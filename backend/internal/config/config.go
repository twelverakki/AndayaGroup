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

	// Automatically convert unit_type columns to VARCHAR(50) so custom unit types (botol, cup, porsi, ikat, etc.) are accepted
	_, _ = DB.Exec(context.Background(), "ALTER TABLE products ALTER COLUMN unit_type TYPE VARCHAR(50)")
	_, _ = DB.Exec(context.Background(), "ALTER TABLE ingredients ALTER COLUMN unit_type TYPE VARCHAR(50)")
}

// Helper to read env variable or fallback
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
