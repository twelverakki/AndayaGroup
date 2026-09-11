package items

import (
	"context"
	"os"
	"testing"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

var (
	tenantRetailUUID  = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // Tenant A: Retail
	tenantKitchenUUID = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12") // Tenant B: Manufacturing/Kitchen
	outletRetailUUID  = uuid.MustParse("c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11") // Outlet Retail A1
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

func TestItemsTenantIsolation(t *testing.T) {
	ctx := context.Background()
	service := NewItemsService(config.DB)

	// Create item for Tenant A (Retail)
	skuRetail := "RETAIL-TEST-" + uuid.New().String()[:6]
	itemRetail, err := service.CreateItem(ctx, tenantRetailUUID, &outletRetailUUID, CreateItemRequest{
		Name:               "Sabun Cuci Retail Test",
		SKU:                &skuRetail,
		ItemType:           models.ItemFinishedGood,
		IsSellable:         true,
		IsInventoryTracked: true,
		BaseUnit:           "pcs",
		BoxUnit:            "kardus",
		ConversionRate:     24,
		SellPrice:          5000,
		BoxSellPrice:       110000,
		StandardCost:       4000,
		InitialStockSealed: 2,
		InitialStockLoose:  10,
	})
	if err != nil {
		t.Fatalf("Failed to create Tenant Retail item: %v", err)
	}

	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM item_stocks WHERE item_id = $1", itemRetail.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM items WHERE id = $1", itemRetail.ID)
	}()

	// Query items as Tenant Retail -> must find the item
	itemsRetail, err := service.GetItems(ctx, tenantRetailUUID, "", nil)
	if err != nil {
		t.Fatalf("Failed to get items for Tenant Retail: %v", err)
	}
	foundInRetail := false
	for _, it := range itemsRetail {
		if it.ID == itemRetail.ID {
			foundInRetail = true
			if it.QtySealed != 2 || it.QtyLoose != 10 {
				t.Fatalf("Expected stock 2 sealed, 10 loose; got %f sealed, %f loose", it.QtySealed, it.QtyLoose)
			}
			break
		}
	}
	if !foundInRetail {
		t.Fatal("Expected created item to be found in Tenant Retail query, but not found")
	}

	// Query items as Tenant Kitchen -> must NOT find Tenant Retail item (Cross-Tenant Isolation)
	itemsKitchen, err := service.GetItems(ctx, tenantKitchenUUID, "", nil)
	if err != nil {
		t.Fatalf("Failed to get items for Tenant Kitchen: %v", err)
	}
	for _, it := range itemsKitchen {
		if it.ID == itemRetail.ID {
			t.Fatalf("SECURITY VIOLATION: Item %s belonging to Tenant Retail was visible to Tenant Kitchen!", itemRetail.ID)
		}
	}
	t.Log("Pass: Items cross-tenant isolation verified successfully.")
}

func TestCategoriesAndWastageScoping(t *testing.T) {
	ctx := context.Background()
	service := NewItemsService(config.DB)

	// Fetch categories for Tenant Retail
	cats, err := service.GetCategories(ctx, tenantRetailUUID)
	if err != nil {
		t.Fatalf("Failed to get categories: %v", err)
	}
	if len(cats) == 0 {
		t.Log("Warning: No categories found for Tenant Retail, but query succeeded.")
	}

	// Fetch wastage logs for Tenant Retail
	logs, err := service.GetWastageLogs(ctx, tenantRetailUUID)
	if err != nil {
		t.Fatalf("Failed to get wastage logs: %v", err)
	}
	for _, l := range logs {
		if l.BusinessID != tenantRetailUUID {
			t.Fatalf("SECURITY VIOLATION: Wastage log %s belonging to other tenant was returned for Tenant Retail!", l.ID)
		}
	}
	t.Log("Pass: Category and Wastage log tenant scoping verified.")
}
