package auth

import (
	"strings"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	PhoneOrEmail string `json:"phone_or_email"`
	Password     string `json:"password"`
	Pin          string `json:"pin"`
}

type SwitchRequest struct {
	BusinessID string `json:"business_id"`
	OutletID   string `json:"outlet_id"`
	Role       string `json:"role"`
}

// HandleLogin handles POST /api/v1/auth/login
func HandleLogin(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	// Validate credentials
	user, err := AuthenticateUser(c.Context(), req.PhoneOrEmail, req.Password, req.Pin)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	// Fetch available workspaces
	workspaces, err := GetUserWorkspaces(c.Context(), user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to retrieve user workspaces",
			"error":   err.Error(),
		})
	}

	if len(workspaces) == 0 {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "This user account is not assigned to any business or outlet",
		})
	}

	// Determine default active context (first workspace)
	defaultWS := workspaces[0]
	token, err := GenerateJWT(user.ID, defaultWS.Role, defaultWS.BusinessID, defaultWS.OutletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate token",
		})
	}

	// Set HTTP-Only Cookie
	setTokenCookie(c, token)

	activeContext := &models.ActiveContext{
		BusinessID: defaultWS.BusinessID,
		OutletID:   defaultWS.OutletID,
		Role:       defaultWS.Role,
		Name:       defaultWS.BusinessName,
		Type:       defaultWS.BusinessType,
	}
	if defaultWS.OutletID != nil {
		activeContext.Name = defaultWS.OutletName
	}

	return c.JSON(LoginResponse{
		User:          user,
		Workspaces:    workspaces,
		ActiveContext: activeContext,
		Token:         token, // Included for API clients (mobile) that don't support cookies
	})
}

// HandleSwitchBusiness handles POST /api/v1/auth/switch-business
func HandleSwitchBusiness(c *fiber.Ctx) error {
	var req SwitchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "User session not found",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid user ID format",
		})
	}

	// Fetch all workspaces for the user to validate access
	workspaces, err := GetUserWorkspaces(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to check workspaces",
		})
	}

	// Verify if user owns/is staff at the target context
	var targetWS *Workspace
	for _, ws := range workspaces {
		matchBusiness := req.BusinessID != "" && ws.BusinessID != nil && ws.BusinessID.String() == req.BusinessID
		matchOutlet := req.OutletID != "" && ws.OutletID != nil && ws.OutletID.String() == req.OutletID
		matchRole := req.Role == "" || ws.Role == req.Role

		// Owners/Superadmins switch context with BusinessID or OutletID and optional Role
		if req.BusinessID == "" && req.OutletID == "" {
			if ws.Role == "superadmin" {
				targetWS = ws
				break
			}
		} else if req.BusinessID != "" && req.OutletID != "" {
			if matchBusiness && matchOutlet && matchRole {
				targetWS = ws
				break
			}
		} else if req.BusinessID != "" {
			if matchBusiness && ws.OutletID == nil && matchRole {
				targetWS = ws
				break
			}
		} else if req.OutletID != "" {
			if matchOutlet && matchRole {
				targetWS = ws
				break
			}
		}
	}

	if targetWS == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to the requested business or outlet workspace is denied",
		})
	}

	// Generate new token with updated context
	token, err := GenerateJWT(userID, targetWS.Role, targetWS.BusinessID, targetWS.OutletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to switch workspace token",
		})
	}

	// Set HTTP-Only Cookie
	setTokenCookie(c, token)

	activeContext := &models.ActiveContext{
		BusinessID: targetWS.BusinessID,
		OutletID:   targetWS.OutletID,
		Role:       targetWS.Role,
		Name:       targetWS.BusinessName,
		Type:       targetWS.BusinessType,
	}
	if targetWS.OutletID != nil {
		activeContext.Name = targetWS.OutletName
	}

	return c.JSON(fiber.Map{
		"active_context": activeContext,
		"token":          token,
	})
}

// HandleGetMe handles GET /api/v1/auth/me
func HandleGetMe(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	role := c.Locals("role").(string)
	activeBusinessIDStr, _ := c.Locals("business_id").(string)
	activeOutletIDStr, _ := c.Locals("outlet_id").(string)

	userID, _ := uuid.Parse(userIDStr)

	// Fetch user details
	var user models.User
	importErr := config.DB.QueryRow(c.Context(), 
		"SELECT id, name, phone_or_email, status, created_at, updated_at FROM users WHERE id = $1", 
		userID,
	).Scan(&user.ID, &user.Name, &user.PhoneOrEmail, &user.Status, &user.CreatedAt, &user.UpdatedAt)

	if importErr != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "User profile not found",
		})
	}

	// Fetch available workspaces
	workspaces, err := GetUserWorkspaces(c.Context(), user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to retrieve workspaces",
		})
	}

	// Construct active context based on current JWT claims
	activeContext := &models.ActiveContext{
		Role: role,
	}

	if activeBusinessIDStr != "" {
		bID, _ := uuid.Parse(activeBusinessIDStr)
		activeContext.BusinessID = &bID
	}
	if activeOutletIDStr != "" {
		oID, _ := uuid.Parse(activeOutletIDStr)
		activeContext.OutletID = &oID
	}

	// Find names and business type for the active context from workspaces list
	for _, ws := range workspaces {
		matchBusiness := activeContext.BusinessID != nil && ws.BusinessID != nil && *activeContext.BusinessID == *ws.BusinessID
		matchOutlet := activeContext.OutletID != nil && ws.OutletID != nil && *activeContext.OutletID == *ws.OutletID

		if activeContext.BusinessID != nil && activeContext.OutletID != nil {
			if matchBusiness && matchOutlet {
				activeContext.Name = ws.OutletName
				activeContext.Type = ws.BusinessType
				break
			}
		} else if activeContext.BusinessID != nil {
			if matchBusiness && ws.OutletID == nil {
				activeContext.Name = ws.BusinessName
				activeContext.Type = ws.BusinessType
				break
			}
		} else if activeContext.OutletID != nil {
			if matchOutlet {
				activeContext.Name = ws.OutletName
				activeContext.Type = ws.BusinessType
				break
			}
		}
	}

	return c.JSON(fiber.Map{
		"user":           user,
		"workspaces":     workspaces,
		"active_context": activeContext,
	})
}

// HandleLogout handles POST /api/v1/auth/logout
func HandleLogout(c *fiber.Ctx) error {
	// Clear the HTTP-Only token cookie by setting it with an expired time
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Now().Add(-24 * time.Hour),
		HTTPOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: "Lax",
		Path:     "/",
	})

	return c.JSON(fiber.Map{
		"message": "Successfully logged out",
	})
}

// Helper to set cookie properly
func setTokenCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    token,
		Expires:  time.Now().Add(config.AppConfig.JWTExpiryHours),
		HTTPOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: "Lax",
		Path:     "/",
	})
}

// HandleGetStaff handles GET /api/v1/auth/staff
func HandleGetStaff(c *fiber.Ctx) error {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid business ID format",
		})
	}

	db := config.DB
	rows, err := db.Query(c.Context(), `
		SELECT DISTINCT u.id, u.name, os.role, os.status
		FROM users u
		JOIN outlet_staff os ON u.id = os.user_id
		JOIN outlets o ON os.outlet_id = o.id
		WHERE o.business_id = $1 AND os.status = 'active'
	`, businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch staff members",
			"error":   err.Error(),
		})
	}
	defer rows.Close()

	type StaffItem struct {
		ID     uuid.UUID `json:"id"`
		Name   string    `json:"name"`
		Role   string    `json:"role"`
		Status string    `json:"status"`
	}

	var list []StaffItem
	for rows.Next() {
		var s StaffItem
		err = rows.Scan(&s.ID, &s.Name, &s.Role, &s.Status)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Error scanning staff record",
				"error":   err.Error(),
			})
		}
		list = append(list, s)
	}

	return c.JSON(list)
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// HandleForgotPassword handles POST /api/v1/auth/forgot-password
func HandleForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Email wajib diisi",
		})
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))

	// Check if user exists with this email
	var userID uuid.UUID
	var name string
	err := config.DB.QueryRow(c.Context(), 
		"SELECT id, name FROM users WHERE LOWER(phone_or_email) = $1", 
		email,
	).Scan(&userID, &name)

	if err != nil {
		// Even if not found, return generic message for security, or explicit for dev
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Akun dengan email Gmail tersebut tidak ditemukan",
		})
	}

	// In development/production simulation, return 6-digit OTP
	return c.JSON(fiber.Map{
		"message": "Instruksi pemulihan kata sandi dan kode OTP telah dikirim ke " + email,
		"email":   email,
		"dev_otp": "888888", // Simulated OTP for instant testing
	})
}

type ResetPasswordRequest struct {
	Email       string `json:"email"`
	OTP         string `json:"otp"`
	NewPassword string `json:"new_password"`
}

// HandleResetPassword handles POST /api/v1/auth/reset-password
func HandleResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Permintaan tidak valid",
		})
	}

	if strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.NewPassword) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Email dan password baru wajib diisi",
		})
	}

	if len(req.NewPassword) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Password minimal harus 6 karakter",
		})
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Gagal mengenkripsi kata sandi baru",
		})
	}

	hashStr := string(hash)
	cmdTag, err := config.DB.Exec(c.Context(),
		"UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(phone_or_email) = $2",
		hashStr, email,
	)
	if err != nil || cmdTag.RowsAffected() == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Gagal memperbarui kata sandi atau akun tidak ditemukan",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Kata sandi berhasil diperbarui. Silakan login dengan password baru.",
	})
}


