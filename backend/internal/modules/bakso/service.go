package bakso

import (
	"context"
	"errors"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ClosingInput struct {
	ProductID    uuid.UUID `json:"product_id"`
	ActualSealed float64   `json:"actual_sealed"`
	ActualOpened float64   `json:"actual_opened"`
}

// ProductionExpenseInput represents a material/tool used in production
type ProductionExpenseInput struct {
	IngredientID uuid.UUID `json:"ingredient_id"`
	Quantity     float64   `json:"quantity"`
}

// CreateProduction logs a production run, central stock increment, and logs expenses.
func CreateProduction(ctx context.Context, businessID uuid.UUID, productID uuid.UUID, qtyProduced float64, userID uuid.UUID, expenses []ProductionExpenseInput) (*models.Production, error) {
	db := config.DB

	// Verify product exists and belongs to the business
	var pName string
	err := db.QueryRow(ctx, "SELECT name FROM products WHERE id = $1 AND business_id = $2 AND status = 'active'", productID, businessID).Scan(&pName)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("active product not found in this business context")
		}
		return nil, err
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	prod := &models.Production{
		ID:           uuid.New(),
		BusinessID:   businessID,
		ProductID:    productID,
		QtyProduced:  qtyProduced,
		ProducedBy:   userID,
		ProducedAt:   time.Now(),
		CreatedAt:    time.Now(),
	}

	// 1. Insert Production record
	_, err = tx.Exec(ctx, `
		INSERT INTO productions (id, business_id, product_id, qty_produced, produced_by, produced_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, prod.ID, prod.BusinessID, prod.ProductID, prod.QtyProduced, prod.ProducedBy, prod.ProducedAt, prod.CreatedAt)
	if err != nil {
		return nil, err
	}

	// 2. Increase central products stock (in pack)
	_, err = tx.Exec(ctx, `
		UPDATE products 
		SET current_stock = current_stock + $1, updated_at = NOW()
		WHERE id = $2
	`, prod.QtyProduced, prod.ProductID)
	if err != nil {
		return nil, err
	}

	// 3. Log dynamic expenses/ingredients
	var prodExpenses []models.ProductionExpense
	for _, exp := range expenses {
		// Verify ingredient exists and belongs to the business
		var ingName string
		err := tx.QueryRow(ctx, "SELECT name FROM ingredients WHERE id = $1 AND business_id = $2", exp.IngredientID, businessID).Scan(&ingName)
		if err != nil {
			return nil, errors.New("ingredient not found in this business context")
		}

		pe := models.ProductionExpense{
			ID:           uuid.New(),
			ProductionID: prod.ID,
			IngredientID: exp.IngredientID,
			Quantity:     exp.Quantity,
			CreatedAt:    time.Now(),
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO production_expenses (id, production_id, ingredient_id, quantity, created_at)
			VALUES ($1, $2, $3, $4, $5)
		`, pe.ID, pe.ProductionID, pe.IngredientID, pe.Quantity, pe.CreatedAt)
		if err != nil {
			return nil, err
		}
		prodExpenses = append(prodExpenses, pe)
	}
	prod.Expenses = prodExpenses

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return prod, nil
}

// GetProductions retrieves production history for the business including expenses
func GetProductions(ctx context.Context, businessID uuid.UUID) ([]*models.Production, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT id, business_id, product_id, qty_produced, produced_by, produced_at, created_at
		FROM productions
		WHERE business_id = $1
		ORDER BY produced_at DESC
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Production
	for rows.Next() {
		var p models.Production
		err = rows.Scan(&p.ID, &p.BusinessID, &p.ProductID, &p.QtyProduced, &p.ProducedBy, &p.ProducedAt, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &p)
	}
	rows.Close() // close early to release connection for nested queries

	for _, p := range list {
		rowsEx, err := db.Query(ctx, `
			SELECT id, production_id, ingredient_id, quantity, created_at
			FROM production_expenses
			WHERE production_id = $1
		`, p.ID)
		if err != nil {
			return nil, err
		}
		var expenses []models.ProductionExpense
		for rowsEx.Next() {
			var pe models.ProductionExpense
			err = rowsEx.Scan(&pe.ID, &pe.ProductionID, &pe.IngredientID, &pe.Quantity, &pe.CreatedAt)
			if err != nil {
				rowsEx.Close()
				return nil, err
			}
			expenses = append(expenses, pe)
		}
		rowsEx.Close()
		p.Expenses = expenses
	}

	return list, nil
}

// CreateDistribution registers a stock dispatch from central warehouse to a staff's point of sale
func CreateDistribution(ctx context.Context, businessID uuid.UUID, productID uuid.UUID, sentToUserID uuid.UUID, qty float64, senderUserID uuid.UUID) (*models.Distribution, error) {
	db := config.DB

	// 1. Check central stock
	var currentStock float64
	err := db.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1 AND business_id = $2", productID, businessID).Scan(&currentStock)
	if err != nil {
		return nil, errors.New("product not found")
	}

	if currentStock < qty {
		return nil, errors.New("insufficient central stock to distribute")
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	dist := &models.Distribution{
		ID:           uuid.New(),
		BusinessID:   businessID,
		ProductID:    productID,
		SentToUserID: sentToUserID,
		Qty:          qty,
		Status:       models.DistSent,
		Type:         models.TypeOutbound,
		SentAt:       time.Now(),
		CreatedAt:    time.Now(),
	}

	// 2. Insert Distribution record
	_, err = tx.Exec(ctx, `
		INSERT INTO distributions (id, business_id, product_id, sent_to_user_id, qty, status, type, sent_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, dist.ID, dist.BusinessID, dist.ProductID, dist.SentToUserID, dist.Qty, string(dist.Status), string(dist.Type), dist.SentAt, dist.CreatedAt)
	if err != nil {
		return nil, err
	}

	// 3. Deduct stock from central products
	_, err = tx.Exec(ctx, `
		UPDATE products 
		SET current_stock = current_stock - $1, updated_at = NOW()
		WHERE id = $2
	`, dist.Qty, dist.ProductID)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return dist, nil
}

// ReceiveDistribution marks distribution as received and transfers packs to receiver's sealed stock batch
func ReceiveDistribution(ctx context.Context, distributionID uuid.UUID, sentToUserID uuid.UUID) (*models.Distribution, error) {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var dist models.Distribution
	var distType string
	err = tx.QueryRow(ctx, `
		SELECT id, business_id, product_id, sent_to_user_id, qty, status, type, sent_at, received_at, created_at
		FROM distributions
		WHERE id = $1 AND sent_to_user_id = $2 FOR UPDATE
	`, distributionID, sentToUserID).Scan(
		&dist.ID, &dist.BusinessID, &dist.ProductID, &dist.SentToUserID, &dist.Qty, &dist.Status, &distType,
		&dist.SentAt, &dist.ReceivedAt, &dist.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("distribution record not found or unauthorized")
		}
		return nil, err
	}

	dist.Type = models.DistributionType(distType)

	if dist.Type != models.TypeOutbound {
		return nil, errors.New("cannot receive a non-outbound distribution from this endpoint")
	}

	if dist.Status == models.DistReceived {
		return nil, errors.New("distribution has already been received")
	}

	now := time.Now()
	dist.Status = models.DistReceived
	dist.ReceivedAt = &now

	// 1. Update distribution status
	_, err = tx.Exec(ctx, `
		UPDATE distributions
		SET status = 'received', received_at = $1
		WHERE id = $2
	`, now, distributionID)
	if err != nil {
		return nil, err
	}

	// 2. Add to staff's sealed stock batch
	var batchID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id FROM stock_batches
		WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'sealed'
		FOR UPDATE
	`, dist.ProductID, dist.SentToUserID).Scan(&batchID)

	if err == pgx.ErrNoRows {
		// Create new sealed batch
		_, err = tx.Exec(ctx, `
			INSERT INTO stock_batches (id, business_id, product_id, held_by_user_id, batch_status, quantity, distribution_id)
			VALUES ($1, $2, $3, $4, 'sealed', $5, $6)
		`, uuid.New(), dist.BusinessID, dist.ProductID, dist.SentToUserID, dist.Qty, dist.ID)
	} else if err != nil {
		return nil, err
	} else {
		// Update sealed batch
		_, err = tx.Exec(ctx, `
			UPDATE stock_batches
			SET quantity = quantity + $1
			WHERE id = $2
		`, dist.Qty, batchID)
	}
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return &dist, nil
}

// GetDistributions retrieves distribution records for a business or specific receiver
func GetDistributions(ctx context.Context, businessID uuid.UUID, sentToUserID *uuid.UUID) ([]*models.Distribution, error) {
	db := config.DB
	var rows pgx.Rows
	var err error

	if sentToUserID != nil {
		rows, err = db.Query(ctx, `
			SELECT id, business_id, product_id, sent_to_user_id, qty, status, type, production_id, sent_at, received_at, created_at
			FROM distributions
			WHERE business_id = $1 AND sent_to_user_id = $2
			ORDER BY sent_at DESC
		`, businessID, *sentToUserID)
	} else {
		rows, err = db.Query(ctx, `
			SELECT id, business_id, product_id, sent_to_user_id, qty, status, type, production_id, sent_at, received_at, created_at
			FROM distributions
			WHERE business_id = $1
			ORDER BY sent_at DESC
		`, businessID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Distribution
	for rows.Next() {
		var d models.Distribution
		var distType string
		err = rows.Scan(&d.ID, &d.BusinessID, &d.ProductID, &d.SentToUserID, &d.Qty, &d.Status, &distType, &d.ProductionID, &d.SentAt, &d.ReceivedAt, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		d.Type = models.DistributionType(distType)
		list = append(list, &d)
	}
	return list, nil
}

// ThawBatch converts sealed packs into opened pcs
func ThawBatch(ctx context.Context, userID uuid.UUID, productID uuid.UUID, qtyPacks float64) error {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var businessID uuid.UUID
	err = tx.QueryRow(ctx, "SELECT business_id FROM products WHERE id = $1", productID).Scan(&businessID)
	if err != nil {
		return err
	}

	// 1. Verify sealed batch stock
	var sealedBatchID uuid.UUID
	var currentSealedQty float64
	err = tx.QueryRow(ctx, `
		SELECT id, quantity FROM stock_batches
		WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'sealed'
		FOR UPDATE
	`, productID, userID).Scan(&sealedBatchID, &currentSealedQty)

	if err != nil {
		if err == pgx.ErrNoRows {
			return errors.New("no sealed packs available to thaw")
		}
		return err
	}

	if currentSealedQty < qtyPacks {
		return errors.New("insufficient sealed packs to thaw")
	}

	// 2. Fetch conversion rate (pack -> pcs)
	var convRate float64 = 20 // default to 20 as per spec
	_ = tx.QueryRow(ctx, `
		SELECT conversion_rate FROM stock_conversions
		WHERE product_id = $1 AND from_unit = 'pack' AND to_unit = 'pcs'
	`, productID).Scan(&convRate)

	qtyPcs := qtyPacks * convRate

	// 3. Deduct sealed packs
	_, err = tx.Exec(ctx, `
		UPDATE stock_batches
		SET quantity = quantity - $1
		WHERE id = $2
	`, qtyPacks, sealedBatchID)
	if err != nil {
		return err
	}

	// 4. Increment or create opened pcs batch
	var openedBatchID uuid.UUID
	var currentOpenedQty float64
	err = tx.QueryRow(ctx, `
		SELECT id, quantity FROM stock_batches
		WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'opened'
		FOR UPDATE
	`, productID, userID).Scan(&openedBatchID, &currentOpenedQty)

	now := time.Now()
	if err == pgx.ErrNoRows {
		_, err = tx.Exec(ctx, `
			INSERT INTO stock_batches (id, business_id, product_id, held_by_user_id, batch_status, quantity, opened_at, quality_check_status)
			VALUES ($1, $2, $3, $4, 'opened', $5, $6, 'pass')
		`, uuid.New(), businessID, productID, userID, qtyPcs, now)
	} else if err != nil {
		return err
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE stock_batches
			SET quantity = quantity + $1, opened_at = $2, quality_check_status = 'pass'
			WHERE id = $3
		`, qtyPcs, now, openedBatchID)
	}
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// QualityCheckBatch changes the QC status of an opened batch
func QualityCheckBatch(ctx context.Context, batchID uuid.UUID, status string, userID uuid.UUID, businessID uuid.UUID, outletID uuid.UUID) error {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var b models.StockBatch
	err = tx.QueryRow(ctx, `
		SELECT id, product_id, held_by_user_id, batch_status, quantity, opened_at, quality_checked_at, quality_check_status, created_at
		FROM stock_batches
		WHERE id = $1 FOR UPDATE
	`, batchID).Scan(&b.ID, &b.ProductID, &b.HeldByUserID, &b.BatchStatus, &b.Quantity, &b.OpenedAt, &b.QualityCheckedAt, &b.QualityCheckStatus, &b.CreatedAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			return errors.New("batch not found")
		}
		return err
	}

	if b.BatchStatus != models.BatchOpened {
		return errors.New("only opened batches require quality checks")
	}

	now := time.Now()
	qcs := models.QualityCheckStatus(status)

	// 1. Update QC status
	_, err = tx.Exec(ctx, `
		UPDATE stock_batches
		SET quality_check_status = $1, quality_checked_at = $2
		WHERE id = $3
	`, status, now, batchID)
	if err != nil {
		return err
	}

	// 2. If discard, log as wastage and set quantity to 0
	if qcs == models.QCDiscard && b.Quantity > 0 {
		_, err = tx.Exec(ctx, `
			UPDATE stock_batches
			SET quantity = 0
			WHERE id = $1
		`, batchID)
		if err != nil {
			return err
		}

		// Log wastage
		_, err = tx.Exec(ctx, `
			INSERT INTO wastage_logs (id, business_id, outlet_id, product_id, stock_batch_id, expected_qty, actual_qty, discrepancy, input_by, status, source_stage, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'pending_approval', 'qc_discard', NOW(), NOW())
		`, uuid.New(), businessID, outletID, b.ProductID, batchID, b.Quantity, -b.Quantity, userID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// CloseDailyStock submits closing quantities and logs discrepancies as wastage
func CloseDailyStock(ctx context.Context, userID uuid.UUID, businessID uuid.UUID, outletID uuid.UUID, inputs []ClosingInput) error {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, input := range inputs {
		// 1. Reconcile Sealed
		var sealedBatchID uuid.UUID
		var expectedSealed float64 = 0
		err = tx.QueryRow(ctx, `
			SELECT id, quantity FROM stock_batches
			WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'sealed'
			FOR UPDATE
		`, input.ProductID, userID).Scan(&sealedBatchID, &expectedSealed)

		if err != nil && err != pgx.ErrNoRows {
			return err
		}

		sealedDiscrepancy := input.ActualSealed - expectedSealed
		if sealedDiscrepancy != 0 {
			var sbID uuid.UUID
			if sealedBatchID != uuid.Nil {
				sbID = sealedBatchID
			} else {
				sbID = uuid.New()
			}

			// Write discrepancy to wastage_logs
			_, err = tx.Exec(ctx, `
				INSERT INTO wastage_logs (id, business_id, outlet_id, product_id, stock_batch_id, expected_qty, actual_qty, discrepancy, input_by, status, source_stage, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_approval', 'daily_closing', NOW(), NOW())
			`, uuid.New(), businessID, outletID, input.ProductID, sbID, expectedSealed, input.ActualSealed, sealedDiscrepancy, userID)
			if err != nil {
				return err
			}

			// Adjust current batch
			if sealedBatchID != uuid.Nil {
				_, err = tx.Exec(ctx, "UPDATE stock_batches SET quantity = $1 WHERE id = $2", input.ActualSealed, sealedBatchID)
			} else {
				_, err = tx.Exec(ctx, `
					INSERT INTO stock_batches (id, business_id, product_id, held_by_user_id, batch_status, quantity)
					VALUES ($1, $2, $3, $4, 'sealed', $5)
				`, sbID, businessID, input.ProductID, userID, input.ActualSealed)
			}
			if err != nil {
				return err
			}
		}

		// 2. Reconcile Opened
		var openedBatchID uuid.UUID
		var expectedOpened float64 = 0
		err = tx.QueryRow(ctx, `
			SELECT id, quantity FROM stock_batches
			WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'opened'
			FOR UPDATE
		`, input.ProductID, userID).Scan(&openedBatchID, &expectedOpened)

		if err != nil && err != pgx.ErrNoRows {
			return err
		}

		openedDiscrepancy := input.ActualOpened - expectedOpened
		if openedDiscrepancy != 0 {
			var obID uuid.UUID
			if openedBatchID != uuid.Nil {
				obID = openedBatchID
			} else {
				obID = uuid.New()
			}

			// Write discrepancy to wastage_logs
			_, err = tx.Exec(ctx, `
				INSERT INTO wastage_logs (id, business_id, outlet_id, product_id, stock_batch_id, expected_qty, actual_qty, discrepancy, input_by, status, source_stage, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_approval', 'daily_closing', NOW(), NOW())
			`, uuid.New(), businessID, outletID, input.ProductID, obID, expectedOpened, input.ActualOpened, openedDiscrepancy, userID)
			if err != nil {
				return err
			}

			// Adjust current batch
			if openedBatchID != uuid.Nil {
				_, err = tx.Exec(ctx, "UPDATE stock_batches SET quantity = $1 WHERE id = $2", input.ActualOpened, openedBatchID)
			} else {
				_, err = tx.Exec(ctx, `
					INSERT INTO stock_batches (id, business_id, product_id, held_by_user_id, batch_status, quantity, opened_at, quality_check_status)
					VALUES ($1, $2, $3, 'opened', $4, NOW(), 'pass')
				`, obID, businessID, input.ProductID, userID, input.ActualOpened)
			}
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

// GetStockBatches retrieves current stock batches (both sealed and opened) for a user
func GetStockBatches(ctx context.Context, userID uuid.UUID) ([]*models.StockBatch, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT id, business_id, outlet_id, product_id, held_by_user_id, batch_status, quantity, distribution_id, opened_at, quality_checked_at, quality_check_status, created_at
		FROM stock_batches
		WHERE held_by_user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.StockBatch
	for rows.Next() {
		var b models.StockBatch
		err = rows.Scan(&b.ID, &b.BusinessID, &b.OutletID, &b.ProductID, &b.HeldByUserID, &b.BatchStatus, &b.Quantity, &b.DistributionID, &b.OpenedAt, &b.QualityCheckedAt, &b.QualityCheckStatus, &b.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &b)
	}
	return list, nil
}

// GetStockAlerts retrieves products under min_stock_alert for central warehouse
func GetStockAlerts(ctx context.Context, businessID uuid.UUID) ([]*models.Product, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT id, business_id, outlet_id, sku, name, unit_type, inventory_mode, purchase_price, sell_price, current_stock, min_stock_alert, status, created_at, updated_at
		FROM products
		WHERE business_id = $1 AND current_stock <= min_stock_alert AND status = 'active'
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Product
	for rows.Next() {
		var p models.Product
		err = rows.Scan(&p.ID, &p.BusinessID, &p.OutletID, &p.SKU, &p.Name, &p.UnitType, &p.InventoryMode, &p.PurchasePrice, &p.SellPrice, &p.CurrentStock, &p.MinStockAlert, &p.Status, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &p)
	}
	return list, nil
}

// CreateReturn registers a return dispatch from staff to central warehouse
func CreateReturn(ctx context.Context, businessID uuid.UUID, productID uuid.UUID, staffUserID uuid.UUID, qty float64) (*models.Distribution, error) {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Verify staff has enough sealed batch stock
	var batchID uuid.UUID
	var currentQty float64
	err = tx.QueryRow(ctx, `
		SELECT id, quantity FROM stock_batches
		WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'sealed'
		FOR UPDATE
	`, productID, staffUserID).Scan(&batchID, &currentQty)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("no sealed stock batch found for this product")
		}
		return nil, err
	}

	if currentQty < qty {
		return nil, errors.New("insufficient sealed stock to return")
	}

	// 2. Deduct from staff sealed stock
	_, err = tx.Exec(ctx, `
		UPDATE stock_batches
		SET quantity = quantity - $1
		WHERE id = $2
	`, qty, batchID)
	if err != nil {
		return nil, err
	}

	// 3. Create distribution record of type 'return', status 'sent'
	dist := &models.Distribution{
		ID:           uuid.New(),
		BusinessID:   businessID,
		ProductID:    productID,
		SentToUserID: staffUserID,
		Qty:          qty,
		Status:       models.DistSent,
		Type:         models.TypeReturn,
		SentAt:       time.Now(),
		CreatedAt:    time.Now(),
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO distributions (id, business_id, product_id, sent_to_user_id, qty, status, type, sent_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, dist.ID, dist.BusinessID, dist.ProductID, dist.SentToUserID, dist.Qty, string(dist.Status), string(dist.Type), dist.SentAt, dist.CreatedAt)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return dist, nil
}

// ReceiveReturn registers return receipt at central warehouse, returning packs to central stock
func ReceiveReturn(ctx context.Context, distributionID uuid.UUID, businessID uuid.UUID) (*models.Distribution, error) {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var dist models.Distribution
	var distType string
	err = tx.QueryRow(ctx, `
		SELECT id, business_id, product_id, sent_to_user_id, qty, status, type, sent_at, received_at, created_at
		FROM distributions
		WHERE id = $1 AND business_id = $2 FOR UPDATE
	`, distributionID, businessID).Scan(
		&dist.ID, &dist.BusinessID, &dist.ProductID, &dist.SentToUserID, &dist.Qty, &dist.Status, &distType,
		&dist.SentAt, &dist.ReceivedAt, &dist.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("distribution return record not found")
		}
		return nil, err
	}

	dist.Type = models.DistributionType(distType)

	if dist.Type != models.TypeReturn {
		return nil, errors.New("distribution is not a return")
	}

	if dist.Status == models.DistReceived {
		return nil, errors.New("return has already been received")
	}

	now := time.Now()
	dist.Status = models.DistReceived
	dist.ReceivedAt = &now

	// 1. Update distribution status
	_, err = tx.Exec(ctx, `
		UPDATE distributions
		SET status = 'received', received_at = $1
		WHERE id = $2
	`, now, distributionID)
	if err != nil {
		return nil, err
	}

	// 2. Add back to central product stock
	_, err = tx.Exec(ctx, `
		UPDATE products
		SET current_stock = current_stock + $1, updated_at = NOW()
		WHERE id = $2
	`, dist.Qty, dist.ProductID)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return &dist, nil
}
