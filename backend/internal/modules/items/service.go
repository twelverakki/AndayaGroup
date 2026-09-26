package items

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"andaya-erp/backend/internal/models"
)

type CreateItemRequest struct {
	CategoryID         *uuid.UUID      `json:"category_id,omitempty"`
	SKU                *string         `json:"sku,omitempty"`
	Name               string          `json:"name"`
	ItemType           models.ItemType `json:"item_type"`
	IsSellable         bool            `json:"is_sellable"`
	IsInventoryTracked bool            `json:"is_inventory_tracked"`
	IsTrackingStock    bool            `json:"is_tracking_stock"`
	IsProduced         bool            `json:"is_produced"`
	IsPurchasable      bool            `json:"is_purchasable"`
	IsThawable         bool            `json:"is_thawable"`
	RequiresThaw       bool            `json:"requires_thaw"`
	BaseUnit           string          `json:"base_unit"`
	BoxUnit            string          `json:"box_unit"`
	ConversionRate     float64         `json:"conversion_rate"`
	PriceUnit          string          `json:"price_unit"`
	SellPrice          int64           `json:"sell_price"`
	BoxSellPrice       int64           `json:"box_sell_price"`
	StandardCost       int64           `json:"standard_cost"`
	MinStockAlert      float64         `json:"min_stock_alert"`
	ImageURL           *string         `json:"image_url,omitempty"`
	InitialStockSealed float64         `json:"initial_stock_sealed"`
	InitialStockLoose  float64         `json:"initial_stock_loose"`
}

type ItemResponse struct {
	models.Item
	CategoryName  *string `json:"category_name,omitempty"`
	Category      *string `json:"category,omitempty"`       // Backward-compatibility alias
	QtySealed     float64 `json:"qty_sealed"`
	QtyLoose      float64 `json:"qty_loose"`
	CurrentStock  float64 `json:"current_stock"`            // Backward-compatibility alias
	PurchasePrice int64   `json:"purchase_price"`           // Backward-compatibility alias
	UnitType      string  `json:"unit_type,omitempty"`      // Backward-compatibility alias
	InventoryMode string  `json:"inventory_mode,omitempty"` // Backward-compatibility alias
}

type ItemsService struct {
	DB *pgxpool.Pool
}

func NewItemsService(db *pgxpool.Pool) *ItemsService {
	return &ItemsService{DB: db}
}

func (s *ItemsService) GetItems(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, itemType string, isSellable *bool, status string) ([]ItemResponse, error) {
	args := []interface{}{businessID}
	paramIdx := 2

	var stockJoin string
	if outletID != nil {
		stockJoin = fmt.Sprintf("LEFT JOIN item_stocks st ON i.id = st.item_id AND st.outlet_id = $%d AND st.held_by_user_id IS NULL", paramIdx)
		args = append(args, *outletID)
		paramIdx++
	} else {
		stockJoin = "LEFT JOIN item_stocks st ON i.id = st.item_id AND st.held_by_user_id IS NULL"
	}

	query := fmt.Sprintf(`
		SELECT i.id, i.business_id, i.category_id, i.sku, i.name, i.item_type, i.is_sellable, i.is_inventory_tracked,
		       COALESCE(i.is_produced, FALSE) AS is_produced,
		       COALESCE(i.is_purchasable, TRUE) AS is_purchasable,
		       COALESCE(i.is_thawable, i.requires_thaw, FALSE) AS is_thawable,
		       i.base_unit, i.box_unit, i.conversion_rate, COALESCE(i.price_unit, 'base') AS price_unit, i.sell_price, i.box_sell_price, i.standard_cost,
		       COALESCE(i.min_stock_alert, 5.0) AS min_stock_alert,
		       i.image_url, i.status,
		       i.created_at, i.updated_at, c.name AS category_name,
		       COALESCE(SUM(st.qty_sealed), 0) AS qty_sealed,
		       COALESCE(SUM(st.qty_loose), 0) AS qty_loose
		FROM items i
		LEFT JOIN categories c ON i.category_id = c.id
		%s
		WHERE i.business_id = $1
	`, stockJoin)

	if status != "" && status != "all" {
		query += fmt.Sprintf(" AND i.status = $%d", paramIdx)
		args = append(args, status)
		paramIdx++
	}

	if itemType != "" {
		query += fmt.Sprintf(" AND i.item_type = $%d", paramIdx)
		args = append(args, itemType)
		paramIdx++
	}

	if isSellable != nil {
		query += fmt.Sprintf(" AND i.is_sellable = $%d", paramIdx)
		args = append(args, *isSellable)
		paramIdx++
	}

	query += ` GROUP BY i.id, c.name ORDER BY i.name ASC`

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]ItemResponse, 0)
	for rows.Next() {
		var item ItemResponse
		err := rows.Scan(
			&item.ID, &item.BusinessID, &item.CategoryID, &item.SKU, &item.Name, &item.ItemType,
			&item.IsSellable, &item.IsInventoryTracked, &item.IsProduced, &item.IsPurchasable, &item.IsThawable,
			&item.BaseUnit, &item.BoxUnit, &item.ConversionRate,
			&item.PriceUnit, &item.SellPrice, &item.BoxSellPrice, &item.StandardCost, &item.MinStockAlert,
			&item.ImageURL, &item.Status, &item.CreatedAt, &item.UpdatedAt,
			&item.CategoryName, &item.QtySealed, &item.QtyLoose,
		)
		if err != nil {
			return nil, err
		}
		item.IsTrackingStock = item.IsInventoryTracked
		item.RequiresThaw = item.IsThawable
		item.Category = item.CategoryName
		item.PurchasePrice = item.StandardCost
		item.CurrentStock = item.QtyLoose
		item.UnitType = item.BaseUnit
		item.InventoryMode = "dry_strict"
		list = append(list, item)
	}

	return list, nil
}

func (s *ItemsService) CreateItem(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, req CreateItemRequest) (*ItemResponse, error) {
	if req.Name == "" {
		return nil, errors.New("item name is required")
	}

	if req.ConversionRate <= 0 {
		req.ConversionRate = 1.0
	}
	if req.BaseUnit == "" {
		req.BaseUnit = "pcs"
	}
	if req.BoxUnit == "" {
		req.BoxUnit = "kardus"
	}
	if req.PriceUnit == "" {
		req.PriceUnit = "base"
	}
	if req.MinStockAlert <= 0 {
		req.MinStockAlert = 5.0
	}
	if req.ItemType == "" {
		req.ItemType = "finished_good"
	}

	// Flag synchronizations
	isTracking := req.IsTrackingStock || req.IsInventoryTracked
	isThaw := req.IsThawable || req.RequiresThaw

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	itemID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO items (
			id, business_id, category_id, sku, name, item_type,
			is_sellable, is_inventory_tracked, is_produced, is_purchasable, is_thawable, requires_thaw,
			base_unit, box_unit, conversion_rate, price_unit, sell_price, box_sell_price, standard_cost, min_stock_alert,
			image_url, status, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'active', NOW(), NOW())
	`, itemID, businessID, req.CategoryID, req.SKU, req.Name, req.ItemType,
		req.IsSellable, isTracking, req.IsProduced, req.IsPurchasable, isThaw, isThaw,
		req.BaseUnit, req.BoxUnit, req.ConversionRate, req.PriceUnit, req.SellPrice, req.BoxSellPrice, req.StandardCost, req.MinStockAlert,
		req.ImageURL)
	if err != nil {
		return nil, fmt.Errorf("failed to insert item: %w", err)
	}

	targetOutletID := uuid.Nil
	if outletID != nil && *outletID != uuid.Nil {
		targetOutletID = *outletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			targetOutletID = uuid.New()
		}
	}

	if isTracking && (req.InitialStockSealed > 0 || req.InitialStockLoose > 0) {
		_, err = tx.Exec(ctx, `
			INSERT INTO item_stocks (item_id, outlet_id, qty_sealed, qty_loose, updated_at)
			VALUES ($1, $2, $3, $4, NOW())
		`, itemID, targetOutletID, req.InitialStockSealed, req.InitialStockLoose)
		if err != nil {
			return nil, fmt.Errorf("failed to insert item stock: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ItemResponse{
		Item: models.Item{
			ID:                 itemID,
			BusinessID:         businessID,
			CategoryID:         req.CategoryID,
			SKU:                req.SKU,
			Name:               req.Name,
			ItemType:           req.ItemType,
			IsSellable:         req.IsSellable,
			IsInventoryTracked: isTracking,
			IsTrackingStock:    isTracking,
			IsProduced:         req.IsProduced,
			IsPurchasable:      req.IsPurchasable,
			IsThawable:         isThaw,
			RequiresThaw:       isThaw,
			BaseUnit:           req.BaseUnit,
			BoxUnit:            req.BoxUnit,
			ConversionRate:     req.ConversionRate,
			PriceUnit:          req.PriceUnit,
			SellPrice:          req.SellPrice,
			BoxSellPrice:       req.BoxSellPrice,
			StandardCost:       req.StandardCost,
			MinStockAlert:      req.MinStockAlert,
			ImageURL:           req.ImageURL,
			Status:             "active",
		},
		QtySealed: req.InitialStockSealed,
		QtyLoose:  req.InitialStockLoose,
	}, nil
}

func (s *ItemsService) UpdateItem(ctx context.Context, businessID, itemID uuid.UUID, req CreateItemRequest) error {
	if req.Name == "" {
		return errors.New("item name is required")
	}
	if req.ConversionRate <= 0 {
		req.ConversionRate = 1.0
	}
	if req.PriceUnit == "" {
		req.PriceUnit = "base"
	}
	if req.MinStockAlert <= 0 {
		req.MinStockAlert = 5.0
	}
	if req.ItemType == "" {
		req.ItemType = "finished_good"
	}

	isTracking := req.IsTrackingStock || req.IsInventoryTracked
	isThaw := req.IsThawable || req.RequiresThaw

	result, err := s.DB.Exec(ctx, `
		UPDATE items
		SET category_id = $1, sku = $2, name = $3, item_type = $4,
		    is_sellable = $5, is_inventory_tracked = $6, is_produced = $7, is_purchasable = $8, is_thawable = $9, requires_thaw = $10,
		    base_unit = $11, box_unit = $12, conversion_rate = $13, price_unit = $14, sell_price = $15, box_sell_price = $16,
		    standard_cost = $17, min_stock_alert = $18, image_url = $19, updated_at = NOW()
		WHERE id = $20 AND business_id = $21
	`, req.CategoryID, req.SKU, req.Name, req.ItemType,
		req.IsSellable, isTracking, req.IsProduced, req.IsPurchasable, isThaw, isThaw,
		req.BaseUnit, req.BoxUnit, req.ConversionRate, req.PriceUnit, req.SellPrice, req.BoxSellPrice,
		req.StandardCost, req.MinStockAlert, req.ImageURL, itemID, businessID)
	if err != nil {
		return fmt.Errorf("failed to update item: %w", err)
	}
	if result.RowsAffected() == 0 {
		return errors.New("item not found or not owned by business")
	}
	return nil
}

func (s *ItemsService) UpdateItemStatus(ctx context.Context, businessID, itemID uuid.UUID, status string) error {
	if status != "active" && status != "inactive" && status != "discontinued" && status != "archived" {
		return errors.New("invalid status value")
	}

	result, err := s.DB.Exec(ctx, `
		UPDATE items
		SET status = $1, updated_at = NOW()
		WHERE id = $2 AND business_id = $3
	`, status, itemID, businessID)
	if err != nil {
		return fmt.Errorf("failed to update item status: %w", err)
	}
	if result.RowsAffected() == 0 {
		return errors.New("item not found or not owned by business")
	}
	return nil
}

func (s *ItemsService) CreateCategory(ctx context.Context, businessID uuid.UUID, name string, categoryType string) (*models.Category, error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("category name is required")
	}
	if categoryType == "" {
		categoryType = "finished_good"
	}
	id := uuid.New()
	var cat models.Category
	err := s.DB.QueryRow(ctx, `
		INSERT INTO categories (id, business_id, name, category_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id, business_id, name, category_type, created_at, updated_at
	`, id, businessID, strings.TrimSpace(name), categoryType).Scan(&cat.ID, &cat.BusinessID, &cat.Name, &cat.CategoryType, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}
	return &cat, nil
}

func (s *ItemsService) DeleteCategory(ctx context.Context, businessID, categoryID uuid.UUID) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Disassociate items by setting their category_id to NULL
	_, err = tx.Exec(ctx, `UPDATE items SET category_id = NULL WHERE category_id = $1 AND business_id = $2`, categoryID, businessID)
	if err != nil {
		return fmt.Errorf("failed to unlink items from category: %w", err)
	}

	result, err := tx.Exec(ctx, `DELETE FROM categories WHERE id = $1 AND business_id = $2`, categoryID, businessID)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}
	if result.RowsAffected() == 0 {
		return errors.New("category not found or not owned by business")
	}

	return tx.Commit(ctx)
}

func (s *ItemsService) GetCategories(ctx context.Context, businessID uuid.UUID, categoryType string) ([]models.Category, error) {
	query := `
		SELECT c.id, c.business_id, c.name, COALESCE(c.category_type, 'finished_good'), 
		       COUNT(i.id) AS item_count, c.created_at, c.updated_at
		FROM categories c
		LEFT JOIN items i ON i.category_id = c.id AND i.business_id = c.business_id
		WHERE c.business_id = $1
	`
	args := []interface{}{businessID}
	if categoryType != "" && categoryType != "all" {
		query += " AND c.category_type = $2"
		args = append(args, categoryType)
	}
	query += " GROUP BY c.id, c.business_id, c.name, c.category_type, c.created_at, c.updated_at ORDER BY c.name ASC"

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Category, 0)
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.BusinessID, &c.Name, &c.CategoryType, &c.ItemCount, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *ItemsService) GetWastageLogs(ctx context.Context, businessID uuid.UUID) ([]models.WastageLog, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, business_id, outlet_id, product_id, expected_qty, actual_qty, discrepancy, input_by, approved_by, status, created_at, updated_at
		FROM wastage_logs WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.WastageLog, 0)
	for rows.Next() {
		var w models.WastageLog
		err := rows.Scan(&w.ID, &w.BusinessID, &w.OutletID, &w.ProductID, &w.ExpectedQty, &w.ActualQty, &w.Discrepancy, &w.InputBy, &w.ApprovedBy, &w.Status, &w.CreatedAt, &w.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, nil
}

func (s *ItemsService) GetProcurements(ctx context.Context, businessID uuid.UUID) ([]models.Procurement, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, business_id, outlet_id, supplier_name, invoice_number, total_cost, payment_status, amount_owed, procurement_date, due_date, created_by, created_at, updated_at
		FROM procurements WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Procurement, 0)
	for rows.Next() {
		var p models.Procurement
		err := rows.Scan(&p.ID, &p.BusinessID, &p.OutletID, &p.SupplierName, &p.InvoiceNumber, &p.TotalCost, &p.PaymentStatus, &p.AmountOwed, &p.ProcurementDate, &p.DueDate, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

type UnboxRequest struct {
	BoxesToUnbox float64 `json:"boxes_to_unbox"`
	Notes        string  `json:"notes,omitempty"`
}

func (s *ItemsService) UnboxItem(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, userID uuid.UUID, itemID uuid.UUID, req UnboxRequest) (*ItemResponse, error) {
	if req.BoxesToUnbox <= 0 {
		return nil, errors.New("jumlah dus yang dibongkar harus lebih dari 0")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Fetch Item details & conversion rate
	var item models.Item
	err = tx.QueryRow(ctx, `
		SELECT id, business_id, conversion_rate, base_unit, box_unit, name, standard_cost, is_inventory_tracked
		FROM items WHERE id = $1 AND business_id = $2
	`, itemID, businessID).Scan(&item.ID, &item.BusinessID, &item.ConversionRate, &item.BaseUnit, &item.BoxUnit, &item.Name, &item.StandardCost, &item.IsInventoryTracked)
	if err != nil {
		return nil, fmt.Errorf("item tidak ditemukan: %w", err)
	}

	if !item.IsInventoryTracked {
		return nil, errors.New("item ini tidak melacak inventori (jasa/untracked), tidak dapat dibongkar")
	}

	if item.ConversionRate <= 0 {
		item.ConversionRate = 1.0
	}

	// 2. Resolve outlet
	targetOutletID := uuid.Nil
	if outletID != nil && *outletID != uuid.Nil {
		targetOutletID = *outletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return nil, errors.New("outlet tidak ditemukan untuk bisnis ini")
		}
	}

	// 3. Lock & check stock
	var currentSealed, currentLoose float64
	err = tx.QueryRow(ctx, `
		SELECT qty_sealed, qty_loose FROM item_stocks 
		WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL
		FOR UPDATE
	`, itemID, targetOutletID).Scan(&currentSealed, &currentLoose)
	if err != nil {
		return nil, fmt.Errorf("stok item belum diinisialisasi di outlet ini: %w", err)
	}

	if currentSealed < req.BoxesToUnbox {
		return nil, fmt.Errorf("stok dus tidak cukup (tersedia: %.2f %s, diminta unbox: %.2f %s)", currentSealed, item.BoxUnit, req.BoxesToUnbox, item.BoxUnit)
	}

	looseQtyToAdd := req.BoxesToUnbox * item.ConversionRate
	newSealed := currentSealed - req.BoxesToUnbox
	newLoose := currentLoose + looseQtyToAdd

	// 4. Update Stock
	_, err = tx.Exec(ctx, `
		UPDATE item_stocks
		SET qty_sealed = $1, qty_loose = $2, updated_at = NOW()
		WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
	`, newSealed, newLoose, itemID, targetOutletID)
	if err != nil {
		return nil, fmt.Errorf("gagal mengupdate stok: %w", err)
	}

	// 5. Append Stock Movement Ledger Record
	movementNotes := fmt.Sprintf("Buka Dus (Unbox): %.2f %s -> %.2f %s", req.BoxesToUnbox, item.BoxUnit, looseQtyToAdd, item.BaseUnit)
	if req.Notes != "" {
		movementNotes += " - " + req.Notes
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (
			business_id, item_id, source_document_type, from_location_type, from_outlet_id,
			to_location_type, to_outlet_id, package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
		) VALUES (
			$1, $2, 'UNBOX_TO_SHELF', 'warehouse_sealed', $3,
			'retail_shelf', $3, 'loose', $4, $5, $6, $7, $8, NOW()
		)
	`, businessID, itemID, targetOutletID, looseQtyToAdd, item.StandardCost, int64(looseQtyToAdd)*item.StandardCost, userID, movementNotes)
	if err != nil {
		return nil, fmt.Errorf("gagal mencatat ledger pergerakan stok: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ItemResponse{
		Item:      item,
		QtySealed: newSealed,
		QtyLoose:  newLoose,
	}, nil
}

type AdjustStockRequest struct {
	ActualStockLoose  *float64 `json:"actual_stock_loose,omitempty"`
	ActualStockSealed *float64 `json:"actual_stock_sealed,omitempty"`
	ActualQty         *float64 `json:"actual_qty,omitempty"`
	DeltaLoose        *float64 `json:"delta_loose,omitempty"`
	Reason            string   `json:"reason"`
	Notes             string   `json:"notes,omitempty"`
}

func (s *ItemsService) AdjustStock(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, userID uuid.UUID, itemID uuid.UUID, req AdjustStockRequest) (*ItemResponse, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Fetch Item details
	var item models.Item
	err = tx.QueryRow(ctx, `
		SELECT id, business_id, conversion_rate, base_unit, box_unit, name, standard_cost, is_inventory_tracked
		FROM items WHERE id = $1 AND business_id = $2
	`, itemID, businessID).Scan(&item.ID, &item.BusinessID, &item.ConversionRate, &item.BaseUnit, &item.BoxUnit, &item.Name, &item.StandardCost, &item.IsInventoryTracked)
	if err != nil {
		return nil, fmt.Errorf("item tidak ditemukan: %w", err)
	}

	if !item.IsInventoryTracked {
		return nil, errors.New("item non-inventori / jasa tidak memerlukan penyesuaian stok")
	}

	// 2. Resolve outlet
	targetOutletID := uuid.Nil
	if outletID != nil && *outletID != uuid.Nil {
		targetOutletID = *outletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return nil, errors.New("outlet tidak ditemukan untuk bisnis ini")
		}
	}

	// 3. Ensure item_stocks row exists and lock it
	var currentSealed, currentLoose float64
	var stockExists bool
	err = tx.QueryRow(ctx, `
		SELECT qty_sealed, qty_loose FROM item_stocks 
		WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL
		FOR UPDATE
	`, itemID, targetOutletID).Scan(&currentSealed, &currentLoose)
	if err != nil {
		currentSealed = 0
		currentLoose = 0
		stockExists = false
	} else {
		stockExists = true
	}

	newLoose := currentLoose
	newSealed := currentSealed
	var discrepancyLoose float64

	if req.ActualStockLoose != nil {
		newLoose = *req.ActualStockLoose
		discrepancyLoose = newLoose - currentLoose
	} else if req.ActualQty != nil {
		newLoose = *req.ActualQty
		discrepancyLoose = newLoose - currentLoose
	} else if req.DeltaLoose != nil {
		discrepancyLoose = *req.DeltaLoose
		newLoose = currentLoose + discrepancyLoose
	}

	if newLoose < 0 {
		return nil, errors.New("stok akhir tidak boleh kurang dari 0")
	}

	if req.ActualStockSealed != nil {
		if *req.ActualStockSealed < 0 {
			return nil, errors.New("stok dus tidak boleh kurang dari 0")
		}
		newSealed = *req.ActualStockSealed
	}

	// 4. Update or Insert item_stocks
	if stockExists {
		_, err = tx.Exec(ctx, `
			UPDATE item_stocks
			SET qty_sealed = $1, qty_loose = $2, updated_at = NOW()
			WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
		`, newSealed, newLoose, itemID, targetOutletID)
	} else {
		_, err = tx.Exec(ctx, `
			INSERT INTO item_stocks (id, item_id, outlet_id, qty_sealed, qty_loose, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
		`, itemID, targetOutletID, newSealed, newLoose)
	}
	if err != nil {
		return nil, fmt.Errorf("gagal mengupdate stok item: %w", err)
	}

	// 5. Append Stock Movement Ledger Record if there is a discrepancy
	absDiscrepancy := math.Abs(discrepancyLoose)
	if absDiscrepancy > 0 {
		reasonText := req.Reason
		if reasonText == "" {
			reasonText = "Penyesuaian Stok Manual"
		}
		movementNotes := fmt.Sprintf("Stock Adjustment: %s (Selisih: %+.2f %s)", reasonText, discrepancyLoose, item.BaseUnit)
		if req.Notes != "" {
			movementNotes += " - " + req.Notes
		}

		fromLoc := "adjustment_gain"
		toLoc := "retail_shelf"
		if discrepancyLoose < 0 {
			fromLoc = "retail_shelf"
			toLoc = "inventory_adjustment_loss"
		}

		costAmount := int64(absDiscrepancy) * item.StandardCost

		_, err = tx.Exec(ctx, `
			INSERT INTO stock_movements (
				business_id, item_id, source_document_type, from_location_type, from_outlet_id,
				to_location_type, to_outlet_id, package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
			) VALUES (
				$1, $2, 'STOCK_ADJUSTMENT', $3, $4,
				$5, $4, 'loose', $6, $7, $8, $9, $10, NOW()
			)
		`, businessID, itemID, fromLoc, targetOutletID, toLoc, absDiscrepancy, item.StandardCost, costAmount, userID, movementNotes)
		if err != nil {
			return nil, fmt.Errorf("gagal mencatat ledger pergerakan stok: %w", err)
		}

		// 6. Insert into wastage_logs for audit tracking
		_, _ = tx.Exec(ctx, `
			INSERT INTO wastage_logs (
				id, business_id, outlet_id, item_id, product_id, expected_qty, actual_qty, discrepancy, input_by, approved_by, status, created_at, updated_at
			) VALUES (
				gen_random_uuid(), $1, $2, $3, $3, $4, $5, $6, $7, $7, 'approved', NOW(), NOW()
			)
		`, businessID, targetOutletID, itemID, currentLoose, newLoose, discrepancyLoose, userID)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("gagal menyelesaikan transaksi penyesuaian: %w", err)
	}

	return &ItemResponse{
		Item:      item,
		QtySealed: newSealed,
		QtyLoose:  newLoose,
	}, nil
}

type OutletInfo struct {
	ID      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	IsMain  bool      `json:"is_main"`
	Address *string   `json:"address,omitempty"`
}

type OutletStockDetail struct {
	OutletID   uuid.UUID `json:"outlet_id"`
	OutletName string    `json:"outlet_name"`
	IsMain     bool      `json:"is_main"`
	QtySealed  float64   `json:"qty_sealed"`
	QtyLoose   float64   `json:"qty_loose"`
}

type StockMatrixItem struct {
	ID                 uuid.UUID                    `json:"id"`
	SKU                *string                      `json:"sku,omitempty"`
	Name               string                       `json:"name"`
	CategoryID         *uuid.UUID                   `json:"category_id,omitempty"`
	CategoryName       *string                      `json:"category_name,omitempty"`
	ItemType           models.ItemType              `json:"item_type"`
	IsSellable         bool                         `json:"is_sellable"`
	IsInventoryTracked bool                         `json:"is_inventory_tracked"`
	IsTrackingStock    bool                         `json:"is_tracking_stock"`
	IsProduced         bool                         `json:"is_produced"`
	IsPurchasable      bool                         `json:"is_purchasable"`
	IsThawable         bool                         `json:"is_thawable"`
	BaseUnit           string                       `json:"base_unit"`
	BoxUnit            string                       `json:"box_unit"`
	ConversionRate     float64                      `json:"conversion_rate"`
	MinStockAlert      float64                      `json:"min_stock_alert"`
	SellPrice          int64                        `json:"sell_price"`
	StandardCost       int64                        `json:"standard_cost"`
	Status             string                       `json:"status"`
	TotalQtySealed     float64                      `json:"total_qty_sealed"`
	TotalQtyLoose      float64                      `json:"total_qty_loose"`
	Stocks             map[string]OutletStockDetail `json:"stocks"`
}

type StockMatrixResponse struct {
	Outlets []OutletInfo      `json:"outlets"`
	Items   []StockMatrixItem `json:"items"`
}

func (s *ItemsService) GetStockMatrix(ctx context.Context, businessID uuid.UUID) (*StockMatrixResponse, error) {
	// 1. Get all outlets under this business (Main outlet first, then alphabetical)
	outletsRows, err := s.DB.Query(ctx, `
		SELECT id, name, is_main, address
		FROM outlets
		WHERE business_id = $1
		ORDER BY is_main DESC, name ASC
	`, businessID)
	if err != nil {
		return nil, fmt.Errorf("gagal memuat daftar outlet: %w", err)
	}
	defer outletsRows.Close()

	var outlets []OutletInfo
	outletMap := make(map[uuid.UUID]OutletInfo)
	for outletsRows.Next() {
		var o OutletInfo
		if err := outletsRows.Scan(&o.ID, &o.Name, &o.IsMain, &o.Address); err != nil {
			return nil, fmt.Errorf("gagal membaca baris outlet: %w", err)
		}
		outlets = append(outlets, o)
		outletMap[o.ID] = o
	}

	// 2. Get all items under this business
	itemsRows, err := s.DB.Query(ctx, `
		SELECT i.id, i.sku, i.name, i.category_id, c.name AS category_name, i.item_type,
		       i.is_sellable, i.is_inventory_tracked,
		       COALESCE(i.is_produced, FALSE) AS is_produced,
		       COALESCE(i.is_purchasable, TRUE) AS is_purchasable,
		       COALESCE(i.is_thawable, i.requires_thaw, FALSE) AS is_thawable,
		       i.base_unit, i.box_unit, i.conversion_rate,
		       COALESCE(i.min_stock_alert, 5.0) AS min_stock_alert,
		       i.sell_price, i.standard_cost, i.status
		FROM items i
		LEFT JOIN categories c ON i.category_id = c.id
		WHERE i.business_id = $1
		ORDER BY i.name ASC
	`, businessID)
	if err != nil {
		return nil, fmt.Errorf("gagal memuat master item: %w", err)
	}
	defer itemsRows.Close()

	var items []StockMatrixItem
	itemIndexMap := make(map[uuid.UUID]int)
	for itemsRows.Next() {
		var it StockMatrixItem
		if err := itemsRows.Scan(
			&it.ID, &it.SKU, &it.Name, &it.CategoryID, &it.CategoryName, &it.ItemType,
			&it.IsSellable, &it.IsInventoryTracked, &it.IsProduced, &it.IsPurchasable,
			&it.IsThawable, &it.BaseUnit, &it.BoxUnit, &it.ConversionRate,
			&it.MinStockAlert, &it.SellPrice, &it.StandardCost, &it.Status,
		); err != nil {
			return nil, fmt.Errorf("gagal membaca baris item: %w", err)
		}
		it.IsTrackingStock = it.IsInventoryTracked
		it.Stocks = make(map[string]OutletStockDetail)

		// Pre-populate empty stocks for all outlets
		for _, o := range outlets {
			it.Stocks[o.ID.String()] = OutletStockDetail{
				OutletID:   o.ID,
				OutletName: o.Name,
				IsMain:     o.IsMain,
				QtySealed:  0,
				QtyLoose:   0,
			}
		}

		itemIndexMap[it.ID] = len(items)
		items = append(items, it)
	}

	// 3. Query all stock levels for this business' outlets
	stockRows, err := s.DB.Query(ctx, `
		SELECT st.item_id, st.outlet_id, COALESCE(st.qty_sealed, 0), COALESCE(st.qty_loose, 0)
		FROM item_stocks st
		JOIN outlets o ON st.outlet_id = o.id
		WHERE o.business_id = $1 AND st.held_by_user_id IS NULL
	`, businessID)
	if err != nil {
		return nil, fmt.Errorf("gagal memuat saldo stok outlet: %w", err)
	}
	defer stockRows.Close()

	for stockRows.Next() {
		var itemID, outletID uuid.UUID
		var qtySealed, qtyLoose float64
		if err := stockRows.Scan(&itemID, &outletID, &qtySealed, &qtyLoose); err != nil {
			return nil, fmt.Errorf("gagal membaca saldo stok: %w", err)
		}

		idx, exists := itemIndexMap[itemID]
		if !exists {
			continue
		}

		oInfo, oExists := outletMap[outletID]
		oName := "Cabang"
		isMain := false
		if oExists {
			oName = oInfo.Name
			isMain = oInfo.IsMain
		}

		items[idx].Stocks[outletID.String()] = OutletStockDetail{
			OutletID:   outletID,
			OutletName: oName,
			IsMain:     isMain,
			QtySealed:  qtySealed,
			QtyLoose:   qtyLoose,
		}
		items[idx].TotalQtySealed += qtySealed
		items[idx].TotalQtyLoose += qtyLoose
	}

	return &StockMatrixResponse{
		Outlets: outlets,
		Items:   items,
	}, nil
}


