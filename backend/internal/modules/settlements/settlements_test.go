package settlements

import (
	"context"
	"os"
	"testing"

	"andaya-erp/backend/internal/config"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	tenantFnBUUID       = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12") // F&B Tenant
	tenantRetailUUID    = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // Retail Store Tenant
	userStaffMobileUUID = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17") // Mobile Staff Member
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

func TestSettlementsAndDirectSales(t *testing.T) {
	ctx := context.Background()
	service := NewSettlementsService(config.DB)

	// Create Finished Good Item
	fgItemID := uuid.New()
	skuItem := "SETTLE-ITEM-" + uuid.New().String()[:6]
	_, err := config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'F&B Food Item Closing Test', 'finished_good', true, true, 'pcs', 'pack', 20, 2500, 30000, 'active', NOW(), NOW())
	`, fgItemID, tenantFnBUUID, skuItem)
	if err != nil {
		t.Fatalf("Failed to create test item: %v", err)
	}

	_, err = config.DB.Exec(ctx, `
		INSERT INTO products (id, business_id, name, sku, unit_type, inventory_mode, purchase_price, sell_price, current_stock, status, created_at, updated_at)
		VALUES ($1, $2, 'F&B Food Item Closing Test', $3, 'pack', 'batch_thaw', 30000, 45000, 30, 'active', NOW(), NOW())
	`, fgItemID, tenantFnBUUID, skuItem)
	if err != nil {
		t.Fatalf("Failed to create test product: %v", err)
	}

	// Fetch default outlet
	var outletID uuid.UUID
	err = config.DB.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 LIMIT 1`, tenantFnBUUID).Scan(&outletID)
	if err != nil {
		t.Fatalf("Failed to get outlet: %v", err)
	}

	// Stock 30 packs in central warehouse for direct sales test
	_, err = config.DB.Exec(ctx, `
		INSERT INTO item_stocks (item_id, outlet_id, qty_sealed, qty_loose, updated_at)
		VALUES ($1, $2, 30, 0, NOW())
	`, fgItemID, outletID)
	if err != nil {
		t.Fatalf("Failed to seed initial stock: %v", err)
	}

	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM wastage_logs WHERE product_id = $1", fgItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM daily_settlement_items WHERE item_id = $1", fgItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM daily_settlements WHERE business_id = $1", tenantFnBUUID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM transaction_items WHERE product_id = $1", fgItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM transactions WHERE business_id = $1 AND shift_id IS NULL", tenantFnBUUID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_movements WHERE item_id = $1", fgItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id = $1", fgItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id = $1", fgItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM products WHERE id = $1", fgItemID)
	}()

	// 1. Daily Settlement Closing Simulation
	// Opening: 0 pcs loose. Thawed: 40 pcs loose. Actual Sisa: 5 pcs loose. Discard: 1 pcs loose.
	// Sold = (0 + 40) - 5 - 1 = 34 pcs.
	// Price = 2.500/pcs. Target Revenue = 34 * 2.500 = 85.000.
	// Cash Collected = 70.000, QRIS = 15.000. Total Collected = 85.000. Variance = 0.
	clientUUID := uuid.New()
	settleReq := CreateSettlementRequest{
		OutletID:      &outletID,
		CashCollected: 70000,
		QRISCollected: 15000,
		ClientUUID:    clientUUID,
		Items: []SettlementItemInput{
			{
				ItemID:       fgItemID,
				OpeningLoose: 0,
				ThawedLoose:  40,
				ActualLoose:  5,
				ActualSealed: 8,
				DiscardLoose: 1,
			},
		},
	}

	settleHeader, err := service.CreateSettlement(ctx, tenantFnBUUID, userStaffMobileUUID, settleReq)
	if err != nil {
		t.Fatalf("Failed to create daily settlement: %v", err)
	}

	if settleHeader.TotalTargetRevenue != 85000 {
		t.Fatalf("Expected target revenue 85000, got %d", settleHeader.TotalTargetRevenue)
	}
	if settleHeader.TotalCollected != 85000 {
		t.Fatalf("Expected total collected 85000, got %d", settleHeader.TotalCollected)
	}
	if settleHeader.TotalVariance != 0 {
		t.Fatalf("Expected variance 0, got %d", settleHeader.TotalVariance)
	}
	t.Log("Pass: Daily Settlement math & closing reconciliation calculated properly.")

	// 2. Idempotency Test: Resubmitting identical client_uuid MUST be blocked
	_, err = service.CreateSettlement(ctx, tenantFnBUUID, userStaffMobileUUID, settleReq)
	if err == nil {
		t.Fatal("Expected duplicate settlement submission to be rejected by idempotency constraint, but succeeded!")
	}
	t.Logf("Pass: Duplicate settlement rejected cleanly: %v", err)

	// 3. Direct Sale of Pack Gudang
	// Sale of 5 packs @ 45.000 = 225.000
	ds, err := service.CreateDirectSale(ctx, tenantFnBUUID, userStaffMobileUUID, DirectSaleRequest{
		ItemID:        fgItemID,
		OutletID:      &outletID,
		QtyPack:       5,
		UnitPrice:     45000,
		PaymentMethod: "cash",
	})
	if err != nil {
		t.Fatalf("Failed to create direct sale: %v", err)
	}

	if ds.TotalAmount != 225000 {
		t.Fatalf("Expected total amount 225000, got %d", ds.TotalAmount)
	}

	// Verify central warehouse stock reduced from 30 to 25
	var warehouseStock float64
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL`, fgItemID, outletID).Scan(&warehouseStock)
	if warehouseStock != 25 {
		t.Fatalf("Expected warehouse stock 25, got %f", warehouseStock)
	}
	t.Log("Pass: Direct pack sale successfully deducted warehouse sealed stock.")
}
