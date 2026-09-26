package admin

import (
	"context"
	"errors"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserAssignmentInfo struct {
	Type         string     `json:"type"` // "owner", "staff"
	BusinessID   *uuid.UUID `json:"business_id,omitempty"`
	BusinessName string     `json:"business_name,omitempty"`
	OutletID     *uuid.UUID `json:"outlet_id,omitempty"`
	OutletName   string     `json:"outlet_name,omitempty"`
	Role         string     `json:"role,omitempty"` // "manager", "admin_gudang", "staff"
	Status       string     `json:"status,omitempty"`
}

type UserAdminDetail struct {
	ID           uuid.UUID            `json:"id"`
	Name         string               `json:"name"`
	PhoneOrEmail *string              `json:"phone_or_email,omitempty"`
	Status       string               `json:"status"`
	CreatedAt    time.Time            `json:"created_at"`
	Assignments  []UserAssignmentInfo `json:"assignments"`
}

type AssignmentInput struct {
	Type       string     `json:"type"` // "owner", "staff"
	BusinessID *uuid.UUID `json:"business_id,omitempty"`
	OutletID   *uuid.UUID `json:"outlet_id,omitempty"`
	Role       string     `json:"role,omitempty"`
}

// ListAllUsers retrieves all users in the system with their assignments
func ListAllUsers(ctx context.Context) ([]*UserAdminDetail, error) {
	db := config.DB

	rows, err := db.Query(ctx, `
		SELECT id, name, phone_or_email, status, created_at
		FROM users
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*UserAdminDetail
	for rows.Next() {
		var u UserAdminDetail
		err = rows.Scan(&u.ID, &u.Name, &u.PhoneOrEmail, &u.Status, &u.CreatedAt)
		if err != nil {
			return nil, err
		}
		u.Assignments = []UserAssignmentInfo{}
		list = append(list, &u)
	}

	// Fetch assignments for each user
	for _, user := range list {
		// 1. Fetch Owner assignments
		oRows, err := db.Query(ctx, `
			SELECT bo.business_id, bo.outlet_id, b.name, o.name
			FROM business_owners bo
			LEFT JOIN businesses b ON bo.business_id = b.id
			LEFT JOIN outlets o ON bo.outlet_id = o.id
			WHERE bo.user_id = $1
		`, user.ID)
		if err == nil {
			for oRows.Next() {
				var info UserAssignmentInfo
				info.Type = "owner"
				var bName *string
				var oName *string
				err = oRows.Scan(&info.BusinessID, &info.OutletID, &bName, &oName)
				if err == nil {
					if bName != nil {
						info.BusinessName = *bName
					}
					if oName != nil {
						info.OutletName = *oName
					}
					user.Assignments = append(user.Assignments, info)
				}
			}
			oRows.Close()
		}

		// 2. Fetch Staff assignments
		sRows, err := db.Query(ctx, `
			SELECT os.outlet_id, os.role, os.status, o.name, b.id, b.name
			FROM outlet_staff os
			JOIN outlets o ON os.outlet_id = o.id
			JOIN businesses b ON o.business_id = b.id
			WHERE os.user_id = $1
		`, user.ID)
		if err == nil {
			for sRows.Next() {
				var info UserAssignmentInfo
				info.Type = "staff"
				var bName *string
				err = sRows.Scan(&info.OutletID, &info.Role, &info.Status, &info.OutletName, &info.BusinessID, &bName)
				if err == nil {
					if bName != nil {
						info.BusinessName = *bName
					}
					user.Assignments = append(user.Assignments, info)
				}
			}
			sRows.Close()
		}
	}

	return list, nil
}

// CreateUser creates a new user from superadmin panel
func CreateUser(ctx context.Context, name, email, password, pin, status string) (*models.User, error) {
	db := config.DB

	// Check unique email
	if email != "" {
		var exists bool
		_ = db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE phone_or_email = $1)", email).Scan(&exists)
		if exists {
			return nil, errors.New("phone_or_email already registered")
		}
	}

	var pwdHash *string
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hs := string(hash)
		pwdHash = &hs
	}

	var pinHash *string
	if pin != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hs := string(hash)
		pinHash = &hs
	}

	u := &models.User{
		ID:        uuid.New(),
		Name:      name,
		Status:    models.UserStatus(status),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if email != "" {
		u.PhoneOrEmail = &email
	}

	_, err := db.Exec(ctx, `
		INSERT INTO users (id, name, phone_or_email, password_hash, pin_hash, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, u.ID, u.Name, u.PhoneOrEmail, pwdHash, pinHash, string(u.Status), u.CreatedAt, u.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return u, nil
}

// UpdateUser updates basic user info
func UpdateUser(ctx context.Context, id uuid.UUID, name, email, status string) (*models.User, error) {
	db := config.DB

	// Check if unique email
	if email != "" {
		var exists bool
		_ = db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE phone_or_email = $1 AND id != $2)", email, id).Scan(&exists)
		if exists {
			return nil, errors.New("phone_or_email already registered by another user")
		}
	}

	var emailPtr *string
	if email != "" {
		emailPtr = &email
	}

	_, err := db.Exec(ctx, `
		UPDATE users
		SET name = $1, phone_or_email = $2, status = $3, updated_at = NOW()
		WHERE id = $4
	`, name, emailPtr, status, id)
	if err != nil {
		return nil, err
	}

	var u models.User
	err = db.QueryRow(ctx, "SELECT id, name, phone_or_email, status, created_at, updated_at FROM users WHERE id = $1", id).
		Scan(&u.ID, &u.Name, &u.PhoneOrEmail, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &u, nil
}

// UpdateUserAssignments handles resetting and updating user assignments
func UpdateUserAssignments(ctx context.Context, userID uuid.UUID, assignments []AssignmentInput) error {
	db := config.DB

	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Delete all current assignments
	_, err = tx.Exec(ctx, "DELETE FROM business_owners WHERE user_id = $1", userID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, "DELETE FROM outlet_staff WHERE user_id = $1", userID)
	if err != nil {
		return err
	}

	// 2. Insert new assignments
	for _, a := range assignments {
		if a.Type == "owner" {
			_, err = tx.Exec(ctx, `
				INSERT INTO business_owners (id, user_id, business_id, outlet_id)
				VALUES ($1, $2, $3, $4)
			`, uuid.New(), userID, a.BusinessID, a.OutletID)
		} else if a.Type == "staff" {
			if a.OutletID == nil {
				return errors.New("outlet_id is required for staff/manager assignment")
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO outlet_staff (id, user_id, outlet_id, role, status)
				VALUES ($1, $2, $3, $4, 'active')
			`, uuid.New(), userID, *a.OutletID, a.Role)
		}
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

type OwnerBusinessSummary struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Type             string    `json:"type"`
	Phone            *string   `json:"phone,omitempty"`
	Email            *string   `json:"email,omitempty"`
	TaxID            *string   `json:"tax_id,omitempty"`
	TaxRatePct       float64   `json:"tax_rate_pct"`
	HasPos           bool      `json:"has_pos"`
	HasManufacturing bool      `json:"has_manufacturing"`
	HasLogisticsHub  bool      `json:"has_logistics_hub"`
	HasEodUsage      bool      `json:"has_eod_usage"`
	HasMultiOutlets  bool      `json:"has_multi_outlets"`
	OutletCount      int       `json:"outlet_count"`
	StaffCount       int       `json:"staff_count"`
	CreatedAt        time.Time `json:"created_at"`
}

type OwnerHierarchyDetail struct {
	ID           uuid.UUID              `json:"id"`
	Name         string                 `json:"name"`
	PhoneOrEmail *string                `json:"phone_or_email,omitempty"`
	Status       string                 `json:"status"`
	CreatedAt    time.Time              `json:"created_at"`
	Businesses   []OwnerBusinessSummary `json:"businesses"`
}

// GetOwnersWithBusinesses retrieves all Owner users along with their businesses
func GetOwnersWithBusinesses(ctx context.Context) ([]*OwnerHierarchyDetail, error) {
	db := config.DB

	// Fetch users who are business owners or newly registered owners without staff assignments
	rows, err := db.Query(ctx, `
		SELECT DISTINCT u.id, u.name, u.phone_or_email, u.status, u.created_at
		FROM users u
		LEFT JOIN business_owners bo ON bo.user_id = u.id
		LEFT JOIN outlet_staff os ON os.user_id = u.id
		WHERE (u.phone_or_email IS NULL OR u.phone_or_email NOT IN ('superadmin@andaya.com', 'admin@andaya.com'))
		  AND (bo.id IS NOT NULL OR os.id IS NULL)
		ORDER BY u.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var owners []*OwnerHierarchyDetail
	for rows.Next() {
		var o OwnerHierarchyDetail
		if err := rows.Scan(&o.ID, &o.Name, &o.PhoneOrEmail, &o.Status, &o.CreatedAt); err != nil {
			return nil, err
		}
		o.Businesses = []OwnerBusinessSummary{}
		owners = append(owners, &o)
	}

	for _, owner := range owners {
		bRows, err := db.Query(ctx, `
			SELECT DISTINCT b.id, b.name, b.type, b.phone, b.email, b.tax_id, COALESCE(b.tax_rate_pct, 0), b.has_pos, b.has_manufacturing, b.has_logistics_hub, b.has_eod_usage, COALESCE(b.has_multi_outlets, false), b.created_at,
			       (SELECT COUNT(*) FROM outlets o WHERE o.business_id = b.id) as outlet_count,
			       (SELECT COUNT(*) FROM outlet_staff os JOIN outlets o ON os.outlet_id = o.id WHERE o.business_id = b.id) as staff_count
			FROM businesses b
			JOIN business_owners bo ON bo.business_id = b.id
			WHERE bo.user_id = $1
			ORDER BY b.name ASC
		`, owner.ID)
		if err == nil {
			for bRows.Next() {
				var b OwnerBusinessSummary
				if err := bRows.Scan(&b.ID, &b.Name, &b.Type, &b.Phone, &b.Email, &b.TaxID, &b.TaxRatePct, &b.HasPos, &b.HasManufacturing, &b.HasLogisticsHub, &b.HasEodUsage, &b.HasMultiOutlets, &b.CreatedAt, &b.OutletCount, &b.StaffCount); err == nil {
					owner.Businesses = append(owner.Businesses, b)
				}
			}
			bRows.Close()
		}
	}

	return owners, nil
}

// CreateBusinessForOwner creates a new business entity and assigns it to an Owner user
func CreateBusinessForOwner(ctx context.Context, ownerID uuid.UUID, name string, bType string, hasPos, hasMfg, hasHub, hasEod, hasMulti bool, initialOutletName *string) (*models.Business, error) {
	db := config.DB

	if bType == "" || bType == "custom" {
		bType = "retail"
	}

	tx, err := db.Begin(ctx)
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

	// Create initial default outlet if specified, or auto create one
	outletName := "Outlet Utama"
	if initialOutletName != nil && *initialOutletName != "" {
		outletName = *initialOutletName
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO outlets (id, business_id, name, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
	`, uuid.New(), bizID, outletName)
	if err != nil {
		return nil, err
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

// ListAllBusinesses fetches all businesses in the system
func ListAllBusinesses(ctx context.Context) ([]*models.Business, error) {
	db := config.DB
	rows, err := db.Query(ctx, "SELECT id, name, type, has_pos, has_manufacturing, has_logistics_hub, has_eod_usage, COALESCE(has_multi_outlets, false), created_at, updated_at FROM businesses ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Business
	for rows.Next() {
		var b models.Business
		err = rows.Scan(&b.ID, &b.Name, &b.Type, &b.HasPos, &b.HasManufacturing, &b.HasLogisticsHub, &b.HasEodUsage, &b.HasMultiOutlets, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &b)
	}
	return list, nil
}

// ListAllOutlets fetches all outlets in the system
func ListAllOutlets(ctx context.Context) ([]*models.Outlet, error) {
	db := config.DB
	rows, err := db.Query(ctx, "SELECT id, business_id, name, address, created_at, updated_at FROM outlets ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Outlet
	for rows.Next() {
		var o models.Outlet
		err = rows.Scan(&o.ID, &o.BusinessID, &o.Name, &o.Address, &o.CreatedAt, &o.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &o)
	}
	return list, nil
}

// LogSecurityEvent records a sensitive security or authorization event
func LogSecurityEvent(ctx context.Context, actorID *uuid.UUID, actorName, actorRole, action, targetType string, targetID *string, details map[string]interface{}, ipAddress, userAgent *string) error {
	db := config.DB
	if db == nil {
		return nil
	}

	_, err := db.Exec(ctx, `
		INSERT INTO security_audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
	`, uuid.New(), actorID, actorName, actorRole, action, targetType, targetID, details, ipAddress, userAgent)
	return err
}

// ListSecurityAuditLogs retrieves recent security and system audit logs
func ListSecurityAuditLogs(ctx context.Context) ([]*models.SecurityAuditLog, error) {
	db := config.DB
	rows, err := db.Query(ctx, `
		SELECT id, actor_id, actor_name, actor_role, action, target_type, target_id, details, ip_address, user_agent, created_at
		FROM security_audit_logs
		ORDER BY created_at DESC
		LIMIT 200
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*models.SecurityAuditLog
	for rows.Next() {
		var l models.SecurityAuditLog
		err := rows.Scan(&l.ID, &l.ActorID, &l.ActorName, &l.ActorRole, &l.Action, &l.TargetType, &l.TargetID, &l.Details, &l.IPAddress, &l.UserAgent, &l.CreatedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &l)
	}
	return logs, nil
}

