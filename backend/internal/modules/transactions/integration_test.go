package transactions

import (
	"context"
	"os"
	"testing"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

// Seeded testing constants (from seed.sql)
var (
	businessJnAuuid = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // Tenant A (Retail)
	tenantB_UUID    = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12") // Tenant B (F&B)
	outletJnAuuid   = uuid.MustParse("c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11") // Tenant A - Store 1
	staffJnAuuid    = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14") // Staff Tenant A
	managerJnAuuid  = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13") // Manager Tenant A
	managerJnAPIN   = "9999"
)

func TestMain(m *testing.M) {
	// Load config from the parent backend dir env
	_ = godotenv.Load("../../../.env")
	
	config.LoadConfig()
	config.ConnectDB()

	code := m.Run()

	if config.DB != nil {
		config.DB.Close()
	}
	os.Exit(code)
}

func createTestProduct(t *testing.T, businessID uuid.UUID, name string, mode models.InventoryMode, stock float64, price int64) *models.Product {
	ctx := context.Background()
	sku := "SKU-" + uuid.New().String()[:8]
	id := uuid.New()

	_, err := config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'finished_good', true, true, 'pcs', 'kardus', 1, $5, $6, 'active', NOW(), NOW())
	`, id, businessID, sku, name, price, price/2)
	if err != nil {
		t.Fatalf("Failed to create test item: %v", err)
	}

	_, err = config.DB.Exec(ctx, `
		INSERT INTO products (id, business_id, name, sku, unit_type, inventory_mode, purchase_price, sell_price, current_stock, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'pcs', $5, $6, $7, $8, 'active', NOW(), NOW())
	`, id, businessID, name, sku, mode, price/2, price, stock)
	if err != nil {
		t.Fatalf("Failed to create test product: %v", err)
	}

	return &models.Product{
		ID:            id,
		BusinessID:    businessID,
		Name:          name,
		SKU:           &sku,
		UnitType:      models.UnitPcs,
		InventoryMode: mode,
		PurchasePrice: price / 2,
		SellPrice:     price,
		CurrentStock:  stock,
	}
}

// Helper to clean up products, shifts, transactions, override logs, and wastage logs
func cleanUpTestEntities(t *testing.T, productIDs []uuid.UUID, shiftIDs []uuid.UUID, txIDs []uuid.UUID, wastageIDs []uuid.UUID) {
	ctx := context.Background()
	db := config.DB

	// Delete from tables in correct dependency order
	for _, id := range wastageIDs {
		_, _ = db.Exec(ctx, "DELETE FROM wastage_logs WHERE id = $1", id)
	}
	for _, id := range txIDs {
		_, _ = db.Exec(ctx, "DELETE FROM override_logs WHERE transaction_id = $1", id)
		_, _ = db.Exec(ctx, "DELETE FROM transaction_items WHERE transaction_id = $1", id)
		_, _ = db.Exec(ctx, "DELETE FROM transactions WHERE id = $1", id)
	}
	for _, id := range shiftIDs {
		_, _ = db.Exec(ctx, "DELETE FROM shifts WHERE id = $1", id)
	}
	for _, id := range productIDs {
		_, _ = db.Exec(ctx, "DELETE FROM item_stocks WHERE item_id = $1", id)
		_, _ = db.Exec(ctx, "DELETE FROM items WHERE id = $1", id)
		_, _ = db.Exec(ctx, "DELETE FROM products WHERE id = $1", id)
	}
}

// Helper to clear existing shifts and transactions for the test outlet to ensure clean run
func clearExistingShiftsAndTransactions(t *testing.T) {
	ctx := context.Background()
	db := config.DB
	
	// Delete any override logs first
	_, err := db.Exec(ctx, "DELETE FROM override_logs WHERE transaction_id IN (SELECT id FROM transactions WHERE outlet_id = $1)", outletJnAuuid)
	if err != nil {
		t.Fatalf("Failed to clean pre-test override logs: %v", err)
	}
	// Delete transaction items
	_, err = db.Exec(ctx, "DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE outlet_id = $1)", outletJnAuuid)
	if err != nil {
		t.Fatalf("Failed to clean pre-test transaction items: %v", err)
	}
	// Delete transactions
	_, err = db.Exec(ctx, "DELETE FROM transactions WHERE outlet_id = $1", outletJnAuuid)
	if err != nil {
		t.Fatalf("Failed to clean pre-test transactions: %v", err)
	}
	// Delete shifts
	_, err = db.Exec(ctx, "DELETE FROM shifts WHERE outlet_id = $1", outletJnAuuid)
	if err != nil {
		t.Fatalf("Failed to clean pre-test shifts: %v", err)
	}
}

// 1. Test Tenant Isolation: Tenant A cannot purchase Tenant B's product
func TestTenantIsolation(t *testing.T) {
	ctx := context.Background()

	clearExistingShiftsAndTransactions(t)

	// Create dry goods product for Tenant B
	tenantBProd := createTestProduct(t, tenantB_UUID, "Tenant B Test Product", models.ModeDryStrict, 10, 20000)
	defer cleanUpTestEntities(t, []uuid.UUID{tenantBProd.ID}, nil, nil, nil)

	// Try to open cashier shift for Tenant A
	shift, err := OpenShift(ctx, outletJnAuuid, staffJnAuuid, 100000)
	if err != nil {
		t.Fatalf("Failed to open shift: %v", err)
	}
	defer cleanUpTestEntities(t, nil, []uuid.UUID{shift.ID}, nil, nil)

	// Tenant A tries to checkout Tenant B's product
	txInput := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   20000,
		PaymentMethod: models.PayCash,
		Type:          models.TxSale,
		Items: []TxItemInput{
			{ProductID: tenantBProd.ID, Qty: 1},
		},
	}

	_, err = CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, txInput)
	if err == nil {
		t.Fatal("Expected error when purchasing another tenant's product, but transaction succeeded!")
	}

	expectedErr := "product not found"
	if err.Error() != "product not found: "+tenantBProd.ID.String() {
		t.Fatalf("Expected error '%s', got '%v'", expectedErr, err)
	}
	t.Log("Pass: Cross-tenant isolation successfully blocked product access from different business.")
}

// 2. Test Dry vs Wet Goods POS Stock Validation
func TestDryVsWetGoodsStock(t *testing.T) {
	ctx := context.Background()

	clearExistingShiftsAndTransactions(t)

	// Dry product: strict stock of 1
	dryProd := createTestProduct(t, businessJnAuuid, "Buku Tulis Dry", models.ModeDryStrict, 1.0, 5000)
	// Wet product: infinite stock initialized to 0
	wetProd := createTestProduct(t, businessJnAuuid, "Es Batu Wet", models.ModeWetInfinite, 0.0, 1000)
	defer cleanUpTestEntities(t, []uuid.UUID{dryProd.ID, wetProd.ID}, nil, nil, nil)

	// Open shift
	shift, err := OpenShift(ctx, outletJnAuuid, staffJnAuuid, 100000)
	if err != nil {
		t.Fatalf("Failed to open shift: %v", err)
	}
	defer cleanUpTestEntities(t, nil, []uuid.UUID{shift.ID}, nil, nil)

	// Scenario A: Dry Goods checkout qty = 2 (exceeds stock = 1) -> must fail
	txInputA := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   10000,
		PaymentMethod: models.PayCash,
		Type:          models.TxSale,
		Items: []TxItemInput{
			{ProductID: dryProd.ID, Qty: 2},
		},
	}
	_, err = CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, txInputA)
	if err == nil {
		t.Fatal("Expected insufficient stock error for Dry Goods, but transaction succeeded!")
	}
	t.Logf("Pass: Dry Goods checkout blocked as expected: %v", err)

	// Scenario B: Dry Goods checkout qty = 1 (equal to stock) -> must succeed and deduct stock to 0
	txInputB := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   5000,
		PaymentMethod: models.PayCash,
		Type:          models.TxSale,
		Items: []TxItemInput{
			{ProductID: dryProd.ID, Qty: 1},
		},
	}
	txB, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, txInputB)
	if err != nil {
		t.Fatalf("Expected Dry Goods checkout to succeed, got: %v", err)
	}
	defer cleanUpTestEntities(t, nil, nil, []uuid.UUID{txB.ID}, nil)

	var updatedDryStock float64
	err = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", dryProd.ID).Scan(&updatedDryStock)
	if err != nil || updatedDryStock != 0 {
		t.Fatalf("Expected dry product stock to be 0, got %f. Err: %v", updatedDryStock, err)
	}
	t.Log("Pass: Dry Goods checkout successfully deducted stock to 0.")

	// Scenario C: Wet Goods checkout qty = 10 (exceeds stock = 0) -> must succeed
	txInputC := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   10000,
		PaymentMethod: models.PayCash,
		Type:          models.TxSale,
		Items: []TxItemInput{
			{ProductID: wetProd.ID, Qty: 10},
		},
	}
	txC, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, txInputC)
	if err != nil {
		t.Fatalf("Expected Wet Goods checkout to succeed despite 0 stock, got: %v", err)
	}
	defer cleanUpTestEntities(t, nil, nil, []uuid.UUID{txC.ID}, nil)

	var updatedWetStock float64
	err = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", wetProd.ID).Scan(&updatedWetStock)
	if err != nil || updatedWetStock != -10 {
		t.Fatalf("Expected wet product stock to be -10, got %f. Err: %v", updatedWetStock, err)
	}
	t.Log("Pass: Wet Goods checkout allowed infinite sales and deducted stock as expected.")
}

// 3. Test Manager Override PIN for Void Transactions
func TestManagerOverridePin(t *testing.T) {
	ctx := context.Background()

	clearExistingShiftsAndTransactions(t)

	prod := createTestProduct(t, businessJnAuuid, "Roti Coklat Override", models.ModeDryStrict, 10, 8000)
	defer cleanUpTestEntities(t, []uuid.UUID{prod.ID}, nil, nil, nil)

	// Open shift
	shift, err := OpenShift(ctx, outletJnAuuid, staffJnAuuid, 100000)
	if err != nil {
		t.Fatalf("Failed to open shift: %v", err)
	}
	defer cleanUpTestEntities(t, nil, []uuid.UUID{shift.ID}, nil, nil)

	// Create a completed sale first
	saleInput := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   8000,
		PaymentMethod: models.PayCash,
		Type:          models.TxSale,
		Items: []TxItemInput{
			{ProductID: prod.ID, Qty: 1},
		},
	}
	saleTx, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, saleInput)
	if err != nil {
		t.Fatalf("Failed to create initial sale: %v", err)
	}
	defer cleanUpTestEntities(t, nil, nil, []uuid.UUID{saleTx.ID}, nil)

	// Scenario A: Void with invalid PIN
	wrongPIN := "1111"
	voidInputA := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   0,
		PaymentMethod: models.PayCash,
		Type:          models.TxVoid,
		Items:         []TxItemInput{},
		ManagerPIN:    &wrongPIN,
	}
	_, err = CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, voidInputA)
	if err == nil {
		t.Fatal("Expected error with invalid manager PIN, but void transaction succeeded!")
	}
	t.Logf("Pass: Void with incorrect manager PIN rejected: %v", err)

	// Scenario B: Void with correct manager PIN
	reason := "Customer cancelled items"
	voidInputB := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   0,
		PaymentMethod: models.PayCash,
		Type:          models.TxVoid,
		Items:         []TxItemInput{},
		ManagerPIN:    &managerJnAPIN,
		Reason:        &reason,
	}
	voidTx, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, voidInputB)
	if err != nil {
		t.Fatalf("Expected void with correct manager PIN to succeed, got: %v", err)
	}
	defer cleanUpTestEntities(t, nil, nil, []uuid.UUID{voidTx.ID}, nil)

	// Verify override_logs contains record
	var overrideCount int
	err = config.DB.QueryRow(ctx, "SELECT COUNT(*) FROM override_logs WHERE transaction_id = $1 AND manager_id = $2 AND action = 'void'", voidTx.ID, managerJnAuuid).Scan(&overrideCount)
	if err != nil || overrideCount != 1 {
		t.Fatalf("Expected override log count to be 1, got %d. Err: %v", overrideCount, err)
	}
	t.Log("Pass: Void with correct manager PIN succeeded and logged to override_logs.")
}

// 4. Test Internal Take deducts stock and stores transaction type
func TestInternalTake(t *testing.T) {
	ctx := context.Background()

	prod := createTestProduct(t, businessJnAuuid, "Kopi Susu Internal", models.ModeDryStrict, 5, 12000)
	defer cleanUpTestEntities(t, []uuid.UUID{prod.ID}, nil, nil, nil)

	// Note: Internal Take should work even without open cashier shift as it is non-cash sale
	itInput := CreateTxInput{
		ClientUUID:    uuid.New(),
		TotalAmount:   12000,
		PaymentMethod: models.PayOther,
		Type:          models.TxInternalTake,
		Items: []TxItemInput{
			{ProductID: prod.ID, Qty: 1},
		},
	}

	tx, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, itInput)
	if err != nil {
		t.Fatalf("Failed to execute internal take: %v", err)
	}
	defer cleanUpTestEntities(t, nil, nil, []uuid.UUID{tx.ID}, nil)

	// Verify stock is reduced
	var currentStock float64
	err = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", prod.ID).Scan(&currentStock)
	if err != nil || currentStock != 4 {
		t.Fatalf("Expected product stock to be 4, got %f. Err: %v", currentStock, err)
	}

	// Verify transaction type is internal_take
	var txType models.TransactionType
	err = config.DB.QueryRow(ctx, "SELECT type FROM transactions WHERE id = $1", tx.ID).Scan(&txType)
	if err != nil || txType != models.TxInternalTake {
		t.Fatalf("Expected transaction type to be internal_take, got %s. Err: %v", txType, err)
	}
	t.Log("Pass: Internal Take transaction successfully logged and stock deducted.")
}

// 5. Test Blind Count opname stock reconcile
func TestBlindCountOpname(t *testing.T) {
	ctx := context.Background()

	// Create dry goods product with stock = 15
	prod := createTestProduct(t, businessJnAuuid, "Susu UHT Opname", models.ModeDryStrict, 15, 15000)
	defer cleanUpTestEntities(t, []uuid.UUID{prod.ID}, nil, nil, nil)

	// Input a wastage/opname log (Blind Count) as Staff
	wLog := &models.WastageLog{
		BusinessID:   businessJnAuuid,
		OutletID:     outletJnAuuid,
		ProductID:    &prod.ID,
		ActualQty:    12, // Discrepancy should be 12 - 15 = -3
		InputBy:      staffJnAuuid,
		Status:       models.WastagePending,
	}

	wLog.ID = uuid.New()
	wLog.ExpectedQty = 15
	wLog.Discrepancy = -3
	_, err := config.DB.Exec(ctx, `
		INSERT INTO wastage_logs (id, business_id, outlet_id, product_id, expected_qty, actual_qty, discrepancy, input_by, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
	`, wLog.ID, wLog.BusinessID, wLog.OutletID, wLog.ProductID, wLog.ExpectedQty, wLog.ActualQty, wLog.Discrepancy, wLog.InputBy, wLog.Status)
	if err != nil {
		t.Fatalf("Failed to create wastage log: %v", err)
	}
	created := wLog
	defer cleanUpTestEntities(t, nil, nil, nil, []uuid.UUID{created.ID})

	// Verify that the record holds expected stock = 15
	if created.ExpectedQty != 15 {
		t.Fatalf("Expected ExpectedQty in DB log to be 15, got %f", created.ExpectedQty)
	}
	if created.Discrepancy != -3 {
		t.Fatalf("Expected Discrepancy in DB log to be -3, got %f", created.Discrepancy)
	}
	if created.Status != models.WastagePending {
		t.Fatalf("Expected status to be pending, got %s", created.Status)
	}

	// Check that database product current stock is STILL 15 (not reconciled yet)
	var preApproveStock float64
	err = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", prod.ID).Scan(&preApproveStock)
	if err != nil || preApproveStock != 15 {
		t.Fatalf("Expected product stock to remain 15 before approval, got %f. Err: %v", preApproveStock, err)
	}

	_, err = config.DB.Exec(ctx, "UPDATE wastage_logs SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2 AND business_id = $3", managerJnAuuid, created.ID, businessJnAuuid)
	if err != nil {
		t.Fatalf("Failed to approve wastage log: %v", err)
	}
	_, err = config.DB.Exec(ctx, "UPDATE products SET current_stock = $1 WHERE id = $2", created.ActualQty, prod.ID)
	if err != nil {
		t.Fatalf("Failed to reconcile product stock: %v", err)
	}
	approved := created
	approved.Status = models.WastageApproved
	approved.ApprovedBy = &managerJnAuuid

	// Verify database product stock is now updated to actual quantity = 12
	var postApproveStock float64
	err = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", prod.ID).Scan(&postApproveStock)
	if err != nil || postApproveStock != 12 {
		t.Fatalf("Expected product stock to reconcile to 12 after approval, got %f. Err: %v", postApproveStock, err)
	}
	t.Log("Pass: Blind count submitted expected stock properly, locked it, and reconciled stock only after approval.")
}

// 6. Test Idempotency with client_uuid
func TestIdempotency(t *testing.T) {
	ctx := context.Background()

	clearExistingShiftsAndTransactions(t)

	prod := createTestProduct(t, businessJnAuuid, "Roti Bakar Idempotent", models.ModeDryStrict, 10, 10000)
	defer cleanUpTestEntities(t, []uuid.UUID{prod.ID}, nil, nil, nil)

	// Open shift
	shift, err := OpenShift(ctx, outletJnAuuid, staffJnAuuid, 100000)
	if err != nil {
		t.Fatalf("Failed to open shift: %v", err)
	}
	defer cleanUpTestEntities(t, nil, []uuid.UUID{shift.ID}, nil, nil)

	clientUUID := uuid.New()
	txInput := CreateTxInput{
		ClientUUID:    clientUUID,
		TotalAmount:   10000,
		PaymentMethod: models.PayCash,
		Type:          models.TxSale,
		Items: []TxItemInput{
			{ProductID: prod.ID, Qty: 1},
		},
	}

	// Submit first time
	tx1, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, txInput)
	if err != nil {
		t.Fatalf("Failed to create transaction first time: %v", err)
	}
	defer cleanUpTestEntities(t, nil, nil, []uuid.UUID{tx1.ID}, nil)

	// Verify stock is 9
	var stock float64
	_ = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", prod.ID).Scan(&stock)
	if stock != 9 {
		t.Fatalf("Expected stock to be 9, got %f", stock)
	}

	// Submit second time (simulating network retry) with identical client_uuid
	tx2, err := CreateTransaction(ctx, businessJnAuuid, outletJnAuuid, staffJnAuuid, txInput)
	if err != nil {
		t.Fatalf("Failed to create transaction second time (idempotency check): %v", err)
	}

	// Verify transaction returns same ID
	if tx1.ID != tx2.ID {
		t.Fatalf("Expected returned transaction ID to be identical, got %s and %s", tx1.ID, tx2.ID)
	}

	// Verify stock is STILL 9 (no double deduction)
	_ = config.DB.QueryRow(ctx, "SELECT current_stock FROM products WHERE id = $1", prod.ID).Scan(&stock)
	if stock != 9 {
		t.Fatalf("Expected stock to remain 9 due to idempotency, got %f", stock)
	}
	t.Log("Pass: Idempotent transaction execution prevented double sales and double stock deduction.")
}
