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

	// Create 2 test items: 1 frozen item, 1 ingredient item
	item1ID := uuid.New()
	sku1 := "LOG-ITEM-" + uuid.New().String()[:6]
	_, err := config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'Thawable Frozen Food Item Test', 'finished_good', true, true, 'pcs', 'pack', 20, 2500, 30000, 'active', NOW(), NOW())
	`, item1ID, tenantFnBUUID, sku1)
	if err != nil {
		t.Fatalf("Failed to create test item 1: %v", err)
	}

	item2ID := uuid.New()
	sku2 := "LOG-ITEM-" + uuid.New().String()[:6]
	_, err = config.DB.Exec(ctx, `
		INSERT INTO items (id, business_id, sku, name, item_type, is_sellable, is_inventory_tracked, base_unit, box_unit, conversion_rate, sell_price, standard_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'Sauce Bottle Pack Test', 'raw_material', false, true, 'botol', 'dus', 12, 0, 60000, 'active', NOW(), NOW())
	`, item2ID, tenantFnBUUID, sku2)
	if err != nil {
		t.Fatalf("Failed to create test item 2: %v", err)
	}

	// Fetch default Hub/Warehouse outlet and destination branch
	var outletWarehouseID uuid.UUID
	err = config.DB.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 LIMIT 1`, tenantFnBUUID).Scan(&outletWarehouseID)
	if err != nil {
		t.Fatalf("Failed to get warehouse outlet: %v", err)
	}

	var outletBranchID uuid.UUID
	err = config.DB.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 AND id != $2 LIMIT 1`, tenantFnBUUID, outletWarehouseID).Scan(&outletBranchID)
	if err != nil {
		outletBranchID = uuid.New()
		_, _ = config.DB.Exec(ctx, `INSERT INTO outlets (id, business_id, name, is_main, address) VALUES ($1, $2, 'Bakso Cart Branch Test', false, 'Jl. Kaliurang')`, outletBranchID, tenantFnBUUID)
		defer func() {
			_, _ = config.DB.Exec(ctx, `DELETE FROM outlets WHERE id = $1`, outletBranchID)
		}()
	}

	// Seed stock: 50 packs of item1, 30 boxes of item2 at warehouse
	_, err = config.DB.Exec(ctx, `
		INSERT INTO item_stocks (item_id, outlet_id, qty_sealed, qty_loose, updated_at)
		VALUES ($1, $2, 50, 0, NOW()), ($3, $2, 30, 0, NOW())
	`, item1ID, outletWarehouseID, item2ID)
	if err != nil {
		t.Fatalf("Failed to seed initial stock: %v", err)
	}

	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_movements WHERE item_id IN ($1, $2)", item1ID, item2ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM stock_transfer_items WHERE item_id IN ($1, $2)", item1ID, item2ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id IN ($1, $2)", item1ID, item2ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id IN ($1, $2)", item1ID, item2ID)
	}()

	// 0. Guard Test: Self-Transfer (from == to) must fail
	selfTransferReq := CreateTransferRequest{
		FromOutletID: &outletWarehouseID,
		ToOutletID:   &outletWarehouseID,
		Items: []CreateTransferItemRequest{
			{ItemID: item1ID, QtySentSealed: 1},
		},
	}
	_, selfErr := service.CreateTransfer(ctx, tenantFnBUUID, userOwnerFnBUUID, selfTransferReq)
	if selfErr == nil {
		t.Fatal("Expected error when FromOutletID == ToOutletID, but succeeded!")
	}
	t.Logf("Pass: Self-transfer rejected properly: %v", selfErr)

	// 1. Create Multi-Item Surat Jalan (Transfer: 10 packs item1, 5 boxes item2)
	transferReq := CreateTransferRequest{
		FromOutletID: &outletWarehouseID,
		ToOutletID:   &outletBranchID,
		SentToUserID: &userStaffMobileUUID,
		TransferType: "outbound",
		Notes:        "Pengiriman stok harian multi-item",
		Items: []CreateTransferItemRequest{
			{ItemID: item1ID, QtySentSealed: 10, QtySentLoose: 0, Notes: "Frozen packs"},
			{ItemID: item2ID, QtySentSealed: 5, QtySentLoose: 0, Notes: "Sauce boxes"},
		},
	}

	transfer, err := service.CreateTransfer(ctx, tenantFnBUUID, userOwnerFnBUUID, transferReq)
	if err != nil {
		t.Fatalf("Failed to create multi-item transfer: %v", err)
	}

	if len(transfer.Items) != 2 {
		t.Fatalf("Expected 2 items in transfer, got %d", len(transfer.Items))
	}

	// Verify warehouse stock deducted: item1 -> 40, item2 -> 25
	var s1, s2 float64
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2`, item1ID, outletWarehouseID).Scan(&s1)
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2`, item2ID, outletWarehouseID).Scan(&s2)
	if s1 != 40 || s2 != 25 {
		t.Fatalf("Expected stocks (40, 25), got (%.2f, %.2f)", s1, s2)
	}
	t.Log("Pass: Central warehouse stock deducted properly for multi-item delivery.")

	// 2. Cross-Tenant / Invalid ID Handshake: Must fail
	invalidTransferID := uuid.New()
	err = service.ReceiveTransfer(ctx, tenantFnBUUID, userStaffRetailUUID, invalidTransferID, ReceiveTransferRequest{}, &outletBranchID, "staff")
	if err == nil {
		t.Fatal("Expected error when non-existent transfer is received, but succeeded!")
	}
	t.Logf("Pass: Invalid transfer handshake rejected: %v", err)

	// 3. Legitimate Handshake Receive with Shrinkage Override (item1: 10 received, item2: 4 received -> 1 box damaged/shrinkage)
	recQty1 := 10.0
	recQty2 := 4.0
	receiveReq := ReceiveTransferRequest{
		Notes: "Diterima oleh staff cabang, 1 dus saus pecah dalam perjalanan",
		Items: []ReceiveTransferItemRequest{
			{ItemID: item1ID, QtyReceivedSealed: &recQty1},
			{ItemID: item2ID, QtyReceivedSealed: &recQty2},
		},
	}

	err = service.ReceiveTransfer(ctx, tenantFnBUUID, userStaffMobileUUID, transfer.ID, receiveReq, &outletBranchID, "staff")
	if err != nil {
		t.Fatalf("Failed to receive multi-item transfer: %v", err)
	}

	// Verify Destination stock at branch: item1 = 10, item2 = 4
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2`, item1ID, outletBranchID).Scan(&s1)
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed FROM item_stocks WHERE item_id = $1 AND outlet_id = $2`, item2ID, outletBranchID).Scan(&s2)
	if s1 != 10 || s2 != 4 {
		t.Fatalf("Expected post-receipt branch stocks (10, 4), got (%.2f, %.2f)", s1, s2)
	}
	t.Log("Pass: Recipient received stock with shrinkage accurately tracked at destination branch.")

	// 4. Universal Unboxing / Thawing: Staff thaws 2 packs item1 -> 40 pcs loose (conversion_rate = 20)
	err = service.UnboxOrThawItem(ctx, tenantFnBUUID, userStaffMobileUUID, UnboxRequest{
		ItemID:         item1ID,
		OutletID:       &outletWarehouseID,
		QtyBoxes:       2,
		ShrinkageLoose: 0,
		Notes:          "Thaw harian bakso",
	})
	if err != nil {
		t.Fatalf("Failed to thaw item: %v", err)
	}

	var sealedAfter, looseAfter float64
	_ = config.DB.QueryRow(ctx, `SELECT qty_sealed, qty_loose FROM item_stocks WHERE item_id = $1 AND outlet_id = $2`, item1ID, outletWarehouseID).Scan(&sealedAfter, &looseAfter)
	if sealedAfter != 38 || looseAfter != 40 {
		t.Fatalf("Expected 38 sealed and 40 loose, got %.2f sealed and %.2f loose", sealedAfter, looseAfter)
	}
	t.Log("Pass: Universal Unboxing/Thawing executed cleanly without thaw_logs overhead.")

	// 5. Outlet Scoping Isolation Test:
	// Transfers involving outletBranchID must be returned when filtering by outletBranchID,
	// but a completely unrelated third outlet must see 0 transfers.
	unrelatedOutletID := uuid.New()
	_, _ = config.DB.Exec(ctx, `INSERT INTO outlets (id, business_id, name, is_main) VALUES ($1, $2, 'Unrelated Isolated Branch', false)`, unrelatedOutletID, tenantFnBUUID)
	defer func() {
		_, _ = config.DB.Exec(ctx, `DELETE FROM outlets WHERE id = $1`, unrelatedOutletID)
	}()

	branchTransfers, err := service.GetTransfers(ctx, tenantFnBUUID, &outletBranchID)
	if err != nil {
		t.Fatalf("Failed to get transfers scoped to branch: %v", err)
	}
	if len(branchTransfers) == 0 {
		t.Fatal("Expected at least 1 transfer for active branch outlet, got 0")
	}

	isolatedTransfers, err := service.GetTransfers(ctx, tenantFnBUUID, &unrelatedOutletID)
	if err != nil {
		t.Fatalf("Failed to get transfers for isolated branch: %v", err)
	}
	if len(isolatedTransfers) != 0 {
		t.Fatalf("Expected 0 transfers for completely isolated branch, got %d", len(isolatedTransfers))
	}
	t.Log("Pass: Outlet scoping isolation verified (Branch sees only its transfers, isolated branch sees none).")
}
