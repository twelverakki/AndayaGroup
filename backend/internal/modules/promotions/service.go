package promotions

import (
	"context"
	"errors"
	"fmt"
	"time"

	"andaya-erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PromotionsService struct {
	db *pgxpool.Pool
}

func NewPromotionsService(db *pgxpool.Pool) *PromotionsService {
	return &PromotionsService{db: db}
}

// GetPromotions retrieves promotions for a business with optional active filter and tenant scoping
func (s *PromotionsService) GetPromotions(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, activeOnly bool) ([]models.Promotion, error) {
	query := `
		SELECT p.id, p.business_id, p.outlet_id, o.name as outlet_name, p.name, p.code, p.promo_type,
		       p.start_date, p.end_date, p.active_days, 
		       COALESCE(to_char(p.active_time_start, 'HH24:MI:SS'), ''),
		       COALESCE(to_char(p.active_time_end, 'HH24:MI:SS'), ''),
		       p.min_order_amount, p.min_qty, p.usage_limit, p.usage_count,
		       p.reward_type, p.reward_value, p.max_discount_cap, p.target_scope,
		       p.is_active, p.created_by, p.created_at, p.updated_at
		FROM promotions p
		LEFT JOIN outlets o ON p.outlet_id = o.id
		WHERE p.business_id = $1
	`
	args := []interface{}{businessID}

	if activeOnly {
		query += ` AND p.is_active = TRUE AND (p.end_date IS NULL OR p.end_date >= NOW())`
	}

	if outletID != nil && *outletID != uuid.Nil {
		args = append(args, *outletID)
		query += fmt.Sprintf(` AND (p.outlet_id IS NULL OR p.outlet_id = $%d)`, len(args))
	}

	query += ` ORDER BY p.created_at DESC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	promos := []models.Promotion{}
	for rows.Next() {
		var p models.Promotion
		var activeTimeStart, activeTimeEnd string
		err := rows.Scan(
			&p.ID, &p.BusinessID, &p.OutletID, &p.OutletName, &p.Name, &p.Code, &p.PromoType,
			&p.StartDate, &p.EndDate, &p.ActiveDays,
			&activeTimeStart, &activeTimeEnd,
			&p.MinOrderAmount, &p.MinQty, &p.UsageLimit, &p.UsageCount,
			&p.RewardType, &p.RewardValue, &p.MaxDiscountCap, &p.TargetScope,
			&p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if activeTimeStart != "" {
			p.ActiveTimeStart = &activeTimeStart
		}
		if activeTimeEnd != "" {
			p.ActiveTimeEnd = &activeTimeEnd
		}

		promos = append(promos, p)
	}

	// Batch load targets for all specific promos in a single roundtrip (O(1) query)
	var specificPromoIDs []uuid.UUID
	promoMap := make(map[uuid.UUID]*models.Promotion)
	for i := range promos {
		p := &promos[i]
		if p.TargetScope == "specific_items" || p.TargetScope == "specific_categories" {
			specificPromoIDs = append(specificPromoIDs, p.ID)
			promoMap[p.ID] = p
		}
	}

	if len(specificPromoIDs) > 0 {
		targetRows, err := s.db.Query(ctx, `
			SELECT pt.promotion_id, pt.target_id, COALESCE(i.name, c.name, ''), COALESCE(i.sku, '')
			FROM promotion_targets pt
			LEFT JOIN items i ON pt.target_type = 'item' AND pt.target_id = i.id
			LEFT JOIN categories c ON pt.target_type = 'category' AND pt.target_id = c.id
			WHERE pt.promotion_id = ANY($1)
		`, specificPromoIDs)
		if err == nil {
			defer targetRows.Close()
			for targetRows.Next() {
				var promoID, tID uuid.UUID
				var tName, tSKU string
				if err := targetRows.Scan(&promoID, &tID, &tName, &tSKU); err == nil {
					if targetPromo, exists := promoMap[promoID]; exists {
						targetPromo.TargetIDs = append(targetPromo.TargetIDs, tID)
						targetPromo.TargetItems = append(targetPromo.TargetItems, models.TargetItemInfo{
							ID:   tID,
							Name: tName,
							SKU:  tSKU,
						})
					}
				}
			}
		}
	}

	return promos, nil
}

// CreatePromotion inserts a new rule-based promotion with targets
func (s *PromotionsService) CreatePromotion(ctx context.Context, businessID uuid.UUID, userID uuid.UUID, req models.CreatePromotionRequest) (*models.Promotion, error) {
	if req.Name == "" {
		return nil, errors.New("promotion name is required")
	}

	if len(req.ActiveDays) == 0 {
		req.ActiveDays = []int{0, 1, 2, 3, 4, 5, 6}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	promoID := uuid.New()
	p := &models.Promotion{
		ID:              promoID,
		BusinessID:      businessID,
		OutletID:        req.OutletID,
		Name:            req.Name,
		Code:            req.Code,
		PromoType:       req.PromoType,
		StartDate:       req.StartDate,
		EndDate:         req.EndDate,
		ActiveDays:      req.ActiveDays,
		ActiveTimeStart: req.ActiveTimeStart,
		ActiveTimeEnd:   req.ActiveTimeEnd,
		MinOrderAmount:  req.MinOrderAmount,
		MinQty:          req.MinQty,
		UsageLimit:      req.UsageLimit,
		UsageCount:      0,
		RewardType:      req.RewardType,
		RewardValue:     req.RewardValue,
		MaxDiscountCap:  req.MaxDiscountCap,
		TargetScope:     req.TargetScope,
		IsActive:        req.IsActive,
		CreatedBy:       &userID,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		TargetIDs:       req.TargetIDs,
	}

	if p.StartDate.IsZero() {
		p.StartDate = time.Now()
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO promotions (
			id, business_id, outlet_id, name, code, promo_type,
			start_date, end_date, active_days, active_time_start, active_time_end,
			min_order_amount, min_qty, usage_limit, usage_count,
			reward_type, reward_value, max_discount_cap, target_scope,
			is_active, created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15,
			$16, $17, $18, $19,
			$20, $21, $22, $23
		)
	`, p.ID, p.BusinessID, p.OutletID, p.Name, p.Code, p.PromoType,
		p.StartDate, p.EndDate, p.ActiveDays, p.ActiveTimeStart, p.ActiveTimeEnd,
		p.MinOrderAmount, p.MinQty, p.UsageLimit, p.UsageCount,
		p.RewardType, p.RewardValue, p.MaxDiscountCap, p.TargetScope,
		p.IsActive, p.CreatedBy, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Insert targets
	if len(req.TargetIDs) > 0 {
		targetType := "item"
		if req.TargetScope == "specific_categories" {
			targetType = "category"
		}
		for _, targetID := range req.TargetIDs {
			_, err = tx.Exec(ctx, `
				INSERT INTO promotion_targets (id, promotion_id, target_type, target_id)
				VALUES ($1, $2, $3, $4)
			`, uuid.New(), promoID, targetType, targetID)
			if err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return p, nil
}

// UpdatePromotion updates an existing promotion
func (s *PromotionsService) UpdatePromotion(ctx context.Context, businessID uuid.UUID, promoID uuid.UUID, req models.UpdatePromotionRequest) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var exists bool
	err = tx.QueryRow(ctx, "SELECT TRUE FROM promotions WHERE id = $1 AND business_id = $2", promoID, businessID).Scan(&exists)
	if err != nil || !exists {
		return errors.New("promotion not found")
	}

	query := `
		UPDATE promotions SET
			name = COALESCE($1, name),
			code = $2,
			outlet_id = $3,
			promo_type = COALESCE($4, promo_type),
			start_date = COALESCE($5, start_date),
			end_date = $6,
			active_days = COALESCE($7, active_days),
			active_time_start = $8,
			active_time_end = $9,
			min_order_amount = COALESCE($10, min_order_amount),
			min_qty = COALESCE($11, min_qty),
			usage_limit = $12,
			reward_type = COALESCE($13, reward_type),
			reward_value = COALESCE($14, reward_value),
			max_discount_cap = $15,
			target_scope = COALESCE($16, target_scope),
			is_active = COALESCE($17, is_active),
			updated_at = NOW()
		WHERE id = $18 AND business_id = $19
	`
	_, err = tx.Exec(ctx, query,
		req.Name, req.Code, req.OutletID, req.PromoType,
		req.StartDate, req.EndDate, req.ActiveDays,
		req.ActiveTimeStart, req.ActiveTimeEnd,
		req.MinOrderAmount, req.MinQty, req.UsageLimit,
		req.RewardType, req.RewardValue, req.MaxDiscountCap,
		req.TargetScope, req.IsActive, promoID, businessID,
	)
	if err != nil {
		return err
	}

	if req.TargetIDs != nil {
		_, _ = tx.Exec(ctx, "DELETE FROM promotion_targets WHERE promotion_id = $1", promoID)
		targetType := "item"
		if req.TargetScope != nil && *req.TargetScope == "specific_categories" {
			targetType = "category"
		}
		for _, targetID := range req.TargetIDs {
			_, err = tx.Exec(ctx, `
				INSERT INTO promotion_targets (id, promotion_id, target_type, target_id)
				VALUES ($1, $2, $3, $4)
			`, uuid.New(), promoID, targetType, targetID)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

// DeletePromotion soft deletes or deactivates a promotion
func (s *PromotionsService) DeletePromotion(ctx context.Context, businessID uuid.UUID, promoID uuid.UUID) error {
	_, err := s.db.Exec(ctx, "UPDATE promotions SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND business_id = $2", promoID, businessID)
	return err
}
