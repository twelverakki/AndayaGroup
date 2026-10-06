package purchases

import (
	"context"
	"os"
	"testing"
	"time"

	"andaya-erp/backend/internal/config"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	testBusinessID = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // Tenant A
	testOutletID   = uuid.MustParse("c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11") // Outlet A1
	testOtherBizID = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12") // Tenant B
	testUserID     = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11") // Owner/User
)

func TestMain(m *testing.M) {
	_ = godotenv.Load("../../../.env")
	config.LoadConfig()
	config.ConnectDB()

	code := m.Run()

	if config.DB != nil {
		config.DB.Close()
	}
	os.Exit(code)
}

func TestSupplierCRUD(t *testing.T) {
	ctx := context.Background()
	service := NewPurchasesService(config.DB)

	// 1. Create Supplier
	supName := "PT Supplier Maju Test " + uuid.New().String()[:6]
	contact := "Budi Santoso"
	phone := "081234567890"
	sup, err := service.CreateSupplier(ctx, testBusinessID, CreateSupplierRequest{
		Name:             supName,
		ContactPerson:    &contact,
		Phone:            &phone,
		PaymentTermsDays: 14,
		Status:           "active",
	})
	if err != nil {
		t.Fatalf("Failed to create supplier: %v", err)
	}

	defer func() {
		_ = service.DeleteSupplier(ctx, testBusinessID, sup.ID)
	}()

	if sup.Name != supName || sup.PaymentTermsDays != 14 {
		t.Fatalf("Created supplier mismatch: %+v", sup)
	}

	// 2. Get Suppliers for Business A
	sups, err := service.GetSuppliers(ctx, testBusinessID, "active")
	if err != nil {
		t.Fatalf("Failed to get suppliers: %v", err)
	}
	found := false
	for _, s := range sups {
		if s.ID == sup.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("Created supplier not found in business suppliers list")
	}

	// 3. Cross-Tenant Check: Business B should NOT see Business A's supplier
	otherSups, err := service.GetSuppliers(ctx, testOtherBizID, "active")
	if err != nil {
		t.Fatalf("Failed to get other business suppliers: %v", err)
	}
	for _, s := range otherSups {
		if s.ID == sup.ID {
			t.Fatalf("SECURITY VIOLATION: Business A's supplier %s leaked to Business B!", sup.ID)
		}
	}

	// 4. Update Supplier
	updatedName := supName + " (Updated)"
	updatedSup, err := service.UpdateSupplier(ctx, testBusinessID, sup.ID, UpdateSupplierRequest{
		Name:             updatedName,
		ContactPerson:    &contact,
		Phone:            &phone,
		PaymentTermsDays: 30,
		Status:           "active",
	})
	if err != nil {
		t.Fatalf("Failed to update supplier: %v", err)
	}
	if updatedSup.Name != updatedName || updatedSup.PaymentTermsDays != 30 {
		t.Fatalf("Updated supplier data mismatch: %+v", updatedSup)
	}
}

func TestDirectPurchaseAndStockLedger(t *testing.T) {
	ctx := context.Background()
	service := NewPurchasesService(config.DB)

	// Create test item
	var itemID uuid.UUID
	sku := "PURCHASE-TEST-" + uuid.New().String()[:6]
	err := config.DB.QueryRow(ctx, `
		INSERT INTO items (
			business_id, sku, name, item_type, is_sellable, is_inventory_tracked,
			is_purchasable, allow_branch_purchase, base_unit, box_unit, conversion_rate,
			sell_price, standard_cost, status
		) VALUES (
			$1, $2, 'Kecap Manis Direct Test', 'finished_good', true, true,
			true, true, 'pcs', 'dus', 12,
			10000, 7000, 'active'
		) RETURNING id
	`, testBusinessID, sku).Scan(&itemID)
	if err != nil {
		t.Fatalf("Failed to create test item: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_movements WHERE item_id = $1", itemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id = $1", itemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id = $1", itemID)
	}()

	// Execute 1-Step Direct Purchase (Status = received, 2 Dus @ Rp96.000 / dus = Rp8.000/pcs)
	poNum := "PO-TEST-" + uuid.New().String()[:6]
	invoiceNo := "INV-SUPPLIER-001"
	purchase, err := service.CreatePurchase(ctx, testBusinessID, testOutletID, testUserID, "owner", CreatePurchaseRequest{
		OutletID:       testOutletID,
		PONumber:       &poNum,
		InvoiceNo:      &invoiceNo,
		SupplierName:   "Distributor Sembako Mandiri",
		Status:         "received",
		PaymentStatus:  "paid",
		PaymentMethod:  "cash",
		SubtotalAmount: 192000,
		TotalAmount:    192000,
		AmountPaid:     192000,
		Items: []PurchaseItemInput{
			{
				ItemID:         itemID,
				UOM:            "box",
				QtyOrdered:     2,
				ConversionRate: 12,
				UnitCost:       96000,
			},
		},
	})
	if err != nil {
		t.Fatalf("Failed to create direct purchase: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM purchase_payments WHERE purchase_id = $1", purchase.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM purchase_items WHERE purchase_id = $1", purchase.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM purchases WHERE id = $1", purchase.ID)
	}()

	if purchase.Status != "received" || purchase.PaymentStatus != "paid" {
		t.Fatalf("Expected purchase status received and paid, got: %s / %s", purchase.Status, purchase.PaymentStatus)
	}

	// 1. Verify item_stocks incremented (2 Dus / 0 Loose)
	var qtySealed, qtyLoose float64
	err = config.DB.QueryRow(ctx, "SELECT qty_sealed, qty_loose FROM item_stocks WHERE item_id = $1 AND outlet_id = $2", itemID, testOutletID).Scan(&qtySealed, &qtyLoose)
	if err != nil {
		t.Fatalf("Failed to query item stock: %v", err)
	}
	if qtySealed != 2 || qtyLoose != 0 {
		t.Fatalf("Expected stock 2 sealed, 0 loose; got %f sealed, %f loose", qtySealed, qtyLoose)
	}

	// 2. Verify stock_movements ledger entry
	var movCount int
	err = config.DB.QueryRow(ctx, "SELECT COUNT(*) FROM stock_movements WHERE source_document_id = $1 AND source_document_type = 'purchase_inbound'", purchase.ID).Scan(&movCount)
	if err != nil || movCount == 0 {
		t.Fatalf("Expected stock movement purchase_inbound recorded, count: %d, err: %v", movCount, err)
	}

	// 3. Verify items.standard_cost updated to Last Buying Price (96.000 / 12 = 8.000)
	var standardCost int64
	err = config.DB.QueryRow(ctx, "SELECT standard_cost FROM items WHERE id = $1", itemID).Scan(&standardCost)
	if err != nil {
		t.Fatalf("Failed to query item standard cost: %v", err)
	}
	if standardCost != 8000 {
		t.Fatalf("Expected standard cost updated to Last Buying Price 8000, got: %d", standardCost)
	}

	t.Log("Pass: 1-Step Direct Purchase, Double-Entry Movement, and Last Buying Price update verified 100%.")
}

func TestTwoStepPOAndReceiveAndAPPayment(t *testing.T) {
	ctx := context.Background()
	service := NewPurchasesService(config.DB)

	// Create test item
	var itemID uuid.UUID
	sku := "PO-TWOSTEP-" + uuid.New().String()[:6]
	err := config.DB.QueryRow(ctx, `
		INSERT INTO items (
			business_id, sku, name, item_type, is_sellable, is_inventory_tracked,
			is_purchasable, allow_branch_purchase, base_unit, box_unit, conversion_rate,
			sell_price, standard_cost, status
		) VALUES (
			$1, $2, 'Beras Ramos 5kg Test', 'finished_good', true, true,
			true, true, 'pcs', 'karung', 5,
			75000, 60000, 'active'
		) RETURNING id
	`, testBusinessID, sku).Scan(&itemID)
	if err != nil {
		t.Fatalf("Failed to create test item: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_movements WHERE item_id = $1", itemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id = $1", itemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id = $1", itemID)
	}()

	// Step 1: Create PO in 'submitted' status with partial payment (DP 50%)
	poNum := "PO-SUBMIT-" + uuid.New().String()[:6]
	dueDate := time.Now().AddDate(0, 0, 14).Format("2006-01-02")
	purchase, err := service.CreatePurchase(ctx, testBusinessID, testOutletID, testUserID, "owner", CreatePurchaseRequest{
		OutletID:       testOutletID,
		PONumber:       &poNum,
		SupplierName:   "Agen Beras Sumber Rejeki",
		Status:         "submitted",
		PaymentStatus:  "partial",
		PaymentMethod:  "bank_transfer",
		DueDate:        &dueDate,
		SubtotalAmount: 600000, // 10 karung @ Rp60.000
		TotalAmount:    600000,
		AmountPaid:     200000, // DP Rp200.000 (Sisa Rp400.000)
		Items: []PurchaseItemInput{
			{
				ItemID:         itemID,
				UOM:            "box",
				QtyOrdered:     10,
				ConversionRate: 5,
				UnitCost:       60000,
			},
		},
	})
	if err != nil {
		t.Fatalf("Failed to create submitted PO: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM purchase_payments WHERE purchase_id = $1", purchase.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM purchase_items WHERE purchase_id = $1", purchase.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM purchases WHERE id = $1", purchase.ID)
	}()

	if purchase.AmountOwed != 400000 || purchase.PaymentStatus != "partial" {
		t.Fatalf("Expected amount owed 400000, got: %d", purchase.AmountOwed)
	}

	// Verify stock is STILL 0 before receiving
	var initialQty float64
	_ = config.DB.QueryRow(ctx, "SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2", itemID, testOutletID).Scan(&initialQty)
	if initialQty != 0 {
		t.Fatalf("Stock should be 0 before Goods Receipt, got: %f", initialQty)
	}

	// Step 2: Confirm Goods Receipt (Receive Purchase)
	receivedPurchase, err := service.ReceivePurchase(ctx, testBusinessID, purchase.ID, testUserID, ReceivePurchaseRequest{})
	if err != nil {
		t.Fatalf("Failed to receive purchase: %v", err)
	}
	if receivedPurchase.Status != "received" {
		t.Fatalf("Expected purchase status received, got: %s", receivedPurchase.Status)
	}

	// Verify stock has NOW increased (10 karung sealed, 0 pcs loose)
	var finalSealed, finalLoose float64
	err = config.DB.QueryRow(ctx, "SELECT qty_sealed, qty_loose FROM item_stocks WHERE item_id = $1 AND outlet_id = $2", itemID, testOutletID).Scan(&finalSealed, &finalLoose)
	if err != nil || finalSealed != 10 || finalLoose != 0 {
		t.Fatalf("Expected stock 10 sealed, 0 loose after receive; got %f sealed, %f loose, err: %v", finalSealed, finalLoose, err)
	}

	// Step 3: Record Accounts Payable (AP) Repayment of remaining Rp400.000
	refNo := "TRF-BCA-987654"
	payment, err := service.AddPurchasePayment(ctx, testBusinessID, purchase.ID, testUserID, AddPaymentRequest{
		AmountPaid:    400000,
		PaymentMethod: "bank_transfer",
		ReferenceNo:   &refNo,
	})
	if err != nil {
		t.Fatalf("Failed to add AP payment: %v", err)
	}
	if payment.AmountPaid != 400000 {
		t.Fatalf("Expected payment amount 400000, got: %d", payment.AmountPaid)
	}

	// Step 4: Verify Overpayment Rejection
	_, err = service.AddPurchasePayment(ctx, testBusinessID, purchase.ID, testUserID, AddPaymentRequest{
		AmountPaid:    50000,
		PaymentMethod: "cash",
	})
	if err == nil {
		t.Fatal("Expected error when attempting overpayment on fully paid purchase, but got nil")
	}

	t.Log("Pass: 2-Step PO, Goods Receipt, AP settlement, and Overpayment Protection verified 100%.")
}
