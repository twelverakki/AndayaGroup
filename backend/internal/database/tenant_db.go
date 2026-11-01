package database

import (
	"context"
	"errors"

	"andaya-erp/backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrMissingTenantContext = errors.New("missing or invalid tenant business_id context")

// TenantScope represents the strongly-typed, validated multi-tenant execution context
// extracted from the authenticated user session.
type TenantScope struct {
	BusinessID uuid.UUID
	OutletID   *uuid.UUID
	UserID     uuid.UUID
	Role       string
}

// ResolveTenantScope extracts and validates the active tenant scope from Fiber context locals.
func ResolveTenantScope(c *fiber.Ctx) (*TenantScope, error) {
	businessIDStr, ok := c.Locals("business_id").(string)
	if !ok || businessIDStr == "" {
		return nil, ErrMissingTenantContext
	}

	businessID, err := uuid.Parse(businessIDStr)
	if err != nil || businessID == uuid.Nil {
		return nil, ErrMissingTenantContext
	}

	var outletID *uuid.UUID
	if outletIDStr, ok := c.Locals("outlet_id").(string); ok && outletIDStr != "" {
		if parsedOutlet, err := uuid.Parse(outletIDStr); err == nil && parsedOutlet != uuid.Nil {
			outletID = &parsedOutlet
		}
	}

	var userID uuid.UUID
	if userIDStr, ok := c.Locals("user_id").(string); ok && userIDStr != "" {
		if parsedUser, err := uuid.Parse(userIDStr); err == nil {
			userID = parsedUser
		}
	}

	role, _ := c.Locals("role").(string)

	return &TenantScope{
		BusinessID: businessID,
		OutletID:   outletID,
		UserID:     userID,
		Role:       role,
	}, nil
}

// WithTenantTx executes fn inside a database transaction with PostgreSQL session-local
// tenant variables (app.current_business_id and app.current_outlet_id) bound for RLS & audit safety.
func (s *TenantScope) WithTenantTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	if s == nil || s.BusinessID == uuid.Nil {
		return ErrMissingTenantContext
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, "SELECT set_config('app.current_business_id', $1, true)", s.BusinessID.String()); err != nil {
		return err
	}

	outletStr := ""
	if s.OutletID != nil && *s.OutletID != uuid.Nil {
		outletStr = s.OutletID.String()
	}
	if _, err := tx.Exec(ctx, "SELECT set_config('app.current_outlet_id', $1, true)", outletStr); err != nil {
		return err
	}

	if err := fn(tx); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// TenantDB provides access to the connection pool along with the raw tenant identifiers.
type TenantDB struct {
	pool       *pgxpool.Pool
	BusinessID string
	OutletID   string
}

func NewTenantDB(pool *pgxpool.Pool, businessID, outletID string) *TenantDB {
	return &TenantDB{
		pool:       pool,
		BusinessID: businessID,
		OutletID:   outletID,
	}
}

func GetTenantDB(c *fiber.Ctx) *TenantDB {
	businessID, _ := c.Locals("business_id").(string)
	outletID, _ := c.Locals("outlet_id").(string)
	return &TenantDB{
		pool:       config.DB,
		BusinessID: businessID,
		OutletID:   outletID,
	}
}

func (tdb *TenantDB) RawPool() *pgxpool.Pool {
	return tdb.pool
}
