package items

import (
	"context"
	"errors"
	"fmt"
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
	BaseUnit           string          `json:"base_unit"`
	BoxUnit            string          `json:"box_unit"`
	ConversionRate     float64         `json:"conversion_rate"`
	SellPrice          int64           `json:"sell_price"`
	BoxSellPrice       int64           `json:"box_sell_price"`
	StandardCost       int64           `json:"standard_cost"`
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

func (s *ItemsService) GetItems(ctx context.Context, businessID uuid.UUID, itemType string, isSellable *bool) ([]ItemResponse, error) {
	query := `
		SELECT i.id, i.business_id, i.category_id, i.sku, i.name, i.item_type, i.is_sellable, i.is_inventory_tracked,
		       i.base_unit, i.box_unit, i.conversion_rate, i.sell_price, i.box_sell_price, i.standard_cost, i.status,
		       i.created_at, i.updated_at, c.name AS category_name,
		       COALESCE(SUM(st.qty_sealed), 0) AS qty_sealed,
		       COALESCE(SUM(st.qty_loose), 0) AS qty_loose
		FROM items i
		LEFT JOIN categories c ON i.category_id = c.id
		LEFT JOIN item_stocks st ON i.id = st.item_id AND st.held_by_user_id IS NULL
		WHERE i.business_id = $1 AND i.status = 'active'
	`
	args := []interface{}{businessID}
	paramIdx := 2

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
			&item.IsSellable, &item.IsInventoryTracked, &item.BaseUnit, &item.BoxUnit, &item.ConversionRate,
			&item.SellPrice, &item.BoxSellPrice, &item.StandardCost, &item.Status, &item.CreatedAt, &item.UpdatedAt,
			&item.CategoryName, &item.QtySealed, &item.QtyLoose,
		)
		if err != nil {
			return nil, err
		}
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

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	itemID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO items (id, business_id, category_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, box_sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', NOW(), NOW())
	`, itemID, businessID, req.CategoryID, req.SKU, req.Name, req.ItemType, req.IsSellable, req.IsInventoryTracked, req.BaseUnit, req.BoxUnit, req.ConversionRate, req.SellPrice, req.BoxSellPrice, req.StandardCost)
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

	if req.IsInventoryTracked && (req.InitialStockSealed > 0 || req.InitialStockLoose > 0) {
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
			IsInventoryTracked: req.IsInventoryTracked,
			BaseUnit:           req.BaseUnit,
			BoxUnit:            req.BoxUnit,
			ConversionRate:     req.ConversionRate,
			SellPrice:          req.SellPrice,
			BoxSellPrice:       req.BoxSellPrice,
			StandardCost:       req.StandardCost,
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

	result, err := s.DB.Exec(ctx, `
		UPDATE items
		SET category_id = $1, sku = $2, name = $3, item_type = $4, is_sellable = $5, is_inventory_tracked = $6,
		    base_unit = $7, box_unit = $8, conversion_rate = $9, sell_price = $10, box_sell_price = $11,
		    standard_cost = $12, updated_at = NOW()
		WHERE id = $13 AND business_id = $14
	`, req.CategoryID, req.SKU, req.Name, req.ItemType, req.IsSellable, req.IsInventoryTracked,
		req.BaseUnit, req.BoxUnit, req.ConversionRate, req.SellPrice, req.BoxSellPrice,
		req.StandardCost, itemID, businessID)
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

func (s *ItemsService) CreateCategory(ctx context.Context, businessID uuid.UUID, name string) (*models.Category, error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("category name is required")
	}
	id := uuid.New()
	var cat models.Category
	err := s.DB.QueryRow(ctx, `
		INSERT INTO categories (id, business_id, name, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		RETURNING id, business_id, name, created_at, updated_at
	`, id, businessID, strings.TrimSpace(name)).Scan(&cat.ID, &cat.BusinessID, &cat.Name, &cat.CreatedAt, &cat.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}
	return &cat, nil
}

func (s *ItemsService) DeleteCategory(ctx context.Context, businessID, categoryID uuid.UUID) error {
	// Set items with this category to NULL first
	_, _ = s.DB.Exec(ctx, `UPDATE items SET category_id = NULL WHERE category_id = $1 AND business_id = $2`, categoryID, businessID)
	result, err := s.DB.Exec(ctx, `DELETE FROM categories WHERE id = $1 AND business_id = $2`, categoryID, businessID)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}
	if result.RowsAffected() == 0 {
		return errors.New("category not found or not owned by business")
	}
	return nil
}

func (s *ItemsService) GetCategories(ctx context.Context, businessID uuid.UUID) ([]models.Category, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, business_id, name, created_at, updated_at
		FROM categories WHERE business_id = $1 ORDER BY name ASC
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Category, 0)
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.BusinessID, &c.Name, &c.CreatedAt, &c.UpdatedAt); err != nil {
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
