package logistics

import (
	"context"
	"os"
	"testing"

	"andaya-erp/backend/internal/config"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	tenantFnBUUID       = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12") // F&B Mobile/Hub Tenant
	tenantRetailUUID    = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // Retail Store Tenant
	userOwnerFnBUUID    = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12") // Tenant Owner
	userStaffMobileUUID = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17") // Mobile Staff Member
	userStaffRetailUUID = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14") // Retail Staff Member
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

func TestLogisticsWorkflowAndIsolation(t *testing.T) {
	ctx := context.Background()
	service := NewLogisticsService(config.DB)

	// Create Thawable Finished Good Item
	fgThawItemID := uuid.New()
	skuThawItem := "LOG-ITEM-" + uuid.New().String()[:6]
	_, err := config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'Thawable Frozen Food Item Test', 'finished_good', true, true, 'pcs', 'pack', 20, 2500, 30000, 'active', NOW(), NOW())
	`, fgThawItemID, tenantFnBUUID, skuThawItem)
	if err != nil {
		t.Fatalf("Failed to create test thawable item: %v", err)
	}

	_, err = config.DB.Exec(ctx, `
		INSERT INTO products (id, business_id, name, sku, unit_type, inventory_mode, purchase_price, sell_price, current_stock, status, created_at, updated_at)
		VALUES ($1, $2, 'Thawable Frozen Food Item Test', $3, 'pack', 'batch_thaw', 30000, 45000, 50, 'active', NOW(), NOW())
	`, fgThawItemID, tenantFnBUUID, skuThawItem)
	if err != nil {
		t.Fatalf("Failed to create test thawable product: %v", err)
	}

	// Fetch default Hub/Warehouse outlet
	var outletWarehouseID uuid.UUID
	err = config.DB.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 LIMIT 1`, tenantFnBUUID).Scan(&outletWarehouseID)
	if err != nil {
		t.Fatalf("Failed to get warehouse outlet: %v", err)
	}

	// Stock 50 packs in central warehouse
	_, err = config.DB.Exec(ctx, `
		INSERT INTO item_stocks (item_id, outlet_id, qty_sealed, qty_loose, updated_at)
		VALUES ($1, $2, 50, 0, NOW())
	`, fgThawItemID, outletWarehouseID)
	if err != nil {
		t.Fatalf("Failed to seed initial stock: %v", err)
	}

	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_movements WHERE item_id = $1", fgThawItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id = $1", fgThawItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM distributions WHERE product_id = $1", fgThawItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id = $1", fgThawItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM products WHERE id = $1", fgThawItemID)
	}()

	// 1. Create Distribution (Outbound: Central Hub -> Mobile Staff: 10 packs)
	dist, err := service.CreateDistribution(ctx, tenantFnBUUID, userOwnerFnBUUID, DistributionRequest{
		ItemID:       fgThawItemID,
		OutletID:     &outletWarehouseID,
		SentToUserID: userStaffMobileUUID,
		Qty:          10,
		Type:         "outbound",
	})
	if err != nil {
		t.Fatalf("Failed to create distribution: %v", err)
	}

	// Verify central warehouse stock is reduced to 40
	var warehouseStock float64
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL`, fgThawItemID, outletWarehouseID).Scan(&warehouseStock)
	if warehouseStock != 40 {
		t.Fatalf("Expected warehouse sealed stock to be 40, got %f", warehouseStock)
	}
	t.Log("Pass: Central warehouse stock deducted upon outbound shipment.")

	// 2. Cross-Tenant / Unauthorized Handshake: Staff from another tenant tries to receive distribution -> MUST FAIL
	err = service.ReceiveDistribution(ctx, tenantFnBUUID, userStaffRetailUUID, dist.ID)
	if err == nil {
		t.Fatal("Expected error when unauthorized staff attempts to receive distribution, but succeeded!")
	}
	t.Logf("Pass: Unauthorized handshake receive rejected: %v", err)

	// 3. Legitimate Handshake Receive by Assigned Mobile Staff
	err = service.ReceiveDistribution(ctx, tenantFnBUUID, userStaffMobileUUID, dist.ID)
	if err != nil {
		t.Fatalf("Failed to perform legitimate receive handshake: %v", err)
	}

	// Verify Mobile Staff's personal item_stock is now 10 packs sealed
	var mobileStockSealed float64
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id = $3`, fgThawItemID, outletWarehouseID, userStaffMobileUUID).Scan(&mobileStockSealed)
	if mobileStockSealed != 10 {
		t.Fatalf("Expected mobile staff stock to be 10 sealed packs, got %f", mobileStockSealed)
	}
	t.Log("Pass: Recipient staff successfully received stock into personal inventory.")

	// 4. Thawing: Staff thaws 2 packs beku -> converts to 40 pcs loose (conversion_rate = 20)
	err = service.ThawItem(ctx, tenantFnBUUID, userStaffMobileUUID, ThawRequest{
		ItemID:   fgThawItemID,
		OutletID: &outletWarehouseID,
		QtyPacks: 2,
	})
	if err != nil {
		t.Fatalf("Failed to thaw packs: %v", err)
	}

	// Verify Staff's stock is now: 8 sealed packs + 40 loose pcs
	var sealedAfter, looseAfter float64
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed, qty_loose FROM item_stocks WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id = $3`, fgThawItemID, outletWarehouseID, userStaffMobileUUID).Scan(&sealedAfter, &looseAfter)
	if sealedAfter != 8 || looseAfter != 40 {
		t.Fatalf("Expected 8 sealed and 40 loose, got %f sealed and %f loose", sealedAfter, looseAfter)
	}
	t.Log("Pass: Thawing conversion (pack beku -> pcs loose) executed cleanly.")
}
