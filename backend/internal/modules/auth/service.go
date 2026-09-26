package auth

import (
	"context"
	"errors"
	"time"

	"andaya-erp/backend/internal/config"
	"andaya-erp/backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type Workspace struct {
	BusinessID                   *uuid.UUID          `json:"business_id,omitempty"`
	OutletID                     *uuid.UUID          `json:"outlet_id,omitempty"`
	BusinessName                 string              `json:"business_name"`
	OutletName                   string              `json:"outlet_name,omitempty"`
	Role                         string              `json:"role"` // "owner", "manager", "admin_gudang", "staff", "superadmin"
	BusinessType                 models.BusinessType `json:"business_type"`
	IsMainOutlet                 bool                `json:"is_main_outlet"`
	HasPOS                       bool                `json:"has_pos"`
	HasManufacturing             bool                `json:"has_manufacturing"`
	HasLogisticsHub              bool                `json:"has_logistics_hub"`
	HasEODUsage                  bool                `json:"has_eod_usage"`
	HasMultiOutlets              bool                `json:"has_multi_outlets"`
	HideCentralStockFromBranches bool                `json:"hide_central_stock_from_branches"`
	AllowCrossBranchStockView    bool                `json:"allow_cross_branch_stock_view"`
}

type LoginResponse struct {
	User             *models.User          `json:"user"`
	Workspaces       []*Workspace          `json:"workspaces"`
	ActiveContext    *models.ActiveContext `json:"active_context"`
	Token            string                `json:"token,omitempty"` // For API clients
}

// AuthenticateUser verifies user credentials (password or PIN)
func AuthenticateUser(ctx context.Context, phoneOrEmail, password, pin string) (*models.User, error) {
	var user models.User
	var err error

	db := config.DB

	if phoneOrEmail != "" {
		// Login with Phone/Email
		err = db.QueryRow(ctx, 
			"SELECT id, name, phone_or_email, password_hash, pin_hash, status, created_at, updated_at FROM users WHERE phone_or_email = $1", 
			phoneOrEmail,
		).Scan(&user.ID, &user.Name, &user.PhoneOrEmail, &user.PasswordHash, &user.PinHash, &user.Status, &user.CreatedAt, &user.UpdatedAt)
	} else if pin != "" {
		// Login with PIN-only (needs to check if PIN is globally unique)
		// We'll search for the active user who matches the PIN hash. Since we have to scan all, we check PINs.
		// Note: In production, you would fetch active staff PIN hashes and verify. For simplicity in MVP, 
		// we query users and verify. Or we can ask for phone_or_email + PIN.
		rows, qErr := db.Query(ctx, "SELECT id, name, phone_or_email, password_hash, pin_hash, status, created_at, updated_at FROM users WHERE status = 'active'")
		if qErr != nil {
			return nil, qErr
		}
		defer rows.Close()

		found := false
		for rows.Next() {
			var u models.User
			if scanErr := rows.Scan(&u.ID, &u.Name, &u.PhoneOrEmail, &u.PasswordHash, &u.PinHash, &u.Status, &u.CreatedAt, &u.UpdatedAt); scanErr == nil {
				if u.PinHash != nil && bcrypt.CompareHashAndPassword([]byte(*u.PinHash), []byte(pin)) == nil {
					user = u
					found = true
					break
				}
			}
		}

		if !found {
			return nil, errors.New("invalid PIN code")
		}
		err = nil
	} else {
		return nil, errors.New("credentials must be provided")
	}

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	if user.Status == models.StatusInactive {
		return nil, errors.New("account is inactive")
	}

	// Verify Password if provided
	if password != "" {
		if user.PasswordHash == nil {
			return nil, errors.New("password login is not set for this account")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
			return nil, errors.New("invalid password")
		}
	} else if pin != "" && phoneOrEmail != "" {
		// Verify PIN with phone_or_email provided
		if user.PinHash == nil {
			return nil, errors.New("PIN login is not set for this account")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*user.PinHash), []byte(pin)); err != nil {
			return nil, errors.New("invalid PIN code")
		}
	}

	return &user, nil
}

// GetUserWorkspaces fetches all available business/outlet workspaces for a user
func GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*Workspace, error) {
	db := config.DB
	workspaces := []*Workspace{}

	// Check if user is superadmin (Strict check by email)
	var email string
	err := db.QueryRow(ctx, "SELECT phone_or_email FROM users WHERE id = $1", userID).Scan(&email)

	isSuperAdmin := err == nil && (email == "superadmin@andaya.com" || email == "admin@andaya.com")

	if isSuperAdmin {
		workspaces = append(workspaces, &Workspace{
			BusinessName:     "Superadmin Control Center",
			Role:             "superadmin",
			BusinessType:     "retail",
			HasPOS:           true,
			HasManufacturing: true,
			HasLogisticsHub:  true,
			HasEODUsage:      true,
			HasMultiOutlets:  true,
		})

		// Fetch all businesses as owner role
		bRows, err := db.Query(ctx, "SELECT id, name, type, COALESCE(has_pos, true), COALESCE(has_manufacturing, false), COALESCE(has_logistics_hub, false), COALESCE(has_eod_usage, false), COALESCE(has_multi_outlets, false), COALESCE(hide_central_stock_from_branches, false), COALESCE(allow_cross_branch_stock_view, false) FROM businesses")
		if err == nil {
			for bRows.Next() {
				var ws Workspace
				var bID uuid.UUID
				var bName string
				var bType models.BusinessType
				var hasPOS, hasMfg, hasHub, hasEOD, hasMulti, hideStock, allowCrossStock bool
				if err := bRows.Scan(&bID, &bName, &bType, &hasPOS, &hasMfg, &hasHub, &hasEOD, &hasMulti, &hideStock, &allowCrossStock); err == nil {
					ws.BusinessID = &bID
					ws.BusinessName = bName
					ws.Role = "owner"
					ws.BusinessType = bType
					ws.HasPOS = hasPOS
					ws.HasManufacturing = hasMfg
					ws.HasLogisticsHub = hasHub
					ws.HasEODUsage = hasEOD
					ws.HasMultiOutlets = hasMulti
					ws.HideCentralStockFromBranches = hideStock
					ws.AllowCrossBranchStockView = allowCrossStock
					workspaces = append(workspaces, &ws)
				}
			}
			bRows.Close()
		}

		// Fetch all outlets with manager, staff, and admin_gudang roles for Superadmin impersonation
		oRows, err := db.Query(ctx, `
			SELECT o.id, o.name, o.is_main, o.business_id, b.name, b.type, 
			       COALESCE(b.has_pos, true), COALESCE(b.has_manufacturing, false), 
			       COALESCE(b.has_logistics_hub, false), COALESCE(b.has_eod_usage, false),
			       COALESCE(b.has_multi_outlets, false), COALESCE(b.hide_central_stock_from_branches, false),
			       COALESCE(b.allow_cross_branch_stock_view, false)
			FROM outlets o
			JOIN businesses b ON o.business_id = b.id
		`)
		if err == nil {
			for oRows.Next() {
				var oID uuid.UUID
				var oName string
				var isMain bool
				var bID uuid.UUID
				var bName string
				var bType models.BusinessType
				var hasPOS, hasMfg, hasHub, hasEOD, hasMulti, hideStock, allowCrossStock bool
				if err := oRows.Scan(&oID, &oName, &isMain, &bID, &bName, &bType, &hasPOS, &hasMfg, &hasHub, &hasEOD, &hasMulti, &hideStock, &allowCrossStock); err == nil {
					workspaces = append(workspaces, &Workspace{
						OutletID:                     &oID,
						OutletName:                   oName,
						IsMainOutlet:                 isMain,
						BusinessID:                   &bID,
						BusinessName:                 bName,
						Role:                         "manager",
						BusinessType:                 bType,
						HasPOS:                       hasPOS,
						HasManufacturing:             hasMfg,
						HasLogisticsHub:              hasHub,
						HasEODUsage:                  hasEOD,
						HasMultiOutlets:              hasMulti,
						HideCentralStockFromBranches: hideStock,
						AllowCrossBranchStockView:    allowCrossStock,
					})
					workspaces = append(workspaces, &Workspace{
						OutletID:                     &oID,
						OutletName:                   oName,
						BusinessID:                   &bID,
						BusinessName:                 bName,
						Role:                         "staff",
						BusinessType:                 bType,
						HasPOS:                       hasPOS,
						HasManufacturing:             hasMfg,
						HasLogisticsHub:              hasHub,
						HasEODUsage:                  hasEOD,
						HasMultiOutlets:              hasMulti,
						HideCentralStockFromBranches: hideStock,
						AllowCrossBranchStockView:    allowCrossStock,
					})
					if bType == "fnb_production" || hasMfg || hasHub {
						workspaces = append(workspaces, &Workspace{
							OutletID:                     &oID,
							OutletName:                   oName,
							BusinessID:                   &bID,
							BusinessName:                 bName,
							Role:                         "admin_gudang",
							BusinessType:                 bType,
							HasPOS:                       hasPOS,
							HasManufacturing:             hasMfg,
							HasLogisticsHub:              hasHub,
							HasEODUsage:                  hasEOD,
							HasMultiOutlets:              hasMulti,
							HideCentralStockFromBranches: hideStock,
							AllowCrossBranchStockView:    allowCrossStock,
						})
					}
				}
			}
			oRows.Close()
		}

		// Return superadmin workspaces list directly to avoid duplicate owner queries
		return workspaces, nil
	}

	// 1. Fetch Owner businesses (many-to-many business_owners)
	rows, err := db.Query(ctx, `
		SELECT bo.business_id, bo.outlet_id, b.name, b.type, 
		       COALESCE(b.has_pos, true), COALESCE(b.has_manufacturing, false), 
		       COALESCE(b.has_logistics_hub, false), COALESCE(b.has_eod_usage, false), 
		       COALESCE(b.has_multi_outlets, false), COALESCE(b.hide_central_stock_from_branches, false),
		       COALESCE(b.allow_cross_branch_stock_view, false),
		       o.name
		FROM business_owners bo
		LEFT JOIN businesses b ON bo.business_id = b.id
		LEFT JOIN outlets o ON bo.outlet_id = o.id
		WHERE bo.user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var ws Workspace
		var bName *string
		var oName *string
		var bType *models.BusinessType
		var hasPOS, hasMfg, hasHub, hasEOD, hasMulti, hideStock, allowCrossStock *bool

		err = rows.Scan(&ws.BusinessID, &ws.OutletID, &bName, &bType, &hasPOS, &hasMfg, &hasHub, &hasEOD, &hasMulti, &hideStock, &allowCrossStock, &oName)
		if err != nil {
			return nil, err
		}

		ws.Role = "owner"
		if bName != nil {
			ws.BusinessName = *bName
		}
		if oName != nil {
			ws.OutletName = *oName
		}
		if bType != nil {
			ws.BusinessType = *bType
		}
		if hasPOS != nil {
			ws.HasPOS = *hasPOS
		} else {
			ws.HasPOS = true
		}
		if hasMfg != nil {
			ws.HasManufacturing = *hasMfg
		}
		if hasHub != nil {
			ws.HasLogisticsHub = *hasHub
		}
		if hasEOD != nil {
			ws.HasEODUsage = *hasEOD
		}
		if hasMulti != nil {
			ws.HasMultiOutlets = *hasMulti
		}
		if hideStock != nil {
			ws.HideCentralStockFromBranches = *hideStock
		}
		if allowCrossStock != nil {
			ws.AllowCrossBranchStockView = *allowCrossStock
		}

		// Special case: If ownership is assigned at outlet level (e.g. Yasaka franchise)
		if ws.BusinessID == nil && ws.OutletID != nil {
			// Find the parent business of this outlet
			var pBusID uuid.UUID
			var pBusName string
			var pBusType models.BusinessType
			var pHasPOS, pHasMfg, pHasHub, pHasEOD, pHasMulti, pHideStock, pAllowCross bool
			err = db.QueryRow(ctx, `
				SELECT b.id, b.name, b.type, 
				       COALESCE(b.has_pos, true), COALESCE(b.has_manufacturing, false), 
				       COALESCE(b.has_logistics_hub, false), COALESCE(b.has_eod_usage, false),
				       COALESCE(b.has_multi_outlets, false), COALESCE(b.hide_central_stock_from_branches, false),
				       COALESCE(b.allow_cross_branch_stock_view, false)
				FROM outlets o 
				JOIN businesses b ON o.business_id = b.id 
				WHERE o.id = $1
			`, *ws.OutletID).Scan(&pBusID, &pBusName, &pBusType, &pHasPOS, &pHasMfg, &pHasHub, &pHasEOD, &pHasMulti, &pHideStock, &pAllowCross)
			if err == nil {
				ws.BusinessID = &pBusID
				ws.BusinessName = pBusName
				ws.BusinessType = pBusType
				ws.HasPOS = pHasPOS
				ws.HasManufacturing = pHasMfg
				ws.HasLogisticsHub = pHasHub
				ws.HasEODUsage = pHasEOD
				ws.HasMultiOutlets = pHasMulti
				ws.HideCentralStockFromBranches = pHideStock
				ws.AllowCrossBranchStockView = pAllowCross
			}
		}

		workspaces = append(workspaces, &ws)
	}

	// 2. Fetch Staff/Manager businesses (outlet_staff)
	sRows, err := db.Query(ctx, `
		SELECT os.outlet_id, os.role, o.name, o.is_main, b.id, b.name, b.type,
		       COALESCE(b.has_pos, true), COALESCE(b.has_manufacturing, false), 
		       COALESCE(b.has_logistics_hub, false), COALESCE(b.has_eod_usage, false),
		       COALESCE(b.has_multi_outlets, false), COALESCE(b.hide_central_stock_from_branches, false),
		       COALESCE(b.allow_cross_branch_stock_view, false)
		FROM outlet_staff os
		JOIN outlets o ON os.outlet_id = o.id
		JOIN businesses b ON o.business_id = b.id
		WHERE os.user_id = $1 AND (os.status = 'active' OR os.status IS NULL)
	`, userID)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	for sRows.Next() {
		var ws Workspace
		var role models.StaffRole
		var oID uuid.UUID
		var isMain bool
		var bID uuid.UUID
		var hasPOS, hasMfg, hasHub, hasEOD, hasMulti, hideStock, allowCrossStock bool

		err = sRows.Scan(&oID, &role, &ws.OutletName, &isMain, &bID, &ws.BusinessName, &ws.BusinessType, &hasPOS, &hasMfg, &hasHub, &hasEOD, &hasMulti, &hideStock, &allowCrossStock)
		if err != nil {
			return nil, err
		}

		ws.OutletID = &oID
		ws.IsMainOutlet = isMain
		ws.BusinessID = &bID
		ws.Role = string(role)
		ws.HasPOS = hasPOS
		ws.HasManufacturing = hasMfg
		ws.HasLogisticsHub = hasHub
		ws.HasEODUsage = hasEOD
		ws.HasMultiOutlets = hasMulti
		ws.HideCentralStockFromBranches = hideStock
		ws.AllowCrossBranchStockView = allowCrossStock
		workspaces = append(workspaces, &ws)
	}

	return workspaces, nil
}

// GenerateJWT generates token with specific active context
func GenerateJWT(userID uuid.UUID, role string, businessID, outletID *uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"role":    role,
		"exp":     time.Now().Add(config.AppConfig.JWTExpiryHours).Unix(),
	}

	if businessID != nil {
		claims["business_id"] = businessID.String()
	}
	if outletID != nil {
		claims["outlet_id"] = outletID.String()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(config.AppConfig.JWTSecret)
}
