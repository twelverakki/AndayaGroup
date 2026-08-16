package transactions

import (
	"context"
	"errors"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// =========================================================================
// SHIFT SERVICES
// =========================================================================

// GetActiveShift gets the current active open shift for a staff at an outlet
func GetActiveShift(ctx context.Context, staffID uuid.UUID, outletID uuid.UUID) (*models.Shift, error) {
	db := config.DB
	var s models.Shift

	err := db.QueryRow(ctx, `
		SELECT id, outlet_id, staff_id, opening_cash, closing_cash_system, 
		       closing_cash_actual, variance, status, opened_at, closed_at 
		FROM shifts 
		WHERE staff_id = $1 AND outlet_id = $2 AND status = 'open'
	`, staffID, outletID).Scan(
		&s.ID, &s.OutletID, &s.StaffID, &s.OpeningCash, &s.ClosingCashSystem,
		&s.ClosingCashActual, &s.Variance, &s.Status, &s.OpenedAt, &s.ClosedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No active shift
		}
		return nil, err
	}

	return &s, nil
}

// OpenShift starts a new cashier shift session
func OpenShift(ctx context.Context, outletID uuid.UUID, staffID uuid.UUID, openingCash int64) (*models.Shift, error) {
	db := config.DB

	// Check if already has an open shift
	active, err := GetActiveShift(ctx, staffID, outletID)
	if err != nil {
		return nil, err
	}
	if active != nil {
		return nil, errors.New("you already have an active open shift. Please close it first")
	}

	s := &models.Shift{
		ID:          uuid.New(),
		OutletID:    outletID,
		StaffID:     staffID,
		OpeningCash: openingCash,
		Status:      models.ShiftOpen,
		OpenedAt:    time.Now(),
	}

	err = db.QueryRow(ctx, `
		INSERT INTO shifts (id, outlet_id, staff_id, opening_cash, status, opened_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, opened_at
	`, s.ID, s.OutletID, s.StaffID, s.OpeningCash, s.Status, s.OpenedAt).Scan(&s.ID, &s.OpenedAt)

	if err != nil {
		return nil, err
	}

	return s, nil
}

// CloseShift closes a cashier shift, calculating cash system and reconciliation variance
func CloseShift(ctx context.Context, id uuid.UUID, closingCashActual int64) (*models.Shift, error) {
	db := config.DB

	// 1. Get Shift
	var s models.Shift
	err := db.QueryRow(ctx, `
		SELECT id, outlet_id, staff_id, opening_cash, status, opened_at 
		FROM shifts WHERE id = $1
	`, id).Scan(&s.ID, &s.OutletID, &s.StaffID, &s.OpeningCash, &s.Status, &s.OpenedAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("shift not found")
		}
		return nil, err
	}

	if s.Status == models.ShiftClosed {
		return nil, errors.New("shift is already closed")
	}

	// 2. Calculate system cash from sales under this shift
	// We sum cash payments from completed sale transactions
	var systemSales int64
	err = db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_amount), 0) 
		FROM transactions 
		WHERE shift_id = $1 AND type = 'sale' AND status = 'completed' AND payment_method = 'cash'
	`, s.ID).Scan(&systemSales)
	if err != nil {
		return nil, err
	}

	// Variance calculation: actual - (opening + sales)
	closingCashSystem := s.OpeningCash + systemSales
	variance := closingCashActual - closingCashSystem
	closedAt := time.Now()

	s.ClosingCashSystem = &closingCashSystem
	s.ClosingCashActual = &closingCashActual
	s.Variance = &variance
	s.Status = models.ShiftClosed
	s.ClosedAt = &closedAt

	err = db.QueryRow(ctx, `
		UPDATE shifts 
		SET closing_cash_system = $1, closing_cash_actual = $2, variance = $3, 
		    status = 'closed', closed_at = $4
		WHERE id = $5
		RETURNING closed_at
	`, *s.ClosingCashSystem, *s.ClosingCashActual, *s.Variance, s.ClosedAt, s.ID).Scan(&s.ClosedAt)

	if err != nil {
		return nil, err
	}

	return &s, nil
}

// =========================================================================
// TRANSACTION SERVICES
// =========================================================================

type TxItemInput struct {
	ProductID uuid.UUID `json:"product_id"`
	Qty       float64   `json:"qty"`
}

type CreateTxInput struct {
	ClientUUID    uuid.UUID       `json:"client_uuid"`
	TotalAmount   int64           `json:"total_amount"`
	PaymentMethod models.PaymentMethod `json:"payment_method"`
	Type          models.TransactionType   `json:"type"` // sale, internal_take, void
	Items         []TxItemInput   `json:"items"`
	
	// Optional Manager Override details (for void or price overrides)
	ManagerPIN *string `json:"manager_pin,omitempty"`
	Reason     *string `json:"reason,omitempty"`
}

// CreateTransaction saves a transaction, deducts stock, and performs idempotency validation
func CreateTransaction(ctx context.Context, businessID uuid.UUID, outletID uuid.UUID, staffID uuid.UUID, input CreateTxInput) (*models.Transaction, error) {
	db := config.DB

	// 1. Idempotency Check: check if client_uuid already exists
	var existing models.Transaction
	err := db.QueryRow(ctx, `
		SELECT id, business_id, outlet_id, shift_id, staff_id, type, total_amount, 
		       payment_method, status, client_uuid, synced_at, created_at, updated_at 
		FROM transactions 
		WHERE client_uuid = $1
	`, input.ClientUUID).Scan(
		&existing.ID, &existing.BusinessID, &existing.OutletID, &existing.ShiftID,
		&existing.StaffID, &existing.Type, &existing.TotalAmount, &existing.PaymentMethod,
		&existing.Status, &existing.ClientUUID, &existing.SyncedAt, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err == nil {
		// Idempotency: Return existing transaction
		return &existing, nil
	} else if err != pgx.ErrNoRows {
		return nil, err
	}

	// 2. Fetch Active Open Shift for POS sales
	var shiftID *uuid.UUID
	if input.Type == models.TxSale {
		activeShift, err := GetActiveShift(ctx, staffID, outletID)
		if err != nil {
			return nil, err
		}
		if activeShift == nil {
			return nil, errors.New("cashier shift is not open. Please open a shift first before making sales")
		}
		shiftID = &activeShift.ID
	}

	// 3. Manager Override Check for Void transactions
	var managerID *uuid.UUID
	if input.Type == models.TxVoid {
		if input.ManagerPIN == nil || *input.ManagerPIN == "" {
			return nil, errors.New("manager override PIN is required for void transactions")
		}
		
		// Authenticate Manager PIN
		var mID uuid.UUID
		err = db.QueryRow(ctx, `
			SELECT mp.user_id 
			FROM manager_pins mp
			JOIN outlet_staff os ON mp.user_id = os.user_id
			WHERE os.outlet_id = $1 AND os.role = 'manager' AND os.status = 'active'
		`, outletID).Scan(&mID) // In production, we'd hash the pin and compare, let's check:
		
		if err != nil {
			return nil, errors.New("no active manager configured for this outlet")
		}

		// Verify PIN against DB hash
		var pinHash string
		err = db.QueryRow(ctx, "SELECT pin_hash FROM manager_pins WHERE user_id = $1", mID).Scan(&pinHash)
		if err != nil {
			return nil, errors.New("unauthorized manager pin")
		}

		// Compare PIN using bcrypt
		// In service.go, we import golang.org/x/crypto/bcrypt
		// Let's import it if we need it
		err = comparePIN(pinHash, *input.ManagerPIN)
		if err != nil {
			return nil, errors.New("invalid manager override PIN")
		}
		
		managerID = &mID
	}

	// 4. Start database transaction
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Save transaction header
	txID := uuid.New()
	t := &models.Transaction{
		ID:            txID,
		BusinessID:    businessID,
		OutletID:      outletID,
		ShiftID:       shiftID,
		StaffID:       staffID,
		Type:          input.Type,
		TotalAmount:   0, // Will calculate from items
		PaymentMethod: input.PaymentMethod,
		Status:        models.TxCompleted,
		ClientUUID:    input.ClientUUID,
		SyncedAt:      nil, // Set at sync time (usually now)
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if input.Type == models.TxVoid {
		t.Status = models.TxVoided
	}

	var calculatedTotal int64 = 0
	savedItems := []*models.TransactionItem{}

	// 5. Process items
	for _, item := range input.Items {
		// Fetch product
		var p models.Product
		err = tx.QueryRow(ctx, `
			SELECT id, name, sell_price, current_stock, inventory_mode 
			FROM products 
			WHERE id = $1 AND business_id = $2 FOR UPDATE
		`, item.ProductID, businessID).Scan(&p.ID, &p.Name, &p.SellPrice, &p.CurrentStock, &p.InventoryMode)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil, errors.New("product not found: " + item.ProductID.String())
			}
			return nil, err
		}

		// Inventory Mode stock checks
		if p.InventoryMode == models.ModeDryStrict && t.Type == models.TxSale {
			if p.CurrentStock < item.Qty {
				return nil, errors.New("insufficient stock for product: " + p.Name)
			}
		}

		// Deduct stock for active sales and internal takes
		if t.Type == models.TxSale || t.Type == models.TxInternalTake {
			if p.InventoryMode == models.ModeBatchThaw {
				// Deduct from staff's opened batch
				var batchID uuid.UUID
				var currentBatchQty float64
				err = tx.QueryRow(ctx, `
					SELECT id, quantity FROM stock_batches 
					WHERE product_id = $1 AND held_by_user_id = $2 AND batch_status = 'opened'
					FOR UPDATE
				`, p.ID, t.StaffID).Scan(&batchID, &currentBatchQty)

				if err == pgx.ErrNoRows {
					// Create a new opened batch with negative quantity (bypass check, allow negative stock)
					_, err = tx.Exec(ctx, `
						INSERT INTO stock_batches (id, product_id, held_by_user_id, batch_status, quantity, opened_at, quality_check_status)
						VALUES ($1, $2, $3, 'opened', $4, NOW(), 'pass')
					`, uuid.New(), p.ID, t.StaffID, -item.Qty)
				} else if err != nil {
					return nil, err
				} else {
					// Update existing opened batch
					_, err = tx.Exec(ctx, `
						UPDATE stock_batches SET quantity = quantity - $1
						WHERE id = $2
					`, item.Qty, batchID)
				}
				if err != nil {
					return nil, err
				}
			} else {
				newStock := p.CurrentStock - item.Qty
				_, err = tx.Exec(ctx, "UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2", newStock, p.ID)
				if err != nil {
					return nil, err
				}
			}
		}

		subtotal := int64(item.Qty * float64(p.SellPrice))
		// If it's an internal take, we can allow $0 or cost price, let's keep sell price but mark type
		calculatedTotal += subtotal

		ti := &models.TransactionItem{
			ID:            uuid.New(),
			TransactionID: txID,
			ProductID:     p.ID,
			Qty:           item.Qty,
			UnitPrice:     p.SellPrice,
			Subtotal:      subtotal,
			CreatedAt:     time.Now(),
		}
		savedItems = append(savedItems, ti)
	}

	t.TotalAmount = calculatedTotal
	if input.Type == models.TxInternalTake {
		// As per PRD, internal take records consumption (could be priced at Rp0 or cost price)
		// We keep the original total amount but mark transaction type
	}

	// 6. Insert Transaction Header
	now := time.Now()
	t.SyncedAt = &now // Set synced_at as it's being written to backend
	err = tx.QueryRow(ctx, `
		INSERT INTO transactions (
			id, business_id, outlet_id, shift_id, staff_id, type, 
			total_amount, payment_method, status, client_uuid, synced_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING created_at, updated_at
	`, t.ID, t.BusinessID, t.OutletID, t.ShiftID, t.StaffID, t.Type,
		t.TotalAmount, t.PaymentMethod, t.Status, t.ClientUUID, t.SyncedAt, t.CreatedAt, t.UpdatedAt,
	).Scan(&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// 7. Insert Transaction Items
	for _, ti := range savedItems {
		_, err = tx.Exec(ctx, `
			INSERT INTO transaction_items (id, transaction_id, product_id, qty, unit_price, subtotal, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, ti.ID, ti.TransactionID, ti.ProductID, ti.Qty, ti.UnitPrice, ti.Subtotal, ti.CreatedAt)
		if err != nil {
			return nil, err
		}
	}

	// 8. Log Manager Override if it is a void transaction
	if t.Type == models.TxVoid && managerID != nil {
		reason := "Void transaction"
		if input.Reason != nil {
			reason = *input.Reason
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO override_logs (id, transaction_id, staff_id, manager_id, action, reason, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.New(), t.ID, staffID, *managerID, models.ActionVoid, reason, time.Now())
		if err != nil {
			return nil, err
		}
	}

	// 9. Commit transaction
	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return t, nil
}

type TransactionDetail struct {
	models.Transaction
	StaffName string                   `json:"staff_name,omitempty"`
	Items     []models.TransactionItem `json:"items,omitempty"`
}

type VoidTxInput struct {
	ManagerPIN string `json:"manager_pin"`
	Reason     string `json:"reason"`
}

type TopProductSummary struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	Category    string    `json:"category"`
	QtySold     float64   `json:"qty_sold"`
	TotalSales  int64     `json:"total_sales"`
}

type DailySalesTrend struct {
	Date       string `json:"date"`
	GrossSales int64  `json:"gross_sales"`
	TxCount    int    `json:"tx_count"`
}

type PaymentMethodBreakdown struct {
	Method     string  `json:"method"`
	TotalSales int64   `json:"total_sales"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type SalesReportSummary struct {
	TotalGrossSales   int64                    `json:"total_gross_sales"`
	TotalNetSales     int64                    `json:"total_net_sales"`
	TotalTransactions int                      `json:"total_transactions"`
	TotalItemsSold    float64                  `json:"total_items_sold"`
	AverageOrderValue int64                    `json:"average_order_value"`
	TotalTax          int64                    `json:"total_tax"`
	TotalDiscount     int64                    `json:"total_discount"`
	TotalVoidCount    int                      `json:"total_void_count"`
	TotalVoidAmount   int64                    `json:"total_void_amount"`
	PaymentBreakdown  []PaymentMethodBreakdown `json:"payment_breakdown"`
	TopProducts       []TopProductSummary      `json:"top_products"`
	DailyTrends       []DailySalesTrend        `json:"daily_trends"`
}

// GetTransactions gets transactions with optional shift or date filters
func GetTransactions(ctx context.Context, outletID uuid.UUID, shiftID *uuid.UUID) ([]TransactionDetail, error) {
	db := config.DB

	query := `
		SELECT t.id, t.business_id, t.outlet_id, t.shift_id, t.staff_id, 
		       t.type, t.total_amount, t.payment_method, t.status, t.client_uuid, t.synced_at, 
		       t.created_at, t.updated_at, COALESCE(u.name, 'Staff') as staff_name
		FROM transactions t
		LEFT JOIN users u ON t.staff_id = u.id
		WHERE t.outlet_id = $1
	`
	var rows pgx.Rows
	var err error
	if shiftID != nil {
		query += ` AND t.shift_id = $2 ORDER BY t.created_at DESC LIMIT 100`
		rows, err = db.Query(ctx, query, outletID, *shiftID)
	} else {
		query += ` ORDER BY t.created_at DESC LIMIT 200`
		rows, err = db.Query(ctx, query, outletID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []TransactionDetail
	for rows.Next() {
		var td TransactionDetail
		err := rows.Scan(
			&td.ID, &td.BusinessID, &td.OutletID, &td.ShiftID, &td.StaffID, &td.Type,
			&td.TotalAmount, &td.PaymentMethod, &td.Status, &td.ClientUUID, &td.SyncedAt,
			&td.CreatedAt, &td.UpdatedAt, &td.StaffName,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, td)
	}

	return result, nil
}

// GetSalesReportSummary aggregates sales metrics, payment distribution, top products and trends
func GetSalesReportSummary(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, startDate, endDate *time.Time, paymentMethod string, txType string) (*SalesReportSummary, error) {
	db := config.DB
	res := &SalesReportSummary{
		PaymentBreakdown: []PaymentMethodBreakdown{},
		TopProducts:      []TopProductSummary{},
		DailyTrends:      []DailySalesTrend{},
	}

	// 1. Base query filter clauses
	whereClause := "WHERE t.business_id = $1"
	args := []interface{}{businessID}
	argIdx := 2

	if outletID != nil && *outletID != uuid.Nil {
		whereClause += " AND t.outlet_id = $" + string(rune('0'+argIdx))
		args = append(args, *outletID)
		argIdx++
	}

	if startDate != nil {
		whereClause += " AND t.created_at >= $" + string(rune('0'+argIdx))
		args = append(args, *startDate)
		argIdx++
	}

	if endDate != nil {
		whereClause += " AND t.created_at <= $" + string(rune('0'+argIdx))
		args = append(args, *endDate)
		argIdx++
	}

	if paymentMethod != "" && paymentMethod != "all" {
		whereClause += " AND t.payment_method = $" + string(rune('0'+argIdx))
		args = append(args, paymentMethod)
		argIdx++
	}

	if txType != "" && txType != "all" {
		whereClause += " AND t.type = $" + string(rune('0'+argIdx))
		args = append(args, txType)
		argIdx++
	}

	// 2. Aggregate Overall Summary (Completed vs Voided)
	summaryQuery := `
		SELECT 
			COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.total_amount ELSE 0 END), 0) as gross_sales,
			COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as tx_count,
			COALESCE(SUM(CASE WHEN t.status = 'voided' THEN t.total_amount ELSE 0 END), 0) as void_amount,
			COUNT(CASE WHEN t.status = 'voided' THEN 1 END) as void_count
		FROM transactions t
		` + whereClause

	err := db.QueryRow(ctx, summaryQuery, args...).Scan(
		&res.TotalGrossSales,
		&res.TotalTransactions,
		&res.TotalVoidAmount,
		&res.TotalVoidCount,
	)
	if err != nil {
		return nil, err
	}
	res.TotalNetSales = res.TotalGrossSales

	if res.TotalTransactions > 0 {
		res.AverageOrderValue = res.TotalGrossSales / int64(res.TotalTransactions)
	}

	// 3. Aggregate Total Items Sold
	itemsSoldQuery := `
		SELECT COALESCE(SUM(ti.qty), 0)
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		` + whereClause + ` AND t.status = 'completed'`
	_ = db.QueryRow(ctx, itemsSoldQuery, args...).Scan(&res.TotalItemsSold)

	// 4. Payment Breakdown
	paymentQuery := `
		SELECT 
			t.payment_method,
			COALESCE(SUM(t.total_amount), 0) as method_total,
			COUNT(t.id) as method_count
		FROM transactions t
		` + whereClause + ` AND t.status = 'completed'
		GROUP BY t.payment_method
		ORDER BY method_total DESC
	`
	pRows, err := db.Query(ctx, paymentQuery, args...)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var pmb PaymentMethodBreakdown
			if err := pRows.Scan(&pmb.Method, &pmb.TotalSales, &pmb.Count); err == nil {
				if res.TotalGrossSales > 0 {
					pmb.Percentage = float64(pmb.TotalSales) / float64(res.TotalGrossSales) * 100
				}
				res.PaymentBreakdown = append(res.PaymentBreakdown, pmb)
			}
		}
	}

	// 5. Top Selling Products (Top 8)
	topProdQuery := `
		SELECT 
			p.id,
			p.name,
			COALESCE(p.category, 'General') as category,
			COALESCE(SUM(ti.qty), 0) as qty_sold,
			COALESCE(SUM(ti.subtotal), 0) as total_sales
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		JOIN products p ON ti.product_id = p.id
		` + whereClause + ` AND t.status = 'completed'
		GROUP BY p.id, p.name, p.category
		ORDER BY total_sales DESC
		LIMIT 8
	`
	tpRows, err := db.Query(ctx, topProdQuery, args...)
	if err == nil {
		defer tpRows.Close()
		for tpRows.Next() {
			var tp TopProductSummary
			if err := tpRows.Scan(&tp.ProductID, &tp.ProductName, &tp.Category, &tp.QtySold, &tp.TotalSales); err == nil {
				res.TopProducts = append(res.TopProducts, tp)
			}
		}
	}

	// 6. Daily Sales Trend (Last 14 days or filtered period)
	trendQuery := `
		SELECT 
			TO_CHAR(t.created_at, 'YYYY-MM-DD') as day,
			COALESCE(SUM(t.total_amount), 0) as daily_sales,
			COUNT(t.id) as daily_count
		FROM transactions t
		` + whereClause + ` AND t.status = 'completed'
		GROUP BY TO_CHAR(t.created_at, 'YYYY-MM-DD')
		ORDER BY day ASC
		LIMIT 30
	`
	tRows, err := db.Query(ctx, trendQuery, args...)
	if err == nil {
		defer tRows.Close()
		for tRows.Next() {
			var dst DailySalesTrend
			if err := tRows.Scan(&dst.Date, &dst.GrossSales, &dst.TxCount); err == nil {
				res.DailyTrends = append(res.DailyTrends, dst)
			}
		}
	}

	return res, nil
}

// VoidTransaction marks a transaction as voided and restores stock
func VoidTransaction(ctx context.Context, txID uuid.UUID, outletID uuid.UUID, staffID uuid.UUID, input VoidTxInput) (*models.Transaction, error) {
	db := config.DB

	// 1. Authenticate Manager PIN
	var mID uuid.UUID
	err := db.QueryRow(ctx, `
		SELECT mp.user_id 
		FROM manager_pins mp
		JOIN outlet_staff os ON mp.user_id = os.user_id
		WHERE os.outlet_id = $1 AND os.role = 'manager' AND os.status = 'active'
	`, outletID).Scan(&mID)
	if err != nil {
		return nil, errors.New("no active manager configured for this outlet")
	}

	var pinHash string
	err = db.QueryRow(ctx, "SELECT pin_hash FROM manager_pins WHERE user_id = $1", mID).Scan(&pinHash)
	if err != nil {
		return nil, errors.New("unauthorized manager pin")
	}

	err = comparePIN(pinHash, input.ManagerPIN)
	if err != nil {
		return nil, errors.New("invalid manager override PIN")
	}

	// 2. Begin TX
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Fetch transaction
	var t models.Transaction
	err = tx.QueryRow(ctx, `
		SELECT id, business_id, outlet_id, shift_id, staff_id, type, total_amount, 
		       payment_method, status, client_uuid, synced_at, created_at, updated_at
		FROM transactions 
		WHERE id = $1 AND outlet_id = $2
	`, txID, outletID).Scan(
		&t.ID, &t.BusinessID, &t.OutletID, &t.ShiftID, &t.StaffID, &t.Type,
		&t.TotalAmount, &t.PaymentMethod, &t.Status, &t.ClientUUID, &t.SyncedAt,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, errors.New("transaction not found")
	}

	if t.Status == models.TxVoided {
		return nil, errors.New("transaction is already voided")
	}

	// 3. Mark as voided
	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE transactions 
		SET status = 'voided', updated_at = $1 
		WHERE id = $2
	`, now, txID)
	if err != nil {
		return nil, err
	}
	t.Status = models.TxVoided
	t.UpdatedAt = now

	// 4. Restore inventory stock
	itemRows, err := tx.Query(ctx, `SELECT product_id, qty FROM transaction_items WHERE transaction_id = $1`, txID)
	if err == nil {
		type itemRestock struct {
			pID uuid.UUID
			qty float64
		}
		var itemsToRestock []itemRestock
		for itemRows.Next() {
			var ir itemRestock
			if err := itemRows.Scan(&ir.pID, &ir.qty); err == nil {
				itemsToRestock = append(itemsToRestock, ir)
			}
		}
		itemRows.Close()

		for _, item := range itemsToRestock {
			var invMode string
			_ = tx.QueryRow(ctx, "SELECT inventory_mode FROM products WHERE id = $1", item.pID).Scan(&invMode)

			if invMode == string(models.ModeBatchThaw) {
				_, _ = tx.Exec(ctx, `
					UPDATE stock_batches 
					SET quantity = quantity + $1
					WHERE product_id = $2 AND held_by_user_id = $3 AND batch_status = 'opened'
				`, item.qty, item.pID, t.StaffID)
			} else {
				_, _ = tx.Exec(ctx, `
					UPDATE products 
					SET current_stock = current_stock + $1, updated_at = $2 
					WHERE id = $3
				`, item.qty, now, item.pID)
			}

			_, _ = tx.Exec(ctx, `
				INSERT INTO inventory_ledger (id, product_id, outlet_id, change_qty, reason, reference_id, created_at)
				VALUES ($1, $2, $3, $4, 'void_sale', $5, $6)
			`, uuid.New(), item.pID, outletID, item.qty, txID, now)
		}
	}

	// 5. Override Log
	reason := "Void transaction"
	if input.Reason != "" {
		reason = input.Reason
	}
	_, _ = tx.Exec(ctx, `
		INSERT INTO override_logs (id, transaction_id, staff_id, manager_id, action, reason, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, uuid.New(), txID, staffID, mID, models.ActionVoid, reason, now)

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return &t, nil
}

// helper function for password/PIN validation
func comparePIN(hashedPIN, inputPIN string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPIN), []byte(inputPIN))
}

