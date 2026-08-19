package products

import (
	"os"
	"path/filepath"
	"time"

	"andaya-erp/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ProductRequest struct {
	SKU           *string  `json:"sku"`
	Name          string   `json:"name"`
	Category      *string  `json:"category"`
	UnitType      string   `json:"unit_type"`
	InventoryMode string   `json:"inventory_mode"`
	PurchasePrice int64    `json:"purchase_price"`
	SellPrice     int64    `json:"sell_price"`
	CurrentStock  float64  `json:"current_stock"`
	MinStockAlert *float64 `json:"min_stock_alert"`
	Status        string   `json:"status"`
	ImageURL      *string  `json:"image_url"`
}

// Helper to extract active tenant workspace IDs from fiber locals
func getTenantContext(c *fiber.Ctx) (uuid.UUID, *uuid.UUID, error) {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		// Scoped by outlet ownership (Yasaka franchise) might have only outlet_id
		outletIDStr, _ := c.Locals("outlet_id").(string)
		if outletIDStr != "" {
			outletID, err := uuid.Parse(outletIDStr)
			if err == nil {
				// We don't have businessID directly here, we retrieve it downstream or fallback
				return uuid.Nil, &outletID, nil
			}
		}
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

// HandleGetProducts Handles GET /api/v1/products
func HandleGetProducts(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	statusFilter := c.Query("status", "active")

	list, err := GetProducts(c.Context(), businessID, outletID, statusFilter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch products",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleGetProductByID Handles GET /api/v1/products/:id
func HandleGetProductByID(c *fiber.Ctx) error {
	idStr := c.Params("id")
	productID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid product ID format",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	product, err := GetProductByID(c.Context(), productID, businessID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(product)
}

// HandleCreateProduct Handles POST /api/v1/products
func HandleCreateProduct(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	var req ProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Product name is required",
		})
	}

	// Validate Enums
	if req.UnitType == "" {
		req.UnitType = string(models.UnitPcs)
	}
	if req.InventoryMode == "" {
		req.InventoryMode = string(models.ModeDryStrict)
	}

	if req.Status == "" {
		req.Status = "active"
	}

	product := &models.Product{
		BusinessID:    businessID,
		OutletID:      outletID,
		SKU:           req.SKU,
		Name:          req.Name,
		Category:      req.Category,
		UnitType:      models.UnitType(req.UnitType),
		InventoryMode: models.InventoryMode(req.InventoryMode),
		PurchasePrice: req.PurchasePrice,
		SellPrice:     req.SellPrice,
		CurrentStock:  req.CurrentStock,
		MinStockAlert: req.MinStockAlert,
		Status:        models.UserStatus(req.Status),
		ImageURL:      req.ImageURL,
	}

	created, err := CreateProduct(c.Context(), product)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create product",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(created)
}

// HandleUpdateProduct Handles PUT /api/v1/products/:id
func HandleUpdateProduct(c *fiber.Ctx) error {
	idStr := c.Params("id")
	productID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid product ID format",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	var req ProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Product name is required",
		})
	}

	if req.Status == "" {
		req.Status = "active"
	}

	product := &models.Product{
		ID:            productID,
		BusinessID:    businessID,
		SKU:           req.SKU,
		Name:          req.Name,
		Category:      req.Category,
		UnitType:      models.UnitType(req.UnitType),
		InventoryMode: models.InventoryMode(req.InventoryMode),
		PurchasePrice: req.PurchasePrice,
		SellPrice:     req.SellPrice,
		CurrentStock:  req.CurrentStock,
		MinStockAlert: req.MinStockAlert,
		Status:        models.UserStatus(req.Status),
		ImageURL:      req.ImageURL,
	}

	updated, err := UpdateProduct(c.Context(), product)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update product",
			"error":   err.Error(),
		})
	}

	return c.JSON(updated)
}

// HandleDeleteProduct Handles DELETE /api/v1/products/:id
func HandleDeleteProduct(c *fiber.Ctx) error {
	idStr := c.Params("id")
	productID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid product ID format",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	err = SoftDeleteProduct(c.Context(), productID, businessID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Product successfully deleted",
	})
}

// =========================================================================
// WASTAGE LOG / OPNAME HANDLERS
// =========================================================================

type CreateWastageRequest struct {
	ProductID           *uuid.UUID `json:"product_id"`
	IngredientID         *uuid.UUID `json:"ingredient_id"`
	DailyMaterialLogID *uuid.UUID `json:"daily_material_log_id"`
	ActualQty           float64    `json:"actual_qty"`
}

type WastageLogResponse struct {
	ID                 uuid.UUID            `json:"id"`
	BusinessID         uuid.UUID            `json:"business_id"`
	OutletID           uuid.UUID            `json:"outlet_id"`
	ProductID          *uuid.UUID           `json:"product_id,omitempty"`
	IngredientID       *uuid.UUID           `json:"ingredient_id,omitempty"`
	DailyMaterialLogID *uuid.UUID           `json:"daily_material_log_id,omitempty"`
	ExpectedQty        *float64             `json:"expected_qty,omitempty"`
	ActualQty          float64              `json:"actual_qty"`
	Discrepancy        *float64             `json:"discrepancy,omitempty"`
	InputBy            uuid.UUID            `json:"input_by"`
	Status             models.WastageStatus `json:"status"`
	ApprovedBy         *uuid.UUID           `json:"approved_by,omitempty"`
	ApprovedAt         *time.Time           `json:"approved_at,omitempty"`
	CreatedAt          time.Time            `json:"created_at"`
	UpdatedAt          time.Time            `json:"updated_at"`
}

func mapWastageLog(w *models.WastageLog, role string) WastageLogResponse {
	res := WastageLogResponse{
		ID:                 w.ID,
		BusinessID:         w.BusinessID,
		OutletID:           w.OutletID,
		ProductID:          w.ProductID,
		IngredientID:       w.IngredientID,
		DailyMaterialLogID: w.DailyMaterialLogID,
		ActualQty:          w.ActualQty,
		InputBy:            w.InputBy,
		Status:             w.Status,
		ApprovedBy:         w.ApprovedBy,
		ApprovedAt:         w.ApprovedAt,
		CreatedAt:          w.CreatedAt,
		UpdatedAt:          w.UpdatedAt,
	}

	// Hide ExpectedQty and Discrepancy for staff if log is pending_approval (D-10)
	if role == "staff" && w.Status == models.WastagePending {
		res.ExpectedQty = nil
		res.Discrepancy = nil
	} else {
		eq := w.ExpectedQty
		dc := w.Discrepancy
		res.ExpectedQty = &eq
		res.Discrepancy = &dc
	}

	return res
}

// HandleGetWastageLogs Handles GET /api/v1/wastage-logs
func HandleGetWastageLogs(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	list, err := GetWastageLogs(c.Context(), businessID, outletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch wastage logs",
			"error":   err.Error(),
		})
	}

	role, _ := c.Locals("role").(string)
	responseList := make([]WastageLogResponse, len(list))
	for i, w := range list {
		responseList[i] = mapWastageLog(w, role)
	}

	return c.JSON(responseList)
}

// HandleCreateWastageLog Handles POST /api/v1/wastage-logs (Blind Count Opname Submit)
func HandleCreateWastageLog(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	if outletID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Outlet context must be selected to submit opname",
		})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "User session not found",
		})
	}
	userID, _ := uuid.Parse(userIDStr)

	var req CreateWastageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	log := &models.WastageLog{
		BusinessID:         businessID,
		OutletID:           *outletID,
		ProductID:          req.ProductID,
		IngredientID:       req.IngredientID,
		DailyMaterialLogID: req.DailyMaterialLogID,
		ActualQty:           req.ActualQty,
		InputBy:            userID,
	}

	created, err := CreateWastageLog(c.Context(), log)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	role, _ := c.Locals("role").(string)
	return c.Status(fiber.StatusCreated).JSON(mapWastageLog(created, role))
}

// HandleApproveWastageLog Handles POST /api/v1/wastage-logs/:id/approve
func HandleApproveWastageLog(c *fiber.Ctx) error {
	idStr := c.Params("id")
	logID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid log ID format",
		})
	}

	role, _ := c.Locals("role").(string)
	if role != "manager" && role != "owner" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only managers or owners can approve opname discrepancy logs",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	approved, err := ApproveWastageLog(c.Context(), logID, businessID, userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(approved)
}

// HandleRejectWastageLog Handles POST /api/v1/wastage-logs/:id/reject
func HandleRejectWastageLog(c *fiber.Ctx) error {
	idStr := c.Params("id")
	logID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid log ID format",
		})
	}

	role, _ := c.Locals("role").(string)
	if role != "manager" && role != "owner" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only managers or owners can reject opname discrepancy logs",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	rejected, err := RejectWastageLog(c.Context(), logID, businessID, userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(rejected)
}

// =========================================================================
// PROCUREMENT HANDLERS
// =========================================================================

// HandleGetProcurements Handles GET /api/v1/procurements
func HandleGetProcurements(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	list, err := GetProcurements(c.Context(), businessID, outletID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch procurements",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleCreateProcurement Handles POST /api/v1/procurements
func HandleCreateProcurement(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "User session not found",
		})
	}
	userID, _ := uuid.Parse(userIDStr)

	var req CreateProcurementInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.SupplierName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Supplier name is required",
		})
	}

	created, err := CreateProcurement(c.Context(), businessID, outletID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(created)
}

// HandleGetProcurementByID Handles GET /api/v1/procurements/:id
func HandleGetProcurementByID(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	procurementID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid procurement ID",
		})
	}

	detail, err := GetProcurementByID(c.Context(), businessID, procurementID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Procurement record not found",
		})
	}

	return c.JSON(detail)
}

// UpdatePaymentInput body payload for payment status update
type UpdatePaymentInput struct {
	PaymentStatus models.PaymentStatus `json:"payment_status"`
	AmountOwed    *int64               `json:"amount_owed,omitempty"`
}

// HandleUpdateProcurementPayment Handles PUT /api/v1/procurements/:id/payment
func HandleUpdateProcurementPayment(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	procurementID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid procurement ID",
		})
	}

	var req UpdatePaymentInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.PaymentStatus == "" {
		req.PaymentStatus = models.PayPaid
	}

	if req.PaymentStatus == models.PayPaid {
		zero := int64(0)
		req.AmountOwed = &zero
	}

	if err := UpdateProcurementPayment(c.Context(), businessID, procurementID, req.PaymentStatus, req.AmountOwed); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update payment status",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message":        "Payment status updated successfully",
		"payment_status": req.PaymentStatus,
		"amount_owed":    req.AmountOwed,
	})
}

// HandleGetCategories Handles GET /api/v1/categories
func HandleGetCategories(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to active workspace denied",
		})
	}

	list, err := GetCategories(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch categories",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleUploadFile handles file uploads and returns the served URL path
func HandleUploadFile(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "No file uploaded or invalid file format",
		})
	}

	// Create upload folder if not exists
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to initialize upload directory",
			"error":   err.Error(),
		})
	}

	// Generate a secure unique UUID name
	ext := filepath.Ext(file.Filename)
	uniqueName := uuid.New().String() + ext
	filePath := filepath.Join(uploadDir, uniqueName)

	// Save to folder
	if err := c.SaveFile(file, filePath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to save uploaded file",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"url": "/uploads/" + uniqueName,
	})
}

// IngredientRequest body payload for ingredient CRUD
type IngredientRequest struct {
	Name         string  `json:"name"`
	UnitType     string  `json:"unit_type"`
	CurrentStock float64 `json:"current_stock"`
	OutletID     *string `json:"outlet_id,omitempty"`
}

// HandleGetIngredients Handles GET /api/v1/ingredients
func HandleGetIngredients(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	list, err := GetIngredients(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch ingredients",
			"error":   err.Error(),
		})
	}

	return c.JSON(list)
}

// HandleCreateIngredient Handles POST /api/v1/ingredients
func HandleCreateIngredient(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner or Admin Gudang can manage ingredients",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	var req IngredientRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.Name == "" || req.UnitType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Name and Unit Type are required",
		})
	}

	var outletID *uuid.UUID
	if req.OutletID != nil && *req.OutletID != "" {
		id, err := uuid.Parse(*req.OutletID)
		if err == nil {
			outletID = &id
		}
	}

	ing := &models.Ingredient{
		BusinessID:   businessID,
		OutletID:     outletID,
		Name:         req.Name,
		UnitType:     models.UnitType(req.UnitType),
		CurrentStock: req.CurrentStock,
	}

	created, err := CreateIngredient(c.Context(), ing)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create ingredient",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(created)
}

// HandleUpdateIngredient Handles PUT /api/v1/ingredients/:id
func HandleUpdateIngredient(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner or Admin Gudang can manage ingredients",
		})
	}

	idStr := c.Params("id")
	ingID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid ingredient ID format",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	var req IngredientRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if req.Name == "" || req.UnitType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Name and Unit Type are required",
		})
	}

	var outletID *uuid.UUID
	if req.OutletID != nil && *req.OutletID != "" {
		id, err := uuid.Parse(*req.OutletID)
		if err == nil {
			outletID = &id
		}
	}

	ing := &models.Ingredient{
		ID:           ingID,
		BusinessID:   businessID,
		OutletID:     outletID,
		Name:         req.Name,
		UnitType:     models.UnitType(req.UnitType),
		CurrentStock: req.CurrentStock,
	}

	updated, err := UpdateIngredient(c.Context(), ing)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update ingredient",
			"error":   err.Error(),
		})
	}

	return c.JSON(updated)
}

// HandleDeleteIngredient Handles DELETE /api/v1/ingredients/:id
func HandleDeleteIngredient(c *fiber.Ctx) error {
	role := c.Locals("role").(string)
	if role != "owner" && role != "admin_gudang" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only Owner or Admin Gudang can manage ingredients",
		})
	}

	idStr := c.Params("id")
	ingID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid ingredient ID format",
		})
	}

	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	err = DeleteIngredient(c.Context(), ingID, businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete ingredient",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Ingredient successfully deleted",
	})
}


