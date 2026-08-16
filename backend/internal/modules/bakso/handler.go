package bakso

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ProductionRequest struct {
	ProductID   uuid.UUID `json:"product_id"`
	QtyProduced float64   `json:"qty_produced"`
}

type DistributionRequest struct {
	ProductID    uuid.UUID `json:"product_id"`
	SentToUserID uuid.UUID `json:"sent_to_user_id"`
	Qty          float64   `json:"qty"`
}

type ThawRequest struct {
	ProductID uuid.UUID `json:"product_id"`
	QtyPacks  float64   `json:"qty_packs"`
}

type QCRequest struct {
	Status string `json:"status"` // pass, discard
}

type ClosingRequest struct {
	ClosingInputs []ClosingInput `json:"closing_inputs"`
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

// HandleCreateProduction Handles POST /api/v1/productions
func HandleCreateProduction(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner or Admin Gudang can log production runs",
		})
	}

	businessID, _, err := getTenantContext(c)
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

	if req.ProductID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Product ID is required",
		})
	}

	if req.QtyProduced <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Quantity produced must be greater than zero",
		})
	}

	prod, err := CreateProduction(c.Context(), businessID, req.ProductID, req.QtyProduced, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create production entry",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(prod)
}

// HandleGetProductions Handles GET /api/v1/productions
func HandleGetProductions(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	list, err := GetProductions(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch productions",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleCreateDistribution Handles POST /api/v1/distributions
func HandleCreateDistribution(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner or Admin Gudang can initiate distribution",
		})
	}

	businessID, _, err := getTenantContext(c)
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

	var req DistributionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.ProductID == uuid.Nil || req.SentToUserID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Product ID and Sent-To User ID are required",
		})
	}

	if req.Qty <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Quantity must be greater than zero",
		})
	}

	dist, err := CreateDistribution(c.Context(), businessID, req.ProductID, req.SentToUserID, req.Qty, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to initiate distribution",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(dist)
}

// HandleReceiveDistribution Handles POST /api/v1/distributions/:id/receive
func HandleReceiveDistribution(c *fiber.Ctx) error {
	idStr := c.Params("id")
	distID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid distribution ID format",
		})
	}

	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	dist, err := ReceiveDistribution(c.Context(), distID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to receive distribution",
			"error":   err.Error(),
		})
	}

	return c.JSON(dist)
}

// HandleGetDistributions Handles GET /api/v1/distributions
func HandleGetDistributions(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
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

	// Filter by current user if they are staff
	role := c.Locals("role").(string)
	var sentToUserID *uuid.UUID
	if role == "staff" {
		sentToUserID = &userID
	} else {
		// Manager/owner can optionally query by staff user_id
		qUser := c.Query("user_id")
		if qUser != "" {
			u, err := uuid.Parse(qUser)
			if err == nil {
				sentToUserID = &u
			}
		}
	}

	list, err := GetDistributions(c.Context(), businessID, sentToUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch distributions",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleThawBatch Handles POST /api/v1/bakso/thaw
func HandleThawBatch(c *fiber.Ctx) error {
	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	var req ThawRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.ProductID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Product ID is required",
		})
	}

	if req.QtyPacks <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Quantity of packs to thaw must be greater than zero",
		})
	}

	err = ThawBatch(c.Context(), userID, req.ProductID, req.QtyPacks)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to thaw batch",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Successfully thawed batch into opened pcs",
	})
}

// HandleQualityCheckBatch Handles POST /api/v1/bakso/batches/:id/qc
func HandleQualityCheckBatch(c *fiber.Ctx) error {
	idStr := c.Params("id")
	batchID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid batch ID format",
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

	var req QCRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.Status != "pass" && req.Status != "discard" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Status must be either 'pass' or 'discard'",
		})
	}

	var oID uuid.UUID
	if outletID != nil {
		oID = *outletID
	}

	err = QualityCheckBatch(c.Context(), batchID, req.Status, userID, businessID, oID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to complete quality check",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Batch quality check processed successfully",
	})
}

// HandleCloseDailyStock Handles POST /api/v1/bakso/closing
func HandleCloseDailyStock(c *fiber.Ctx) error {
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

	var req ClosingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	var oID uuid.UUID
	if outletID != nil {
		oID = *outletID
	}

	err = CloseDailyStock(c.Context(), userID, businessID, oID, req.ClosingInputs)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to log daily closing",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Daily closing stock reported successfully",
	})
}

// HandleGetStockBatches Handles GET /api/v1/bakso/batches
func HandleGetStockBatches(c *fiber.Ctx) error {
	userID, err := getLoggedUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unauthorized user session",
		})
	}

	// Staff gets their own, manager/owner can specify target user_id
	role := c.Locals("role").(string)
	targetUserID := userID
	if role != "staff" {
		qUser := c.Query("user_id")
		if qUser != "" {
			u, err := uuid.Parse(qUser)
			if err == nil {
				targetUserID = u
			}
		}
	}

	list, err := GetStockBatches(c.Context(), targetUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch stock batches",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleGetStockAlerts Handles GET /api/v1/bakso/stock-alerts
func HandleGetStockAlerts(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	list, err := GetStockAlerts(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch stock alerts",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}
