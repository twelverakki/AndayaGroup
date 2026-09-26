package logistics

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

// CreateTransferItemRequest represents a single item in a delivery order
type CreateTransferItemRequest struct {
	ItemID             uuid.UUID `json:"item_id"`
	QtyRequestedSealed *float64  `json:"qty_requested_sealed,omitempty"`
	QtyRequestedLoose  *float64  `json:"qty_requested_loose,omitempty"`
	QtySentSealed      float64   `json:"qty_sent_sealed"`
	QtySentLoose       float64   `json:"qty_sent_loose"`
	AllocationNotes    *string   `json:"allocation_notes,omitempty"`
	Notes              string    `json:"notes,omitempty"`
}

// CreateTransferRequest represents the payload to create a new delivery order
type CreateTransferRequest struct {
	FromOutletID          *uuid.UUID                  `json:"from_outlet_id,omitempty"`
	ToOutletID            *uuid.UUID                  `json:"to_outlet_id,omitempty"`
	SentToUserID          *uuid.UUID                  `json:"sent_to_user_id,omitempty"`
	DriverName            *string                     `json:"driver_name,omitempty"`
	DriverPhone           *string                     `json:"driver_phone,omitempty"`
	VehiclePlate          *string                     `json:"vehicle_plate,omitempty"`
	CarrierType           string                      `json:"carrier_type,omitempty"`
	ShippingCost          int64                       `json:"shipping_cost,omitempty"`
	ShippingCostPayer     string                      `json:"shipping_cost_payer,omitempty"`
	ShippingPaymentMethod string                      `json:"shipping_payment_method,omitempty"`
	TrackingRefNo         *string                     `json:"tracking_ref_no,omitempty"`
	ShippingCostMode      string                      `json:"shipping_cost_mode,omitempty"`
	MaxClaimBudget        int64                       `json:"max_claim_budget,omitempty"`
	TransferType          string                      `json:"transfer_type,omitempty"` // outbound, requisition, return
	Status                string                      `json:"status,omitempty"`        // draft, pending_approval, in_transit
	Notes                 string                      `json:"notes,omitempty"`
	BackorderStatus       *string                     `json:"backorder_status,omitempty"`
	ParentTransferID      *uuid.UUID                  `json:"parent_transfer_id,omitempty"`
	Items                 []CreateTransferItemRequest `json:"items"`

	// Backward-compatibility single item fields
	ItemID    *uuid.UUID `json:"item_id,omitempty"`
	OutletID  *uuid.UUID `json:"outlet_id,omitempty"`
	QtySealed float64    `json:"qty_sealed,omitempty"`
	QtyLoose  float64    `json:"qty_loose,omitempty"`
	Qty       float64    `json:"qty,omitempty"`
}

// CreateBulkDraftRequest represents payload to create draft transfers for multiple outlets at once
type CreateBulkDraftRequest struct {
	DestinationOutletIDs []uuid.UUID                 `json:"destination_outlet_ids"`
	Items                []CreateTransferItemRequest `json:"items"`
	TransferType         string                      `json:"transfer_type,omitempty"` // outbound, requisition, return
	Notes                string                      `json:"notes,omitempty"`
}

// UpdateTransferRequest represents payload to edit metadata/costs/items/status of an existing transfer
type UpdateTransferRequest struct {
	DriverName            *string                     `json:"driver_name,omitempty"`
	DriverPhone           *string                     `json:"driver_phone,omitempty"`
	VehiclePlate          *string                     `json:"vehicle_plate,omitempty"`
	CarrierType           *string                     `json:"carrier_type,omitempty"`
	ShippingCost          *int64                      `json:"shipping_cost,omitempty"`
	ShippingCostPayer     *string                     `json:"shipping_cost_payer,omitempty"`
	ShippingPaymentMethod *string                     `json:"shipping_payment_method,omitempty"`
	TrackingRefNo         *string                     `json:"tracking_ref_no,omitempty"`
	ShippingCostMode      *string                     `json:"shipping_cost_mode,omitempty"`
	MaxClaimBudget        *int64                      `json:"max_claim_budget,omitempty"`
	Status                *string                     `json:"status,omitempty"` // draft, pending_approval, in_transit, cancelled
	TransferType          *string                     `json:"transfer_type,omitempty"`
	Notes                 *string                     `json:"notes,omitempty"`
	BackorderStatus       *string                     `json:"backorder_status,omitempty"`
	CreateBackorder       bool                        `json:"create_backorder,omitempty"`
	Items                 []CreateTransferItemRequest `json:"items,omitempty"`
}

// ReorderSuggestion represents auto-calculated replenishment suggestion for a branch
type ReorderSuggestion struct {
	ItemID          uuid.UUID `json:"item_id"`
	ItemName        string    `json:"item_name"`
	ItemSKU         string    `json:"item_sku"`
	BaseUnit        string    `json:"base_unit"`
	BoxUnit         string    `json:"box_unit"`
	ConversionRate  float64   `json:"conversion_rate"`
	CurrentSealed   float64   `json:"current_sealed"`
	CurrentLoose    float64   `json:"current_loose"`
	MinStock        float64   `json:"min_stock"`
	DailyVelocity   float64   `json:"daily_velocity"`
	SuggestedSealed float64   `json:"suggested_sealed"`
	SuggestedLoose  float64   `json:"suggested_loose"`
	UrgencyLevel    string    `json:"urgency_level"` // "critical", "warning", "optimal"
	Reason          string    `json:"reason"`
}

// SubmitDriverClaimRequest represents payload when driver scans QR and submits actual trip expenses
type SubmitDriverClaimRequest struct {
	ClaimedAmount        int64   `json:"claimed_amount"`
	ClaimedNotes         string  `json:"claimed_notes"`
	ClaimedAttachmentURL *string `json:"claimed_attachment_url,omitempty"`
}

// RejectClaimRequest represents payload when manager rejects a driver claim
type RejectClaimRequest struct {
	Reason string `json:"reason"`
}

// PublicClaimInfo represents safe info shown on the driver's guest claim portal
type PublicClaimInfo struct {
	TransferID           uuid.UUID  `json:"transfer_id"`
	TransferNo           string     `json:"transfer_no"`
	BusinessName         string     `json:"business_name"`
	FromOutletName       string     `json:"from_outlet_name"`
	ToOutletName         string     `json:"to_outlet_name"`
	DriverName           string     `json:"driver_name"`
	VehiclePlate         string     `json:"vehicle_plate"`
	MaxClaimBudget       int64      `json:"max_claim_budget"`
	ClaimStatus          string     `json:"claim_status"` // none, pending, approved, rejected
	ClaimedAmount        int64      `json:"claimed_amount"`
	ClaimedNotes         *string    `json:"claimed_notes,omitempty"`
	ClaimedAttachmentURL *string    `json:"claimed_attachment_url,omitempty"`
	ClaimedAt            *time.Time `json:"claimed_at,omitempty"`
	ClaimRejectionReason *string    `json:"claim_rejection_reason,omitempty"`
	SentAt               time.Time  `json:"sent_at"`
}

// ReceiveTransferItemRequest represents per-item confirmation at destination
type ReceiveTransferItemRequest struct {
	ItemID            uuid.UUID `json:"item_id"`
	QtyReceivedSealed *float64  `json:"qty_received_sealed,omitempty"`
	QtyReceivedLoose  *float64  `json:"qty_received_loose,omitempty"`
	Notes             string    `json:"notes,omitempty"`
}

// ReceiveTransferRequest represents confirmation payload for handshake receive
type ReceiveTransferRequest struct {
	Notes             string                       `json:"notes,omitempty"`
	Items             []ReceiveTransferItemRequest `json:"items,omitempty"`
	QtyReceivedSealed *float64                     `json:"qty_received_sealed,omitempty"`
	QtyReceivedLoose  *float64                     `json:"qty_received_loose,omitempty"`
}

// UnboxRequest represents payload to unbox/thaw a box/pack into loose pieces
type UnboxRequest struct {
	ItemID         uuid.UUID  `json:"item_id"`
	OutletID       *uuid.UUID `json:"outlet_id,omitempty"`
	QtyBoxes       float64    `json:"qty_boxes"`        // Number of sealed boxes/packs to unpack
	ShrinkageLoose float64    `json:"shrinkage_loose"`  // Loss/shrinkage in loose pieces (e.g. thaw water loss)
	Notes          string     `json:"notes,omitempty"`
}

type LogisticsService struct {
	DB *pgxpool.Pool
}

func NewLogisticsService(db *pgxpool.Pool) *LogisticsService {
	return &LogisticsService{DB: db}
}

// GenerateTransferNo creates a sequential reference e.g. SJ-20260919-001
func (s *LogisticsService) GenerateTransferNo(ctx context.Context, businessID uuid.UUID) string {
	today := time.Now().Format("20060102")
	prefix := fmt.Sprintf("SJ-%s-", today)

	var maxSeq int
	err := s.DB.QueryRow(ctx, `
		SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(transfer_no, '^SJ-[0-9]{8}-', ''), '') AS INTEGER)), 0)
		FROM stock_transfers 
		WHERE transfer_no LIKE $1
	`, prefix+"%").Scan(&maxSeq)
	if err != nil {
		maxSeq = 0
	}

	return fmt.Sprintf("%s%03d", prefix, maxSeq+1)
}

// CreateTransfer creates a new multi-item Surat Jalan and deducts stock from origin outlet
func (s *LogisticsService) CreateTransfer(ctx context.Context, businessID uuid.UUID, senderID uuid.UUID, req CreateTransferRequest) (*models.StockTransfer, error) {
	// Normalize items list (support single-item backward compatibility)
	itemsToProcess := req.Items
	if len(itemsToProcess) == 0 && req.ItemID != nil && *req.ItemID != uuid.Nil {
		sealed := req.QtySealed
		loose := req.QtyLoose
		if sealed <= 0 && loose <= 0 && req.Qty > 0 {
			sealed = req.Qty
		}
		itemsToProcess = append(itemsToProcess, CreateTransferItemRequest{
			ItemID:        *req.ItemID,
			QtySentSealed: sealed,
			QtySentLoose:  loose,
			Notes:         req.Notes,
		})
	}

	if len(itemsToProcess) == 0 {
		return nil, errors.New("surat jalan harus memuat setidaknya 1 item barang")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Resolve from_outlet_id
	fromOutletID := uuid.Nil
	if req.FromOutletID != nil && *req.FromOutletID != uuid.Nil {
		fromOutletID = *req.FromOutletID
	} else if req.OutletID != nil && *req.OutletID != uuid.Nil {
		fromOutletID = *req.OutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&fromOutletID)
		if err != nil {
			return nil, errors.New("no source outlet found for business")
		}
	}

	// Resolve to_outlet_id
	toOutletID := uuid.Nil
	if req.ToOutletID != nil && *req.ToOutletID != uuid.Nil {
		toOutletID = *req.ToOutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 AND id != $2 ORDER BY created_at ASC LIMIT 1`, businessID, fromOutletID).Scan(&toOutletID)
		if err != nil {
			return nil, errors.New("tidak ada outlet/cabang tujuan lain yang ditemukan untuk pengiriman")
		}
	}

	if fromOutletID == toOutletID {
		return nil, errors.New("outlet asal dan cabang tujuan pengiriman tidak boleh sama")
	}

	transferType := "outbound"
	if req.TransferType == "return" {
		transferType = "return"
	} else if req.TransferType == "requisition" {
		transferType = "requisition"
	}

	initialStatus := "in_transit"
	if req.Status == "draft" || req.Status == "pending_approval" {
		initialStatus = req.Status
	} else if transferType == "requisition" && req.Status == "" {
		initialStatus = "pending_approval"
	}

	transferID := uuid.New()
	transferNo := s.GenerateTransferNo(ctx, businessID)

	carrierType := req.CarrierType
	if carrierType == "" {
		carrierType = "internal_fleet"
	}
	shippingCostPayer := req.ShippingCostPayer
	if shippingCostPayer == "" {
		shippingCostPayer = "origin"
	}
	shippingPaymentMethod := req.ShippingPaymentMethod
	if shippingPaymentMethod == "" {
		shippingPaymentMethod = "cash"
	}

	shippingCostMode := req.ShippingCostMode
	if shippingCostMode == "" {
		shippingCostMode = "fixed"
	}
	var claimToken *string
	var claimStatus string = "none"
	if shippingCostMode == "driver_claim" {
		tok := fmt.Sprintf("CLM-%s-%s", time.Now().Format("20060102"), uuid.New().String()[:8])
		claimToken = &tok
		claimStatus = "none"
	}

	backorderStatus := "none"
	if req.BackorderStatus != nil && *req.BackorderStatus != "" {
		backorderStatus = *req.BackorderStatus
	}

	// Insert stock_transfers header
	_, err = tx.Exec(ctx, `
		INSERT INTO stock_transfers (
			id, transfer_no, business_id, from_outlet_id, to_outlet_id,
			sent_by_user_id, sent_to_user_id, driver_name, driver_phone, vehicle_plate, carrier_type,
			shipping_cost, shipping_cost_payer, shipping_payment_method, tracking_ref_no,
			shipping_cost_mode, max_claim_budget, claim_token, claim_status,
			backorder_status, parent_transfer_id,
			status, transfer_type, notes, sent_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15,
			$16, $17, $18, $19,
			$20, $21,
			$22, $23, $24, NOW(), NOW(), NOW()
		)
	`, transferID, transferNo, businessID, fromOutletID, toOutletID,
		senderID, req.SentToUserID, req.DriverName, req.DriverPhone, req.VehiclePlate, carrierType,
		req.ShippingCost, shippingCostPayer, shippingPaymentMethod, req.TrackingRefNo,
		shippingCostMode, req.MaxClaimBudget, claimToken, claimStatus,
		backorderStatus, req.ParentTransferID,
		initialStatus, transferType, req.Notes)
	if err != nil {
		return nil, fmt.Errorf("failed to create stock transfer record: %w", err)
	}

	createdItems := make([]models.StockTransferItem, 0, len(itemsToProcess))

	// Process each item: If in_transit, validate stock, deduct source item_stocks, write stock_movements
	// If draft / pending_approval, just fetch metadata and insert line items
	for _, itm := range itemsToProcess {
		if itm.ItemID == uuid.Nil {
			continue
		}

		var availSealed, availLoose float64
		var itemName, itemSKU, baseUnit, boxUnit string
		var convRate float64
		var standardCost int64

		err = tx.QueryRow(ctx, `
			SELECT i.name, COALESCE(i.sku, ''), i.base_unit, COALESCE(i.box_unit, ''), 
			       COALESCE(i.conversion_rate, 1.0), COALESCE(i.standard_cost, 0),
			       COALESCE(s.qty_sealed, 0), COALESCE(s.qty_loose, 0)
			FROM items i
			LEFT JOIN item_stocks s ON i.id = s.item_id AND s.outlet_id = $2 AND s.held_by_user_id IS NULL
			WHERE i.id = $1 AND i.business_id = $3
		`, itm.ItemID, fromOutletID, businessID).Scan(
			&itemName, &itemSKU, &baseUnit, &boxUnit,
			&convRate, &standardCost,
			&availSealed, &availLoose,
		)
		if err != nil {
			return nil, fmt.Errorf("item %s tidak ditemukan di bisnis ini: %w", itm.ItemID, err)
		}

		reqSealed := itm.QtySentSealed
		if itm.QtyRequestedSealed != nil {
			reqSealed = *itm.QtyRequestedSealed
		}
		reqLoose := itm.QtySentLoose
		if itm.QtyRequestedLoose != nil {
			reqLoose = *itm.QtyRequestedLoose
		}

		// If initial status is in_transit (immediate delivery order), validate stock and deduct
		if initialStatus == "in_transit" {
			if itm.QtySentSealed > availSealed {
				return nil, fmt.Errorf("stok dus/pack '%s' tidak mencukupi (tersedia: %.2f, diminta: %.2f)", itemName, availSealed, itm.QtySentSealed)
			}
			if itm.QtySentLoose > availLoose {
				return nil, fmt.Errorf("stok eceran '%s' tidak mencukupi (tersedia: %.2f, diminta: %.2f)", itemName, availLoose, itm.QtySentLoose)
			}

			// Deduct stock from origin outlet
			_, err = tx.Exec(ctx, `
				UPDATE item_stocks
				SET qty_sealed = qty_sealed - $1, qty_loose = qty_loose - $2, updated_at = NOW()
				WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
			`, itm.QtySentSealed, itm.QtySentLoose, itm.ItemID, fromOutletID)
			if err != nil {
				return nil, fmt.Errorf("failed to deduct source stock for item '%s': %w", itemName, err)
			}

			// Record double-entry stock movement (outbound to transit)
			totalUnits := itm.QtySentSealed + itm.QtySentLoose
			_, err = tx.Exec(ctx, `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, from_outlet_id, to_location_type, to_outlet_id,
					package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
				) VALUES (
					$1, $2, $3, 'distribution_outbound', $4,
					'outlet', $5, 'transit', $6,
					'mixed', $7, $8, $9, $10, $11, NOW()
				)
			`, uuid.New(), businessID, itm.ItemID, transferID,
				fromOutletID, toOutletID,
				totalUnits, standardCost, int64(totalUnits*float64(standardCost)),
				senderID, fmt.Sprintf("Surat Jalan %s: Kirim %.2f dus & %.2f pcs '%s'", transferNo, itm.QtySentSealed, itm.QtySentLoose, itemName))
			if err != nil {
				return nil, fmt.Errorf("failed to record stock movement: %w", err)
			}
		}

		// Insert line item into stock_transfer_items
		lineItemID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO stock_transfer_items (
				id, transfer_id, item_id, qty_requested_sealed, qty_requested_loose,
				qty_sent_sealed, qty_sent_loose,
				qty_received_sealed, qty_received_loose, shrinkage_qty, allocation_notes, notes, created_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, 0, 0, 0, $8, $9, NOW()
			)
		`, lineItemID, transferID, itm.ItemID, reqSealed, reqLoose, itm.QtySentSealed, itm.QtySentLoose, itm.AllocationNotes, itm.Notes)
		if err != nil {
			return nil, fmt.Errorf("failed to insert transfer line item: %w", err)
		}

		createdItems = append(createdItems, models.StockTransferItem{
			ID:                 lineItemID,
			TransferID:         transferID,
			ItemID:             itm.ItemID,
			ItemName:           itemName,
			ItemSKU:            itemSKU,
			BaseUnit:           baseUnit,
			BoxUnit:            boxUnit,
			ConversionRate:     convRate,
			QtyRequestedSealed: reqSealed,
			QtyRequestedLoose:  reqLoose,
			QtySentSealed:      itm.QtySentSealed,
			QtySentLoose:       itm.QtySentLoose,
			QtyReceivedSealed:  0,
			QtyReceivedLoose:   0,
			ShrinkageQty:       0,
			AllocationNotes:    itm.AllocationNotes,
			CreatedAt:          time.Now(),
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transfer transaction: %w", err)
	}

	return &models.StockTransfer{
		ID:                    transferID,
		TransferNo:            transferNo,
		BusinessID:            businessID,
		FromOutletID:          fromOutletID,
		ToOutletID:            toOutletID,
		SentByUserID:          senderID,
		SentToUserID:          req.SentToUserID,
		DriverName:            req.DriverName,
		DriverPhone:           req.DriverPhone,
		VehiclePlate:          req.VehiclePlate,
		CarrierType:           carrierType,
		ShippingCost:          req.ShippingCost,
		ShippingCostPayer:     shippingCostPayer,
		ShippingPaymentMethod: shippingPaymentMethod,
		TrackingRefNo:         req.TrackingRefNo,
		ShippingCostMode:      shippingCostMode,
		MaxClaimBudget:        req.MaxClaimBudget,
		ClaimToken:            claimToken,
		ClaimStatus:           claimStatus,
		BackorderStatus:       backorderStatus,
		ParentTransferID:      req.ParentTransferID,
		Status:                initialStatus,
		TransferType:          transferType,
		Notes:                 &req.Notes,
		SentAt:                time.Now(),
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
		Items:                 createdItems,
	}, nil

}

// ReceiveTransfer completes handshake receipt of a multi-item Surat Jalan
func (s *LogisticsService) ReceiveTransfer(ctx context.Context, businessID uuid.UUID, recipientID uuid.UUID, transferID uuid.UUID, req ReceiveTransferRequest, userOutletID *uuid.UUID, userRole string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var (
		transferNo string
		fromOutletID uuid.UUID
		toOutletID   uuid.UUID
		status       string
	)

	err = tx.QueryRow(ctx, `
		SELECT transfer_no, from_outlet_id, to_outlet_id, status
		FROM stock_transfers
		WHERE id = $1 AND business_id = $2
	`, transferID, businessID).Scan(&transferNo, &fromOutletID, &toOutletID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("surat jalan / pengiriman logistik tidak ditemukan")
		}
		return err
	}

	// Validate receiver destination outlet scope
	if userRole != "owner" && userRole != "superadmin" && userRole != "admin_gudang" && userOutletID != nil && *userOutletID != uuid.Nil {
		if toOutletID != *userOutletID {
			return errors.New("anda hanya memiliki akses untuk mengonfirmasi penerimaan barang di cabang Anda")
		}
	}

	if status == "received" {
		return errors.New("pengiriman ini sudah pernah dikonfirmasi diterima")
	}
	if status == "cancelled" {
		return errors.New("pengiriman ini telah dibatalkan")
	}

	// Fetch existing line items
	rows, err := tx.Query(ctx, `
		SELECT id, item_id, qty_sent_sealed, qty_sent_loose
		FROM stock_transfer_items
		WHERE transfer_id = $1
	`, transferID)
	if err != nil {
		return fmt.Errorf("failed to query transfer line items: %w", err)
	}
	defer rows.Close()

	type lineData struct {
		ID            uuid.UUID
		ItemID        uuid.UUID
		QtySentSealed float64
		QtySentLoose  float64
	}
	var lines []lineData
	for rows.Next() {
		var l lineData
		if err := rows.Scan(&l.ID, &l.ItemID, &l.QtySentSealed, &l.QtySentLoose); err == nil {
			lines = append(lines, l)
		}
	}
	rows.Close()

	// Map incoming confirmation overrides
	receivedOverrides := make(map[uuid.UUID]ReceiveTransferItemRequest)
	for _, itm := range req.Items {
		receivedOverrides[itm.ItemID] = itm
	}

	// Update each line item and add stock to destination outlet
	for _, l := range lines {
		recSealed := l.QtySentSealed
		recLoose := l.QtySentLoose

		if ov, exists := receivedOverrides[l.ItemID]; exists {
			if ov.QtyReceivedSealed != nil {
				recSealed = *ov.QtyReceivedSealed
			}
			if ov.QtyReceivedLoose != nil {
				recLoose = *ov.QtyReceivedLoose
			}
		} else if len(req.Items) == 0 {
			// If top-level single override provided
			if req.QtyReceivedSealed != nil {
				recSealed = *req.QtyReceivedSealed
			}
			if req.QtyReceivedLoose != nil {
				recLoose = *req.QtyReceivedLoose
			}
		}

		shrinkage := (l.QtySentSealed - recSealed) + (l.QtySentLoose - recLoose)
		if shrinkage < 0 {
			shrinkage = 0
		}

		// Update line item
		_, err = tx.Exec(ctx, `
			UPDATE stock_transfer_items
			SET qty_received_sealed = $1, qty_received_loose = $2, shrinkage_qty = $3
			WHERE id = $4
		`, recSealed, recLoose, shrinkage, l.ID)
		if err != nil {
			return fmt.Errorf("failed to update transfer line item: %w", err)
		}

		// Add stock to destination outlet in item_stocks
		var currentSealed, currentLoose float64
		err = tx.QueryRow(ctx, `
			SELECT qty_sealed, qty_loose FROM item_stocks 
			WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL
			FOR UPDATE
		`, l.ItemID, toOutletID).Scan(&currentSealed, &currentLoose)
		if err != nil {
			// Row doesn't exist, insert new
			_, err = tx.Exec(ctx, `
				INSERT INTO item_stocks (id, item_id, outlet_id, held_by_user_id, qty_sealed, qty_loose, updated_at)
				VALUES (gen_random_uuid(), $1, $2, NULL, $3, $4, NOW())
			`, l.ItemID, toOutletID, recSealed, recLoose)
		} else {
			// Row exists, update
			_, err = tx.Exec(ctx, `
				UPDATE item_stocks
				SET qty_sealed = qty_sealed + $1, qty_loose = qty_loose + $2, updated_at = NOW()
				WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
			`, recSealed, recLoose, l.ItemID, toOutletID)
		}
		if err != nil {
			return fmt.Errorf("failed to update destination item stock: %w", err)
		}

		// Record stock movement (transit -> destination outlet)
		_, err = tx.Exec(ctx, `
			INSERT INTO stock_movements (
				id, business_id, item_id, source_document_type, source_document_id,
				from_location_type, to_location_type, to_outlet_id,
				package_form, qty, performed_by, notes, created_at
			) VALUES (
				$1, $2, $3, 'distribution_received', $4,
				'transit', 'outlet', $5,
				'mixed', $6, $7, $8, NOW()
			)
		`, uuid.New(), businessID, l.ItemID, transferID,
			toOutletID, (recSealed + recLoose), recipientID,
			fmt.Sprintf("Handshake Terima Surat Jalan: %s (Diterima %.2f dus / %.2f pcs)", transferNo, recSealed, recLoose))
		if err != nil {
			return fmt.Errorf("failed to record stock movement: %w", err)
		}

		// Record shrinkage movement if any
		if shrinkage > 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, to_location_type,
					package_form, qty, performed_by, notes, created_at
				) VALUES (
					$1, $2, $3, 'transit_shrinkage', $4,
					'transit', 'scrap_shrinkage',
					'mixed', $5, $6, $7, NOW()
				)
			`, uuid.New(), businessID, l.ItemID, transferID,
				shrinkage, recipientID,
				fmt.Sprintf("Susut Air / Selisih Transit: %s (Susut %.2f unit)", transferNo, shrinkage))
			if err != nil {
				return fmt.Errorf("failed to record shrinkage movement: %w", err)
			}
		}
	}

	// Update stock_transfers header status
	_, err = tx.Exec(ctx, `
		UPDATE stock_transfers
		SET status = 'received', received_by_user_id = $1, received_at = NOW(),
		    notes = COALESCE(NULLIF($2, ''), notes), updated_at = NOW()
		WHERE id = $3
	`, recipientID, req.Notes, transferID)
	if err != nil {
		return fmt.Errorf("failed to update transfer status: %w", err)
	}

	return tx.Commit(ctx)
}

// GetTransfers returns all delivery orders for the active tenant, optionally filtered by outlet
func (s *LogisticsService) GetTransfers(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]models.StockTransfer, error) {
	query := `
		SELECT t.id, t.transfer_no, t.business_id, t.from_outlet_id, COALESCE(fo.name, ''),
		       t.to_outlet_id, COALESCE(to_out.name, ''), t.sent_by_user_id, COALESCE(u_sent.name, ''),
		       t.sent_to_user_id, COALESCE(u_target.name, ''), t.received_by_user_id, COALESCE(u_rec.name, ''),
		       t.driver_name, t.driver_phone, t.vehicle_plate, COALESCE(t.carrier_type, 'internal_fleet'),
		       COALESCE(t.shipping_cost, 0), COALESCE(t.shipping_cost_payer, 'origin'), COALESCE(t.shipping_payment_method, 'cash'), t.tracking_ref_no,
		       COALESCE(t.shipping_cost_mode, 'fixed'), COALESCE(t.max_claim_budget, 0), t.claim_token, COALESCE(t.claim_status, 'none'),
		       COALESCE(t.claimed_amount, 0), t.claimed_notes, t.claimed_attachment_url, t.claimed_at,
		       t.claim_reviewed_by, COALESCE(u_rev.name, ''), t.claim_reviewed_at, t.claim_rejection_reason,
		       COALESCE(t.backorder_status, 'none'), t.parent_transfer_id,
		       t.status, t.transfer_type, t.notes, t.sent_at, t.received_at, t.created_at, t.updated_at
		FROM stock_transfers t
		LEFT JOIN outlets fo ON t.from_outlet_id = fo.id
		LEFT JOIN outlets to_out ON t.to_outlet_id = to_out.id
		LEFT JOIN users u_sent ON t.sent_by_user_id = u_sent.id
		LEFT JOIN users u_target ON t.sent_to_user_id = u_target.id
		LEFT JOIN users u_rec ON t.received_by_user_id = u_rec.id
		LEFT JOIN users u_rev ON t.claim_reviewed_by = u_rev.id
		WHERE t.business_id = $1
	`

	var args []interface{}
	args = append(args, businessID)

	if outletID != nil && *outletID != uuid.Nil {
		query += ` AND (t.from_outlet_id = $2 OR t.to_outlet_id = $2)`
		args = append(args, *outletID)
	}

	query += ` ORDER BY t.created_at DESC`

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	transfers := []models.StockTransfer{}
	for rows.Next() {
		var t models.StockTransfer
		err := rows.Scan(
			&t.ID, &t.TransferNo, &t.BusinessID, &t.FromOutletID, &t.FromOutletName,
			&t.ToOutletID, &t.ToOutletName, &t.SentByUserID, &t.SentByUserName,
			&t.SentToUserID, &t.SentToUserName, &t.ReceivedByUserID, &t.ReceivedByUserName,
			&t.DriverName, &t.DriverPhone, &t.VehiclePlate, &t.CarrierType,
			&t.ShippingCost, &t.ShippingCostPayer, &t.ShippingPaymentMethod, &t.TrackingRefNo,
			&t.ShippingCostMode, &t.MaxClaimBudget, &t.ClaimToken, &t.ClaimStatus,
			&t.ClaimedAmount, &t.ClaimedNotes, &t.ClaimedAttachmentURL, &t.ClaimedAt,
			&t.ClaimReviewedBy, &t.ClaimReviewedByName, &t.ClaimReviewedAt, &t.ClaimRejectionReason,
			&t.BackorderStatus, &t.ParentTransferID,
			&t.Status, &t.TransferType, &t.Notes, &t.SentAt, &t.ReceivedAt, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Fetch line items for this transfer
		itemRows, err := s.DB.Query(ctx, `
			SELECT ti.id, ti.transfer_id, ti.item_id, COALESCE(i.name, ''), COALESCE(i.sku, ''),
			       i.base_unit, COALESCE(i.box_unit, ''), COALESCE(i.conversion_rate, 1.0),
			       COALESCE(ti.qty_requested_sealed, ti.qty_sent_sealed), COALESCE(ti.qty_requested_loose, ti.qty_sent_loose),
			       ti.qty_sent_sealed, ti.qty_sent_loose, ti.qty_received_sealed, ti.qty_received_loose,
			       ti.shrinkage_qty, ti.allocation_notes, ti.notes, ti.created_at
			FROM stock_transfer_items ti
			JOIN items i ON ti.item_id = i.id
			WHERE ti.transfer_id = $1
			ORDER BY ti.created_at ASC
		`, t.ID)
		if err == nil {
			var lineItems []models.StockTransferItem
			for itemRows.Next() {
				var li models.StockTransferItem
				if err := itemRows.Scan(
					&li.ID, &li.TransferID, &li.ItemID, &li.ItemName, &li.ItemSKU,
					&li.BaseUnit, &li.BoxUnit, &li.ConversionRate,
					&li.QtyRequestedSealed, &li.QtyRequestedLoose,
					&li.QtySentSealed, &li.QtySentLoose, &li.QtyReceivedSealed, &li.QtyReceivedLoose,
					&li.ShrinkageQty, &li.AllocationNotes, &li.Notes, &li.CreatedAt,
				); err == nil {
					lineItems = append(lineItems, li)
				}
			}
			itemRows.Close()
			t.Items = lineItems
		}

		transfers = append(transfers, t)
	}

	return transfers, nil
}

// GetTransferByID returns a single delivery order with complete joined metadata and items
func (s *LogisticsService) GetTransferByID(ctx context.Context, businessID uuid.UUID, transferID uuid.UUID) (*models.StockTransfer, error) {
	query := `
		SELECT t.id, t.transfer_no, t.business_id, t.from_outlet_id, COALESCE(fo.name, ''),
		       t.to_outlet_id, COALESCE(to_out.name, ''), t.sent_by_user_id, COALESCE(u_sent.name, ''),
		       t.sent_to_user_id, COALESCE(u_target.name, ''), t.received_by_user_id, COALESCE(u_rec.name, ''),
		       t.driver_name, t.driver_phone, t.vehicle_plate, COALESCE(t.carrier_type, 'internal_fleet'),
		       COALESCE(t.shipping_cost, 0), COALESCE(t.shipping_cost_payer, 'origin'), COALESCE(t.shipping_payment_method, 'cash'), t.tracking_ref_no,
		       COALESCE(t.shipping_cost_mode, 'fixed'), COALESCE(t.max_claim_budget, 0), t.claim_token, COALESCE(t.claim_status, 'none'),
		       COALESCE(t.claimed_amount, 0), t.claimed_notes, t.claimed_attachment_url, t.claimed_at,
		       t.claim_reviewed_by, COALESCE(u_rev.name, ''), t.claim_reviewed_at, t.claim_rejection_reason,
		       COALESCE(t.backorder_status, 'none'), t.parent_transfer_id,
		       t.status, t.transfer_type, t.notes, t.sent_at, t.received_at, t.created_at, t.updated_at
		FROM stock_transfers t
		LEFT JOIN outlets fo ON t.from_outlet_id = fo.id
		LEFT JOIN outlets to_out ON t.to_outlet_id = to_out.id
		LEFT JOIN users u_sent ON t.sent_by_user_id = u_sent.id
		LEFT JOIN users u_target ON t.sent_to_user_id = u_target.id
		LEFT JOIN users u_rec ON t.received_by_user_id = u_rec.id
		LEFT JOIN users u_rev ON t.claim_reviewed_by = u_rev.id
		WHERE t.id = $1 AND t.business_id = $2
	`

	var t models.StockTransfer
	err := s.DB.QueryRow(ctx, query, transferID, businessID).Scan(
		&t.ID, &t.TransferNo, &t.BusinessID, &t.FromOutletID, &t.FromOutletName,
		&t.ToOutletID, &t.ToOutletName, &t.SentByUserID, &t.SentByUserName,
		&t.SentToUserID, &t.SentToUserName, &t.ReceivedByUserID, &t.ReceivedByUserName,
		&t.DriverName, &t.DriverPhone, &t.VehiclePlate, &t.CarrierType,
		&t.ShippingCost, &t.ShippingCostPayer, &t.ShippingPaymentMethod, &t.TrackingRefNo,
		&t.ShippingCostMode, &t.MaxClaimBudget, &t.ClaimToken, &t.ClaimStatus,
		&t.ClaimedAmount, &t.ClaimedNotes, &t.ClaimedAttachmentURL, &t.ClaimedAt,
		&t.ClaimReviewedBy, &t.ClaimReviewedByName, &t.ClaimReviewedAt, &t.ClaimRejectionReason,
		&t.BackorderStatus, &t.ParentTransferID,
		&t.Status, &t.TransferType, &t.Notes, &t.SentAt, &t.ReceivedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("surat jalan tidak ditemukan")
		}
		return nil, err
	}

	// Fetch line items
	itemRows, err := s.DB.Query(ctx, `
		SELECT ti.id, ti.transfer_id, ti.item_id, COALESCE(i.name, ''), COALESCE(i.sku, ''),
		       i.base_unit, COALESCE(i.box_unit, ''), COALESCE(i.conversion_rate, 1.0),
		       COALESCE(ti.qty_requested_sealed, ti.qty_sent_sealed), COALESCE(ti.qty_requested_loose, ti.qty_sent_loose),
		       ti.qty_sent_sealed, ti.qty_sent_loose, ti.qty_received_sealed, ti.qty_received_loose,
		       ti.shrinkage_qty, ti.allocation_notes, ti.notes, ti.created_at
		FROM stock_transfer_items ti
		JOIN items i ON ti.item_id = i.id
		WHERE ti.transfer_id = $1
		ORDER BY ti.created_at ASC
	`, t.ID)
	if err == nil {
		var lineItems []models.StockTransferItem
		for itemRows.Next() {
			var li models.StockTransferItem
			if err := itemRows.Scan(
				&li.ID, &li.TransferID, &li.ItemID, &li.ItemName, &li.ItemSKU,
				&li.BaseUnit, &li.BoxUnit, &li.ConversionRate,
				&li.QtyRequestedSealed, &li.QtyRequestedLoose,
				&li.QtySentSealed, &li.QtySentLoose, &li.QtyReceivedSealed, &li.QtyReceivedLoose,
				&li.ShrinkageQty, &li.AllocationNotes, &li.Notes, &li.CreatedAt,
			); err == nil {
				lineItems = append(lineItems, li)
			}
		}
		itemRows.Close()
		t.Items = lineItems
	}

	return &t, nil
}

// UpdateTransfer updates shipping costs, carrier info, tracking numbers, line items, or transitions status
func (s *LogisticsService) UpdateTransfer(ctx context.Context, businessID uuid.UUID, transferID uuid.UUID, req UpdateTransferRequest) (*models.StockTransfer, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Verify existence & status
	var (
		transferNo    string
		fromOutletID  uuid.UUID
		toOutletID    uuid.UUID
		currentStatus string
		senderID      uuid.UUID
	)
	err = tx.QueryRow(ctx, `
		SELECT transfer_no, from_outlet_id, to_outlet_id, status, sent_by_user_id
		FROM stock_transfers
		WHERE id = $1 AND business_id = $2
	`, transferID, businessID).Scan(&transferNo, &fromOutletID, &toOutletID, &currentStatus, &senderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("surat jalan tidak ditemukan")
		}
		return nil, fmt.Errorf("failed to fetch stock transfer: %w", err)
	}

	if currentStatus == "cancelled" {
		return nil, errors.New("surat jalan yang sudah dibatalkan tidak dapat diubah")
	}
	if currentStatus == "received" && req.Status != nil && *req.Status != "received" {
		return nil, errors.New("surat jalan yang sudah diterima tidak dapat diubah statusnya")
	}

	targetStatus := currentStatus
	if req.Status != nil && *req.Status != "" {
		targetStatus = *req.Status
	}

	// If currently draft/pending_approval and new item lines are provided, replace them
	if (currentStatus == "draft" || currentStatus == "pending_approval") && len(req.Items) > 0 {
		_, err = tx.Exec(ctx, `DELETE FROM stock_transfer_items WHERE transfer_id = $1`, transferID)
		if err != nil {
			return nil, fmt.Errorf("failed to clear old line items: %w", err)
		}

		for _, itm := range req.Items {
			if itm.ItemID == uuid.Nil {
				continue
			}
			reqSealed := itm.QtySentSealed
			if itm.QtyRequestedSealed != nil {
				reqSealed = *itm.QtyRequestedSealed
			}
			reqLoose := itm.QtySentLoose
			if itm.QtyRequestedLoose != nil {
				reqLoose = *itm.QtyRequestedLoose
			}

			lineItemID := uuid.New()
			_, err = tx.Exec(ctx, `
				INSERT INTO stock_transfer_items (
					id, transfer_id, item_id, qty_requested_sealed, qty_requested_loose,
					qty_sent_sealed, qty_sent_loose,
					qty_received_sealed, qty_received_loose, shrinkage_qty, allocation_notes, notes, created_at
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7, 0, 0, 0, $8, $9, NOW()
				)
			`, lineItemID, transferID, itm.ItemID, reqSealed, reqLoose, itm.QtySentSealed, itm.QtySentLoose, itm.AllocationNotes, itm.Notes)
			if err != nil {
				return nil, fmt.Errorf("failed to update transfer line item: %w", err)
			}
		}
	}

	// Transition: Draft / Pending Approval -> In Transit (Execute physical stock deduction & movements)
	if (currentStatus == "draft" || currentStatus == "pending_approval") && targetStatus == "in_transit" {
		rows, err := tx.Query(ctx, `
			SELECT ti.item_id, ti.qty_sent_sealed, ti.qty_sent_loose,
			       i.name, COALESCE(s.qty_sealed, 0), COALESCE(s.qty_loose, 0), COALESCE(i.standard_cost, 0)
			FROM stock_transfer_items ti
			JOIN items i ON ti.item_id = i.id
			LEFT JOIN item_stocks s ON i.id = s.item_id AND s.outlet_id = $2 AND s.held_by_user_id IS NULL
			WHERE ti.transfer_id = $1
		`, transferID, fromOutletID)
		if err != nil {
			return nil, fmt.Errorf("failed to query transfer items for stock dispatch: %w", err)
		}

		type dispatchItem struct {
			itemID       uuid.UUID
			sentSealed   float64
			sentLoose    float64
			itemName     string
			availSealed  float64
			availLoose   float64
			standardCost int64
		}
		var dispatchList []dispatchItem
		for rows.Next() {
			var di dispatchItem
			if err := rows.Scan(&di.itemID, &di.sentSealed, &di.sentLoose, &di.itemName, &di.availSealed, &di.availLoose, &di.standardCost); err == nil {
				dispatchList = append(dispatchList, di)
			}
		}
		rows.Close()

		for _, di := range dispatchList {
			if di.sentSealed > di.availSealed {
				return nil, fmt.Errorf("stok dus '%s' tidak cukup untuk dikirim (tersedia: %.2f, rencana: %.2f)", di.itemName, di.availSealed, di.sentSealed)
			}
			if di.sentLoose > di.availLoose {
				return nil, fmt.Errorf("stok eceran '%s' tidak cukup untuk dikirim (tersedia: %.2f, rencana: %.2f)", di.itemName, di.availLoose, di.sentLoose)
			}

			// Deduct from origin
			_, err = tx.Exec(ctx, `
				UPDATE item_stocks
				SET qty_sealed = qty_sealed - $1, qty_loose = qty_loose - $2, updated_at = NOW()
				WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
			`, di.sentSealed, di.sentLoose, di.itemID, fromOutletID)
			if err != nil {
				return nil, fmt.Errorf("gagal memotong stok origin untuk '%s': %w", di.itemName, err)
			}

			// Record outbound movement
			totalUnits := di.sentSealed + di.sentLoose
			_, err = tx.Exec(ctx, `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, from_outlet_id, to_location_type, to_outlet_id,
					package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
				) VALUES (
					$1, $2, $3, 'distribution_outbound', $4,
					'outlet', $5, 'transit', $6,
					'mixed', $7, $8, $9, $10, $11, NOW()
				)
			`, uuid.New(), businessID, di.itemID, transferID,
				fromOutletID, toOutletID,
				totalUnits, di.standardCost, int64(totalUnits*float64(di.standardCost)),
				senderID, fmt.Sprintf("Surat Jalan %s: Kirim %.2f dus & %.2f pcs '%s'", transferNo, di.sentSealed, di.sentLoose, di.itemName))
			if err != nil {
				return nil, fmt.Errorf("failed to record dispatch movement: %w", err)
			}
		}
	}

	// Backorder Handling: If create_backorder is requested and there are unfulfilled items
	var newBackorderStatus *string = req.BackorderStatus
	if req.CreateBackorder {
		type unfulfilledItem struct {
			itemID    uuid.UUID
			remSealed float64
			remLoose  float64
			notes     string
		}
		var unfulfilled []unfulfilledItem

		unfulfilledRows, err := tx.Query(ctx, `
			SELECT item_id,
			       GREATEST(0, COALESCE(qty_requested_sealed, qty_sent_sealed) - qty_sent_sealed),
			       GREATEST(0, COALESCE(qty_requested_loose, qty_sent_loose) - qty_sent_loose),
			       COALESCE(notes, '')
			FROM stock_transfer_items
			WHERE transfer_id = $1
			  AND (COALESCE(qty_requested_sealed, qty_sent_sealed) > qty_sent_sealed OR COALESCE(qty_requested_loose, qty_sent_loose) > qty_sent_loose)
		`, transferID)
		if err == nil {
			for unfulfilledRows.Next() {
				var uf unfulfilledItem
				if err := unfulfilledRows.Scan(&uf.itemID, &uf.remSealed, &uf.remLoose, &uf.notes); err == nil {
					if uf.remSealed > 0 || uf.remLoose > 0 {
						unfulfilled = append(unfulfilled, uf)
					}
				}
			}
			unfulfilledRows.Close()
		}

		if len(unfulfilled) > 0 {
			hasBackorder := "has_backorder"
			newBackorderStatus = &hasBackorder

			// Create Child Backorder Requisition Transfer
			childID := uuid.New()
			childTransferNo := s.GenerateTransferNo(ctx, businessID)
			childNotes := fmt.Sprintf("Backorder otomatis sisa kuota dari Surat Jalan %s", transferNo)

			_, err = tx.Exec(ctx, `
				INSERT INTO stock_transfers (
					id, transfer_no, business_id, from_outlet_id, to_outlet_id,
					sent_by_user_id, status, transfer_type, backorder_status, parent_transfer_id,
					notes, sent_at, created_at, updated_at
				) VALUES (
					$1, $2, $3, $4, $5,
					$6, 'pending_approval', 'requisition', 'is_backorder', $7,
					$8, NOW(), NOW(), NOW()
				)
			`, childID, childTransferNo, businessID, fromOutletID, toOutletID,
				senderID, transferID, childNotes)
			if err != nil {
				return nil, fmt.Errorf("failed to create child backorder transfer: %w", err)
			}

			for _, uf := range unfulfilled {
				childItemID := uuid.New()
				_, err = tx.Exec(ctx, `
					INSERT INTO stock_transfer_items (
						id, transfer_id, item_id, qty_requested_sealed, qty_requested_loose,
						qty_sent_sealed, qty_sent_loose,
						qty_received_sealed, qty_received_loose, shrinkage_qty, allocation_notes, notes, created_at
					) VALUES (
						$1, $2, $3, $4, $5, $4, $5, 0, 0, 0, 'Sisa kuota backorder', $6, NOW()
					)
				`, childItemID, childID, uf.itemID, uf.remSealed, uf.remLoose, uf.notes)
				if err != nil {
					return nil, fmt.Errorf("failed to insert backorder child line item: %w", err)
				}
			}
		}
	}

	// Transition: In Transit -> Cancelled (Restore deducted stock back to origin)
	if currentStatus == "in_transit" && targetStatus == "cancelled" {
		rows, err := tx.Query(ctx, `
			SELECT ti.item_id, ti.qty_sent_sealed, ti.qty_sent_loose, i.name, COALESCE(i.standard_cost, 0)
			FROM stock_transfer_items ti
			JOIN items i ON ti.item_id = i.id
			WHERE ti.transfer_id = $1
		`, transferID)
		if err != nil {
			return nil, fmt.Errorf("failed to query transfer items for cancellation: %w", err)
		}

		type restoreItem struct {
			itemID       uuid.UUID
			sentSealed   float64
			sentLoose    float64
			itemName     string
			standardCost int64
		}
		var restoreList []restoreItem
		for rows.Next() {
			var ri restoreItem
			if err := rows.Scan(&ri.itemID, &ri.sentSealed, &ri.sentLoose, &ri.itemName, &ri.standardCost); err == nil {
				restoreList = append(restoreList, ri)
			}
		}
		rows.Close()

		for _, ri := range restoreList {
			_, err = tx.Exec(ctx, `
				UPDATE item_stocks
				SET qty_sealed = qty_sealed + $1, qty_loose = qty_loose + $2, updated_at = NOW()
				WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
			`, ri.sentSealed, ri.sentLoose, ri.itemID, fromOutletID)
			if err != nil {
				return nil, fmt.Errorf("failed to restore stock for '%s': %w", ri.itemName, err)
			}

			// Record reversal stock movement
			totalUnits := ri.sentSealed + ri.sentLoose
			_, err = tx.Exec(ctx, `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, from_outlet_id, to_location_type, to_outlet_id,
					package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
				) VALUES (
					$1, $2, $3, 'transfer_reversal', $4,
					'transit', $5, 'outlet', $6,
					'mixed', $7, $8, $9, $10, $11, NOW()
				)
			`, uuid.New(), businessID, ri.itemID, transferID,
				toOutletID, fromOutletID,
				totalUnits, ri.standardCost, int64(totalUnits*float64(ri.standardCost)),
				senderID, fmt.Sprintf("Pembatalan Surat Jalan %s: Kembalikan %.2f dus & %.2f pcs '%s'", transferNo, ri.sentSealed, ri.sentLoose, ri.itemName))
			if err != nil {
				return nil, fmt.Errorf("failed to record reversal movement: %w", err)
			}
		}
	}

	// Update stock_transfers header fields
	_, err = tx.Exec(ctx, `
		UPDATE stock_transfers
		SET driver_name = COALESCE($1, driver_name),
		    driver_phone = COALESCE($2, driver_phone),
		    vehicle_plate = COALESCE($3, vehicle_plate),
		    carrier_type = COALESCE($4, carrier_type),
		    shipping_cost = COALESCE($5, shipping_cost),
		    shipping_cost_payer = COALESCE($6, shipping_cost_payer),
		    shipping_payment_method = COALESCE($7, shipping_payment_method),
		    tracking_ref_no = COALESCE($8, tracking_ref_no),
		    shipping_cost_mode = COALESCE($9, shipping_cost_mode),
		    max_claim_budget = COALESCE($10, max_claim_budget),
		    status = $11,
		    backorder_status = COALESCE($12, backorder_status),
		    notes = COALESCE($13, notes),
		    updated_at = NOW()
		WHERE id = $14 AND business_id = $15
	`, req.DriverName, req.DriverPhone, req.VehiclePlate, req.CarrierType,
		req.ShippingCost, req.ShippingCostPayer, req.ShippingPaymentMethod, req.TrackingRefNo,
		req.ShippingCostMode, req.MaxClaimBudget, targetStatus, newBackorderStatus, req.Notes,
		transferID, businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to update stock transfer: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit update transaction: %w", err)
	}

	// Fetch updated record with relations
	return s.GetTransferByID(ctx, businessID, transferID)
}

// CreateBulkDraftTransfer generates draft delivery transfers for multiple destination outlets
func (s *LogisticsService) CreateBulkDraftTransfer(ctx context.Context, businessID uuid.UUID, senderID uuid.UUID, req CreateBulkDraftRequest) ([]models.StockTransfer, error) {
	if len(req.DestinationOutletIDs) == 0 {
		return nil, errors.New("pilih setidaknya satu cabang tujuan")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("pilih setidaknya satu barang untuk draft distribusi")
	}

	var createdTransfers []models.StockTransfer

	for _, destID := range req.DestinationOutletIDs {
		createReq := CreateTransferRequest{
			ToOutletID:   &destID,
			TransferType: req.TransferType,
			Status:       "draft",
			Notes:        req.Notes,
			Items:        req.Items,
		}
		if createReq.TransferType == "" {
			createReq.TransferType = "outbound"
		}

		tr, err := s.CreateTransfer(ctx, businessID, senderID, createReq)
		if err != nil {
			return nil, fmt.Errorf("gagal membuat draft untuk cabang %s: %w", destID, err)
		}
		createdTransfers = append(createdTransfers, *tr)
	}

	return createdTransfers, nil
}

// UnboxOrThawItem performs universal unboxing/thawing (converts sealed pack/box to loose pieces)
func (s *LogisticsService) UnboxOrThawItem(ctx context.Context, businessID uuid.UUID, userID uuid.UUID, req UnboxRequest) error {
	if req.ItemID == uuid.Nil {
		return errors.New("item_id is required")
	}
	if req.QtyBoxes <= 0 {
		return errors.New("qty_boxes must be greater than 0")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	targetOutletID := uuid.Nil
	if req.OutletID != nil && *req.OutletID != uuid.Nil {
		targetOutletID = *req.OutletID
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM outlets WHERE business_id = $1 ORDER BY created_at ASC LIMIT 1`, businessID).Scan(&targetOutletID)
		if err != nil {
			return errors.New("no outlet found for unboxing operation")
		}
	}

	var itemName, baseUnit, boxUnit string
	var conversionRate float64 = 1.0
	var standardCost int64 = 0
	var availSealed float64 = 0

	err = tx.QueryRow(ctx, `
		SELECT i.name, i.base_unit, COALESCE(i.box_unit, 'dus'), COALESCE(i.conversion_rate, 1.0), COALESCE(i.standard_cost, 0),
		       COALESCE(s.qty_sealed, 0)
		FROM items i
		LEFT JOIN item_stocks s ON i.id = s.item_id AND s.outlet_id = $2 AND s.held_by_user_id IS NULL
		WHERE i.id = $1 AND i.business_id = $3
	`, req.ItemID, targetOutletID, businessID).Scan(
		&itemName, &baseUnit, &boxUnit, &conversionRate, &standardCost, &availSealed,
	)
	if err != nil {
		return fmt.Errorf("item tidak ditemukan: %w", err)
	}

	if conversionRate <= 0 {
		conversionRate = 1.0
	}

	if availSealed < req.QtyBoxes {
		return fmt.Errorf("stok %s '%s' tidak mencukupi (tersedia: %.2f, diminta buka: %.2f)", boxUnit, itemName, availSealed, req.QtyBoxes)
	}

	grossLoose := req.QtyBoxes * conversionRate
	netLoose := grossLoose - req.ShrinkageLoose
	if netLoose < 0 {
		netLoose = 0
	}

	// Update item_stocks: Deduct sealed boxes and add net loose pieces
	_, err = tx.Exec(ctx, `
		UPDATE item_stocks
		SET qty_sealed = qty_sealed - $1, qty_loose = qty_loose + $2, updated_at = NOW()
		WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL
	`, req.QtyBoxes, netLoose, req.ItemID, targetOutletID)
	if err != nil {
		return fmt.Errorf("failed to update item stock: %w", err)
	}

	// Record unboxing in append-only stock_movements ledger
	docID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO stock_movements (
			id, business_id, item_id, source_document_type, source_document_id,
			from_location_type, from_outlet_id, to_location_type, to_outlet_id,
			package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
		) VALUES (
			$1, $2, $3, 'unboxing_thaw', $4,
			'outlet', $5, 'outlet', $5,
			'loose', $6, $7, $8, $9, $10, NOW()
		)
	`, docID, businessID, req.ItemID, docID,
		targetOutletID, netLoose, standardCost, int64(netLoose*float64(standardCost)),
		userID, fmt.Sprintf("Pecah Kemasan/Thaw: Buka %.2f %s -> Jadi %.2f %s '%s'", req.QtyBoxes, boxUnit, netLoose, baseUnit, itemName))
	if err != nil {
		return fmt.Errorf("failed to record stock movement: %w", err)
	}

	// If there is shrinkage/loss (e.g. purge water loss during thaw)
	if req.ShrinkageLoose > 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO stock_movements (
				id, business_id, item_id, source_document_type, source_document_id,
				from_location_type, to_location_type, to_outlet_id,
				package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
			) VALUES (
				$1, $2, $3, 'thawing_shrinkage', $4,
				'outlet', 'scrap_shrinkage', $5,
				'loose', $6, $7, $8, $9, $10, NOW()
			)
		`, uuid.New(), businessID, req.ItemID, docID,
			targetOutletID, req.ShrinkageLoose, standardCost, int64(req.ShrinkageLoose*float64(standardCost)),
			userID, fmt.Sprintf("Susut Pencairan/Thaw: %.2f %s '%s'", req.ShrinkageLoose, baseUnit, itemName))
		if err != nil {
			return fmt.Errorf("failed to record thaw shrinkage movement: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// GetTransferByClaimToken retrieves public transfer summary for driver guest claim portal
func (s *LogisticsService) GetTransferByClaimToken(ctx context.Context, token string) (*PublicClaimInfo, error) {
	if token == "" {
		return nil, errors.New("claim token is required")
	}

	query := `
		SELECT t.id, t.transfer_no, COALESCE(b.name, 'ANDAYA GROUP'),
		       COALESCE(fo.name, 'Gudang Pusat'), COALESCE(to_out.name, 'Cabang Tujuan'),
		       COALESCE(t.driver_name, ''), COALESCE(t.vehicle_plate, ''),
		       COALESCE(t.max_claim_budget, 0), COALESCE(t.claim_status, 'none'),
		       COALESCE(t.claimed_amount, 0), t.claimed_notes, t.claimed_attachment_url,
		       t.claimed_at, t.claim_rejection_reason, t.sent_at
		FROM stock_transfers t
		JOIN businesses b ON t.business_id = b.id
		LEFT JOIN outlets fo ON t.from_outlet_id = fo.id
		LEFT JOIN outlets to_out ON t.to_outlet_id = to_out.id
		WHERE t.claim_token = $1
	`

	var info PublicClaimInfo
	err := s.DB.QueryRow(ctx, query, token).Scan(
		&info.TransferID, &info.TransferNo, &info.BusinessName,
		&info.FromOutletName, &info.ToOutletName,
		&info.DriverName, &info.VehiclePlate,
		&info.MaxClaimBudget, &info.ClaimStatus,
		&info.ClaimedAmount, &info.ClaimedNotes, &info.ClaimedAttachmentURL,
		&info.ClaimedAt, &info.ClaimRejectionReason, &info.SentAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("surat jalan / token klaim tidak valid atau tidak ditemukan")
		}
		return nil, err
	}

	return &info, nil
}

// SubmitDriverClaim processes driver submission from public guest portal
func (s *LogisticsService) SubmitDriverClaim(ctx context.Context, token string, req SubmitDriverClaimRequest) (*PublicClaimInfo, error) {
	if token == "" {
		return nil, errors.New("claim token is required")
	}
	if req.ClaimedAmount <= 0 {
		return nil, errors.New("nominal biaya yang diajukan harus lebih dari 0")
	}

	// Verify token exists and current status
	var (
		transferID uuid.UUID
		currStatus string
	)
	err := s.DB.QueryRow(ctx, `
		SELECT id, COALESCE(claim_status, 'none')
		FROM stock_transfers
		WHERE claim_token = $1
	`, token).Scan(&transferID, &currStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("token klaim tidak valid")
		}
		return nil, err
	}

	if currStatus == "approved" {
		return nil, errors.New("klaim untuk surat jalan ini sudah disetujui sebelumnya")
	}

	// Update claim submission details
	_, err = s.DB.Exec(ctx, `
		UPDATE stock_transfers
		SET claim_status = 'pending',
		    claimed_amount = $1,
		    claimed_notes = $2,
		    claimed_attachment_url = $3,
		    claimed_at = NOW(),
		    claim_rejection_reason = NULL,
		    updated_at = NOW()
		WHERE id = $4
	`, req.ClaimedAmount, req.ClaimedNotes, req.ClaimedAttachmentURL, transferID)
	if err != nil {
		return nil, fmt.Errorf("gagal menyimpan pengajuan klaim biaya: %w", err)
	}

	return s.GetTransferByClaimToken(ctx, token)
}

// ApproveClaim allows manager to approve driver claim and record it to shipping_cost
func (s *LogisticsService) ApproveClaim(ctx context.Context, businessID uuid.UUID, transferID uuid.UUID, reviewerID uuid.UUID) error {
	var claimedAmount int64
	var claimStatus string

	err := s.DB.QueryRow(ctx, `
		SELECT COALESCE(claimed_amount, 0), COALESCE(claim_status, 'none')
		FROM stock_transfers
		WHERE id = $1 AND business_id = $2
	`, transferID, businessID).Scan(&claimedAmount, &claimStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("surat jalan tidak ditemukan")
		}
		return err
	}

	if claimedAmount <= 0 {
		return errors.New("tidak ada nominal klaim yang diajukan oleh kurir")
	}

	_, err = s.DB.Exec(ctx, `
		UPDATE stock_transfers
		SET claim_status = 'approved',
		    shipping_cost = claimed_amount,
		    claim_reviewed_by = $1,
		    claim_reviewed_at = NOW(),
		    claim_rejection_reason = NULL,
		    updated_at = NOW()
		WHERE id = $2 AND business_id = $3
	`, reviewerID, transferID, businessID)
	if err != nil {
		return fmt.Errorf("failed to approve claim: %w", err)
	}

	return nil
}

// RejectClaim allows manager to reject driver claim with reason
func (s *LogisticsService) RejectClaim(ctx context.Context, businessID uuid.UUID, transferID uuid.UUID, reviewerID uuid.UUID, reason string) error {
	if reason == "" {
		return errors.New("alasan penolakan klaim wajib diisi")
	}

	_, err := s.DB.Exec(ctx, `
		UPDATE stock_transfers
		SET claim_status = 'rejected',
		    claim_rejection_reason = $1,
		    claim_reviewed_by = $2,
		    claim_reviewed_at = NOW(),
		    updated_at = NOW()
		WHERE id = $3 AND business_id = $4
	`, reason, reviewerID, transferID, businessID)
	if err != nil {
		return fmt.Errorf("failed to reject claim: %w", err)
	}

	return nil
}

// DeleteDraftTransfer deletes a draft delivery transfer and its line items
func (s *LogisticsService) DeleteDraftTransfer(ctx context.Context, businessID uuid.UUID, transferID uuid.UUID) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start database transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var status string
	err = tx.QueryRow(ctx, `
		SELECT status
		FROM stock_transfers
		WHERE id = $1 AND business_id = $2
	`, transferID, businessID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("surat jalan / draf tidak ditemukan")
		}
		return err
	}

	if status != "draft" && status != "pending_approval" {
		return fmt.Errorf("hanya surat jalan berstatus draf atau menunggu konfirmasi yang dapat dihapus (status saat ini: %s)", status)
	}

	// Delete line items
	_, err = tx.Exec(ctx, `DELETE FROM stock_transfer_items WHERE transfer_id = $1`, transferID)
	if err != nil {
		return fmt.Errorf("failed to delete transfer items: %w", err)
	}

	// Delete header
	_, err = tx.Exec(ctx, `DELETE FROM stock_transfers WHERE id = $1 AND business_id = $2`, transferID, businessID)
	if err != nil {
		return fmt.Errorf("failed to delete stock transfer: %w", err)
	}

	return tx.Commit(ctx)
}

// CancelTransfer cancels an active transfer. If in_transit, it restores stock to origin.
func (s *LogisticsService) CancelTransfer(ctx context.Context, businessID uuid.UUID, userID uuid.UUID, transferID uuid.UUID, reason string) (*models.StockTransfer, error) {
	statusCancelled := "cancelled"
	req := UpdateTransferRequest{
		Status: &statusCancelled,
	}
	if reason != "" {
		req.Notes = &reason
	}
	return s.UpdateTransfer(ctx, businessID, transferID, req)
}

// GetSuggestedReorder calculates replenishment suggestions based on current stock, minimum stock levels, and historical consumption velocity
func (s *LogisticsService) GetSuggestedReorder(ctx context.Context, businessID uuid.UUID, outletID uuid.UUID) ([]ReorderSuggestion, error) {
	// 1. Fetch consumption velocity over past 14 days
	velocityMap := make(map[uuid.UUID]float64)
	velRows, err := s.DB.Query(ctx, `
		SELECT item_id, COALESCE(SUM(qty), 0) / 14.0 as daily_velocity
		FROM stock_movements
		WHERE business_id = $1 AND from_outlet_id = $2
		  AND created_at >= NOW() - INTERVAL '14 days'
		  AND source_document_type IN ('pos_sale', 'production_usage', 'unboxing_thaw', 'distribution_outbound')
		GROUP BY item_id
	`, businessID, outletID)
	if err == nil {
		defer velRows.Close()
		for velRows.Next() {
			var iID uuid.UUID
			var vel float64
			if err := velRows.Scan(&iID, &vel); err == nil {
				velocityMap[iID] = vel
			}
		}
	}

	// 2. Query all active items with their current stock in target outlet
	rows, err := s.DB.Query(ctx, `
		SELECT i.id, i.name, COALESCE(i.sku, ''), i.base_unit, COALESCE(i.box_unit, 'dus'),
		       COALESCE(i.conversion_rate, 1.0), COALESCE(i.min_stock, 0),
		       COALESCE(s.qty_sealed, 0), COALESCE(s.qty_loose, 0)
		FROM items i
		LEFT JOIN item_stocks s ON i.id = s.item_id AND s.outlet_id = $1 AND s.held_by_user_id IS NULL
		WHERE i.business_id = $2 AND i.is_active = true
		ORDER BY i.name ASC
	`, outletID, businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to query item stocks for reorder calculation: %w", err)
	}
	defer rows.Close()

	var suggestions []ReorderSuggestion
	for rows.Next() {
		var sug ReorderSuggestion
		err := rows.Scan(
			&sug.ItemID, &sug.ItemName, &sug.ItemSKU, &sug.BaseUnit, &sug.BoxUnit,
			&sug.ConversionRate, &sug.MinStock,
			&sug.CurrentSealed, &sug.CurrentLoose,
		)
		if err != nil {
			continue
		}

		convRate := sug.ConversionRate
		if convRate <= 0 {
			convRate = 1.0
		}
		sug.ConversionRate = convRate

		dailyVel := velocityMap[sug.ItemID]
		sug.DailyVelocity = math.Round(dailyVel*100) / 100

		totalCurrentLoose := (sug.CurrentSealed * convRate) + sug.CurrentLoose

		// Target buffer: At least 2x min_stock, or 7 days of daily consumption
		targetBuffer := sug.MinStock * 2.0
		if velTarget := dailyVel * 7.0; velTarget > targetBuffer {
			targetBuffer = velTarget
		}
		if targetBuffer < sug.MinStock {
			targetBuffer = sug.MinStock
		}

		deficitLoose := targetBuffer - totalCurrentLoose

		if totalCurrentLoose < sug.MinStock {
			sug.UrgencyLevel = "critical"
			sug.Reason = fmt.Sprintf("Stok saat ini (%.0f %s) di bawah batas aman minimum (%.0f %s)", totalCurrentLoose, sug.BaseUnit, sug.MinStock, sug.BaseUnit)
		} else if deficitLoose > 0 {
			sug.UrgencyLevel = "warning"
			sug.Reason = fmt.Sprintf("Kebutuhan pengisian buffer operasional 7 hari (rata-rata pemakaian %.1f %s/hari)", dailyVel, sug.BaseUnit)
		} else {
			sug.UrgencyLevel = "optimal"
			sug.Reason = "Stok dalam batas optimal & mencukupi"
		}

		if deficitLoose > 0 {
			if convRate > 1.0 {
				sug.SuggestedSealed = math.Floor(deficitLoose / convRate)
				sug.SuggestedLoose = math.Mod(deficitLoose, convRate)
				// If fractional is more than half a box, round up to 1 box
				if sug.SuggestedSealed == 0 && sug.SuggestedLoose >= convRate*0.5 {
					sug.SuggestedSealed = 1
					sug.SuggestedLoose = 0
				}
			} else {
				sug.SuggestedSealed = 0
				sug.SuggestedLoose = math.Ceil(deficitLoose)
			}
		}

		suggestions = append(suggestions, sug)
	}

	return suggestions, nil
}
