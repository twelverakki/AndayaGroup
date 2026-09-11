package auth

import (
	"context"
	"errors"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type Workspace struct {
	BusinessID   *uuid.UUID          `json:"business_id,omitempty"`
	OutletID     *uuid.UUID          `json:"outlet_id,omitempty"`
	BusinessName string              `json:"business_name"`
	OutletName   string              `json:"outlet_name,omitempty"`
	Role         string              `json:"role"` // "owner", "manager", "admin_gudang", "staff"
	BusinessType models.BusinessType `json:"business_type"`
}

type LoginResponse struct {
	User             *models.User          `json:"user"`
	Workspaces       []*Workspace          `json:"workspaces"`
	ActiveContext    *models.ActiveContext `json:"active_context"`
	Token            string                `json:"token,omitempty"` // For API clients
}

// AuthenticateUser verifies user credentials (password or PIN)
func AuthenticateUser(ctx context.Context, phoneOrEmail, password, pin string) (*models.User, error) {
	var user models.User
	var err error

	db := config.DB

	if phoneOrEmail != "" {
		// Login with Phone/Email
		err = db.QueryRow(ctx, 
			"SELECT id, name, phone_or_email, password_hash, pin_hash, status, created_at, updated_at FROM users WHERE phone_or_email = $1", 
			phoneOrEmail,
		).Scan(&user.ID, &user.Name, &user.PhoneOrEmail, &user.PasswordHash, &user.PinHash, &user.Status, &user.CreatedAt, &user.UpdatedAt)
	} else if pin != "" {
		// Login with PIN-only (needs to check if PIN is globally unique)
		// We'll search for the active user who matches the PIN hash. Since we have to scan all, we check PINs.
		// Note: In production, you would fetch active staff PIN hashes and verify. For simplicity in MVP, 
		// we query users and verify. Or we can ask for phone_or_email + PIN.
		// Let's support searching by PIN hash if bcrypt allows or by retrieving all active users with a PIN.
		rows, err := db.Query(ctx, "SELECT id, name, phone_or_email, password_hash, pin_hash, status, created_at, updated_at FROM users WHERE pin_hash IS NOT NULL AND status = 'active'")
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		var found bool
		for rows.Next() {
			var u models.User
			err = rows.Scan(&u.ID, &u.Name, &u.PhoneOrEmail, &u.PasswordHash, &u.PinHash, &u.Status, &u.CreatedAt, &u.UpdatedAt)
			if err != nil {
				continue
			}
			if u.PinHash != nil && bcrypt.CompareHashAndPassword([]byte(*u.PinHash), []byte(pin)) == nil {
				user = u
				found = true
				break
			}
		}

		if !found {
			return nil, errors.New("invalid PIN code")
		}
		err = nil
	} else {
		return nil, errors.New("credentials must be provided")
	}

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	if user.Status == models.StatusInactive {
		return nil, errors.New("account is inactive")
	}

	// Verify Password if provided
	if password != "" {
		if user.PasswordHash == nil {
			return nil, errors.New("password login is not set for this account")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
			return nil, errors.New("invalid password")
		}
	} else if pin != "" && phoneOrEmail != "" {
		// Verify PIN with phone_or_email provided
		if user.PinHash == nil {
			return nil, errors.New("PIN login is not set for this account")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*user.PinHash), []byte(pin)); err != nil {
			return nil, errors.New("invalid PIN code")
		}
	}

	return &user, nil
}

// GetUserWorkspaces fetches all available business/outlet workspaces for a user
func GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*Workspace, error) {
	db := config.DB
	workspaces := []*Workspace{}

	// Check if user is superadmin (Strict check by email)
	var email string
	err := db.QueryRow(ctx, "SELECT phone_or_email FROM users WHERE id = $1", userID).Scan(&email)

	isSuperAdmin := err == nil && (email == "superadmin@andaya.com" || email == "admin@andaya.com")

	if isSuperAdmin {
		workspaces = append(workspaces, &Workspace{
			BusinessName: "Superadmin Control Center",
			Role:         "superadmin",
			BusinessType: "retail",
		})

		// Fetch all businesses as owner role
		bRows, err := db.Query(ctx, "SELECT id, name, type FROM businesses")
		if err == nil {
			for bRows.Next() {
				var ws Workspace
				var bID uuid.UUID
				var bName string
				var bType models.BusinessType
				if err := bRows.Scan(&bID, &bName, &bType); err == nil {
					ws.BusinessID = &bID
					ws.BusinessName = bName
					ws.Role = "owner"
					ws.BusinessType = bType
					workspaces = append(workspaces, &ws)
				}
			}
			bRows.Close()
		}

		// Fetch all outlets with manager, staff, and admin_gudang roles for Superadmin impersonation
		oRows, err := db.Query(ctx, `
			SELECT o.id, o.name, o.business_id, b.name, b.type 
			FROM outlets o
			JOIN businesses b ON o.business_id = b.id
		`)
		if err == nil {
			for oRows.Next() {
				var oID uuid.UUID
				var oName string
				var bID uuid.UUID
				var bName string
				var bType models.BusinessType
				if err := oRows.Scan(&oID, &oName, &bID, &bName, &bType); err == nil {
					workspaces = append(workspaces, &Workspace{
						OutletID:     &oID,
						OutletName:   oName,
						BusinessID:   &bID,
						BusinessName: bName,
						Role:         "manager",
						BusinessType: bType,
					})
					workspaces = append(workspaces, &Workspace{
						OutletID:     &oID,
						OutletName:   oName,
						BusinessID:   &bID,
						BusinessName: bName,
						Role:         "staff",
						BusinessType: bType,
					})
					if bType == "fnb_production" {
						workspaces = append(workspaces, &Workspace{
							OutletID:     &oID,
							OutletName:   oName,
							BusinessID:   &bID,
							BusinessName: bName,
							Role:         "admin_gudang",
							BusinessType: bType,
						})
					}
				}
			}
			oRows.Close()
		}

		// Return superadmin workspaces list directly to avoid duplicate owner queries
		return workspaces, nil
	}

	// 1. Fetch Owner businesses (many-to-many business_owners)
	rows, err := db.Query(ctx, `
		SELECT bo.business_id, bo.outlet_id, b.name, b.type, o.name
		FROM business_owners bo
		LEFT JOIN businesses b ON bo.business_id = b.id
		LEFT JOIN outlets o ON bo.outlet_id = o.id
		WHERE bo.user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var ws Workspace
		var bName *string
		var oName *string
		var bType *models.BusinessType

		err = rows.Scan(&ws.BusinessID, &ws.OutletID, &bName, &bType, &oName)
		if err != nil {
			return nil, err
		}

		ws.Role = "owner"
		if bName != nil {
			ws.BusinessName = *bName
		}
		if oName != nil {
			ws.OutletName = *oName
		}
		if bType != nil {
			ws.BusinessType = *bType
		}

		// Special case: If ownership is assigned at outlet level (e.g. Yasaka franchise)
		if ws.BusinessID == nil && ws.OutletID != nil {
			// Find the parent business of this outlet
			var pBusID uuid.UUID
			var pBusName string
			var pBusType models.BusinessType
			err = db.QueryRow(ctx, `
				SELECT b.id, b.name, b.type FROM outlets o 
				JOIN businesses b ON o.business_id = b.id 
				WHERE o.id = $1
			`, *ws.OutletID).Scan(&pBusID, &pBusName, &pBusType)
			if err == nil {
				ws.BusinessID = &pBusID
				ws.BusinessName = pBusName
				ws.BusinessType = pBusType
			}
		}

		workspaces = append(workspaces, &ws)
	}

	// 2. Fetch Staff/Manager businesses (outlet_staff)
	sRows, err := db.Query(ctx, `
		SELECT os.outlet_id, os.role, o.name, b.id, b.name, b.type
		FROM outlet_staff os
		JOIN outlets o ON os.outlet_id = o.id
		JOIN businesses b ON o.business_id = b.id
		WHERE os.user_id = $1 AND (os.status = 'active' OR os.status IS NULL)
	`, userID)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	for sRows.Next() {
		var ws Workspace
		var role models.StaffRole
		var oID uuid.UUID
		var bID uuid.UUID

		err = sRows.Scan(&oID, &role, &ws.OutletName, &bID, &ws.BusinessName, &ws.BusinessType)
		if err != nil {
			return nil, err
		}

		ws.OutletID = &oID
		ws.BusinessID = &bID
		ws.Role = string(role)
		workspaces = append(workspaces, &ws)
	}

	return workspaces, nil
}

// GenerateJWT generates token with specific active context
func GenerateJWT(userID uuid.UUID, role string, businessID, outletID *uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"role":    role,
		"exp":     time.Now().Add(config.AppConfig.JWTExpiryHours).Unix(),
	}

	if businessID != nil {
		claims["business_id"] = businessID.String()
	}
	if outletID != nil {
		claims["outlet_id"] = outletID.String()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(config.AppConfig.JWTSecret)
}
