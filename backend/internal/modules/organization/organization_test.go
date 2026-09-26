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
	allowCross := true
	err := svc.UpdateBusinessCapabilities(ctx, testBusinessID, models.UpdateBusinessCapabilitiesRequest{
		HasPos:                    &hasPos,
		HasManufacturing:          &hasMfg,
		AllowCrossBranchStockView: &allowCross,
	})
	if err != nil {
		t.Fatalf("Failed to update business capabilities: %v", err)
	}

	profile, err := svc.GetBusinessProfile(ctx, testBusinessID)
	if err != nil {
		t.Fatalf("Failed to fetch business profile: %v", err)
	}
	if !profile.AllowCrossBranchStockView {
		t.Fatalf("Expected AllowCrossBranchStockView to be true, got false")
	}
}

func TestSingleManagerPerOutletInvariant(t *testing.T) {
	ctx := context.Background()
	svc := NewService(config.DB)

	// Create a dedicated isolated test outlet
	isolatedOutletID := uuid.New()
	_, err := config.DB.Exec(ctx, `INSERT INTO outlets (id, business_id, name, is_main) VALUES ($1, $2, 'Manager Guard Outlet Test', false)`, isolatedOutletID, testBusinessID)
	if err != nil {
		t.Fatalf("Failed to create test outlet: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, `DELETE FROM outlets WHERE id = $1`, isolatedOutletID)
	}()

	// 1. Create first manager (must succeed)
	mgr1Email := "mgr1_" + uuid.New().String()[:6] + "@andaya.com"
	mgr1, err := svc.CreateStaffMember(ctx, testBusinessID, models.CreateStaffRequest{
		Name:         "Manager Pertama",
		PhoneOrEmail: mgr1Email,
		Password:     "password123",
		PIN:          "123456",
		OutletID:     isolatedOutletID,
		Role:         models.RoleManager,
		CanViewCost:  true,
	})
	if err != nil {
		t.Fatalf("Failed to create first manager: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM manager_pins WHERE user_id = $1", mgr1.UserID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM outlet_staff WHERE id = $1", mgr1.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", mgr1.UserID)
	}()

	// 2. Attempt to create a SECOND manager for the SAME outlet (must fail)
	mgr2Email := "mgr2_" + uuid.New().String()[:6] + "@andaya.com"
	_, err = svc.CreateStaffMember(ctx, testBusinessID, models.CreateStaffRequest{
		Name:         "Manager Kedua Konflik",
		PhoneOrEmail: mgr2Email,
		Password:     "password123",
		PIN:          "654321",
		OutletID:     isolatedOutletID,
		Role:         models.RoleManager,
		CanViewCost:  true,
	})
	if err == nil {
		t.Fatal("Expected error when creating 2nd manager for same outlet, but succeeded!")
	}
	t.Logf("Pass: 2nd manager creation rejected properly: %v", err)

	// 3. Create a cashier staff (must succeed)
	cashierEmail := "cashier_" + uuid.New().String()[:6] + "@andaya.com"
	cashier, err := svc.CreateStaffMember(ctx, testBusinessID, models.CreateStaffRequest{
		Name:         "Staff Kasir Biasa",
		PhoneOrEmail: cashierEmail,
		Password:     "password123",
		PIN:          "111222",
		OutletID:     isolatedOutletID,
		Role:         models.RoleStaff,
		CanViewCost:  false,
	})
	if err != nil {
		t.Fatalf("Failed to create cashier staff: %v", err)
	}
	defer func() {
		_, _ = config.DB.Exec(ctx, "DELETE FROM outlet_staff WHERE id = $1", cashier.ID)
		_, _ = config.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", cashier.UserID)
	}()

	// 4. Attempt to promote cashier to manager while 1st manager is still active (must fail)
	mgrRole := models.RoleManager
	err = svc.UpdateStaffMember(ctx, testBusinessID, cashier.ID, models.UpdateStaffRequest{
		Role: &mgrRole,
	})
	if err == nil {
		t.Fatal("Expected error when promoting staff to manager while active manager exists, but succeeded!")
	}
	t.Logf("Pass: Promotion to 2nd manager rejected properly: %v", err)
}
