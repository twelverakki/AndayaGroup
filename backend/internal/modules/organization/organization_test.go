package organization

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
	testBusinessID = uuid.MustParse("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11") // JnA Mart
	testOutletID   = uuid.MustParse("c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11") // JnA Mart Toko Utama
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

func TestOrganizationStaffCRUD(t *testing.T) {
	ctx := context.Background()
	svc := NewService(config.DB)

	// 1. Get initial staff members
	initialStaff, err := svc.GetStaffMembers(ctx, testBusinessID, &testOutletID)
	if err != nil {
		t.Fatalf("Failed to fetch initial staff: %v", err)
	}

	initialCount := len(initialStaff)

	// 2. Create a new test cashier staff
	testEmail := "kasir_test_" + uuid.New().String()[:6] + "@andaya.com"
	createdStaff, err := svc.CreateStaffMember(ctx, testBusinessID, models.CreateStaffRequest{
		Name:         "Kasir Test Unit",
		PhoneOrEmail: testEmail,
		Password:     "password123",
		PIN:          "654321",
		OutletID:     testOutletID,
		Role:         models.RoleStaff,
		CanViewCost:  false,
	})
	if err != nil {
		t.Fatalf("Failed to create staff member: %v", err)
	}

	if createdStaff.Name != "Kasir Test Unit" || createdStaff.Role != models.RoleStaff {
		t.Errorf("Unexpected created staff payload: %+v", createdStaff)
	}

	// 3. Verify staff count increased
	staffAfterCreate, err := svc.GetStaffMembers(ctx, testBusinessID, &testOutletID)
	if err != nil {
		t.Fatalf("Failed to fetch staff after creation: %v", err)
	}

	if len(staffAfterCreate) != initialCount+1 {
		t.Errorf("Expected staff count to be %d, got %d", initialCount+1, len(staffAfterCreate))
	}

	// 4. Update staff (toggle status to inactive)
	inactiveStatus := models.StatusInactive
	newPIN := "112233"
	err = svc.UpdateStaffMember(ctx, testBusinessID, createdStaff.ID, models.UpdateStaffRequest{
		Status: &inactiveStatus,
		PIN:    &newPIN,
	})
	if err != nil {
		t.Fatalf("Failed to update staff member: %v", err)
	}

	// 5. Clean up created test user and staff
	_, _ = config.DB.Exec(ctx, "DELETE FROM outlet_staff WHERE id = $1", createdStaff.ID)
	_, _ = config.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", createdStaff.UserID)
}

func TestBusinessCapabilityUpdate(t *testing.T) {
	ctx := context.Background()
	svc := NewService(config.DB)

	hasPos := true
	hasMfg := false
	err := svc.UpdateBusinessCapabilities(ctx, testBusinessID, models.UpdateBusinessCapabilitiesRequest{
		HasPos:           &hasPos,
		HasManufacturing: &hasMfg,
	})
	if err != nil {
		t.Fatalf("Failed to update business capabilities: %v", err)
	}
}
