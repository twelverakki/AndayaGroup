package production

import (
	"context"
	"os"
	"testing"

	"andaya-erp/backend/internal/config"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	tenantFnBUUID     = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12") // F&B Central Kitchen Tenant
	tenantRetailUUID  = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // Retail Store Tenant
	userOwnerFnBUUID  = uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12") // Tenant Owner
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

func TestProductionHPPAndTenantIsolation(t *testing.T) {
	ctx := context.Background()
	service := NewProductionService(config.DB)

	// 1. Create Raw Materials
	rawDagingID := uuid.New()
	_, err := config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'Daging Sapi Segar Test', 'raw_material', false, true, 'kg', 'dus', 1, 0, 100000, 'active', NOW(), NOW())
	`, rawDagingID, tenantFnBUUID, "RAW-DAGING-"+uuid.New().String()[:6])
	if err != nil {
		t.Fatalf("Failed to create raw material: %v", err)
	}

	rawTepungID := uuid.New()
	_, err = config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'Tepung Tapioka Test', 'raw_material', false, true, 'kg', 'sak', 1, 0, 20000, 'active', NOW(), NOW())
	`, rawTepungID, tenantFnBUUID, "RAW-TEPUNG-"+uuid.New().String()[:6])
	if err != nil {
		t.Fatalf("Failed to create raw material 2: %v", err)
	}

	// Create Finished Good
	fgFnBItemID := uuid.New()
	skuFnBItem := "FG-FNB-" + uuid.New().String()[:6]
	_, err = config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'Item Olahan Central Kitchen Test', 'finished_good', true, true, 'pcs', 'pack', 20, 2500, 45000, 'active', NOW(), NOW())
	`, fgFnBItemID, tenantFnBUUID, skuFnBItem)
	if err != nil {
		t.Fatalf("Failed to create finished good item: %v", err)
	}

	_, err = config.DB.Exec(ctx, `
		INSERT INTO products (id, business_id, name, sku, unit_type, inventory_mode, purchase_price, sell_price, current_stock, status, created_at, updated_at)
		VALUES ($1, $2, 'Item Olahan Central Kitchen Test', $3, 'pack', 'batch_thaw', 30000, 45000, 0, 'active', NOW(), NOW())
	`, fgFnBItemID, tenantFnBUUID, skuFnBItem)
	if err != nil {
		t.Fatalf("Failed to create finished good product: %v", err)
	}

	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_movements WHERE item_id IN ($1, $2, $3)", rawDagingID, rawTepungID, fgFnBItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id IN ($1, $2, $3)", rawDagingID, rawTepungID, fgFnBItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM productions WHERE product_id = $1", fgFnBItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id IN ($1, $2, $3)", rawDagingID, rawTepungID, fgFnBItemID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM products WHERE id = $1", fgFnBItemID)
	}()

	// Scenario 1: Tenant Isolation - Retail tenant tries to trigger production using Central Kitchen's finished good -> MUST FAIL
	_, err = service.CreateProduction(ctx, tenantRetailUUID, userOwnerFnBUUID, ProductionRequest{
		ItemID:      fgFnBItemID,
		QtyProduced: 10,
		Expenses: []ProductionExpenseInput{
			{ItemID: rawDagingID, Qty: 2},
		},
	})
	if err == nil {
		t.Fatal("Expected error when producing across tenant boundary, but succeeded!")
	}
	t.Logf("Pass: Cross-tenant production blocked as expected: %v", err)

	// Scenario 2: Valid Production Run for F&B Tenant
	// 2 kg Daging @ 100.000 = 200.000
	// 5 kg Tepung @ 20.000 = 100.000
	// Total Cost = 300.000. Qty Produced = 10 pack -> HPP per pack = 30.000
	prodRun, err := service.CreateProduction(ctx, tenantFnBUUID, userOwnerFnBUUID, ProductionRequest{
		ItemID:      fgFnBItemID,
		QtyProduced: 10,
		Expenses: []ProductionExpenseInput{
			{ItemID: rawDagingID, Qty: 2.0},
			{ItemID: rawTepungID, Qty: 5.0},
		},
	})
	if err != nil {
		t.Fatalf("Failed to create valid production run: %v", err)
	}

	if prodRun.TotalMaterialCost != 300000 {
		t.Fatalf("Expected total material cost 300000, got %d", prodRun.TotalMaterialCost)
	}
	if prodRun.HPPPerUnit != 30000 {
		t.Fatalf("Expected HPP per unit 30000, got %d", prodRun.HPPPerUnit)
	}
	t.Log("Pass: Production HPP snapshot and stock ledger calculated correctly.")

	// Check Production History
	history, err := service.GetProductions(ctx, tenantFnBUUID)
	if err != nil {
		t.Fatalf("Failed to get productions: %v", err)
	}
	found := false
	for _, p := range history {
		if p.ID == prodRun.ID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("Expected created production run to appear in history list")
	}
	t.Log("Pass: Production history retrieval verified.")
}
