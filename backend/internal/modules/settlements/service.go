package settlements

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"andaya-erp/backend/internal/models"
)

type SettlementItemInput struct {
	ItemID       uuid.UUID `json:"item_id"`
	OpeningLoose float64   `json:"opening_loose"`
	ThawedLoose  float64   `json:"thawed_loose"`
	ActualLoose  float64   `json:"actual_loose"`
	ActualSealed float64   `json:"actual_sealed"`
	DiscardLoose float64   `json:"discard_loose"`
}

type CreateSettlementRequest struct {
	OutletID      *uuid.UUID            `json:"outlet_id,omitempty"`
	CashCollected int64                 `json:"cash_collected"`
	QRISCollected int64                 `json:"qris_collected"`
	Notes         *string               `json:"notes,omitempty"`
	ClientUUID    uuid.UUID             `json:"client_uuid"`
	Items         []SettlementItemInput `json:"items"`
}

type DirectSaleRequest struct {
	ItemID        uuid.UUID  `json:"item_id"`
	OutletID      *uuid.UUID `json:"outlet_id,omitempty"`
	QtyPack       float64    `json:"qty_pack"`
	UnitPrice     int64      `json:"unit_price"`
	PaymentMethod string     `json:"payment_method"` // cash, qris, transfer
}

type SettlementsService struct {
	DB *pgxpool.Pool
}

func NewSettlementsService(db *pgxpool.Pool) *SettlementsService {
	return &SettlementsService{DB: db}
}

func (s *SettlementsService) CreateSettlement(ctx context.Context, businessID uuid.UUID, staffID uuid.UUID, req CreateSettlementRequest) (*models.HeaderDailySettlement, error) {
	if req.ClientUUID == uuid.Nil {
		return nil, errors.New("client_uuid idempotency token is required")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Idempotency check
	var existingID uuid.UUID
	err = tx.QueryRow(ctx, `SELECT id FROM daily_settlements WHERE client_uuid = $1`, req.ClientUUID).Scan(&existingID)
	if err == nil {
		return nil, errors.New("duplicate settlement submission detected (idempotency key constraint)")
	}

	targetOutletID := uuid.Nil
	if req.OutletID != nil && *req.OutletID != uuid.Nil {
		targetOutletID = *req.OutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return nil, errors.New("no default outlet found")
		}
	}

	var totalTargetRevenue int64 = 0
	detailRows := make([]models.DailySettlementItemDetail, 0, len(req.Items))

	for _, itemInput := range req.Items {
		if itemInput.ItemID == uuid.Nil {
			continue
		}

		var unitSellPrice int64 = 0
		err = tx.QueryRow(ctx, `SELECT sell_price FROM items WHERE id = $1 AND business_id = $2`, itemInput.ItemID, businessID).Scan(&unitSellPrice)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("item %s not found", itemInput.ItemID)
			}
			return nil, err
		}

		qtySold := (itemInput.OpeningLoose + itemInput.ThawedLoose) - itemInput.ActualLoose - itemInput.DiscardLoose
		if qtySold < 0 {
			qtySold = 0
		}

		subtotalTarget := int64(math.Round(qtySold * float64(unitSellPrice)))
		totalTargetRevenue += subtotalTarget

		detailRows = append(detailRows, models.DailySettlementItemDetail{
			ItemID:                 itemInput.ItemID,
			OpeningLoose:           itemInput.OpeningLoose,
			ThawedLoose:            itemInput.ThawedLoose,
			ActualLoose:            itemInput.ActualLoose,
			ActualSealed:           itemInput.ActualSealed,
			DiscardLoose:           itemInput.DiscardLoose,
			QtySold:                qtySold,
			UnitSellPrice:          unitSellPrice,
			SubtotalTargetRevenue: subtotalTarget,
		})

		// Record QC Discard in wastage_logs if discard > 0
		if itemInput.DiscardLoose > 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO wastage_logs (id, business_id, outlet_id, product_id, expected_qty, actual_qty, discrepancy, input_by, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 'approved', NOW(), NOW())
			`, uuid.New(), businessID, targetOutletID, itemInput.ItemID, itemInput.DiscardLoose, -itemInput.DiscardLoose, staffID)
			if err != nil {
				return nil, fmt.Errorf("failed to log wastage discard: %w", err)
			}
		}
	}

	totalCollected := req.CashCollected + req.QRISCollected
	totalVariance := totalCollected - totalTargetRevenue

	settlementID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO daily_settlements (id, business_id, outlet_id, staff_id, settlement_date, cash_collected, qris_collected, total_collected, total_target_revenue, total_variance, notes, client_uuid, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10, $11, NOW())
	`, settlementID, businessID, targetOutletID, staffID, req.CashCollected, req.QRISCollected, totalCollected, totalTargetRevenue, totalVariance, req.Notes, req.ClientUUID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert daily_settlements header: %w", err)
	}

	for i := range detailRows {
		detailRows[i].ID = uuid.New()
		detailRows[i].SettlementID = settlementID
		_, err = tx.Exec(ctx, `
			INSERT INTO daily_settlement_items (id, settlement_id, item_id, opening_loose, thawed_loose, actual_loose, actual_sealed, discard_loose, qty_sold, unit_sell_price, subtotal_target_revenue)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, detailRows[i].ID, settlementID, detailRows[i].ItemID, detailRows[i].OpeningLoose, detailRows[i].ThawedLoose, detailRows[i].ActualLoose, detailRows[i].ActualSealed, detailRows[i].DiscardLoose, detailRows[i].QtySold, detailRows[i].UnitSellPrice, detailRows[i].SubtotalTargetRevenue)
		if err != nil {
			return nil, fmt.Errorf("failed to insert daily_settlement_items detail: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit settlement transaction: %w", err)
	}

	return &models.HeaderDailySettlement{
		ID:                 settlementID,
		BusinessID:         businessID,
		OutletID:           targetOutletID,
		StaffID:            staffID,
		CashCollected:      req.CashCollected,
		QRISCollected:      req.QRISCollected,
		TotalCollected:     totalCollected,
		TotalTargetRevenue: totalTargetRevenue,
		TotalVariance:      totalVariance,
		Notes:              req.Notes,
		ClientUUID:         req.ClientUUID,
		Items:              detailRows,
	}, nil
}

func (s *SettlementsService) CreateDirectSale(ctx context.Context, businessID uuid.UUID, staffID uuid.UUID, req DirectSaleRequest) (*models.DirectSale, error) {
	if req.ItemID == uuid.Nil {
		return nil, errors.New("item_id is required")
	}
	if req.QtyPack <= 0 {
		return nil, errors.New("qty_pack must be greater than 0")
	}
	if req.UnitPrice <= 0 {
		return nil, errors.New("unit_price must be greater than 0")
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
			return nil, errors.New("no default outlet found")
		}
	}

	totalAmount := int64(math.Round(req.QtyPack * float64(req.UnitPrice)))
	saleID := uuid.New()

	paymentMethod := models.PaymentMethod(req.PaymentMethod)
	if paymentMethod != models.PayCash && paymentMethod != models.PayQRIS {
		paymentMethod = models.PayOther
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, business_id, outlet_id, staff_id, type, total_amount, payment_method, status, client_uuid, synced_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'sale', $5, $6, 'completed', gen_random_uuid(), NOW(), NOW(), NOW())
	`, saleID, businessID, targetOutletID, staffID, totalAmount, paymentMethod)
	if err != nil {
		return nil, fmt.Errorf("failed to insert transaction header: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transaction_items (id, transaction_id, product_id, qty, unit_price, subtotal, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, uuid.New(), saleID, req.ItemID, req.QtyPack, req.UnitPrice, totalAmount)
	if err != nil {
		return nil, fmt.Errorf("failed to insert transaction item: %w", err)
	}

	// Deduct stock from central warehouse
	_, err = tx.Exec(ctx, `
		UPDATE item_stocks SET qty_sealed = qty_sealed - $1, updated_at = NOW()
		WHERE item_id = $2 AND outlet_id = $3 AND held_by_user_id IS NULL
	`, req.QtyPack, req.ItemID, targetOutletID)
	if err != nil {
		return nil, fmt.Errorf("failed to deduct central warehouse stock: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (id, item_id, outlet_id, movement_type, qty_sealed_change, unit_cost, reference_id, created_by, created_at)
		VALUES ($1, $2, $3, 'direct_sale_outbound', $4, $5, $6, $7, NOW())
	`, uuid.New(), req.ItemID, targetOutletID, -req.QtyPack, req.UnitPrice, saleID, staffID)
	if err != nil {
		return nil, fmt.Errorf("failed to record direct sale stock movement: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit direct sale transaction: %w", err)
	}

	return &models.DirectSale{
		ID:            saleID,
		BusinessID:    businessID,
		ProductID:     req.ItemID,
		QtyPack:       req.QtyPack,
		UnitPrice:     req.UnitPrice,
		TotalAmount:   totalAmount,
		PaymentMethod: req.PaymentMethod,
		SoldBy:        staffID,
	}, nil
}

func (s *SettlementsService) GetSettlements(ctx context.Context, businessID uuid.UUID) ([]models.HeaderDailySettlement, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT id, business_id, outlet_id, staff_id, settlement_date, cash_collected, qris_collected, total_collected, total_target_revenue, total_variance, notes, client_uuid, created_at
		FROM daily_settlements
		WHERE business_id = $1
		ORDER BY created_at DESC LIMIT 50
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.HeaderDailySettlement, 0)
	for rows.Next() {
		var h models.HeaderDailySettlement
		err := rows.Scan(&h.ID, &h.BusinessID, &h.OutletID, &h.StaffID, &h.SettlementDate, &h.CashCollected, &h.QRISCollected, &h.TotalCollected, &h.TotalTargetRevenue, &h.TotalVariance, &h.Notes, &h.ClientUUID, &h.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, h)
	}
	return list, nil
}
