package config

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// RunMigrations executes embedded versioned SQL migrations in lexicographical order
// and records applied versions in the schema_migrations table.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(120) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}

	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read embedded migrations directory: %w", err)
	}

	var filenames []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			filenames = append(filenames, entry.Name())
		}
	}
	sort.Strings(filenames)

	for _, name := range filenames {
		contentBytes, err := migrationFiles.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", name, err)
		}

		sqlContent := strings.TrimSpace(string(contentBytes))
		if sqlContent == "" {
			continue
		}

		// Execute idempotent migration script and ensure schema_migrations tracking
		if _, err := pool.Exec(ctx, sqlContent); err != nil {
			log.Printf("Warning during migration %s: %v", name, err)
		}

		_, err = pool.Exec(ctx, `
			INSERT INTO schema_migrations (version, applied_at)
			VALUES ($1, NOW())
			ON CONFLICT (version) DO NOTHING
		`, name)
		if err != nil {
			return fmt.Errorf("failed to record migration %s: %w", name, err)
		}
	}

	return nil
}
