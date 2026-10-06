package items

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ItemsHandler struct {
	Service *ItemsService
}

func NewItemsHandler(db *pgxpool.Pool) *ItemsHandler {
	return &ItemsHandler{
		Service: NewItemsService(db),
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

func (h *ItemsHandler) HandleUploadFile(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "No file uploaded",
		})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Only image files (jpg, jpeg, png, webp) are allowed",
		})
	}

	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)
	_ = os.MkdirAll("./uploads", 0755)
	savePath := fmt.Sprintf("./uploads/%s", filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to save uploaded file",
		})
	}

	fileURL := fmt.Sprintf("/uploads/%s", filename)
	return c.JSON(fiber.Map{
		"message":  "File uploaded successfully",
		"file_url": fileURL,
	})
}

func isItemAdmin(role string) bool {
	return role == "owner" || role == "superadmin" || role == "admin_gudang"
}

func (h *ItemsHandler) HandleGetItems(c *fiber.Ctx) error {
	businessID, ctxOutletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	outletQuery := c.Query("outlet_id")
	var targetOutletID *uuid.UUID

	// Check if cross-branch stock view is enabled on the business
	var allowCrossBranch bool
	_ = h.Service.DB.QueryRow(c.Context(), "SELECT COALESCE(allow_cross_branch_stock_view, false) FROM businesses WHERE id = $1", businessID).Scan(&allowCrossBranch)

	if isItemAdmin(role) || allowCrossBranch {
		if outletQuery != "" && outletQuery != "all" {
			if parsed, err := uuid.Parse(outletQuery); err == nil {
				targetOutletID = &parsed
			}
		} else if outletQuery == "all" {
			targetOutletID = nil
		} else if ctxOutletID != nil {
			targetOutletID = ctxOutletID
		}
	} else {
		// Non-admin branch staff without cross-branch permission: strictly lock to their active branch outlet
		targetOutletID = ctxOutletID
	}

	itemType := c.Query("item_type")
	status := c.Query("status")
	sellableQuery := c.Query("is_sellable")
	var isSellable *bool
	if sellableQuery == "true" {
		val := true
		isSellable = &val
	} else if sellableQuery == "false" {
		val := false
		isSellable = &val
	}

	res, err := h.Service.GetItems(c.Context(), businessID, targetOutletID, itemType, isSellable, status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	// Cost Protection: If user is staff/cashier without can_view_cost permission, mask standard_cost
	if !isItemAdmin(role) {
		var canViewCost bool
		userIDStr, _ := c.Locals("user_id").(string)
		if uID, err := uuid.Parse(userIDStr); err == nil && ctxOutletID != nil {
			_ = h.Service.DB.QueryRow(c.Context(), "SELECT COALESCE(can_view_cost, false) FROM outlet_staff WHERE user_id = $1 AND outlet_id = $2", uID, *ctxOutletID).Scan(&canViewCost)
		}
		if !canViewCost {
			for i := range res {
				res[i].StandardCost = 0
				res[i].PurchasePrice = 0
			}
		}
	}

	return c.JSON(fiber.Map{
		"data": res,
	})
}

func (h *ItemsHandler) HandleCreateItem(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	if !isItemAdmin(role) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Hanya Owner dan Admin Gudang yang berwenang membuat master barang baru.",
		})
	}

	var req CreateItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	res, err := h.Service.CreateItem(c.Context(), businessID, outletID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Item catalog entry created successfully",
		"data":    res,
	})
}

func (h *ItemsHandler) HandleUpdateItem(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	if !isItemAdmin(role) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Hanya Owner dan Admin Gudang yang berwenang mengubah data master barang.",
		})
	}

	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid item ID",
		})
	}

	var req CreateItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	if err := h.Service.UpdateItem(c.Context(), businessID, itemID, req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Item updated successfully",
	})
}

func (h *ItemsHandler) HandleUpdateItemStatus(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	if !isItemAdmin(role) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Hanya Owner dan Admin Gudang yang berwenang mengubah status master barang.",
		})
	}

	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid item ID",
		})
	}

	var payload struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&payload); err != nil || payload.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Valid status is required",
		})
	}

	if err := h.Service.UpdateItemStatus(c.Context(), businessID, itemID, payload.Status); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Item status updated successfully",
	})
}

func (h *ItemsHandler) HandleCreateCategory(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	if !isItemAdmin(role) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Hanya Owner dan Admin Gudang yang berwenang menambah kategori.",
		})
	}

	var payload struct {
		Name         string `json:"name"`
		CategoryType string `json:"category_type"`
	}
	if err := c.BodyParser(&payload); err != nil || payload.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Category name is required",
		})
	}

	cat, err := h.Service.CreateCategory(c.Context(), businessID, payload.Name, payload.CategoryType)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Category created successfully",
		"data":    cat,
	})
}

func (h *ItemsHandler) HandleDeleteCategory(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	if !isItemAdmin(role) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Hanya Owner dan Admin Gudang yang berwenang menghapus kategori.",
		})
	}

	categoryID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid category ID",
		})
	}

	if err := h.Service.DeleteCategory(c.Context(), businessID, categoryID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Category deleted successfully",
	})
}

func (h *ItemsHandler) HandleGetCategories(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	categoryType := c.Query("type")
	res, err := h.Service.GetCategories(c.Context(), businessID, categoryType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": res,
	})
}

func (h *ItemsHandler) HandleGetWastageLogs(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	res, err := h.Service.GetWastageLogs(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": res,
	})
}

func (h *ItemsHandler) HandleGetProcurements(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	res, err := h.Service.GetProcurements(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": res,
	})
}

func (h *ItemsHandler) HandleUnboxItem(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid user context",
		})
	}

	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid item ID",
		})
	}

	var req UnboxRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	res, err := h.Service.UnboxItem(c.Context(), businessID, outletID, userID, itemID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Dus berhasil dibongkar ke rak etalase",
		"data":    res,
	})
}

func (h *ItemsHandler) HandleAdjustStock(c *fiber.Ctx) error {
	businessID, outletID, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid user context",
		})
	}

	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid item ID",
		})
	}

	var req AdjustStockRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request payload",
		})
	}

	res, err := h.Service.AdjustStock(c.Context(), businessID, outletID, userID, itemID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Stok berhasil disesuaikan",
		"data":    res,
	})
}

func (h *ItemsHandler) HandleGetStockMatrix(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	var allowCrossBranch bool
	_ = h.Service.DB.QueryRow(c.Context(), "SELECT COALESCE(allow_cross_branch_stock_view, false) FROM businesses WHERE id = $1", businessID).Scan(&allowCrossBranch)

	if !isItemAdmin(role) && !allowCrossBranch {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Visibilitas matriks stok lintas cabang tidak diaktifkan oleh Owner",
		})
	}

	matrix, err := h.Service.GetStockMatrix(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Matriks stok berhasil dimuat",
		"data":    matrix,
	})
}

func (h *ItemsHandler) HandleQuickCreateItem(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	var req QuickCreateItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Payload permintaan tidak valid",
		})
	}

	res, err := h.Service.QuickCreateItem(c.Context(), businessID, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Barang baru berhasil dibuat (menunggu peninjauan)",
		"data":    res,
	})
}

func (h *ItemsHandler) HandleGetPendingReviewItems(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	res, err := h.Service.GetPendingReviewItems(c.Context(), businessID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data":  res,
		"count": len(res),
	})
}

func (h *ItemsHandler) HandleReviewItem(c *fiber.Ctx) error {
	businessID, _, err := getTenantContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Access to business context denied",
		})
	}

	role, _ := c.Locals("role").(string)
	if !isItemAdmin(role) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Akses ditolak: Hanya Owner dan Admin Gudang yang berwenang memverifikasi data master barang.",
		})
	}

	userIDStr, _ := c.Locals("user_id").(string)
	reviewerID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid user context",
		})
	}

	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid item ID",
		})
	}

	var req CreateItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Payload permintaan tidak valid",
		})
	}

	if err := h.Service.ReviewItem(c.Context(), businessID, itemID, reviewerID, req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Barang berhasil diverifikasi dan master katalog diperbarui",
	})
}


