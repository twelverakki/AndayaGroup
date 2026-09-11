package production

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProductionHandler struct {
	Service *ProductionService
}

func NewProductionHandler(db *pgxpool.Pool) *ProductionHandler {
	return &ProductionHandler{
		Service: NewProductionService(db),
	}
}

func getTenantContext(c *fiber.Ctx) (uuid.UUID, *uuid.UUID, error) {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return uuid.Nil, nil, fiber.ErrForbidden
	}

	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return uuid.Nil, nil, fiber.ErrBadRequest
	}

	outletIDStr, _ := c.Locals("outlet_id").(string)
	var outletID *uuid.UUID
	if outletIDStr != "" {
		id, err := uuid.Parse(outletIDStr)
		if err == nil {
			outletID = &id
		}
	}

	return businessID, outletID, nil
}

func getLoggedUserID(c *fiber.Ctx) (uuid.UUID, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return uuid.Nil, fiber.ErrUnauthorized
	}
	return uuid.Parse(userIDStr)
}

func (h *ProductionHandler) HandleCreateProduction(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" && role != "manager" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner, Manager, or Admin Gudang can log production runs",
		})
	}

	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	var req ProductionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.OutletID == nil && outletID != nil {
		req.OutletID = outletID
	}

	res, err := h.Service.CreateProduction(c.Context(), businessID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Production run created successfully",
		"data":    res,
	})
}

func (h *ProductionHandler) HandleGetProductions(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	res, err := h.Service.GetProductions(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": res,
	})
}

func (h *ProductionHandler) HandleCreateEodMaterialUsage(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	var req struct {
		OutletID         *uuid.UUID `json:"outlet_id,omitempty"`
		SettlementID     *uuid.UUID `json:"settlement_id,omitempty"`
		ItemID           uuid.UUID  `json:"item_id"`
		InitialStock     float64    `json:"initial_stock"`
		RestockIn        float64    `json:"restock_in"`
		FinalOpnameStock float64    `json:"final_opname_stock"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	targetOutlet := uuid.Nil
	if req.OutletID != nil && *req.OutletID != uuid.Nil {
		targetOutlet = *req.OutletID
	} else if outletID != nil {
		targetOutlet = *outletID
	}

	if req.ItemID == uuid.Nil || targetOutlet == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "item_id and outlet_id are required"})
	}

	res, err := h.Service.CreateEodMaterialUsage(c.Context(), businessID, targetOutlet, req.SettlementID, req.ItemID, req.InitialStock, req.RestockIn, req.FinalOpnameStock)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": res})
}

func (h *ProductionHandler) HandleGetEodMaterialUsages(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access to business context denied"})
	}

	res, err := h.Service.GetEodMaterialUsages(c.Context(), businessID, outletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": res})
}
