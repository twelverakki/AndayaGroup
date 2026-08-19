package products

import (
	"context"
	"errors"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// GetProducts retrieves products scoped to the business (and outlet if provided), with optional status filter
func GetProducts(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, statusFilter string) ([]*models.Product, error) {
	db := config.DB
	var rows pgx.Rows
	var err error

	if statusFilter == "" {
		statusFilter = "active"
	}

	if outletID != nil {
		if statusFilter == "all" {
			rows, err = db.Query(ctx, `
				SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
				       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
				       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
				FROM products p
				LEFT JOIN categories c ON p.category_id = c.id
				WHERE p.business_id = $1 AND (p.outlet_id IS NULL OR p.outlet_id = $2) AND p.status IN ('active', 'inactive', 'discontinued')
				ORDER BY p.name ASC
			`, businessID, *outletID)
		} else if statusFilter == "archived" {
			rows, err = db.Query(ctx, `
				SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
				       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
				       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
				FROM products p
				LEFT JOIN categories c ON p.category_id = c.id
				WHERE p.business_id = $1 AND (p.outlet_id IS NULL OR p.outlet_id = $2) AND p.status IN ('inactive', 'discontinued')
				ORDER BY p.name ASC
			`, businessID, *outletID)
		} else {
			rows, err = db.Query(ctx, `
				SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
				       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
				       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
				FROM products p
				LEFT JOIN categories c ON p.category_id = c.id
				WHERE p.business_id = $1 AND (p.outlet_id IS NULL OR p.outlet_id = $2) AND p.status = $3
				ORDER BY p.name ASC
			`, businessID, *outletID, statusFilter)
		}
	} else {
		if statusFilter == "all" {
			rows, err = db.Query(ctx, `
				SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
				       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
				       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
				FROM products p
				LEFT JOIN categories c ON p.category_id = c.id
				WHERE p.business_id = $1 AND p.status IN ('active', 'inactive', 'discontinued')
				ORDER BY p.name ASC
			`, businessID)
		} else if statusFilter == "archived" {
			rows, err = db.Query(ctx, `
				SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
				       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
				       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
				FROM products p
				LEFT JOIN categories c ON p.category_id = c.id
				WHERE p.business_id = $1 AND p.status IN ('inactive', 'discontinued')
				ORDER BY p.name ASC
			`, businessID)
		} else {
			rows, err = db.Query(ctx, `
				SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
				       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
				       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
				FROM products p
				LEFT JOIN categories c ON p.category_id = c.id
				WHERE p.business_id = $1 AND p.status = $2
				ORDER BY p.name ASC
			`, businessID, statusFilter)
		}
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Product
	for rows.Next() {
		var p models.Product
		err = rows.Scan(
			&p.ID, &p.BusinessID, &p.OutletID, &p.SKU, &p.Name, &p.CategoryID, &p.Category,
			&p.UnitType, &p.InventoryMode, &p.PurchasePrice, &p.SellPrice,
			&p.CurrentStock, &p.MinStockAlert, &p.ImageURL, &p.Status, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, &p)
	}

	return list, nil
}

// GetProductByID retrieves a single product by ID, verified by businessID
func GetProductByID(ctx context.Context, id uuid.UUID, businessID uuid.UUID) (*models.Product, error) {
	db := config.DB
	var p models.Product

	err := db.QueryRow(ctx, `
		SELECT p.id, p.business_id, p.outlet_id, p.sku, p.name, p.category_id, c.name AS category_name, p.unit_type, 
		       p.inventory_mode, p.purchase_price, p.sell_price, p.current_stock, 
		       p.min_stock_alert, p.image_url, p.status, p.created_at, p.updated_at 
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.id = $1 AND p.business_id = $2 AND p.status IN ('active', 'inactive', 'discontinued')
	`, id, businessID).Scan(
		&p.ID, &p.BusinessID, &p.OutletID, &p.SKU, &p.Name, &p.CategoryID, &p.Category,
		&p.UnitType, &p.InventoryMode, &p.PurchasePrice, &p.SellPrice,
		&p.CurrentStock, &p.MinStockAlert, &p.Status, &p.CreatedAt, &p.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("product not found")
		}
		return nil, err
	}

	return &p, nil
}

// Helper to resolve category ID from string name dynamically (with transaction context)
func getOrCreateCategoryID(ctx context.Context, tx pgx.Tx, businessID uuid.UUID, categoryName *string) (*uuid.UUID, error) {
	if categoryName == nil || *categoryName == "" {
		return nil, nil
	}

	trimmed := *categoryName
	var catID uuid.UUID

	err := tx.QueryRow(ctx, "SELECT id FROM categories WHERE business_id = $1 AND LOWER(name) = LOWER($2)", businessID, trimmed).Scan(&catID)
	if err == pgx.ErrNoRows {
		catID = uuid.New()
		_, err = tx.Exec(ctx, "INSERT INTO categories (id, business_id, name) VALUES ($1, $2, $3)", catID, businessID, trimmed)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	return &catID, nil
}

// CreateProduct inserts a new product, auto-linking to categories
func CreateProduct(ctx context.Context, p *models.Product) (*models.Product, error) {
	db := config.DB
	
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Resolve/Create category
	p.CategoryID, err = getOrCreateCategoryID(ctx, tx, p.BusinessID, p.Category)
	if err != nil {
		return nil, err
	}

	// Default ID if empty
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	p.Status = models.StatusActive
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()

	err = tx.QueryRow(ctx, `
		INSERT INTO products (
			id, business_id, outlet_id, sku, name, category_id, unit_type, 
			inventory_mode, purchase_price, sell_price, current_stock, 
			min_stock_alert, image_url, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id, created_at, updated_at
	`, p.ID, p.BusinessID, p.OutletID, p.SKU, p.Name, p.CategoryID, p.UnitType,
		p.InventoryMode, p.PurchasePrice, p.SellPrice, p.CurrentStock,
		p.MinStockAlert, p.ImageURL, p.Status, p.CreatedAt, p.UpdatedAt,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return p, nil
}

// UpdateProduct updates an existing product
func UpdateProduct(ctx context.Context, p *models.Product) (*models.Product, error) {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Resolve/Create category
	p.CategoryID, err = getOrCreateCategoryID(ctx, tx, p.BusinessID, p.Category)
	if err != nil {
		return nil, err
	}

	p.UpdatedAt = time.Now()

	err = tx.QueryRow(ctx, `
		UPDATE products 
		SET sku = $1, name = $2, category_id = $3, unit_type = $4, 
		    inventory_mode = $5, purchase_price = $6, sell_price = $7, 
		    current_stock = $8, min_stock_alert = $9, image_url = $10, status = $11, updated_at = $12
		WHERE id = $13 AND business_id = $14 AND status IN ('active', 'inactive', 'discontinued')
		RETURNING created_at, updated_at
	`, p.SKU, p.Name, p.CategoryID, p.UnitType, p.InventoryMode, p.PurchasePrice,
		p.SellPrice, p.CurrentStock, p.MinStockAlert, p.ImageURL, p.Status, p.UpdatedAt, p.ID, p.BusinessID,
	).Scan(&p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("product not found or unauthorized to update")
		}
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return p, nil
}

// GetCategories lists categories for a business
func GetCategories(ctx context.Context, businessID uuid.UUID) ([]*models.Category, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT id, business_id, name, created_at, updated_at 
		FROM categories 
		WHERE business_id = $1 
		ORDER BY name ASC
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Category
	for rows.Next() {
		var c models.Category
		err = rows.Scan(&c.ID, &c.BusinessID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &c)
	}

	return list, nil
}

// SoftDeleteProduct deactivates a product
func SoftDeleteProduct(ctx context.Context, id uuid.UUID, businessID uuid.UUID) error {
	db := config.DB
	now := time.Now()

	cmd, err := db.Exec(ctx, `
		UPDATE products 
		SET status = 'inactive', updated_at = $1 
		WHERE id = $2 AND business_id = $3 AND status IN ('active', 'discontinued')
	`, now, id, businessID)

	if err != nil {
		return err
	}

	if cmd.RowsAffected() == 0 {
		return errors.New("product not found or unauthorized to delete")
	}

	return nil
}

// =========================================================================
// WASTAGE LOG / OPNAME SERVICES
// =========================================================================

// GetWastageLogs retrieves wastage/opname logs for approval or review
func GetWastageLogs(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]*models.WastageLog, error) {
	db := config.DB
	var rows pgx.Rows
	var err error

	if outletID != nil {
		rows, err = db.Query(ctx, `
			SELECT id, business_id, outlet_id, product_id, ingredient_id, daily_material_log_id,
			       expected_qty, actual_qty, discrepancy, input_by, status, approved_by, 
			       approved_at, created_at, updated_at
			FROM wastage_logs
			WHERE business_id = $1 AND outlet_id = $2
			ORDER BY created_at DESC
		`, businessID, *outletID)
	} else {
		rows, err = db.Query(ctx, `
			SELECT id, business_id, outlet_id, product_id, ingredient_id, daily_material_log_id,
			       expected_qty, actual_qty, discrepancy, input_by, status, approved_by, 
			       approved_at, created_at, updated_at
			FROM wastage_logs
			WHERE business_id = $1
			ORDER BY created_at DESC
		`, businessID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.WastageLog
	for rows.Next() {
		var w models.WastageLog
		err = rows.Scan(
			&w.ID, &w.BusinessID, &w.OutletID, &w.ProductID, &w.IngredientID, &w.DailyMaterialLogID,
			&w.ExpectedQty, &w.ActualQty, &w.Discrepancy, &w.InputBy, &w.Status, &w.ApprovedBy,
			&w.ApprovedAt, &w.CreatedAt, &w.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, &w)
	}

	return list, nil
}

// CreateWastageLog creates a blind count entry
func CreateWastageLog(ctx context.Context, w *models.WastageLog) (*models.WastageLog, error) {
	db := config.DB

	// 1. Get current expected stock
	var expectedStock float64
	if w.ProductID != nil {
		err := db.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1 AND business_id = $2 AND status = 'active'", *w.ProductID, w.BusinessID).Scan(&expectedStock)
		if err != nil {
			return nil, errors.New("product not found or inactive")
		}
	} else if w.IngredientID != nil {
		err := db.QueryRow(ctx, "SELECT current_stock FROM ingredients WHERE id = $1 AND business_id = $2", *w.IngredientID, w.BusinessID).Scan(&expectedStock)
		if err != nil {
			return nil, errors.New("ingredient not found")
		}
	} else {
		return nil, errors.New("either product_id or ingredient_id must be provided")
	}

	w.ID = uuid.New()
	w.ExpectedQty = expectedStock
	w.Discrepancy = w.ActualQty - w.ExpectedQty
	w.Status = models.WastagePending
	w.CreatedAt = time.Now()
	w.UpdatedAt = time.Now()

	err := db.QueryRow(ctx, `
		INSERT INTO wastage_logs (
			id, business_id, outlet_id, product_id, ingredient_id, daily_material_log_id,
			expected_qty, actual_qty, discrepancy, input_by, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at
	`, w.ID, w.BusinessID, w.OutletID, w.ProductID, w.IngredientID, w.DailyMaterialLogID,
		w.ExpectedQty, &w.ActualQty, w.Discrepancy, w.InputBy, w.Status, w.CreatedAt, w.UpdatedAt,
	).Scan(&w.ID, &w.CreatedAt, &w.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return w, nil
}

// ApproveWastageLog approves a wastage log and updates target stock (blind opname reconciliation)
func ApproveWastageLog(ctx context.Context, id uuid.UUID, businessID uuid.UUID, managerID uuid.UUID) (*models.WastageLog, error) {
	db := config.DB

	// Start database transaction
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Fetch Wastage Log
	var w models.WastageLog
	err = tx.QueryRow(ctx, `
		SELECT id, business_id, outlet_id, product_id, ingredient_id, expected_qty, 
		       actual_qty, discrepancy, input_by, status 
		FROM wastage_logs 
		WHERE id = $1 AND business_id = $2 FOR UPDATE
	`, id, businessID).Scan(
		&w.ID, &w.BusinessID, &w.OutletID, &w.ProductID, &w.IngredientID, &w.ExpectedQty,
		&w.ActualQty, &w.Discrepancy, &w.InputBy, &w.Status,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("wastage log not found")
		}
		return nil, err
	}

	if w.Status != models.WastagePending {
		return nil, errors.New("wastage log is already processed")
	}

	approvedAt := time.Now()
	w.Status = models.WastageApproved
	w.ApprovedBy = &managerID
	w.ApprovedAt = &approvedAt

	// 2. Lock & update stock to actual qty
	if w.ProductID != nil {
		_, err = tx.Exec(ctx, `
			UPDATE products 
			SET current_stock = $1, updated_at = NOW() 
			WHERE id = $2 AND business_id = $3
		`, w.ActualQty, *w.ProductID, w.BusinessID)
	} else if w.IngredientID != nil {
		_, err = tx.Exec(ctx, `
			UPDATE ingredients 
			SET current_stock = $1, updated_at = NOW() 
			WHERE id = $2 AND business_id = $3
		`, w.ActualQty, *w.IngredientID, w.BusinessID)
	}
	if err != nil {
		return nil, err
	}

	// 3. Update log status
	err = tx.QueryRow(ctx, `
		UPDATE wastage_logs
		SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING updated_at
	`, w.ApprovedBy, w.ApprovedAt, w.ID).Scan(&w.UpdatedAt)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return &w, nil
}

// RejectWastageLog rejects a wastage log entry without updating stock
func RejectWastageLog(ctx context.Context, id uuid.UUID, businessID uuid.UUID, managerID uuid.UUID) (*models.WastageLog, error) {
	db := config.DB

	var w models.WastageLog
	err := db.QueryRow(ctx, `
		SELECT id, status FROM wastage_logs WHERE id = $1 AND business_id = $2
	`, id, businessID).Scan(&w.ID, &w.Status)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("wastage log not found")
		}
		return nil, err
	}

	if w.Status != models.WastagePending {
		return nil, errors.New("wastage log is already processed")
	}

	approvedAt := time.Now()
	w.Status = models.WastageRejected
	w.ApprovedBy = &managerID
	w.ApprovedAt = &approvedAt

	err = db.QueryRow(ctx, `
		UPDATE wastage_logs
		SET status = 'rejected', approved_by = $1, approved_at = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING updated_at
	`, w.ApprovedBy, w.ApprovedAt, w.ID).Scan(&w.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &w, nil
}

// =========================================================================
// PROCUREMENT SERVICES
// =========================================================================

type ProcurementItemInput struct {
	ProductID    *uuid.UUID `json:"product_id"`
	IngredientID *uuid.UUID `json:"ingredient_id"`
	Qty          float64    `json:"qty"`
	UnitCost     int64      `json:"unit_cost"`
	WeightActual *float64   `json:"weight_actual"`
}

type CreateProcurementInput struct {
	SupplierName    string                 `json:"supplier_name"`
	TotalCost       int64                  `json:"total_cost"`
	PaymentStatus   models.PaymentStatus   `json:"payment_status"`
	AmountOwed      *int64                 `json:"amount_owed"`
	ProcurementDate time.Time              `json:"procurement_date"`
	DueDate         *time.Time             `json:"due_date"`
	Items           []ProcurementItemInput `json:"items"`
}

// GetProcurements lists procurements for workspace
func GetProcurements(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]*models.Procurement, error) {
	db := config.DB
	var rows pgx.Rows
	var err error

	if outletID != nil {
		rows, err = db.Query(ctx, `
			SELECT id, business_id, outlet_id, supplier_name, total_cost, payment_status,
			       amount_owed, procurement_date, due_date, created_by, created_at, updated_at
			FROM procurements
			WHERE business_id = $1 AND outlet_id = $2
			ORDER BY procurement_date DESC, created_at DESC
		`, businessID, *outletID)
	} else {
		rows, err = db.Query(ctx, `
			SELECT id, business_id, outlet_id, supplier_name, total_cost, payment_status,
			       amount_owed, procurement_date, due_date, created_by, created_at, updated_at
			FROM procurements
			WHERE business_id = $1
			ORDER BY procurement_date DESC, created_at DESC
		`, businessID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Procurement
	for rows.Next() {
		var p models.Procurement
		err = rows.Scan(
			&p.ID, &p.BusinessID, &p.OutletID, &p.SupplierName, &p.TotalCost, &p.PaymentStatus,
			&p.AmountOwed, &p.ProcurementDate, &p.DueDate, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		list = append(list, &p)
	}

	return list, nil
}

// CreateProcurement creates procurement, updates stock
func CreateProcurement(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, creatorID uuid.UUID, input CreateProcurementInput) (*models.Procurement, error) {
	db := config.DB

	if len(input.Items) == 0 {
		return nil, errors.New("procurement must contain at least one item")
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	pID := uuid.New()
	p := &models.Procurement{
		ID:              pID,
		BusinessID:      businessID,
		OutletID:        outletID,
		SupplierName:    input.SupplierName,
		TotalCost:       input.TotalCost,
		PaymentStatus:   input.PaymentStatus,
		AmountOwed:      input.AmountOwed,
		ProcurementDate: input.ProcurementDate,
		DueDate:         input.DueDate,
		CreatedBy:       creatorID,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if p.ProcurementDate.IsZero() {
		p.ProcurementDate = time.Now()
	}

	// Save header
	err = tx.QueryRow(ctx, `
		INSERT INTO procurements (
			id, business_id, outlet_id, supplier_name, total_cost, payment_status,
			amount_owed, procurement_date, due_date, created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`, p.ID, p.BusinessID, p.OutletID, p.SupplierName, p.TotalCost, p.PaymentStatus,
		p.AmountOwed, p.ProcurementDate, p.DueDate, p.CreatedBy, p.CreatedAt, p.UpdatedAt,
	).Scan(&p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Save items and update stock
	for _, item := range input.Items {
		var stockChange float64 = item.Qty
		if item.WeightActual != nil {
			stockChange = *item.WeightActual
		}

		piID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO procurement_items (id, procurement_id, product_id, ingredient_id, qty, unit_cost, weight_actual)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, piID, p.ID, item.ProductID, item.IngredientID, item.Qty, item.UnitCost, item.WeightActual)
		if err != nil {
			return nil, err
		}

		// Update stock
		if item.ProductID != nil {
			_, err = tx.Exec(ctx, `
				UPDATE products 
				SET current_stock = current_stock + $1, updated_at = NOW() 
				WHERE id = $2 AND business_id = $3
			`, stockChange, *item.ProductID, businessID)
		} else if item.IngredientID != nil {
			_, err = tx.Exec(ctx, `
				UPDATE ingredients 
				SET current_stock = current_stock + $1, updated_at = NOW() 
				WHERE id = $2 AND business_id = $3
			`, stockChange, *item.IngredientID, businessID)
		}
		if err != nil {
			return nil, err
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return p, nil
}

// ProcurementDetail includes the header plus joined item rows
type ProcurementDetail struct {
	models.Procurement
	Items []ProcurementItemDetail `json:"items"`
}

// ProcurementItemDetail with human-readable product name and unit
type ProcurementItemDetail struct {
	ID           uuid.UUID  `json:"id"`
	ProductID    *uuid.UUID `json:"product_id,omitempty"`
	ProductName  string     `json:"product_name"`
	ProductUnit  string     `json:"product_unit"`
	ProductSKU   string     `json:"product_sku"`
	Qty          float64    `json:"qty"`
	UnitCost     int64      `json:"unit_cost"`
	Subtotal     int64      `json:"subtotal"`
	WeightActual *float64   `json:"weight_actual,omitempty"`
}

// GetProcurementByID fetches a single procurement with its item list
func GetProcurementByID(ctx context.Context, businessID uuid.UUID, procurementID uuid.UUID) (*ProcurementDetail, error) {
	db := config.DB

	var p models.Procurement
	err := db.QueryRow(ctx, `
		SELECT id, business_id, outlet_id, supplier_name, total_cost, payment_status,
		       amount_owed, procurement_date, due_date, created_by, created_at, updated_at
		FROM procurements
		WHERE id = $1 AND business_id = $2
	`, procurementID, businessID).Scan(
		&p.ID, &p.BusinessID, &p.OutletID, &p.SupplierName, &p.TotalCost, &p.PaymentStatus,
		&p.AmountOwed, &p.ProcurementDate, &p.DueDate, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	detail := &ProcurementDetail{
		Procurement: p,
		Items:       []ProcurementItemDetail{},
	}

	rows, err := db.Query(ctx, `
		SELECT pi.id, pi.product_id, COALESCE(pr.name, ing.name, 'Item') as product_name,
		       COALESCE(pr.unit_type, ing.unit_type, 'pcs') as product_unit,
		       COALESCE(pr.sku, '') as product_sku,
		       pi.qty, pi.unit_cost, (pi.qty * pi.unit_cost)::bigint as subtotal, pi.weight_actual
		FROM procurement_items pi
		LEFT JOIN products pr ON pi.product_id = pr.id
		LEFT JOIN ingredients ing ON pi.ingredient_id = ing.id
		WHERE pi.procurement_id = $1
		ORDER BY pi.id ASC
	`, procurementID)
	if err != nil {
		return detail, nil
	}
	defer rows.Close()

	for rows.Next() {
		var it ProcurementItemDetail
		if err := rows.Scan(
			&it.ID, &it.ProductID, &it.ProductName, &it.ProductUnit, &it.ProductSKU,
			&it.Qty, &it.UnitCost, &it.Subtotal, &it.WeightActual,
		); err == nil {
			detail.Items = append(detail.Items, it)
		}
	}

	return detail, nil
}

// UpdateProcurementPayment updates payment status and remaining amount owed
func UpdateProcurementPayment(ctx context.Context, businessID uuid.UUID, procurementID uuid.UUID, paymentStatus models.PaymentStatus, amountOwed *int64) error {
	db := config.DB
	_, err := db.Exec(ctx, `
		UPDATE procurements
		SET payment_status = $1, amount_owed = $2, updated_at = NOW()
		WHERE id = $3 AND business_id = $4
	`, paymentStatus, amountOwed, procurementID, businessID)
	return err
}

// GetIngredients retrieves list of ingredients for a business context
func GetIngredients(ctx context.Context, businessID uuid.UUID) ([]*models.Ingredient, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT id, business_id, outlet_id, name, unit_type, current_stock, created_at, updated_at
		FROM ingredients
		WHERE business_id = $1
		ORDER BY name ASC
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Ingredient
	for rows.Next() {
		var i models.Ingredient
		var unitTypeStr string
		err = rows.Scan(&i.ID, &i.BusinessID, &i.OutletID, &i.Name, &unitTypeStr, &i.CurrentStock, &i.CreatedAt, &i.UpdatedAt)
		if err != nil {
			return nil, err
		}
		i.UnitType = models.UnitType(unitTypeStr)
		list = append(list, &i)
	}
	return list, nil
}

// CreateIngredient inserts a new ingredient record
func CreateIngredient(ctx context.Context, ing *models.Ingredient) (*models.Ingredient, error) {
	db := config.DB
	ing.ID = uuid.New()
	ing.CreatedAt = time.Now()
	ing.UpdatedAt = time.Now()

	_, err := db.Exec(ctx, `
		INSERT INTO ingredients (id, business_id, outlet_id, name, unit_type, current_stock, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, ing.ID, ing.BusinessID, ing.OutletID, ing.Name, string(ing.UnitType), ing.CurrentStock, ing.CreatedAt, ing.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return ing, nil
}

// UpdateIngredient updates an existing ingredient record
func UpdateIngredient(ctx context.Context, ing *models.Ingredient) (*models.Ingredient, error) {
	db := config.DB
	ing.UpdatedAt = time.Now()

	_, err := db.Exec(ctx, `
		UPDATE ingredients
		SET name = $1, unit_type = $2, current_stock = $3, updated_at = $4
		WHERE id = $5 AND business_id = $6
	`, ing.Name, string(ing.UnitType), ing.CurrentStock, ing.UpdatedAt, ing.ID, ing.BusinessID)
	if err != nil {
		return nil, err
	}
	return ing, nil
}

// DeleteIngredient deletes an ingredient record
func DeleteIngredient(ctx context.Context, id uuid.UUID, businessID uuid.UUID) error {
	db := config.DB
	_, err := db.Exec(ctx, `
		DELETE FROM ingredients WHERE id = $1 AND business_id = $2
	`, id, businessID)
	return err
}



