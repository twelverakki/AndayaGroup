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

// ListAllBusinesses fetches all businesses in the system
func ListAllBusinesses(ctx context.Context) ([]*models.Business, error) {
	db := config.DB
	rows, err := db.Query(ctx, "SELECT id, name, type, created_at, updated_at FROM businesses ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*models.Business
	for rows.Next() {
		var b models.Business
		err = rows.Scan(&b.ID, &b.Name, &b.Type, &b.CreatedAt, &b.UpdatedAt)
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
