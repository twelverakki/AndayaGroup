package purchases

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PurchasesHandler struct {
	service *PurchasesService
}

func NewPurchasesHandler(db *pgxpool.Pool) *PurchasesHandler {
	return &PurchasesHandler{
		service: NewPurchasesService(db),
	}
}

// -------------------------------------------------------------------------
// SUPPLIER HANDLERS
// -------------------------------------------------------------------------

func (h *PurchasesHandler) HandleGetSuppliers(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	status := c.Query("status", "")
	suppliers, err := h.service.GetSuppliers(c.Context(), businessID, status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": suppliers})
}

func (h *PurchasesHandler) HandleCreateSupplier(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	var req CreateSupplierRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	supplier, err := h.service.CreateSupplier(c.Context(), businessID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Supplier berhasil ditambahkan",
		"data":    supplier,
	})
}

func (h *PurchasesHandler) HandleUpdateSupplier(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid supplier ID"})
	}

	var req UpdateSupplierRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	supplier, err := h.service.UpdateSupplier(c.Context(), businessID, id, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "Supplier berhasil diperbarui",
		"data":    supplier,
	})
}

func (h *PurchasesHandler) HandleDeleteSupplier(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid supplier ID"})
	}

	if err := h.service.DeleteSupplier(c.Context(), businessID, id); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Supplier berhasil dihapus"})
}

// -------------------------------------------------------------------------
// PURCHASABLE ITEMS HANDLER
// -------------------------------------------------------------------------

func (h *PurchasesHandler) HandleGetPurchasableItems(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	outletIDStr := c.Query("outlet_id", "")
	if outletIDStr == "" {
		outletIDStr, _ = c.Locals("outlet_id").(string)
	}

	var outletID *uuid.UUID
	if outletIDStr != "" {
		if parsed, err := uuid.Parse(outletIDStr); err == nil && parsed != uuid.Nil {
			outletID = &parsed
		}
	}

	items, err := h.service.GetPurchasableItems(c.Context(), businessID, outletID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": items})
}

// -------------------------------------------------------------------------
// PURCHASE / PO HANDLERS
// -------------------------------------------------------------------------

func (h *PurchasesHandler) HandleGetPurchases(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	role, _ := c.Locals("role").(string)
	var outletIDPtr *uuid.UUID

	// Non-owner / non-superadmin only sees active outlet
	if role != "owner" && role != "superadmin" {
		outletIDStr, _ := c.Locals("outlet_id").(string)
		if oID, err := uuid.Parse(outletIDStr); err == nil {
			outletIDPtr = &oID
		}
	} else {
		// Owner can optionally filter by outlet query
		if oParam := c.Query("outlet_id", ""); oParam != "" && oParam != "all" {
			if oID, err := uuid.Parse(oParam); err == nil {
				outletIDPtr = &oID
			}
		}
	}

	status := c.Query("status", "")
	paymentStatus := c.Query("payment_status", "")
	search := strings.TrimSpace(c.Query("search", ""))

	purchases, err := h.service.GetPurchases(c.Context(), businessID, outletIDPtr, status, paymentStatus, search)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": purchases})
}

func (h *PurchasesHandler) HandleGetPurchaseByID(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid purchase ID"})
	}

	purchase, err := h.service.GetPurchaseByID(c.Context(), businessID, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": purchase})
}

func (h *PurchasesHandler) HandleCreatePurchase(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	outletIDStr, _ := c.Locals("outlet_id").(string)
	defaultOutletID, _ := uuid.Parse(outletIDStr)

	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User context invalid"})
	}

	userRole, _ := c.Locals("role").(string)

	var req CreatePurchaseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	purchase, err := h.service.CreatePurchase(c.Context(), businessID, defaultOutletID, userID, userRole, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Faktur pembelian berhasil dibuat",
		"data":    purchase,
	})
}

func (h *PurchasesHandler) HandleReceivePurchase(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid purchase ID"})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User context invalid"})
	}

	var req ReceivePurchaseRequest
	if err := c.BodyParser(&req); err != nil {
		// Empty body is acceptable for full receipt
		req = ReceivePurchaseRequest{}
	}

	purchase, err := h.service.ReceivePurchase(c.Context(), businessID, id, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "Penerimaan barang berhasil dikonfirmasi dan stok telah bertambah",
		"data":    purchase,
	})
}

func (h *PurchasesHandler) HandleAddPayment(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid purchase ID"})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User context invalid"})
	}

	var req AddPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	payment, err := h.service.AddPurchasePayment(c.Context(), businessID, id, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Pembayaran hutang supplier berhasil dicatat",
		"data":    payment,
	})
}

func (h *PurchasesHandler) HandleGetPayments(c *fiber.Ctx) error {
	businessIDStr, _ := c.Locals("business_id").(string)
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid business ID"})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid purchase ID"})
	}

	payments, err := h.service.GetPurchasePayments(c.Context(), businessID, id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"data": payments})
}
