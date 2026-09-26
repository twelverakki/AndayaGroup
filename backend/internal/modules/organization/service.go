package organization

import (
	"context"
	"errors"
	"fmt"
	"time"

	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	GetAllBusinesses(ctx context.Context) ([]*models.Business, error)
	GetBusinessesForUser(ctx context.Context, userID *uuid.UUID, role string, activeBizID *uuid.UUID) ([]*models.Business, error)
	CreateBusiness(ctx context.Context, ownerID uuid.UUID, name string, bType string, hasPos, hasMfg, hasHub, hasEod, hasMulti bool, initialOutletName *string) (*models.Business, error)
	GetStaffMembers(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]models.StaffMember, error)
	CreateStaffMember(ctx context.Context, businessID uuid.UUID, req models.CreateStaffRequest) (*models.StaffMember, error)
	UpdateStaffMember(ctx context.Context, businessID uuid.UUID, staffID uuid.UUID, req models.UpdateStaffRequest) error
	GetOutlets(ctx context.Context, businessID *uuid.UUID) ([]models.Outlet, error)
	CreateOutlet(ctx context.Context, businessID uuid.UUID, name string, address *string, isMain bool) (*models.Outlet, error)
	GetBusinessProfile(ctx context.Context, businessID uuid.UUID) (*models.Business, error)
	UpdateBusinessProfile(ctx context.Context, businessID uuid.UUID, name string, phone, email, taxID *string, taxRatePct float64) (*models.Business, error)
	UpdateOutlet(ctx context.Context, businessID uuid.UUID, outletID uuid.UUID, name string, address, phone, receiptFooter *string, isMain *bool) (*models.Outlet, error)
	UpdateBusinessCapabilities(ctx context.Context, businessID uuid.UUID, req models.UpdateBusinessCapabilitiesRequest) error
	GetAuditLogs(ctx context.Context, businessID *uuid.UUID) ([]models.OverrideLog, error)
}

type service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) Service {
	return &service{db: db}
}

func (s *service) GetStaffMembers(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]models.StaffMember, error) {
	query := `
		SELECT 
			os.id, os.user_id, u.name, u.phone_or_email, os.outlet_id, o.name as outlet_name,
			os.role, os.can_view_cost, os.status, os.created_at
		FROM outlet_staff os
		JOIN users u ON os.user_id = u.id
		JOIN outlets o ON os.outlet_id = o.id
		WHERE o.business_id = $1
	`
	args := []interface{}{businessID}

	if outletID != nil {
		query += " AND os.outlet_id = $2"
		args = append(args, *outletID)
	}

	query += " ORDER BY os.created_at DESC"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query staff: %w", err)
	}
	defer rows.Close()

	var staffList []models.StaffMember
	for rows.Next() {
		var sm models.StaffMember
		err := rows.Scan(
			&sm.ID, &sm.UserID, &sm.Name, &sm.PhoneOrEmail, &sm.OutletID, &sm.OutletName,
			&sm.Role, &sm.CanViewCost, &sm.Status, &sm.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan staff member: %w", err)
		}
		staffList = append(staffList, sm)
	}

	return staffList, nil
}

func (s *service) CreateStaffMember(ctx context.Context, businessID uuid.UUID, req models.CreateStaffRequest) (*models.StaffMember, error) {
	// Verify outlet belongs to business
	var outletName string
	err := s.db.QueryRow(ctx, "SELECT name FROM outlets WHERE id = $1 AND business_id = $2", req.OutletID, businessID).Scan(&outletName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("outlet not found or unauthorized")
		}
		return nil, err
	}

	// Single Manager per Outlet Invariant (Domain 9):
	// An outlet must have at most 1 active Manager.
	if req.Role == models.RoleManager {
		var existingManagerName string
		err = s.db.QueryRow(ctx, `
			SELECT u.name 
			FROM outlet_staff os
			JOIN users u ON os.user_id = u.id
			WHERE os.outlet_id = $1 AND os.role = 'manager' AND os.status = 'active'
			LIMIT 1
		`, req.OutletID).Scan(&existingManagerName)
		if err == nil {
			return nil, fmt.Errorf("outlet '%s' sudah memiliki Manajer aktif (%s). Satu outlet hanya boleh memiliki 1 Manajer aktif", outletName, existingManagerName)
		}
	}

	passHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	passHashStr := string(passHash)

	pinHash, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	pinHashStr := string(pinHash)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	userID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, name, phone_or_email, password_hash, pin_hash, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
	`, userID, req.Name, req.PhoneOrEmail, passHashStr, pinHashStr)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	staffID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO outlet_staff (id, user_id, outlet_id, role, can_view_cost, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
	`, staffID, userID, req.OutletID, req.Role, req.CanViewCost)
	if err != nil {
		return nil, fmt.Errorf("failed to assign outlet staff: %w", err)
	}

	// If manager, also insert to manager_pins
	if req.Role == models.RoleManager {
		_, err = tx.Exec(ctx, `
			INSERT INTO manager_pins (id, user_id, pin_hash, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
		`, uuid.New(), userID, pinHashStr)
		if err != nil {
			return nil, fmt.Errorf("failed to store manager pin: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.StaffMember{
		ID:           staffID,
		UserID:       userID,
		Name:         req.Name,
		PhoneOrEmail: &req.PhoneOrEmail,
		OutletID:     req.OutletID,
		OutletName:   outletName,
		Role:         req.Role,
		CanViewCost:  req.CanViewCost,
		Status:       models.StatusActive,
		CreatedAt:    time.Now(),
	}, nil
}

func (s *service) UpdateStaffMember(ctx context.Context, businessID uuid.UUID, staffID uuid.UUID, req models.UpdateStaffRequest) error {
	var outletStaffID uuid.UUID
	var userID uuid.UUID
	var currentOutletID uuid.UUID
	var currentRole string
	var currentStatus string
	err := s.db.QueryRow(ctx, `
		SELECT os.id, os.user_id, os.outlet_id, os.role, os.status 
		FROM outlet_staff os
		JOIN outlets o ON os.outlet_id = o.id
		WHERE (os.id = $1 OR os.user_id = $1) AND o.business_id = $2
		LIMIT 1
	`, staffID, businessID).Scan(&outletStaffID, &userID, &currentOutletID, &currentRole, &currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("staff member not found or unauthorized")
		}
		return err
	}

	targetOutletID := currentOutletID
	if req.OutletID != nil {
		targetOutletID = *req.OutletID
	}
	targetRole := currentRole
	if req.Role != nil {
		targetRole = string(*req.Role)
	}
	targetStatus := currentStatus
	if req.Status != nil {
		targetStatus = string(*req.Status)
	}

	// Single Manager per Outlet Invariant (Domain 9):
	// Check if target outlet already has an active manager (excluding this user)
	if targetRole == "manager" && targetStatus == "active" {
		var existingManagerName string
		var targetOutletName string
		_ = s.db.QueryRow(ctx, "SELECT name FROM outlets WHERE id = $1", targetOutletID).Scan(&targetOutletName)
		err = s.db.QueryRow(ctx, `
			SELECT u.name 
			FROM outlet_staff os
			JOIN users u ON os.user_id = u.id
			WHERE os.outlet_id = $1 AND os.role = 'manager' AND os.status = 'active' AND os.user_id != $2
			LIMIT 1
		`, targetOutletID, userID).Scan(&existingManagerName)
		if err == nil {
			return fmt.Errorf("outlet '%s' sudah memiliki Manajer aktif (%s). Satu outlet hanya boleh memiliki 1 Manajer aktif", targetOutletName, existingManagerName)
		}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if req.Status != nil {
		_, err = tx.Exec(ctx, "UPDATE outlet_staff SET status = $1, updated_at = NOW() WHERE id = $2", *req.Status, outletStaffID)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2", *req.Status, userID)
		if err != nil {
			return err
		}
	}

	if req.OutletID != nil {
		// Verify outlet belongs to business
		var outletCount int
		err = tx.QueryRow(ctx, "SELECT COUNT(*) FROM outlets WHERE id = $1 AND business_id = $2", *req.OutletID, businessID).Scan(&outletCount)
		if err != nil || outletCount == 0 {
			return errors.New("target branch not found or unauthorized")
		}

		// Check if user already has a record in the target outlet (avoid unique constraint violation)
		var existingTargetStaffRecordID uuid.UUID
		err = tx.QueryRow(ctx, "SELECT id FROM outlet_staff WHERE user_id = $1 AND outlet_id = $2", userID, *req.OutletID).Scan(&existingTargetStaffRecordID)
		if err == nil {
			if existingTargetStaffRecordID != outletStaffID {
				_, _ = tx.Exec(ctx, "DELETE FROM outlet_staff WHERE id = $1", outletStaffID)
				_, err = tx.Exec(ctx, "UPDATE outlet_staff SET status = 'active', updated_at = NOW() WHERE id = $1", existingTargetStaffRecordID)
				if err != nil {
					return err
				}
			}
		} else {
			_, err = tx.Exec(ctx, "UPDATE outlet_staff SET outlet_id = $1, updated_at = NOW() WHERE id = $2", *req.OutletID, outletStaffID)
			if err != nil {
				return err
			}
		}
	}

	if req.Role != nil {
		_, err = tx.Exec(ctx, "UPDATE outlet_staff SET role = $1, updated_at = NOW() WHERE id = $2", *req.Role, outletStaffID)
		if err != nil {
			return err
		}
	}

	if req.CanViewCost != nil {
		_, err = tx.Exec(ctx, "UPDATE outlet_staff SET can_view_cost = $1, updated_at = NOW() WHERE id = $2", *req.CanViewCost, outletStaffID)
		if err != nil {
			return err
		}
	}

	if req.Name != nil {
		_, err = tx.Exec(ctx, "UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", *req.Name, userID)
		if err != nil {
			return err
		}
	}

	if req.PhoneOrEmail != nil {
		_, err = tx.Exec(ctx, "UPDATE users SET phone_or_email = $1, updated_at = NOW() WHERE id = $2", *req.PhoneOrEmail, userID)
		if err != nil {
			return err
		}
	}

	if req.PIN != nil && *req.PIN != "" {
		pinHash, err := bcrypt.GenerateFromPassword([]byte(*req.PIN), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, "UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2", string(pinHash), userID)
		if err != nil {
			return err
		}
		_, _ = tx.Exec(ctx, "UPDATE manager_pins SET pin_hash = $1, updated_at = NOW() WHERE user_id = $2", string(pinHash), userID)
	}

	return tx.Commit(ctx)
}

func (s *service) GetAllBusinesses(ctx context.Context) ([]*models.Business, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, type, phone, email, tax_id, COALESCE(tax_rate_pct, 0), has_pos, has_manufacturing, has_logistics_hub, has_eod_usage, COALESCE(has_multi_outlets, false), COALESCE(hide_central_stock_from_branches, false), created_at, updated_at
		FROM businesses
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Business
	for rows.Next() {
		var b models.Business
		if err := rows.Scan(&b.ID, &b.Name, &b.Type, &b.Phone, &b.Email, &b.TaxID, &b.TaxRatePct, &b.HasPos, &b.HasManufacturing, &b.HasLogisticsHub, &b.HasEodUsage, &b.HasMultiOutlets, &b.HideCentralStockFromBranches, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, &b)
	}
	return list, nil
}

func (s *service) GetBusinessesForUser(ctx context.Context, userID *uuid.UUID, role string, activeBizID *uuid.UUID) ([]*models.Business, error) {
	if role == "superadmin" {
		return s.GetAllBusinesses(ctx)
	}

	var list []*models.Business
	if userID != nil {
		rows, err := s.db.Query(ctx, `
			SELECT DISTINCT b.id, b.name, b.type, b.phone, b.email, b.tax_id, COALESCE(b.tax_rate_pct, 0), b.has_pos, b.has_manufacturing, b.has_logistics_hub, b.has_eod_usage, COALESCE(b.has_multi_outlets, false), COALESCE(b.hide_central_stock_from_branches, false), b.created_at, b.updated_at
			FROM businesses b
			JOIN business_owners bo ON bo.business_id = b.id
			WHERE bo.user_id = $1
			ORDER BY b.name ASC
		`, *userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b models.Business
				if err := rows.Scan(&b.ID, &b.Name, &b.Type, &b.Phone, &b.Email, &b.TaxID, &b.TaxRatePct, &b.HasPos, &b.HasManufacturing, &b.HasLogisticsHub, &b.HasEodUsage, &b.HasMultiOutlets, &b.HideCentralStockFromBranches, &b.CreatedAt, &b.UpdatedAt); err == nil {
					list = append(list, &b)
				}
			}
		}
	}

	// Fallback to activeBizID if business_owners returned empty
	if len(list) == 0 && activeBizID != nil {
		rows, err := s.db.Query(ctx, `
			SELECT id, name, type, phone, email, tax_id, COALESCE(tax_rate_pct, 0), has_pos, has_manufacturing, has_logistics_hub, has_eod_usage, COALESCE(has_multi_outlets, false), COALESCE(hide_central_stock_from_branches, false), created_at, updated_at
			FROM businesses
			WHERE id = $1
			ORDER BY name ASC
		`, *activeBizID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var b models.Business
				if err := rows.Scan(&b.ID, &b.Name, &b.Type, &b.Phone, &b.Email, &b.TaxID, &b.TaxRatePct, &b.HasPos, &b.HasManufacturing, &b.HasLogisticsHub, &b.HasEodUsage, &b.HasMultiOutlets, &b.HideCentralStockFromBranches, &b.CreatedAt, &b.UpdatedAt); err == nil {
					list = append(list, &b)
				}
			}
		}
	}

	return list, nil
}

func (s *service) GetOutlets(ctx context.Context, businessID *uuid.UUID) ([]models.Outlet, error) {
	var rows pgx.Rows
	var err error

	if businessID != nil {
		rows, err = s.db.Query(ctx, `
			SELECT id, business_id, name, is_main, address, phone, receipt_footer, created_at, updated_at
			FROM outlets
			WHERE business_id = $1
			ORDER BY is_main DESC, created_at ASC
		`, *businessID)
	} else {
		rows, err = s.db.Query(ctx, `
			SELECT id, business_id, name, is_main, address, phone, receipt_footer, created_at, updated_at
			FROM outlets
			ORDER BY is_main DESC, name ASC
		`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var outlets []models.Outlet
	for rows.Next() {
		var o models.Outlet
		if err := rows.Scan(&o.ID, &o.BusinessID, &o.Name, &o.IsMain, &o.Address, &o.Phone, &o.ReceiptFooter, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		outlets = append(outlets, o)
	}
	return outlets, nil
}

func (s *service) CreateOutlet(ctx context.Context, businessID uuid.UUID, name string, address *string, isMain bool) (*models.Outlet, error) {
	id := uuid.New()
	now := time.Now()

	// If this outlet is designated as Main, reset other outlets of this business
	if isMain {
		_, _ = s.db.Exec(ctx, `UPDATE outlets SET is_main = FALSE, updated_at = NOW() WHERE business_id = $1`, businessID)
	} else {
		// Check if this is the very first outlet for this business; if so, make it main automatically
		var existingCount int
		_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM outlets WHERE business_id = $1`, businessID).Scan(&existingCount)
		if existingCount == 0 {
			isMain = true
		}
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO outlets (id, business_id, name, is_main, address, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, businessID, name, isMain, address, now, now)
	if err != nil {
		return nil, err
	}
	return &models.Outlet{
		ID:         id,
		BusinessID: businessID,
		Name:       name,
		IsMain:     isMain,
		Address:    address,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (s *service) UpdateBusinessCapabilities(ctx context.Context, businessID uuid.UUID, req models.UpdateBusinessCapabilitiesRequest) error {
	if req.HasPos == nil && req.HasManufacturing == nil && req.HasLogisticsHub == nil && req.HasEodUsage == nil && req.HasMultiOutlets == nil && req.HideCentralStockFromBranches == nil && req.AllowCrossBranchStockView == nil {
		return nil
	}

	query := "UPDATE businesses SET updated_at = NOW()"
	var args []interface{}
	idx := 1

	if req.HasPos != nil {
		query += fmt.Sprintf(", has_pos = $%d", idx)
		args = append(args, *req.HasPos)
		idx++
	}
	if req.HasManufacturing != nil {
		query += fmt.Sprintf(", has_manufacturing = $%d", idx)
		args = append(args, *req.HasManufacturing)
		idx++
	}
	if req.HasLogisticsHub != nil {
		query += fmt.Sprintf(", has_logistics_hub = $%d", idx)
		args = append(args, *req.HasLogisticsHub)
		idx++
	}
	if req.HasEodUsage != nil {
		query += fmt.Sprintf(", has_eod_usage = $%d", idx)
		args = append(args, *req.HasEodUsage)
		idx++
	}
	if req.HasMultiOutlets != nil {
		query += fmt.Sprintf(", has_multi_outlets = $%d", idx)
		args = append(args, *req.HasMultiOutlets)
		idx++
	}
	if req.HideCentralStockFromBranches != nil {
		query += fmt.Sprintf(", hide_central_stock_from_branches = $%d", idx)
		args = append(args, *req.HideCentralStockFromBranches)
		idx++
	}
	if req.AllowCrossBranchStockView != nil {
		query += fmt.Sprintf(", allow_cross_branch_stock_view = $%d", idx)
		args = append(args, *req.AllowCrossBranchStockView)
		idx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", idx)
	args = append(args, businessID)

	_, err := s.db.Exec(ctx, query, args...)
	return err
}

func (s *service) GetBusinessProfile(ctx context.Context, businessID uuid.UUID) (*models.Business, error) {
	var b models.Business
	err := s.db.QueryRow(ctx, `
		SELECT id, name, type, phone, email, tax_id, COALESCE(tax_rate_pct, 0), has_pos, has_manufacturing, has_logistics_hub, has_eod_usage, COALESCE(has_multi_outlets, false), COALESCE(hide_central_stock_from_branches, false), COALESCE(allow_cross_branch_stock_view, false), created_at, updated_at
		FROM businesses
		WHERE id = $1
	`, businessID).Scan(
		&b.ID, &b.Name, &b.Type, &b.Phone, &b.Email, &b.TaxID, &b.TaxRatePct, &b.HasPos, &b.HasManufacturing, &b.HasLogisticsHub, &b.HasEodUsage, &b.HasMultiOutlets, &b.HideCentralStockFromBranches, &b.AllowCrossBranchStockView, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *service) UpdateBusinessProfile(ctx context.Context, businessID uuid.UUID, name string, phone, email, taxID *string, taxRatePct float64) (*models.Business, error) {
	_, err := s.db.Exec(ctx, `
		UPDATE businesses
		SET name = $1, phone = $2, email = $3, tax_id = $4, tax_rate_pct = $5, updated_at = NOW()
		WHERE id = $6
	`, name, phone, email, taxID, taxRatePct, businessID)
	if err != nil {
		return nil, err
	}
	return s.GetBusinessProfile(ctx, businessID)
}

func (s *service) UpdateOutlet(ctx context.Context, businessID uuid.UUID, outletID uuid.UUID, name string, address, phone, receiptFooter *string, isMain *bool) (*models.Outlet, error) {
	if isMain != nil && *isMain {
		// Reset other outlets of this business to false
		_, _ = s.db.Exec(ctx, `UPDATE outlets SET is_main = FALSE, updated_at = NOW() WHERE business_id = $1 AND id != $2`, businessID, outletID)
	}

	query := `UPDATE outlets SET name = $1, address = $2, phone = $3, receipt_footer = $4, updated_at = NOW()`
	args := []interface{}{name, address, phone, receiptFooter, outletID, businessID}
	if isMain != nil {
		query += `, is_main = $7 WHERE id = $5 AND business_id = $6`
		args = append(args, *isMain)
	} else {
		query += ` WHERE id = $5 AND business_id = $6`
	}

	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	var o models.Outlet
	err = s.db.QueryRow(ctx, `
		SELECT id, business_id, name, is_main, address, phone, receipt_footer, created_at, updated_at
		FROM outlets
		WHERE id = $1
	`, outletID).Scan(&o.ID, &o.BusinessID, &o.Name, &o.IsMain, &o.Address, &o.Phone, &o.ReceiptFooter, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *service) GetAuditLogs(ctx context.Context, businessID *uuid.UUID) ([]models.OverrideLog, error) {
	var rows pgx.Rows
	var err error

	if businessID != nil {
		rows, err = s.db.Query(ctx, `
			SELECT ol.id, ol.transaction_id, ol.staff_id, ol.manager_id, ol.action, ol.reason, ol.created_at
			FROM override_logs ol
			JOIN transactions t ON ol.transaction_id = t.id
			WHERE t.business_id = $1
			ORDER BY ol.created_at DESC
			LIMIT 100
		`, *businessID)
	} else {
		rows, err = s.db.Query(ctx, `
			SELECT ol.id, ol.transaction_id, ol.staff_id, ol.manager_id, ol.action, ol.reason, ol.created_at
			FROM override_logs ol
			JOIN transactions t ON ol.transaction_id = t.id
			ORDER BY ol.created_at DESC
			LIMIT 100
		`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.OverrideLog
	for rows.Next() {
		var ol models.OverrideLog
		if err := rows.Scan(&ol.ID, &ol.TransactionID, &ol.StaffID, &ol.ManagerID, &ol.Action, &ol.Reason, &ol.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, ol)
	}
	return logs, nil
}

func (s *service) CreateBusiness(ctx context.Context, ownerID uuid.UUID, name string, bType string, hasPos, hasMfg, hasHub, hasEod, hasMulti bool, initialOutletName *string) (*models.Business, error) {
	if bType == "" || bType == "custom" {
		bType = "retail"
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	bizID := uuid.New()
	now := time.Now()

	_, err = tx.Exec(ctx, `
		INSERT INTO businesses (id, name, type, has_pos, has_manufacturing, has_logistics_hub, has_eod_usage, has_multi_outlets, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, bizID, name, bType, hasPos, hasMfg, hasHub, hasEod, hasMulti, now, now)
	if err != nil {
		return nil, err
	}

	// Assign owner
	_, err = tx.Exec(ctx, `
		INSERT INTO business_owners (id, user_id, business_id, created_at)
		VALUES ($1, $2, $3, NOW())
	`, uuid.New(), ownerID, bizID)
	if err != nil {
		return nil, err
	}

	// Create initial default branch if requested
	if initialOutletName != nil && *initialOutletName != "" {
		outletID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO outlets (id, business_id, name, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
		`, outletID, bizID, *initialOutletName)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.Business{
		ID:               bizID,
		Name:             name,
		Type:             models.BusinessType(bType),
		HasPos:           hasPos,
		HasManufacturing: hasMfg,
		HasLogisticsHub:  hasHub,
		HasEodUsage:      hasEod,
		HasMultiOutlets:  hasMulti,
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}
