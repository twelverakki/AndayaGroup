package database

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"andaya-erp/backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TenantDB wraps pgxpool.Pool and automatically injects tenant constraints into queries
type TenantDB struct {
	pool       *pgxpool.Pool
	BusinessID string
	OutletID   string
}

// NewTenantDB creates a TenantDB instance manually
func NewTenantDB(pool *pgxpool.Pool, businessID, outletID string) *TenantDB {
	return &TenantDB{
		pool:       pool,
		BusinessID: businessID,
		OutletID:   outletID,
	}
}

// GetTenantDB extracts tenant context from fiber Locals and returns a TenantDB instance
func GetTenantDB(c *fiber.Ctx) *TenantDB {
	businessID, _ := c.Locals("business_id").(string)
	outletID, _ := c.Locals("outlet_id").(string)
	return &TenantDB{
		pool:       config.DB,
		BusinessID: businessID,
		OutletID:   outletID,
	}
}

// Query executes a query with automatic tenant filtering
func (tdb *TenantDB) Query(ctx context.Context, baseQuery string, hasOutlet bool, args ...interface{}) (pgx.Rows, error) {
	query, finalArgs := tdb.injectTenant(baseQuery, hasOutlet, args)
	return tdb.pool.Query(ctx, query, finalArgs...)
}

// QueryRow executes a query that returns a single row with automatic tenant filtering
func (tdb *TenantDB) QueryRow(ctx context.Context, baseQuery string, hasOutlet bool, args ...interface{}) pgx.Row {
	query, finalArgs := tdb.injectTenant(baseQuery, hasOutlet, args)
	return tdb.pool.QueryRow(ctx, query, finalArgs...)
}

// Exec executes a command with automatic tenant filtering (useful for UPDATE/DELETE)
func (tdb *TenantDB) Exec(ctx context.Context, baseQuery string, hasOutlet bool, args ...interface{}) (pgconn.CommandTag, error) {
	query, finalArgs := tdb.injectTenant(baseQuery, hasOutlet, args)
	return tdb.pool.Exec(ctx, query, finalArgs...)
}

// RawPool returns the underlying connection pool when tenant isolation is bypassed (e.g. login, superadmin)
func (tdb *TenantDB) RawPool() *pgxpool.Pool {
	return tdb.pool
}

var (
	whereRegex   = regexp.MustCompile(`(?i)\bwhere\b`)
	orderByRegex = regexp.MustCompile(`(?i)\border\s+by\b`)
	groupByRegex = regexp.MustCompile(`(?i)\bgroup\s+by\b`)
	limitRegex   = regexp.MustCompile(`(?i)\blimit\b`)
)

// injectTenant parses the base SQL query and injects business_id (and optionally outlet_id) conditions
func (tdb *TenantDB) injectTenant(query string, hasOutlet bool, args []interface{}) (string, []interface{}) {
	// If it's a superadmin or if the business ID is not set, don't inject (bypass)
	if tdb.BusinessID == "" {
		return query, args
	}

	finalArgs := make([]interface{}, len(args))
	copy(finalArgs, args)

	nextPlaceholderNum := len(finalArgs) + 1
	businessPlaceholder := fmt.Sprintf("$%d", nextPlaceholderNum)
	finalArgs = append(finalArgs, tdb.BusinessID)

	var tenantCondition string
	if hasOutlet && tdb.OutletID != "" {
		nextPlaceholderNum++
		outletPlaceholder := fmt.Sprintf("$%d", nextPlaceholderNum)
		finalArgs = append(finalArgs, tdb.OutletID)
		tenantCondition = fmt.Sprintf("business_id = %s AND outlet_id = %s", businessPlaceholder, outletPlaceholder)
	} else {
		tenantCondition = fmt.Sprintf("business_id = %s", businessPlaceholder)
	}

	// Case 1: Query contains WHERE
	if whereLoc := whereRegex.FindStringIndex(query); whereLoc != nil {
		// Insert right after the WHERE keyword: WHERE (tenantCondition) AND (original_conditions)
		insertIdx := whereLoc[1] // Index right after "WHERE"
		modifiedQuery := query[:insertIdx] + " (" + tenantCondition + ") AND (" + query[insertIdx:] + ")"
		return modifiedQuery, finalArgs
	}

	// Case 2: Query does NOT contain WHERE, check for ORDER BY, GROUP BY, LIMIT
	var insertIdx = len(query)
	for _, regex := range []*regexp.Regexp{orderByRegex, groupByRegex, limitRegex} {
		if loc := regex.FindStringIndex(query); loc != nil {
			if loc[0] < insertIdx {
				insertIdx = loc[0]
			}
		}
	}

	// Insert "WHERE tenantCondition" before ORDER BY, GROUP BY, or LIMIT
	prefix := query[:insertIdx]
	suffix := query[insertIdx:]
	modifiedQuery := fmt.Sprintf("%s WHERE %s %s", strings.TrimSpace(prefix), tenantCondition, suffix)

	return modifiedQuery, finalArgs
}
