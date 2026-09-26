package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/andaya_group?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Failed to parse DB URL: %v", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}

	fmt.Println(" Connected to PostgreSQL database:", poolConfig.ConnConfig.Database)

	// 1. Run Master Schema
	schemaPath := filepath.Join("database", "schema.sql")
	schemaSQL, err := os.ReadFile(schemaPath)
	if err != nil {
		// try relative path
		schemaPath = filepath.Join("..", "database", "schema.sql")
		schemaSQL, err = os.ReadFile(schemaPath)
		if err != nil {
			log.Fatalf("Failed to read schema.sql: %v", err)
		}
	}

	fmt.Printf("Applying Master Schema (%s)...\n", schemaPath)
	_, err = pool.Exec(ctx, string(schemaSQL))
	if err != nil {
		log.Fatalf("Schema execution failed: %v", err)
	}
	fmt.Println(" Master Schema applied successfully!")

	// 2. Run Master Seed
	seedPath := filepath.Join("database", "seed.sql")
	seedSQL, err := os.ReadFile(seedPath)
	if err != nil {
		seedPath = filepath.Join("..", "database", "seed.sql")
		seedSQL, err = os.ReadFile(seedPath)
		if err != nil {
			log.Fatalf("Failed to read seed.sql: %v", err)
		}
	}

	fmt.Printf("Executing Master Seeder (%s)...\n", seedPath)
	statements := strings.Split(string(seedSQL), ";")
	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		_, err = pool.Exec(ctx, stmt)
		if err != nil {
			log.Fatalf("Statement #%d failed:\n%s\n\nERROR: %v", i+1, stmt, err)
		}
	}
	fmt.Println(" Master Seeder executed successfully!")

	// 3. Count Rows per Table
	tables := []string{
		"users", "businesses", "outlets", "business_owners", "outlet_staff",
		"manager_pins", "categories", "items", "products", "item_stocks",
		"stock_movements", "shifts", "transactions", "transaction_items",
		"boms", "bom_items", "productions", "production_expenses",
		"stock_transfers", "stock_transfer_items",
		"eod_material_usages", "daily_settlements",
		"daily_settlement_items", "opname_sessions", "opname_items",
		"procurements", "procurement_items", "wastage_logs", "audit_logs",
		"stock_batches", "ingredients", "promotions", "promotion_targets",
	}

	fmt.Println("\n=== LIVE DATABASE TABLE AUDIT ===")
	for _, t := range tables {
		var count int
		err := pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", t)).Scan(&count)
		if err != nil {
			fmt.Printf("  - %-25s: Error (%v)\n", t, err)
		} else {
			fmt.Printf("  - %-25s: %d rows\n", t, count)
		}
	}
	fmt.Println("=================================")
}
