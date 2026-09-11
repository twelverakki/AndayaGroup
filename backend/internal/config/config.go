package config

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	Env            string
	DatabaseURL    string
	JWTSecret      []byte
	JWTExpiryHours time.Duration
}

var AppConfig *Config
var DB *pgxpool.Pool

// LoadConfig loads environment variables from .env file
func LoadConfig() {
	// Ignore error if .env file is missing, environment variables might already be set
	_ = godotenv.Load()

	port := getEnv("PORT", "8080")
	env := getEnv("ENV", "development")
	dbURL := getEnv("DATABASE_URL", "")
	jwtSecret := getEnv("JWT_SECRET", "default-fallback-secret-key-very-weak")
	expiryHoursStr := getEnv("JWT_EXPIRY_HOURS", "24")

	expiryHours, err := strconv.Atoi(expiryHoursStr)
	if err != nil {
		expiryHours = 24
	}

	AppConfig = &Config{
		Port:           port,
		Env:            env,
		DatabaseURL:    dbURL,
		JWTSecret:      []byte(jwtSecret),
		JWTExpiryHours: time.Duration(expiryHours) * time.Hour,
	}

	if AppConfig.DatabaseURL == "" {
		log.Println("WARNING: DATABASE_URL environment variable is empty!")
	}
}

// ConnectDB establishes a connection pool to PostgreSQL using pgx
func ConnectDB() {
	if AppConfig.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is not configured")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(AppConfig.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to parse DATABASE_URL: %v", err)
	}

	// Connection Pool Optimization settings
	poolConfig.MaxConns = 20
	poolConfig.MinConns = 2
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.MaxConnLifetime = 1 * time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}

	// Ping connection to verify it works
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}

	log.Println("Successfully connected to PostgreSQL database pool!")
	DB = pool

	// Automatically run migration to add 'discontinued' value to 'user_status' enum
	_, err = DB.Exec(context.Background(), "ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'discontinued'")
	if err != nil {
		log.Printf("Warning: Failed to auto-migrate user_status enum: %v", err)
	}

	// Automatically migrate ingredients table schema (category, sub_category, min_stock_alert, unit_cost)
	if _, err := DB.Exec(context.Background(), "ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'raw_material'"); err != nil {
		log.Printf("Auto-migrate ingredients.category error: %v", err)
	}
	if _, err := DB.Exec(context.Background(), "ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100) DEFAULT 'General'"); err != nil {
		log.Printf("Auto-migrate ingredients.sub_category error: %v", err)
	}
	if _, err := DB.Exec(context.Background(), "ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock_alert NUMERIC(12,2) DEFAULT 5.00"); err != nil {
		log.Printf("Auto-migrate ingredients.min_stock_alert error: %v", err)
	}
	if _, err := DB.Exec(context.Background(), "ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS unit_cost BIGINT DEFAULT 0"); err != nil {
		log.Printf("Auto-migrate ingredients.unit_cost error: %v", err)
	}
	if _, err := DB.Exec(context.Background(), "ALTER TABLE ingredients ALTER COLUMN unit_type TYPE VARCHAR(50) USING unit_type::text"); err != nil {
		log.Printf("Auto-migrate ingredients.unit_type error: %v", err)
	}
	if _, err := DB.Exec(context.Background(), "ALTER TABLE businesses ALTER COLUMN type TYPE VARCHAR(50) USING type::text"); err != nil {
		log.Printf("Auto-migrate businesses.type error: %v", err)
	}
	if _, err := DB.Exec(context.Background(), "ALTER TABLE ingredients ALTER COLUMN category TYPE VARCHAR(50) USING category::text"); err != nil {
		log.Printf("Auto-migrate ingredients.category type error: %v", err)
	}

	// Automatically migrate opname tables schema
	_, _ = DB.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS opname_sessions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
			session_name VARCHAR(120) NOT NULL,
			target_category VARCHAR(50) DEFAULT 'all',
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			notes TEXT,
			created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			audited_by UUID REFERENCES users(id) ON DELETE SET NULL,
			approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			completed_at TIMESTAMP WITH TIME ZONE
		);
		CREATE TABLE IF NOT EXISTS opname_items (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			opname_session_id UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
			product_id UUID REFERENCES products(id) ON DELETE CASCADE,
			ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
			expected_qty NUMERIC NOT NULL DEFAULT 0,
			actual_qty NUMERIC NOT NULL DEFAULT 0,
			unit_cost BIGINT DEFAULT 0,
			notes TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		-- Phase 1 (The Lean Odoo Way) Schema Migration
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_pos BOOLEAN NOT NULL DEFAULT TRUE;
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_manufacturing BOOLEAN NOT NULL DEFAULT FALSE;
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_logistics_hub BOOLEAN NOT NULL DEFAULT FALSE;
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_eod_usage BOOLEAN NOT NULL DEFAULT FALSE;
		-- Extended Business & Outlet Profile Fields
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email VARCHAR(100);
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
		ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00;

		ALTER TABLE outlets ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
		ALTER TABLE outlets ADD COLUMN IF NOT EXISTS receipt_footer TEXT;


		ALTER TABLE items ADD COLUMN IF NOT EXISTS requires_thaw BOOLEAN NOT NULL DEFAULT FALSE;
		ALTER TABLE transactions ADD COLUMN IF NOT EXISTS channel VARCHAR(30) NOT NULL DEFAULT 'pos_retail';
		ALTER TABLE distributions ADD COLUMN IF NOT EXISTS shrinkage_tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00;
		ALTER TABLE distributions ADD COLUMN IF NOT EXISTS shrinkage_qty NUMERIC(14,4) NOT NULL DEFAULT 0.0000;

		CREATE TABLE IF NOT EXISTS eod_material_usages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
			outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
			settlement_id UUID REFERENCES daily_settlements(id) ON DELETE SET NULL,
			item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
			initial_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
			restock_in NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
			final_opname_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
			consumed_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
			unit_cost BIGINT NOT NULL DEFAULT 0,
			total_cost BIGINT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)
}

// Helper to read env variable or fallback
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
