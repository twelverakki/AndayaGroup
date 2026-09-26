package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type CreateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Pin      string `json:"pin"`
	Status   string `json:"status"`
}

type UpdateUserRequest struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	Status string `json:"status"`
}

type AssignmentsRequest struct {
	Assignments []AssignmentInput `json:"assignments"`
}


func getActorInfo(c *fiber.Ctx) (*uuid.UUID, string, string, string, string) {
	var actorID *uuid.UUID
	if uidStr, ok := c.Locals("user_id").(string); ok && uidStr != "" {
		if id, err := uuid.Parse(uidStr); err == nil {
			actorID = &id
		}
	}
	role, _ := c.Locals("role").(string)
	if role == "" {
		role = "superadmin"
	}
	name, _ := c.Locals("user_name").(string)
	if name == "" {
		if role == "superadmin" {
			name = "Superadmin Central"
		} else {
			name = "System Actor"
		}
	}
	ip := c.IP()
	ua := c.Get("User-Agent")
	return actorID, name, role, ip, ua
}

func checkSuperadmin(c *fiber.Ctx) error {
	role, ok := c.Locals("role").(string)
	if !ok || role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access restricted to superadmin only",
		})
	}
	return nil
}

// HandleGetUsers handles GET /api/v1/admin/users
func HandleGetUsers(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	list, err := ListAllUsers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load users",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleCreateUser handles POST /api/v1/admin/users
func HandleCreateUser(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "User name is required",
		})
	}

	if req.Status == "" {
		req.Status = "active"
	}

	user, err := CreateUser(c.Context(), req.Name, req.Email, req.Password, req.Pin, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create user",
			"error":   err.Error(),
		})
	}

	actorID, actorName, actorRole, ip, ua := getActorInfo(c)
	targetID := user.ID.String()
	_ = LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "USER_CREATED", "user", &targetID, map[string]interface{}{
		"name":   user.Name,
		"email":  user.PhoneOrEmail,
		"status": user.Status,
	}, &ip, &ua)

	return c.Status(fiber.StatusCreated).JSON(user)
}

// HandleUpdateUser handles PUT /api/v1/admin/users/:id
func HandleUpdateUser(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	idStr := c.Params("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid user ID format",
		})
	}

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "User name is required",
		})
	}

	user, err := UpdateUser(c.Context(), userID, req.Name, req.Email, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update user",
			"error":   err.Error(),
		})
	}

	actorID, actorName, actorRole, ip, ua := getActorInfo(c)
	targetID := user.ID.String()
	_ = LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "USER_UPDATED", "user", &targetID, map[string]interface{}{
		"name":   user.Name,
		"email":  user.PhoneOrEmail,
		"status": user.Status,
	}, &ip, &ua)

	return c.JSON(user)
}

// HandleUpdateUserAssignments handles PUT /api/v1/admin/users/:id/assignments
func HandleUpdateUserAssignments(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	idStr := c.Params("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid user ID format",
		})
	}

	var req AssignmentsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	err = UpdateUserAssignments(c.Context(), userID, req.Assignments)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update user assignments",
			"error":   err.Error(),
		})
	}

	actorID, actorName, actorRole, ip, ua := getActorInfo(c)
	_ = LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "USER_ASSIGNMENTS_UPDATED", "user", &idStr, map[string]interface{}{
		"assignments_count": len(req.Assignments),
	}, &ip, &ua)

	return c.JSON(fiber.Map{
		"message": "User assignments updated successfully",
	})
}

// HandleGetBusinesses handles GET /api/v1/admin/businesses
func HandleGetBusinesses(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	list, err := ListAllBusinesses(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load businesses",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleGetOutlets handles GET /api/v1/admin/outlets
func HandleGetOutlets(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	list, err := ListAllOutlets(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load outlets",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleGetSecurityAuditLogs handles GET /api/v1/admin/security-logs
func HandleGetSecurityAuditLogs(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	logs, err := ListSecurityAuditLogs(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load security audit logs",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": logs,
	})
}

// HandleGetOwnersHierarchy handles GET /api/v1/admin/owners
func HandleGetOwnersHierarchy(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	owners, err := GetOwnersWithBusinesses(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to load owners hierarchy",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": owners,
	})
}

type CreateOwnerBusinessRequest struct {
	Name             string  `json:"name"`
	Type             string  `json:"type"`
	HasPos           bool    `json:"has_pos"`
	HasManufacturing bool    `json:"has_manufacturing"`
	HasLogisticsHub  bool    `json:"has_logistics_hub"`
	HasEodUsage      bool    `json:"has_eod_usage"`
	HasMultiOutlets  bool    `json:"has_multi_outlets"`
	InitialOutlet    *string `json:"initial_outlet_name,omitempty"`
}

// HandleCreateBusinessForOwner handles POST /api/v1/admin/owners/:id/businesses
func HandleCreateBusinessForOwner(c *fiber.Ctx) error {
	if err := checkSuperadmin(c); err != nil {
		return err
	}

	ownerIDStr := c.Params("id")
	ownerID, err := uuid.Parse(ownerIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid owner ID format",
		})
	}

	var req CreateOwnerBusinessRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Business name is required",
		})
	}

	if req.Type == "" {
		req.Type = "custom"
	}

	biz, err := CreateBusinessForOwner(
		c.Context(),
		ownerID,
		req.Name,
		req.Type,
		req.HasPos,
		req.HasManufacturing,
		req.HasLogisticsHub,
		req.HasEodUsage,
		req.HasMultiOutlets,
		req.InitialOutlet,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create business for owner",
			"error":   err.Error(),
		})
	}

	actorID, actorName, actorRole, ip, ua := getActorInfo(c)
	targetID := biz.ID.String()
	_ = LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "BUSINESS_CREATED", "business", &targetID, map[string]interface{}{
		"name":              biz.Name,
		"owner_id":          ownerID.String(),
		"has_pos":           biz.HasPos,
		"has_manufacturing": biz.HasManufacturing,
		"has_logistics_hub": biz.HasLogisticsHub,
		"has_eod_usage":     biz.HasEodUsage,
		"has_multi_outlets": biz.HasMultiOutlets,
	}, &ip, &ua)

	return c.Status(fiber.StatusCreated).JSON(biz)
}
