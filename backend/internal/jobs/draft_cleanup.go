package jobs

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// StartDraftCleanupScheduler runs a background worker that automatically cancels stale drafts.
// Default expiration is 14 days if not configured.
func StartDraftCleanupScheduler(db *pgxpool.Pool, expirationDays int) {
	if expirationDays <= 0 {
		expirationDays = 14
	}

	go func() {
		// Run initial check after 10 seconds of startup
		time.Sleep(10 * time.Second)
		runDraftCleanup(db, expirationDays)

		// Run periodically every 12 hours
		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			runDraftCleanup(db, expirationDays)
		}
	}()
}

func runDraftCleanup(db *pgxpool.Pool, expirationDays int) {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	query := `
		UPDATE stock_transfers
		SET status = 'cancelled',
		    notes = CASE 
		        WHEN notes IS NULL OR notes = '' THEN '[Kadaluarsa otomatis: tidak diselesaikan dalam ' || $1 || ' hari]'
		        ELSE notes || ' [Kadaluarsa otomatis: tidak diselesaikan dalam ' || $1 || ' hari]'
		    END,
		    updated_at = NOW()
		WHERE status = 'draft'
		  AND created_at < NOW() - ($1 || ' days')::INTERVAL;
	`

	cmd, err := db.Exec(ctx, query, expirationDays)
	if err != nil {
		log.Printf("[CRON DRAFT CLEANUP] Error expiring stale drafts: %v", err)
		return
	}

	if cmd.RowsAffected() > 0 {
		log.Printf("[CRON DRAFT CLEANUP] Successfully expired %d stale draft transfer(s) (> %d days old)", cmd.RowsAffected(), expirationDays)
	}
}
