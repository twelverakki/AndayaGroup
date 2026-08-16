package transactions

import (
	"time"

	"andaya-erp/backend/internal/config"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type OpenShiftRequest struct {
	OpeningCash int64 `json:"opening_cash"`
}

type CloseShiftRequest struct {
	ClosingCashActual int64 `json:"closing_cash_actual"`
}

// Helper to extract active tenant workspace IDs and user ID from fiber locals
func getContext(c *fiber.Ctx) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return uuid.Nil, uuid.Nil, uuid.Nil, fiber.ErrUnauthorized
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fiber.ErrBadRequest
	}

	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return uuid.Nil, uuid.Nil, uuid.Nil, fiber.ErrForbidden
	}

	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fiber.ErrBadRequest
	}

	outletIDStr, ok := c.Locals("outlet_id").(string)
	var outletID uuid.UUID
	if !ok || outletIDStr == "" {
		role, _ := c.Locals("role").(string)
		if role == "owner" || role == "superadmin" {
			err = config.DB.QueryRow(c.Context(), "SELECT id FROM outlets WHERE business_id = $1 LIMIT 1", businessID).Scan(&outletID)
			if err != nil {
				return uuid.Nil, uuid.Nil, uuid.Nil, fiber.NewError(fiber.StatusForbidden, "Owner has no outlets configured for this business")
			}
		} else {
			return uuid.Nil, uuid.Nil, uuid.Nil, fiber.ErrForbidden
		}
	} else {
		outletID, err = uuid.Parse(outletIDStr)
		if err != nil {
			return uuid.Nil, uuid.Nil, uuid.Nil, fiber.ErrBadRequest
		}
	}

	return userID, businessID, outletID, nil
}

// HandleGetActiveShift Handles GET /api/v1/shifts/active
func HandleGetActiveShift(c *fiber.Ctx) error {
	userID, _, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	shift, err := GetActiveShift(c.Context(), userID, outletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to check active shift",
			"error":   err.Error(),
		})
	}

	if shift == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "No active open shift found for this session",
		})
	}

	return c.JSON(shift)
}

// HandleOpenShift Handles POST /api/v1/shifts/open
func HandleOpenShift(c *fiber.Ctx) error {
	userID, _, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	var req OpenShiftRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	shift, err := OpenShift(c.Context(), outletID, userID, req.OpeningCash)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(shift)
}

// HandleCloseShift Handles POST /api/v1/shifts/close
func HandleCloseShift(c *fiber.Ctx) error {
	userID, _, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	var req CloseShiftRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	// Fetch current open shift
	active, err := GetActiveShift(c.Context(), userID, outletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to check active shift",
		})
	}
	if active == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "You do not have any open shift to close",
		})
	}

	shift, err := CloseShift(c.Context(), active.ID, req.ClosingCashActual)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to close shift",
			"error":   err.Error(),
		})
	}

	return c.JSON(shift)
}

// HandleCreateTransaction Handles POST /api/v1/transactions
func HandleCreateTransaction(c *fiber.Ctx) error {
	userID, businessID, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	var req CreateTxInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.ClientUUID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "client_uuid is required for transaction synchronization",
		})
	}

	if len(req.Items) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Transaction must contain at least one item",
		})
	}

	tx, err := CreateTransaction(c.Context(), businessID, outletID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(tx)
}

// HandleGetTransactions Handles GET /api/v1/transactions
func HandleGetTransactions(c *fiber.Ctx) error {
	userID, _, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	// Optional shift_id query param
	var shiftID *uuid.UUID
	shiftIDStr := c.Query("shift_id")
	if shiftIDStr != "" {
		if sID, err := uuid.Parse(shiftIDStr); err == nil {
			shiftID = &sID
		}
	} else if c.Query("active_shift") == "true" {
		active, _ := GetActiveShift(c.Context(), userID, outletID)
		if active != nil {
			shiftID = &active.ID
		}
	}

	list, err := GetTransactions(c.Context(), outletID, shiftID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch transactions",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleVoidTransaction Handles POST /api/v1/transactions/:id/void
func HandleVoidTransaction(c *fiber.Ctx) error {
	userID, _, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	txIDStr := c.Params("id")
	txID, err := uuid.Parse(txIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid transaction ID format",
		})
	}

	var req VoidTxInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.ManagerPIN == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Manager PIN is required to authorize void",
		})
	}

	tx, err := VoidTransaction(c.Context(), txID, outletID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(tx)
}

// HandleGetSalesReport Handles GET /api/v1/reports/sales
func HandleGetSalesReport(c *fiber.Ctx) error {
	_, businessID, outletID, err := getContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	var outletIDPtr *uuid.UUID
	if c.Query("all_outlets") != "true" {
		outletIDPtr = &outletID
	}

	var startDatePtr *time.Time
	if startStr := c.Query("start_date"); startStr != "" {
		if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startDatePtr = &t
		}
	}

	var endDatePtr *time.Time
	if endStr := c.Query("end_date"); endStr != "" {
		if t, err := time.Parse("2006-01-02", endStr); err == nil {
			endOfDay := t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			endDatePtr = &endOfDay
		}
	}

	paymentMethod := c.Query("payment_method")
	txType := c.Query("type")

	summary, err := GetSalesReportSummary(c.Context(), businessID, outletIDPtr, startDatePtr, endDatePtr, paymentMethod, txType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate sales report summary",
			"error":   err.Error(),
		})
	}

	return c.JSON(summary)
}

