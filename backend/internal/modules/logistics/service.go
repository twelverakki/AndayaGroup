package logistics

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"andaya-erp/backend/internal/models"
)

type DistributionRequest struct {
	ItemID       uuid.UUID  `json:"item_id"`
	OutletID     *uuid.UUID `json:"outlet_id,omitempty"`
	SentToUserID uuid.UUID  `json:"sent_to_user_id"`
	Qty          float64    `json:"qty"`
	Type         string     `json:"type"` // outbound, return
}

type ThawRequest struct {
	ItemID   uuid.UUID  `json:"item_id"`
	OutletID *uuid.UUID `json:"outlet_id,omitempty"`
	QtyPacks float64    `json:"qty_packs"`
}

type LogisticsService struct {
	DB *pgxpool.Pool
}

func NewLogisticsService(db *pgxpool.Pool) *LogisticsService {
	return &LogisticsService{DB: db}
}

func (s *LogisticsService) CreateDistribution(ctx context.Context, businessID uuid.UUID, senderID uuid.UUID, req DistributionRequest) (*models.Distribution, error) {
	if req.ItemID == uuid.Nil {
		return nil, errors.New("item_id is required")
	}
	if req.SentToUserID == uuid.Nil {
		return nil, errors.New("sent_to_user_id is required")
	}
	if req.Qty <= 0 {
		return nil, errors.New("qty must be greater than 0")
	}

	distType := "outbound"
	if req.Type == "return" {
		distType = "return"
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	targetOutletID := uuid.Nil
	if req.OutletID != nil && *req.OutletID != uuid.Nil {
		targetOutletID = *req.OutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return nil, errors.New("no default outlet found for business")
		}
	}

	distID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO distributions (id, business_id, product_id, sent_to_user_id, qty, status, type, sent_at, created_at)
		VALUES ($1, $2, $3, $4, $5, 'sent', $6, NOW(), NOW())
	`, distID, businessID, req.ItemID, req.SentToUserID, req.Qty, distType)
	if err != nil {
		return nil, fmt.Errorf("failed to create distribution record: %w", err)
	}

	// Deduct sender central outlet stock
	_, err = tx.Exec(ctx, `
		UPDATE item_stocks SET qty_sealed = qty_sealed - $1, updated_at = NOW()
		WHERE item_id = $2 AND outlet_id = $3 AND held_by_user_id IS NULL
	`, req.Qty, req.ItemID, targetOutletID)
	if err != nil {
		return nil, fmt.Errorf("failed to deduct central warehouse stock: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (id, item_id, outlet_id, movement_type, qty_sealed_change, reference_id, created_by, created_at)
		VALUES ($1, $2, $3, 'distribution_outbound', $4, $5, $6, NOW())
	`, uuid.New(), req.ItemID, targetOutletID, -req.Qty, distID, senderID)
	if err != nil {
		return nil, fmt.Errorf("failed to record distribution movement: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &models.Distribution{
		ID:           distID,
		BusinessID:   businessID,
		ProductID:    req.ItemID,
		SentToUserID: req.SentToUserID,
		Qty:          req.Qty,
		Status:       "sent",
		Type:         models.DistributionType(distType),
	}, nil
}

func (s *LogisticsService) ReceiveDistribution(ctx context.Context, businessID uuid.UUID, recipientID uuid.UUID, distID uuid.UUID) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var itemID uuid.UUID
	var qty float64
	var status string
	var sentToUserID uuid.UUID

	err = tx.QueryRow(ctx, `
		SELECT product_id, qty, status, sent_to_user_id
		FROM distributions WHERE id = $1 AND business_id = $2
	`, distID, businessID).Scan(&itemID, &qty, &status, &sentToUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("distribution record not found")
		}
		return err
	}

	if status == "received" {
		return errors.New("distribution has already been received")
	}

	if sentToUserID != recipientID {
		return errors.New("only the designated recipient staff can perform handshake confirmation")
	}

	var outletID uuid.UUID
	err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&outletID)
	if err != nil {
		return errors.New("no default outlet found")
	}

	// Update distribution status
	_, err = tx.Exec(ctx, `
		UPDATE distributions SET status = 'received', received_at = NOW() WHERE id = $1
	`, distID)
	if err != nil {
		return fmt.Errorf("failed to update distribution status: %w", err)
	}

	// Add stock to recipient user's item_stocks (held_by_user_id)
	_, err = tx.Exec(ctx, `
		INSERT INTO item_stocks (item_id, outlet_id, held_by_user_id, qty_sealed, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (item_id, outlet_id, held_by_user_id) WHERE held_by_user_id IS NOT NULL
		DO UPDATE SET qty_sealed = item_stocks.qty_sealed + $4, updated_at = NOW()
	`, itemID, outletID, recipientID, qty)
	if err != nil {
		return fmt.Errorf("failed to update recipient staff stock: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (id, item_id, outlet_id, movement_type, qty_sealed_change, reference_id, created_by, created_at)
		VALUES ($1, $2, $3, 'distribution_received', $4, $5, $6, NOW())
	`, uuid.New(), itemID, outletID, qty, distID, recipientID)
	if err != nil {
		return fmt.Errorf("failed to record receive movement: %w", err)
	}

	return tx.Commit(ctx)
}

func (s *LogisticsService) ThawItem(ctx context.Context, businessID uuid.UUID, userID uuid.UUID, req ThawRequest) error {
	if req.ItemID == uuid.Nil {
		return errors.New("item_id is required")
	}
	if req.QtyPacks <= 0 {
		return errors.New("qty_packs must be greater than 0")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var conversionRate float64 = 20.0
	err = tx.QueryRow(ctx, `SELECT conversion_rate FROM items WHERE id = $1 AND business_id = $2`, req.ItemID, businessID).Scan(&conversionRate)
	if err != nil || conversionRate <= 0 {
		conversionRate = 20.0
	}

	targetOutletID := uuid.Nil
	if req.OutletID != nil && *req.OutletID != uuid.Nil {
		targetOutletID = *req.OutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return errors.New("no default outlet found")
		}
	}

	looseQtyAdded := req.QtyPacks * conversionRate

	// Deduct 1 sealed pack and add loose pcs to recipient's personal item_stock
	res, err := tx.Exec(ctx, `
		UPDATE item_stocks
		SET qty_sealed = qty_sealed - $1, qty_loose = qty_loose + $2, updated_at = NOW()
		WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id = $5 AND qty_sealed >= $1
	`, req.QtyPacks, looseQtyAdded, req.ItemID, targetOutletID, userID)
	if err != nil {
		return fmt.Errorf("failed to execute thaw mutation: %w", err)
	}

	if res.RowsAffected() == 0 {
		return errors.New("insufficient sealed packs available for thawing")
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (id, item_id, outlet_id, movement_type, qty_sealed_change, qty_loose_change, created_by, created_at)
		VALUES ($1, $2, $3, 'thaw_out', $4, $5, $6, NOW())
	`, uuid.New(), req.ItemID, targetOutletID, -req.QtyPacks, looseQtyAdded, userID)
	if err != nil {
		return fmt.Errorf("failed to record thaw movement: %w", err)
	}

	return tx.Commit(ctx)
}

func (s *LogisticsService) GetDistributions(ctx context.Context, businessID uuid.UUID) ([]models.Distribution, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT d.id, d.business_id, d.product_id, d.sent_to_user_id, d.qty, d.status, d.type, d.sent_at, d.received_at, d.created_at
		FROM distributions d
		WHERE d.business_id = $1
		ORDER BY d.created_at DESC LIMIT 50
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Distribution, 0)
	for rows.Next() {
		var dist models.Distribution
		err := rows.Scan(&dist.ID, &dist.BusinessID, &dist.ProductID, &dist.SentToUserID, &dist.Qty, &dist.Status, &dist.Type, &dist.SentAt, &dist.ReceivedAt, &dist.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, dist)
	}
	return list, nil
}
