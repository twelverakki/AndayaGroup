package production

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"andaya-erp/backend/internal/models"
)

type ProductionExpenseInput struct {
	ItemID uuid.UUID `json:"item_id"`
	Qty    float64   `json:"qty"`
}

type ProductionRequest struct {
	ItemID      uuid.UUID                `json:"item_id"`
	OutletID    *uuid.UUID               `json:"outlet_id,omitempty"`
	QtyProduced float64                  `json:"qty_produced"`
	Expenses    []ProductionExpenseInput `json:"expenses"`
}

type ProductionService struct {
	DB *pgxpool.Pool
}

func NewProductionService(db *pgxpool.Pool) *ProductionService {
	return &ProductionService{DB: db}
}

func (s *ProductionService) CreateProduction(ctx context.Context, businessID uuid.UUID, userID uuid.UUID, req ProductionRequest) (*models.ProductionRun, error) {
	if req.ItemID == uuid.Nil {
		return nil, errors.New("item_id is required")
	}
	if req.QtyProduced <= 0 {
		return nil, errors.New("qty_produced must be greater than 0")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Verify item exists & belongs to business
	var itemType string
	var itemStatus string
	err = tx.QueryRow(ctx, `
		SELECT item_type, status FROM items WHERE id = $1 AND business_id = $2
	`, req.ItemID, businessID).Scan(&itemType, &itemStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("target item not found or does not belong to business")
		}
		return nil, err
	}

	// Determine Outlet ID
	targetOutletID := uuid.Nil
	if req.OutletID != nil && *req.OutletID != uuid.Nil {
		targetOutletID = *req.OutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return nil, errors.New("no default outlet found for business")
		}
	}

	// 2. Calculate Total Material Cost
	var totalMaterialCost int64 = 0
	expenseDetails := make([]models.ProductionMaterialLog, 0, len(req.Expenses))

	for _, exp := range req.Expenses {
		if exp.ItemID == uuid.Nil || exp.Qty <= 0 {
			continue
		}
		var unitCost int64
		err = tx.QueryRow(ctx, `
			SELECT standard_cost FROM items WHERE id = $1 AND business_id = $2
		`, exp.ItemID, businessID).Scan(&unitCost)
		if err != nil {
			return nil, fmt.Errorf("expense item %s not found: %w", exp.ItemID, err)
		}

		subtotal := int64(math.Round(float64(unitCost) * exp.Qty))
		totalMaterialCost += subtotal

		expenseDetails = append(expenseDetails, models.ProductionMaterialLog{
			IngredientID: exp.ItemID,
			ActualQty:    exp.Qty,
			UnitCost:     unitCost,
			SubtotalCost: subtotal,
		})

		// Deduct material stock & log stock movement
		_, err = tx.Exec(ctx, `
			INSERT INTO item_stocks (item_id, outlet_id, qty_loose, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (item_id, outlet_id) WHERE held_by_user_id IS NULL
			DO UPDATE SET qty_loose = item_stocks.qty_loose + $3, updated_at = NOW()
		`, exp.ItemID, targetOutletID, -exp.Qty)
		if err != nil {
			return nil, fmt.Errorf("failed to deduct expense item stock: %w", err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO stock_movements (id, item_id, outlet_id, movement_type, qty_loose_change, unit_cost, created_by, created_at)
			VALUES ($1, $2, $3, 'production_expense_out', $4, $5, $6, NOW())
		`, uuid.New(), exp.ItemID, targetOutletID, -exp.Qty, unitCost, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to record expense movement: %w", err)
		}
	}

	hppPerUnit := int64(0)
	if req.QtyProduced > 0 {
		hppPerUnit = int64(math.Round(float64(totalMaterialCost) / req.QtyProduced))
	}

	// 3. Create Production Header Record
	productionID := uuid.New()
	batchCode := fmt.Sprintf("BATCH-%s-%s", time.Now().Format("20060102"), productionID.String()[:4])

	_, err = tx.Exec(ctx, `
		INSERT INTO productions (id, business_id, product_id, qty_produced, produced_by, produced_at, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
	`, productionID, businessID, req.ItemID, req.QtyProduced, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert production header: %w", err)
	}

	// 4. Update Finished Good Stock & Insert Movement
	_, err = tx.Exec(ctx, `
		INSERT INTO item_stocks (item_id, outlet_id, qty_sealed, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (item_id, outlet_id) WHERE held_by_user_id IS NULL
		DO UPDATE SET qty_sealed = item_stocks.qty_sealed + $3, updated_at = NOW()
	`, req.ItemID, targetOutletID, req.QtyProduced)
	if err != nil {
		return nil, fmt.Errorf("failed to update finished good stock: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (id, item_id, outlet_id, movement_type, qty_sealed_change, unit_cost, reference_id, created_by, created_at)
		VALUES ($1, $2, $3, 'production_in', $4, $5, $6, $7, NOW())
	`, uuid.New(), req.ItemID, targetOutletID, req.QtyProduced, hppPerUnit, productionID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to record production stock movement: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit production transaction: %w", err)
	}

	return &models.ProductionRun{
		ID:                productionID,
		BusinessID:        businessID,
		BatchCode:         batchCode,
		ProductID:         req.ItemID,
		TargetQty:         req.QtyProduced,
		ActualYieldQty:    req.QtyProduced,
		HPPPerUnit:        hppPerUnit,
		TotalMaterialCost: totalMaterialCost,
		ProducedBy:        userID,
		ProducedAt:        time.Now(),
		CreatedAt:         time.Now(),
		MaterialLogs:      expenseDetails,
	}, nil
}

func (s *ProductionService) GetProductions(ctx context.Context, businessID uuid.UUID) ([]models.ProductionRun, error) {
	rows, err := s.DB.Query(ctx, `
		SELECT p.id, p.business_id, p.product_id, p.qty_produced, p.produced_by, p.produced_at, p.created_at
		FROM productions p
		WHERE p.business_id = $1
		ORDER BY p.created_at DESC LIMIT 50
	`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.ProductionRun, 0)
	for rows.Next() {
		var pr models.ProductionRun
		var qtyProduced float64
		err := rows.Scan(&pr.ID, &pr.BusinessID, &pr.ProductID, &qtyProduced, &pr.ProducedBy, &pr.ProducedAt, &pr.CreatedAt)
		if err != nil {
			return nil, err
		}
		pr.BatchCode = fmt.Sprintf("BATCH-%s-%s", pr.CreatedAt.Format("20060102"), pr.ID.String()[:4])
		pr.TargetQty = qtyProduced
		pr.ActualYieldQty = qtyProduced
		list = append(list, pr)
	}
	return list, nil
}

func (s *ProductionService) CreateEodMaterialUsage(ctx context.Context, businessID uuid.UUID, outletID uuid.UUID, settlementID *uuid.UUID, itemID uuid.UUID, initialStock, restockIn, finalOpnameStock float64) (*models.EodMaterialUsage, error) {
	consumedQty := (initialStock + restockIn) - finalOpnameStock
	if consumedQty < 0 {
		consumedQty = 0
	}

	var unitCost int64
	var itemName string
	err := s.DB.QueryRow(ctx, "SELECT name, standard_cost FROM items WHERE id = $1 AND business_id = $2", itemID, businessID).Scan(&itemName, &unitCost)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("item not found or unauthorized")
		}
		return nil, err
	}

	totalCost := int64(math.Round(float64(unitCost) * consumedQty))
	id := uuid.New()
	now := time.Now()

	_, err = s.DB.Exec(ctx, `
		INSERT INTO eod_material_usages (
			id, business_id, outlet_id, settlement_id, item_id, initial_stock, restock_in, final_opname_stock, consumed_qty, unit_cost, total_cost, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, id, businessID, outletID, settlementID, itemID, initialStock, restockIn, finalOpnameStock, consumedQty, unitCost, totalCost, now)
	if err != nil {
		return nil, fmt.Errorf("failed to insert eod material usage: %w", err)
	}

	return &models.EodMaterialUsage{
		ID:               id,
		BusinessID:       businessID,
		OutletID:         outletID,
		SettlementID:     settlementID,
		ItemID:           itemID,
		ItemName:         itemName,
		InitialStock:     initialStock,
		RestockIn:        restockIn,
		FinalOpnameStock: finalOpnameStock,
		ConsumedQty:      consumedQty,
		UnitCost:         unitCost,
		TotalCost:        totalCost,
		CreatedAt:        now,
	}, nil
}

func (s *ProductionService) GetEodMaterialUsages(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]models.EodMaterialUsage, error) {
	query := `
		SELECT 
			e.id, e.business_id, e.outlet_id, e.settlement_id, e.item_id, i.name as item_name,
			e.initial_stock, e.restock_in, e.final_opname_stock, e.consumed_qty, e.unit_cost, e.total_cost, e.created_at
		FROM eod_material_usages e
		JOIN items i ON e.item_id = i.id
		WHERE e.business_id = $1
	`
	args := []interface{}{businessID}

	if outletID != nil && *outletID != uuid.Nil {
		query += " AND e.outlet_id = $2"
		args = append(args, *outletID)
	}

	query += " ORDER BY e.created_at DESC LIMIT 100"

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.EodMaterialUsage
	for rows.Next() {
		var u models.EodMaterialUsage
		if err := rows.Scan(
			&u.ID, &u.BusinessID, &u.OutletID, &u.SettlementID, &u.ItemID, &u.ItemName,
			&u.InitialStock, &u.RestockIn, &u.FinalOpnameStock, &u.ConsumedQty, &u.UnitCost, &u.TotalCost, &u.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, nil
}

