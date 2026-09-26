package organization

import (
	"andaya-erp/backend/internal/models"
	"andaya-erp/backend/internal/modules/admin"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)


func getOrgActorInfo(c *fiber.Ctx) (*uuid.UUID, string, string, string, string) {
	var actorID *uuid.UUID
	if uidStr, ok := c.Locals("user_id").(string); ok && uidStr != "" {
		if id, err := uuid.Parse(uidStr); err == nil {
			actorID = &id
		}
	}
	role, _ := c.Locals("role").(string)
	if role == "" {
		role = "owner"
	}
	name, _ := c.Locals("user_name").(string)
	if name == "" {
		if role == "superadmin" {
			name = "Superadmin Central"
		} else if role == "owner" {
			name = "Business Owner"
		} else {
			name = "Manager / Staff"
		}
	}
	ip := c.IP()
	ua := c.Get("User-Agent")
	return actorID, name, role, ip, ua
}

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func getTenantContext(c *fiber.Ctx) (uuid.UUID, *uuid.UUID, error) {
	role, _ := c.Locals("role").(string)

	// 1. Check if business_id was passed via query parameter (useful for Superadmin)
	if queryBiz := c.Query("business_id"); queryBiz != "" {
		if bID, err := uuid.Parse(queryBiz); err == nil {
			var outletID *uuid.UUID
			if outletParam := c.Query("outlet_id"); outletParam != "" {
				if oID, err := uuid.Parse(outletParam); err == nil {
					outletID = &oID
				}
			}
			return bID, outletID, nil
		}
	}

	// 2. Check business_id from JWT Locals
	businessIDStr, ok := c.Locals("business_id").(string)
	if ok && businessIDStr != "" {
		businessID, err := uuid.Parse(businessIDStr)
		if err == nil {
			outletIDStr, _ := c.Locals("outlet_id").(string)
			var outletID *uuid.UUID
			if outletParam := c.Query("outlet_id"); outletParam != "" {
				if oID, err := uuid.Parse(outletParam); err == nil {
					outletID = &oID
				}
			} else if outletIDStr != "" {
				if id, err := uuid.Parse(outletIDStr); err == nil {
					outletID = &id
				}
			}
			return businessID, outletID, nil
		}
	}

	// 3. If role is superadmin, fallback to first available business
	if role == "superadmin" {
		businesses, err := (c.Locals("service").(Service)).GetAllBusinesses(c.Context())
		if err == nil && len(businesses) > 0 {
			return businesses[0].ID, nil, nil
		}
	}

	return uuid.Nil, nil, fiber.ErrForbidden
}

// Helper for Handler to resolve businessID safely
func (h *Handler) resolveBusinessContext(c *fiber.Ctx) (uuid.UUID, *uuid.UUID, error) {
	role, _ := c.Locals("role").(string)

	// Query param takes priority
	if queryBiz := c.Query("business_id"); queryBiz != "" {
		if bID, err := uuid.Parse(queryBiz); err == nil {
			var outletID *uuid.UUID
			if outletParam := c.Query("outlet_id"); outletParam != "" {
				if oID, err := uuid.Parse(outletParam); err == nil {
					outletID = &oID
				}
			}
			return bID, outletID, nil
		}
	}

	// JWT Locals
	businessIDStr, ok := c.Locals("business_id").(string)
	if ok && businessIDStr != "" {
		if businessID, err := uuid.Parse(businessIDStr); err == nil {
			var outletID *uuid.UUID
			if outletParam := c.Query("outlet_id"); outletParam != "" {
				if oID, err := uuid.Parse(outletParam); err == nil {
					outletID = &oID
				}
			} else if outletIDStr, ok := c.Locals("outlet_id").(string); ok && outletIDStr != "" {
				if id, err := uuid.Parse(outletIDStr); err == nil {
					outletID = &id
				}
			}
			return businessID, outletID, nil
		}
	}

	// Superadmin fallback to first business if available
	if role == "superadmin" {
		businesses, err := h.service.GetAllBusinesses(c.Context())
		if err == nil && len(businesses) > 0 {
			return businesses[0].ID, nil, nil
		}
	}

	return uuid.Nil, nil, fiber.ErrForbidden
}

// GetAllBusinesses returns all businesses or businesses scoped to the user
func (h *Handler) GetAllBusinesses(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	userIDStr, _ := c.Locals("user_id").(string)
	businessIDStr, _ := c.Locals("business_id").(string)

	var userID *uuid.UUID
	if uid, err := uuid.Parse(userIDStr); err == nil {
		userID = &uid
	}

	var businessID *uuid.UUID
	if bid, err := uuid.Parse(businessIDStr); err == nil {
		businessID = &bid
	}

	businesses, err := h.service.GetBusinessesForUser(c.Context(), userID, role, businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": businesses})
}

// GetStaff returns the list of staff in the active business/outlet
func (h *Handler) GetStaff(c *fiber.Ctx) error {
	businessID, outletID, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	staff, err := h.service.GetStaffMembers(c.Context(), businessID, outletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": staff})
}

// CreateStaff creates a new staff account under an outlet
func (h *Handler) CreateStaff(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can manage staff accounts"})
	}

	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	var req models.CreateStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if req.Name == "" || req.PhoneOrEmail == "" || req.PIN == "" || req.OutletID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, phone_or_email, pin, and outlet_id are required"})
	}

	if req.Password == "" {
		req.Password = req.PIN // default password to PIN if empty
	}
	if req.Role == "" {
		req.Role = models.RoleStaff
	}

	staff, err := h.service.CreateStaffMember(c.Context(), businessID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	actorID, actorName, actorRole, ip, ua := getOrgActorInfo(c)
	targetID := staff.ID.String()
	_ = admin.LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "STAFF_CREATED", "user", &targetID, map[string]interface{}{
		"name":        staff.Name,
		"email":       staff.PhoneOrEmail,
		"role":        staff.Role,
		"outlet_id":   staff.OutletID.String(),
		"business_id": businessID.String(),
	}, &ip, &ua)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": staff})
}

// UpdateStaff updates staff status, role, PIN, or details
func (h *Handler) UpdateStaff(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can manage staff accounts"})
	}

	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	staffID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid staff ID"})
	}

	var req models.UpdateStaffRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if err := h.service.UpdateStaffMember(c.Context(), businessID, staffID, req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	actorID, actorName, actorRole, ip, ua := getOrgActorInfo(c)
	targetID := staffID.String()
	actionName := "STAFF_UPDATED"
	if req.PIN != nil && *req.PIN != "" {
		actionName = "PIN_RESET"
	} else if req.Status != nil && *req.Status != "" {
		actionName = "STAFF_STATUS_CHANGED"
	}

	details := map[string]interface{}{
		"business_id": businessID.String(),
		"staff_id":    targetID,
	}
	if req.Role != nil {
		details["new_role"] = *req.Role
	}
	if req.Status != nil {
		details["new_status"] = *req.Status
	}
	if req.OutletID != nil {
		details["new_outlet_id"] = req.OutletID.String()
	}

	_ = admin.LogSecurityEvent(c.Context(), actorID, actorName, actorRole, actionName, "user", &targetID, details, &ip, &ua)

	return c.JSON(fiber.Map{"message": "Staff updated successfully"})
}

// GetOutlets returns the list of outlets for the active business or all outlets
func (h *Handler) GetOutlets(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	var businessIDPtr *uuid.UUID

	if queryBiz := c.Query("business_id"); queryBiz != "" {
		if bID, err := uuid.Parse(queryBiz); err == nil {
			businessIDPtr = &bID
		}
	} else if businessIDStr, ok := c.Locals("business_id").(string); ok && businessIDStr != "" {
		if bID, err := uuid.Parse(businessIDStr); err == nil {
			businessIDPtr = &bID
		}
	} else if role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	outlets, err := h.service.GetOutlets(c.Context(), businessIDPtr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": outlets})
}

// CreateOutlet creates a new outlet under the active business
func (h *Handler) CreateOutlet(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can create outlets"})
	}

	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	var req struct {
		Name    string  `json:"name"`
		Address *string `json:"address,omitempty"`
		IsMain  bool    `json:"is_main"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	outlet, err := h.service.CreateOutlet(c.Context(), businessID, req.Name, req.Address, req.IsMain)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": outlet})
}

// UpdateCapabilities updates the capability flags of the business
func (h *Handler) UpdateCapabilities(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can update business capabilities"})
	}

	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	var req models.UpdateBusinessCapabilitiesRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	if err := h.service.UpdateBusinessCapabilities(c.Context(), businessID, req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	actorID, actorName, actorRole, ip, ua := getOrgActorInfo(c)
	targetID := businessID.String()
	_ = admin.LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "CAPABILITY_FLAGS_UPDATED", "business", &targetID, map[string]interface{}{
		"business_id":       targetID,
		"has_pos":           req.HasPos,
		"has_manufacturing": req.HasManufacturing,
		"has_logistics_hub": req.HasLogisticsHub,
		"has_eod_usage":     req.HasEodUsage,
		"has_multi_outlets": req.HasMultiOutlets,
	}, &ip, &ua)

	return c.JSON(fiber.Map{"message": "Business capabilities updated successfully"})
}

// GetBusinessProfile returns profile and capability flags of the active business
func (h *Handler) GetBusinessProfile(c *fiber.Ctx) error {
	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	profile, err := h.service.GetBusinessProfile(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": profile})
}

// GetAuditLogs returns the override audit trail logs
func (h *Handler) GetAuditLogs(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	var businessIDPtr *uuid.UUID

	if queryBiz := c.Query("business_id"); queryBiz != "" {
		if bID, err := uuid.Parse(queryBiz); err == nil {
			businessIDPtr = &bID
		}
	} else if businessIDStr, ok := c.Locals("business_id").(string); ok && businessIDStr != "" {
		if bID, err := uuid.Parse(businessIDStr); err == nil {
			businessIDPtr = &bID
		}
	} else if role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	logs, err := h.service.GetAuditLogs(c.Context(), businessIDPtr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": logs})
}

// CreateBusiness creates a new business entity for Owner or Superadmin
func (h *Handler) CreateBusiness(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can create businesses"})
	}

	actorID, actorName, actorRole, ip, ua := getOrgActorInfo(c)
	if actorID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}

	var req struct {
		Name             string  `json:"name"`
		Type             string  `json:"type"`
		HasPos           bool    `json:"has_pos"`
		HasManufacturing bool    `json:"has_manufacturing"`
		HasLogisticsHub  bool    `json:"has_logistics_hub"`
		HasEodUsage      bool    `json:"has_eod_usage"`
		HasMultiOutlets  bool    `json:"has_multi_outlets"`
		InitialOutlet    *string `json:"initial_outlet_name,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	if req.Type == "" {
		req.Type = "custom"
	}

	biz, err := h.service.CreateBusiness(
		c.Context(),
		*actorID,
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	targetID := biz.ID.String()
	_ = admin.LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "BUSINESS_CREATED", "business", &targetID, map[string]interface{}{
		"name":              biz.Name,
		"owner_id":          actorID.String(),
		"has_pos":           biz.HasPos,
		"has_manufacturing": biz.HasManufacturing,
		"has_logistics_hub": biz.HasLogisticsHub,
		"has_eod_usage":     biz.HasEodUsage,
		"has_multi_outlets": biz.HasMultiOutlets,
	}, &ip, &ua)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": biz})
}

// UpdateBusinessProfile updates brand identity, contact, and tax settings
func (h *Handler) UpdateBusinessProfile(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can update business profile"})
	}

	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	var req struct {
		Name       string  `json:"name"`
		Phone      *string `json:"phone,omitempty"`
		Email      *string `json:"email,omitempty"`
		TaxID      *string `json:"tax_id,omitempty"`
		TaxRatePct float64 `json:"tax_rate_pct"`
	}

	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name is required"})
	}

	biz, err := h.service.UpdateBusinessProfile(c.Context(), businessID, req.Name, req.Phone, req.Email, req.TaxID, req.TaxRatePct)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	actorID, actorName, actorRole, ip, ua := getOrgActorInfo(c)
	targetID := businessID.String()
	_ = admin.LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "BUSINESS_PROFILE_UPDATED", "business", &targetID, map[string]interface{}{
		"name":         biz.Name,
		"phone":        biz.Phone,
		"email":        biz.Email,
		"tax_id":       biz.TaxID,
		"tax_rate_pct": biz.TaxRatePct,
	}, &ip, &ua)

	return c.JSON(fiber.Map{"data": biz, "message": "Profil bisnis berhasil diperbarui"})
}

// UpdateOutletDetails updates physical branch details
func (h *Handler) UpdateOutletDetails(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)
	if role != "owner" && role != "superadmin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Superadmin can edit outlets"})
	}

	businessID, _, err := h.resolveBusinessContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	outletID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid outlet ID format"})
	}

	var req struct {
		Name          string  `json:"name"`
		Address       *string `json:"address,omitempty"`
		Phone         *string `json:"phone,omitempty"`
		ReceiptFooter *string `json:"receipt_footer,omitempty"`
		IsMain        *bool   `json:"is_main,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Outlet name is required"})
	}

	outlet, err := h.service.UpdateOutlet(c.Context(), businessID, outletID, req.Name, req.Address, req.Phone, req.ReceiptFooter, req.IsMain)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	actorID, actorName, actorRole, ip, ua := getOrgActorInfo(c)
	targetID := outletID.String()
	_ = admin.LogSecurityEvent(c.Context(), actorID, actorName, actorRole, "OUTLET_UPDATED", "outlet", &targetID, map[string]interface{}{
		"name":           outlet.Name,
		"address":        outlet.Address,
		"phone":          outlet.Phone,
		"receipt_footer": outlet.ReceiptFooter,
	}, &ip, &ua)

	return c.JSON(fiber.Map{"data": outlet, "message": "Data cabang berhasil diperbarui"})
}
