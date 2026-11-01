package transactions

import (
	"context"
	"errors"
	"fmt"
	"math"
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
	ItemID         *uuid.UUID `json:"item_id,omitempty"`
	ProductID      uuid.UUID  `json:"product_id"`
	Qty            float64    `json:"qty"`
	PromotionID    *uuid.UUID `json:"promotion_id,omitempty"`
	DiscountAmount int64      `json:"discount_amount,omitempty"`
}

// verifyManagerOverridePIN checks inputPIN against all active managers assigned to outletID (or business owners)
func verifyManagerOverridePIN(ctx context.Context, outletID uuid.UUID, inputPIN string) (uuid.UUID, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT mp.user_id, mp.pin_hash
		FROM manager_pins mp
		JOIN outlet_staff os ON mp.user_id = os.user_id
		WHERE os.outlet_id = $1 AND os.role = 'manager' AND os.status = 'active'
	`, outletID)
	if err != nil {
		return uuid.Nil, errors.New("no active manager configured for this outlet")
	}
	defer rows.Close()

	type pinCandidate struct {
		userID  uuid.UUID
		pinHash string
	}
	var candidates []pinCandidate
	for rows.Next() {
		var c pinCandidate
		if err := rows.Scan(&c.userID, &c.pinHash); err == nil {
			candidates = append(candidates, c)
		}
	}

	if len(candidates) == 0 {
		return uuid.Nil, errors.New("no active manager configured for this outlet")
	}

	for _, c := range candidates {
		if comparePIN(c.pinHash, inputPIN) == nil {
			return c.userID, nil
		}
	}

	return uuid.Nil, errors.New("invalid manager override PIN")
}

type CreateTxInput struct {
	ClientUUID     uuid.UUID            `json:"client_uuid"`
	TotalAmount    int64                `json:"total_amount"`
	PaymentMethod  models.PaymentMethod `json:"payment_method"`
	Type           models.TransactionType `json:"type"` // sale, internal_take, void
	Items          []TxItemInput        `json:"items"`
	PromotionID    *uuid.UUID           `json:"promotion_id,omitempty"`
	DiscountAmount int64                `json:"discount_amount,omitempty"`
	
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

		mID, err := verifyManagerOverridePIN(ctx, outletID, *input.ManagerPIN)
		if err != nil {
			return nil, err
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

	// 5. Process items against Unified Item Master (items + item_stocks + stock_movements)
	for _, item := range input.Items {
		targetItemID := item.ProductID
		if item.ItemID != nil && *item.ItemID != uuid.Nil {
			targetItemID = *item.ItemID
		}

		var itmID uuid.UUID
		var itmSKU *string
		var itmName string
		var sellPrice, standardCost int64
		var isInventoryTracked, isThawable bool

		err = tx.QueryRow(ctx, `
			SELECT id, sku, name, sell_price, standard_cost, is_inventory_tracked, COALESCE(is_thawable, requires_thaw, FALSE)
			FROM items
			WHERE id = $1 AND business_id = $2
			FOR UPDATE
		`, targetItemID, businessID).Scan(
			&itmID, &itmSKU, &itmName, &sellPrice, &standardCost, &isInventoryTracked, &isThawable,
		)
		if err != nil {
			if err == pgx.ErrNoRows {
				return nil, errors.New("product not found: " + targetItemID.String())
			}
			return nil, err
		}

		// Lock and check outlet stock balance in item_stocks
		var stockRowID uuid.UUID
		var currentLoose float64
		stockErr := tx.QueryRow(ctx, `
			SELECT id, qty_loose
			FROM item_stocks
			WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL
			FOR UPDATE
		`, itmID, outletID).Scan(&stockRowID, &currentLoose)
		if stockErr != nil && stockErr != pgx.ErrNoRows {
			return nil, stockErr
		}

		// Strict stock validation for inventory-tracked non-thaw items on POS sale
		if isInventoryTracked && !isThawable && t.Type == models.TxSale {
			if currentLoose < item.Qty {
				return nil, errors.New("insufficient stock for product: " + itmName)
			}
		}

		subtotal := int64(math.Round(item.Qty * float64(sellPrice)))
		totalCost := int64(math.Round(item.Qty * float64(standardCost)))
		calculatedTotal += subtotal

		// Deduct stock and append to stock_movements ledger for active sales and internal takes
		if t.Type == models.TxSale || t.Type == models.TxInternalTake {
			if stockErr == pgx.ErrNoRows {
				_, err = tx.Exec(ctx, `
					INSERT INTO item_stocks (id, item_id, outlet_id, qty_sealed, qty_loose, updated_at)
					VALUES ($1, $2, $3, 0, $4, NOW())
				`, uuid.New(), itmID, outletID, -item.Qty)
			} else {
				_, err = tx.Exec(ctx, `
					UPDATE item_stocks
					SET qty_loose = qty_loose - $1, updated_at = NOW()
					WHERE id = $2
				`, item.Qty, stockRowID)
			}
			if err != nil {
				return nil, err
			}

			sourceDocType := "pos_sale"
			toLocationType := "customer"
			movementNote := "Penjualan POS"
			if t.Type == models.TxInternalTake {
				sourceDocType = "internal_take"
				toLocationType = "internal_consumption"
				movementNote = "Konsumsi Internal Outlet"
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, from_outlet_id, to_location_type,
					package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
				) VALUES ($1, $2, $3, $4, $5, 'outlet', $6, $7, 'loose', $8, $9, $10, $11, $12, NOW())
			`, uuid.New(), businessID, itmID, sourceDocType, txID, outletID, toLocationType,
				item.Qty, standardCost, totalCost, staffID, movementNote)
			if err != nil {
				return nil, err
			}
		}

		itemIDCopy := itmID
		ti := &models.TransactionItem{
			ID:             uuid.New(),
			TransactionID:  txID,
			ItemID:         &itemIDCopy,
			ProductID:      itmID,
			SKU:            itmSKU,
			Name:           itmName,
			ProductName:    itmName,
			Qty:            item.Qty,
			UnitPrice:      sellPrice,
			Subtotal:       subtotal,
			UnitCost:       standardCost,
			TotalCost:      totalCost,
			DiscountAmount: item.DiscountAmount,
			PromotionID:    item.PromotionID,
			CreatedAt:      time.Now(),
		}
		savedItems = append(savedItems, ti)
	}

	t.Subtotal = calculatedTotal

	// 5b. Server-Side Rule Validation for Promotion & Discount Engine
	var verifiedDiscount int64 = 0
	if input.PromotionID != nil && *input.PromotionID != uuid.Nil {
		var promo models.Promotion
		var activeTimeStart, activeTimeEnd string
		err = tx.QueryRow(ctx, `
			SELECT id, business_id, promo_type, start_date, end_date, active_days,
			       COALESCE(to_char(active_time_start, 'HH24:MI:SS'), ''),
			       COALESCE(to_char(active_time_end, 'HH24:MI:SS'), ''),
			       min_order_amount, min_qty, usage_limit, usage_count,
			       reward_type, reward_value, max_discount_cap, target_scope, is_active
			FROM promotions
			WHERE id = $1 AND business_id = $2
		`, *input.PromotionID, t.BusinessID).Scan(
			&promo.ID, &promo.BusinessID, &promo.PromoType,
			&promo.StartDate, &promo.EndDate, &promo.ActiveDays,
			&activeTimeStart, &activeTimeEnd,
			&promo.MinOrderAmount, &promo.MinQty, &promo.UsageLimit, &promo.UsageCount,
			&promo.RewardType, &promo.RewardValue, &promo.MaxDiscountCap, &promo.TargetScope, &promo.IsActive,
		)
		if err != nil {
			return nil, errors.New("invalid or unauthorized promotion")
		}

		if !promo.IsActive {
			return nil, errors.New("promotion is currently inactive")
		}

		nowTime := time.Now()
		if nowTime.Before(promo.StartDate) {
			return nil, errors.New("promotion has not started yet")
		}
		if promo.EndDate != nil && nowTime.After(*promo.EndDate) {
			return nil, errors.New("promotion period has expired")
		}

		if len(promo.ActiveDays) > 0 {
			dayOfWeek := int(nowTime.Weekday())
			dayMatched := false
			for _, d := range promo.ActiveDays {
				if d == dayOfWeek {
					dayMatched = true
					break
				}
			}
			if !dayMatched {
				return nil, errors.New("promotion is not active today")
			}
		}

		if activeTimeStart != "" && activeTimeEnd != "" {
			currentTimeStr := nowTime.Format("15:04:05")
			if currentTimeStr < activeTimeStart || currentTimeStr > activeTimeEnd {
				return nil, errors.New("promotion is outside happy hour time range")
			}
		}

		if promo.UsageLimit != nil && *promo.UsageLimit > 0 && promo.UsageCount >= *promo.UsageLimit {
			return nil, errors.New("promotion quota has been exceeded")
		}

		if promo.MinOrderAmount > 0 && calculatedTotal < int64(promo.MinOrderAmount) {
			return nil, fmt.Errorf("minimum order amount of Rp %d not met for this promotion", promo.MinOrderAmount)
		}

		var totalQty float64
		for _, it := range input.Items {
			totalQty += it.Qty
		}
		if promo.MinQty > 0 && totalQty < float64(promo.MinQty) {
			return nil, fmt.Errorf("minimum quantity of %v items not met for this promotion", promo.MinQty)
		}

		var eligibleSubtotal int64 = 0
		if promo.TargetScope == "entire_order" {
			eligibleSubtotal = calculatedTotal
		} else {
			targetRows, tErr := tx.Query(ctx, `
				SELECT target_type, target_id FROM promotion_targets WHERE promotion_id = $1
			`, promo.ID)
			if tErr == nil {
				targetItemIDs := make(map[uuid.UUID]bool)
				targetCategoryIDs := make(map[uuid.UUID]bool)
				for targetRows.Next() {
					var tType string
					var tID uuid.UUID
					if scanErr := targetRows.Scan(&tType, &tID); scanErr == nil {
						if tType == "item" {
							targetItemIDs[tID] = true
						} else if tType == "category" {
							targetCategoryIDs[tID] = true
						}
					}
				}
				targetRows.Close()

				for _, item := range savedItems {
					if promo.TargetScope == "specific_items" && targetItemIDs[item.ProductID] {
						eligibleSubtotal += item.Subtotal
					} else if promo.TargetScope == "specific_categories" {
						var catID *uuid.UUID
						_ = tx.QueryRow(ctx, "SELECT category_id FROM items WHERE id = $1", item.ProductID).Scan(&catID)
						if catID != nil && targetCategoryIDs[*catID] {
							eligibleSubtotal += item.Subtotal
						}
					}
				}
			}

			if eligibleSubtotal <= 0 {
				return nil, errors.New("cart does not contain eligible items for this promotion")
			}
		}

		if promo.RewardType == "discount_pct" {
			verifiedDiscount = int64(math.Round(float64(eligibleSubtotal) * (promo.RewardValue / 100.0)))
		} else if promo.RewardType == "discount_fixed" {
			verifiedDiscount = int64(math.Round(promo.RewardValue))
		}

		if promo.MaxDiscountCap != nil && *promo.MaxDiscountCap > 0 && verifiedDiscount > int64(*promo.MaxDiscountCap) {
			verifiedDiscount = int64(*promo.MaxDiscountCap)
		}

		if verifiedDiscount > calculatedTotal {
			verifiedDiscount = calculatedTotal
		}

		t.PromotionID = &promo.ID
		t.DiscountAmount = verifiedDiscount
	} else if input.DiscountAmount > 0 {
		// Manual Cashier Quick Discount (e.g. Clearance Sale override as per D-23)
		if input.DiscountAmount > calculatedTotal {
			t.DiscountAmount = calculatedTotal
		} else {
			t.DiscountAmount = input.DiscountAmount
		}
		t.PromotionID = nil
	} else {
		t.DiscountAmount = 0
		t.PromotionID = nil
	}

	if input.TotalAmount > 0 && input.PromotionID == nil {
		t.TotalAmount = input.TotalAmount
	} else {
		t.TotalAmount = calculatedTotal - t.DiscountAmount
		if t.TotalAmount < 0 {
			t.TotalAmount = 0
		}
	}
	if input.Type == models.TxInternalTake {
		// As per PRD, internal take records consumption
	}

	// 6. Insert Transaction Header
	now := time.Now()
	t.SyncedAt = &now // Set synced_at as it's being written to backend
	err = tx.QueryRow(ctx, `
		INSERT INTO transactions (
			id, business_id, outlet_id, shift_id, staff_id, type, 
			total_amount, subtotal, discount_amount, promotion_id,
			payment_method, status, client_uuid, synced_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING created_at, updated_at
	`, t.ID, t.BusinessID, t.OutletID, t.ShiftID, t.StaffID, t.Type,
		t.TotalAmount, t.Subtotal, t.DiscountAmount, t.PromotionID,
		t.PaymentMethod, t.Status, t.ClientUUID, t.SyncedAt, t.CreatedAt, t.UpdatedAt,
	).Scan(&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// 7. Insert Transaction Items (linked to Unified Master Items via item_id)
	for _, ti := range savedItems {
		_, err = tx.Exec(ctx, `
			INSERT INTO transaction_items (
				id, transaction_id, item_id, sku, name, qty, unit_price, subtotal, unit_cost, total_cost, discount_amount, promotion_id, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		`, ti.ID, ti.TransactionID, ti.ItemID, ti.SKU, ti.Name, ti.Qty, ti.UnitPrice, ti.Subtotal, ti.UnitCost, ti.TotalCost, ti.DiscountAmount, ti.PromotionID, ti.CreatedAt)
		if err != nil {
			return nil, err
		}
	}

	// 7b. Increment Promotion Usage if applicable (safe against race conditions)
	if t.PromotionID != nil {
		_, _ = tx.Exec(ctx, `
			UPDATE promotions 
			SET usage_count = usage_count + 1, updated_at = NOW() 
			WHERE id = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)
		`, *t.PromotionID)
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
	rows.Close()

	// Populate line items for each transaction from Unified Item Master
	for idx := range result {
		itemRows, itemErr := db.Query(ctx, `
			SELECT ti.id, ti.transaction_id, COALESCE(ti.item_id, ti.product_id),
			       COALESCE(ti.name, i.name, 'Item'), COALESCE(i.base_unit, 'pcs'),
			       ti.qty, ti.unit_price, ti.subtotal, COALESCE(ti.discount_amount, 0), ti.created_at
			FROM transaction_items ti
			LEFT JOIN items i ON COALESCE(ti.item_id, ti.product_id) = i.id
			WHERE ti.transaction_id = $1
			ORDER BY ti.created_at ASC
		`, result[idx].ID)
		if itemErr == nil {
			var items []models.TransactionItem
			for itemRows.Next() {
				var ti models.TransactionItem
				var resolvedItemID *uuid.UUID
				if scanErr := itemRows.Scan(
					&ti.ID, &ti.TransactionID, &resolvedItemID,
					&ti.ProductName, &ti.UnitType,
					&ti.Qty, &ti.UnitPrice, &ti.Subtotal, &ti.DiscountAmount, &ti.CreatedAt,
				); scanErr == nil {
					if resolvedItemID != nil {
						ti.ItemID = resolvedItemID
						ti.ProductID = *resolvedItemID
					}
					ti.Name = ti.ProductName
					items = append(items, ti)
				}
			}
			itemRows.Close()
			result[idx].Items = items
		}
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

	// 5. Top Selling Products (Top 8 from Unified Master Items)
	topProdQuery := `
		SELECT 
			COALESCE(i.id, ti.item_id, ti.product_id) as item_id,
			COALESCE(i.name, ti.name, 'Item') as item_name,
			COALESCE(c.name, 'General') as category_name,
			COALESCE(SUM(ti.qty), 0) as qty_sold,
			COALESCE(SUM(ti.subtotal), 0) as total_sales
		FROM transaction_items ti
		JOIN transactions t ON ti.transaction_id = t.id
		LEFT JOIN items i ON COALESCE(ti.item_id, ti.product_id) = i.id
		LEFT JOIN categories c ON i.category_id = c.id
		` + whereClause + ` AND t.status = 'completed' AND COALESCE(i.id, ti.item_id, ti.product_id) IS NOT NULL
		GROUP BY COALESCE(i.id, ti.item_id, ti.product_id), COALESCE(i.name, ti.name, 'Item'), COALESCE(c.name, 'General')
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

// VoidTransaction marks a transaction as voided and restores stock in item_stocks & stock_movements
func VoidTransaction(ctx context.Context, txID uuid.UUID, outletID uuid.UUID, staffID uuid.UUID, input VoidTxInput) (*models.Transaction, error) {
	db := config.DB

	// 1. Authenticate Manager PIN across all active managers assigned to this outlet
	mID, err := verifyManagerOverridePIN(ctx, outletID, input.ManagerPIN)
	if err != nil {
		return nil, err
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
		FOR UPDATE
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

	// 4. Restore inventory stock to item_stocks and append reversal to stock_movements
	itemRows, err := tx.Query(ctx, `
		SELECT COALESCE(item_id, product_id), qty, COALESCE(unit_cost, 0)
		FROM transaction_items
		WHERE transaction_id = $1
	`, txID)
	if err == nil {
		type itemRestock struct {
			itemID   uuid.UUID
			qty      float64
			unitCost int64
		}
		var itemsToRestock []itemRestock
		for itemRows.Next() {
			var ir itemRestock
			var itemIDPtr *uuid.UUID
			if err := itemRows.Scan(&itemIDPtr, &ir.qty, &ir.unitCost); err == nil && itemIDPtr != nil {
				ir.itemID = *itemIDPtr
				itemsToRestock = append(itemsToRestock, ir)
			}
		}
		itemRows.Close()

		for _, item := range itemsToRestock {
			var stockRowID uuid.UUID
			stockErr := tx.QueryRow(ctx, `
				SELECT id FROM item_stocks
				WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL
				FOR UPDATE
			`, item.itemID, outletID).Scan(&stockRowID)

			if stockErr == pgx.ErrNoRows {
				_, _ = tx.Exec(ctx, `
					INSERT INTO item_stocks (id, item_id, outlet_id, qty_sealed, qty_loose, updated_at)
					VALUES ($1, $2, $3, 0, $4, $5)
				`, uuid.New(), item.itemID, outletID, item.qty, now)
			} else if stockErr == nil {
				_, _ = tx.Exec(ctx, `
					UPDATE item_stocks
					SET qty_loose = qty_loose + $1, updated_at = $2
					WHERE id = $3
				`, item.qty, now, stockRowID)
			}

			totalCost := int64(math.Round(item.qty * float64(item.unitCost)))
			_, _ = tx.Exec(ctx, `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, to_location_type, to_outlet_id,
					package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
				) VALUES ($1, $2, $3, 'pos_void', $4, 'customer', 'outlet', $5, 'loose', $6, $7, $8, $9, $10, $11)
			`, uuid.New(), t.BusinessID, item.itemID, txID, outletID, item.qty, item.unitCost, totalCost, staffID, "Pembatalan (Void) Transaksi POS", now)
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

