package purchases

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"andaya-erp/backend/internal/models"
)

type PurchasesService struct {
	DB *pgxpool.Pool
}

func NewPurchasesService(db *pgxpool.Pool) *PurchasesService {
	return &PurchasesService{DB: db}
}

// Request & Payload DTOs

type CreateSupplierRequest struct {
	Name             string  `json:"name"`
	ContactPerson    *string `json:"contact_person,omitempty"`
	Phone            *string `json:"phone,omitempty"`
	Email            *string `json:"email,omitempty"`
	Address          *string `json:"address,omitempty"`
	PaymentTermsDays int     `json:"payment_terms_days"`
	Status           string  `json:"status"`
}

type UpdateSupplierRequest struct {
	Name             string  `json:"name"`
	ContactPerson    *string `json:"contact_person,omitempty"`
	Phone            *string `json:"phone,omitempty"`
	Email            *string `json:"email,omitempty"`
	Address          *string `json:"address,omitempty"`
	PaymentTermsDays int     `json:"payment_terms_days"`
	Status           string  `json:"status"`
}

type PurchaseItemInput struct {
	ItemID         uuid.UUID `json:"item_id"`
	UOM            string    `json:"uom"` // box, base
	QtyOrdered     float64   `json:"qty_ordered"`
	QtyReceived    *float64  `json:"qty_received,omitempty"`
	ConversionRate float64   `json:"conversion_rate"`
	UnitCost       int64     `json:"unit_cost"`
	DiscountAmount int64     `json:"discount_amount"`
	Notes          *string   `json:"notes,omitempty"`
}

type CreatePurchaseRequest struct {
	OutletID       uuid.UUID           `json:"outlet_id"`
	PONumber       *string             `json:"po_number,omitempty"`
	InvoiceNo      *string             `json:"invoice_no,omitempty"`
	SupplierID     *uuid.UUID          `json:"supplier_id,omitempty"`
	SupplierName   string              `json:"supplier_name"`
	Status         string              `json:"status"` // draft, submitted, received
	PaymentStatus  string              `json:"payment_status"` // unpaid, partial, paid
	PaymentMethod  string              `json:"payment_method"` // cash, bank_transfer, credit, qris
	OrderDate      *string             `json:"order_date,omitempty"`
	DueDate        *string             `json:"due_date,omitempty"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	DiscountAmount int64               `json:"discount_amount"`
	TaxAmount      int64               `json:"tax_amount"`
	ShippingCost   int64               `json:"shipping_cost"`
	TotalAmount    int64               `json:"total_amount"`
	AmountPaid     int64               `json:"amount_paid"`
	Notes          *string             `json:"notes,omitempty"`
	Items          []PurchaseItemInput `json:"items"`
}

type UpdatePurchaseRequest struct {
	InvoiceNo      *string             `json:"invoice_no,omitempty"`
	SupplierID     *uuid.UUID          `json:"supplier_id,omitempty"`
	SupplierName   string              `json:"supplier_name"`
	Status         string              `json:"status"`
	PaymentStatus  string              `json:"payment_status"`
	PaymentMethod  string              `json:"payment_method"`
	DueDate        *string             `json:"due_date,omitempty"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	DiscountAmount int64               `json:"discount_amount"`
	TaxAmount      int64               `json:"tax_amount"`
	ShippingCost   int64               `json:"shipping_cost"`
	TotalAmount    int64               `json:"total_amount"`
	AmountPaid     int64               `json:"amount_paid"`
	Notes          *string             `json:"notes,omitempty"`
	Items          []PurchaseItemInput `json:"items"`
}

type ReceivePurchaseRequest struct {
	ReceivedAt *time.Time                `json:"received_at,omitempty"`
	Notes      *string                   `json:"notes,omitempty"`
	Items      []PurchaseItemReceiveInput `json:"items,omitempty"`
}

type PurchaseItemReceiveInput struct {
	ItemID      uuid.UUID `json:"item_id"`
	QtyReceived float64   `json:"qty_received"`
	UnitCost    *int64    `json:"unit_cost,omitempty"`
}

type AddPaymentRequest struct {
	PaymentDate   *string `json:"payment_date,omitempty"`
	AmountPaid    int64   `json:"amount_paid"`
	PaymentMethod string  `json:"payment_method"`
	ReferenceNo   *string `json:"reference_no,omitempty"`
	Notes         *string `json:"notes,omitempty"`
}

// -------------------------------------------------------------------------
// SUPPLIER OPERATIONS
// -------------------------------------------------------------------------

func (s *PurchasesService) GetSuppliers(ctx context.Context, businessID uuid.UUID, status string) ([]models.Supplier, error) {
	query := `
		SELECT id, business_id, name, contact_person, phone, email, address, payment_terms_days, status, created_at, updated_at
		FROM suppliers
		WHERE business_id = $1
	`
	args := []interface{}{businessID}
	if status != "" && status != "all" {
		query += " AND status = $2"
		args = append(args, status)
	}
	query += " ORDER BY name ASC"

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query suppliers: %w", err)
	}
	defer rows.Close()

	var suppliers []models.Supplier
	for rows.Next() {
		var sup models.Supplier
		if err := rows.Scan(
			&sup.ID, &sup.BusinessID, &sup.Name, &sup.ContactPerson, &sup.Phone,
			&sup.Email, &sup.Address, &sup.PaymentTermsDays, &sup.Status,
			&sup.CreatedAt, &sup.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan supplier: %w", err)
		}
		suppliers = append(suppliers, sup)
	}

	if suppliers == nil {
		suppliers = []models.Supplier{}
	}
	return suppliers, nil
}

func (s *PurchasesService) CreateSupplier(ctx context.Context, businessID uuid.UUID, req CreateSupplierRequest) (*models.Supplier, error) {
	if req.Name == "" {
		return nil, errors.New("nama supplier wajib diisi")
	}
	status := "active"
	if req.Status != "" {
		status = req.Status
	}

	var sup models.Supplier
	query := `
		INSERT INTO suppliers (business_id, name, contact_person, phone, email, address, payment_terms_days, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, business_id, name, contact_person, phone, email, address, payment_terms_days, status, created_at, updated_at
	`
	err := s.DB.QueryRow(ctx, query,
		businessID, req.Name, req.ContactPerson, req.Phone, req.Email, req.Address, req.PaymentTermsDays, status,
	).Scan(
		&sup.ID, &sup.BusinessID, &sup.Name, &sup.ContactPerson, &sup.Phone,
		&sup.Email, &sup.Address, &sup.PaymentTermsDays, &sup.Status,
		&sup.CreatedAt, &sup.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create supplier: %w", err)
	}
	return &sup, nil
}

func (s *PurchasesService) UpdateSupplier(ctx context.Context, businessID, id uuid.UUID, req UpdateSupplierRequest) (*models.Supplier, error) {
	if req.Name == "" {
		return nil, errors.New("nama supplier wajib diisi")
	}
	status := "active"
	if req.Status != "" {
		status = req.Status
	}

	var sup models.Supplier
	query := `
		UPDATE suppliers
		SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5, payment_terms_days = $6, status = $7, updated_at = NOW()
		WHERE id = $8 AND business_id = $9
		RETURNING id, business_id, name, contact_person, phone, email, address, payment_terms_days, status, created_at, updated_at
	`
	err := s.DB.QueryRow(ctx, query,
		req.Name, req.ContactPerson, req.Phone, req.Email, req.Address, req.PaymentTermsDays, status, id, businessID,
	).Scan(
		&sup.ID, &sup.BusinessID, &sup.Name, &sup.ContactPerson, &sup.Phone,
		&sup.Email, &sup.Address, &sup.PaymentTermsDays, &sup.Status,
		&sup.CreatedAt, &sup.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update supplier: %w", err)
	}
	return &sup, nil
}

func (s *PurchasesService) DeleteSupplier(ctx context.Context, businessID, id uuid.UUID) error {
	tag, err := s.DB.Exec(ctx, "DELETE FROM suppliers WHERE id = $1 AND business_id = $2", id, businessID)
	if err != nil {
		return fmt.Errorf("failed to delete supplier: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("supplier tidak ditemukan")
	}
	return nil
}

type PurchasableItemResponse struct {
	models.Item
	CategoryName *string `json:"category_name,omitempty"`
}

// -------------------------------------------------------------------------
// PURCHASABLE ITEMS CHECK (2-LAYER GOVERNANCE)
// -------------------------------------------------------------------------

func (s *PurchasesService) GetPurchasableItems(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID) ([]PurchasableItemResponse, error) {
	isMain := true
	allowDirect := true

	if outletID != nil && *outletID != uuid.Nil {
		err := s.DB.QueryRow(ctx, "SELECT is_main, allow_direct_purchase FROM outlets WHERE id = $1 AND business_id = $2", *outletID, businessID).Scan(&isMain, &allowDirect)
		if err == nil {
			if !isMain && !allowDirect {
				return nil, errors.New("outlet ini tidak diizinkan melakukan pengadaan mandiri (100% pasokan pusat)")
			}
		}
	}

	query := `
		SELECT i.id, i.business_id, i.category_id, i.sku, i.name, i.item_type,
		       i.is_sellable, i.is_inventory_tracked, COALESCE(i.is_produced, FALSE), COALESCE(i.is_purchasable, TRUE),
		       COALESCE(i.is_thawable, i.requires_thaw, FALSE), COALESCE(i.requires_thaw, FALSE), COALESCE(i.allow_branch_purchase, TRUE),
		       i.base_unit, i.box_unit, i.conversion_rate, COALESCE(i.price_unit, 'base'),
		       i.sell_price, i.box_sell_price, i.standard_cost, COALESCE(i.min_stock_alert, 5.0),
		       i.image_url, i.status, i.created_at, i.updated_at, c.name AS category_name
		FROM items i
		LEFT JOIN categories c ON i.category_id = c.id
		WHERE i.business_id = $1 AND i.status = 'active' AND COALESCE(i.is_purchasable, TRUE) = TRUE
	`
	if !isMain {
		// Non-main branches only see items where allow_branch_purchase is TRUE
		query += " AND COALESCE(i.allow_branch_purchase, TRUE) = TRUE"
	}
	query += " ORDER BY i.name ASC"

	rows, err := s.DB.Query(ctx, query, businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to query purchasable items: %w", err)
	}
	defer rows.Close()

	var itemsList []PurchasableItemResponse
	for rows.Next() {
		var it PurchasableItemResponse
		if err := rows.Scan(
			&it.ID, &it.BusinessID, &it.CategoryID, &it.SKU, &it.Name, &it.ItemType,
			&it.IsSellable, &it.IsInventoryTracked, &it.IsProduced, &it.IsPurchasable,
			&it.IsThawable, &it.RequiresThaw, &it.AllowBranchPurchase,
			&it.BaseUnit, &it.BoxUnit, &it.ConversionRate, &it.PriceUnit,
			&it.SellPrice, &it.BoxSellPrice, &it.StandardCost, &it.MinStockAlert,
			&it.ImageURL, &it.Status, &it.CreatedAt, &it.UpdatedAt, &it.CategoryName,
		); err != nil {
			return nil, fmt.Errorf("failed to scan item: %w", err)
		}
		itemsList = append(itemsList, it)
	}
	if itemsList == nil {
		itemsList = []PurchasableItemResponse{}
	}
	return itemsList, nil
}

// -------------------------------------------------------------------------
// PURCHASE OPERATIONS (PO & DIRECT PURCHASE)
// -------------------------------------------------------------------------

func (s *PurchasesService) generatePONumber(ctx context.Context, businessID uuid.UUID) (string, error) {
	todayStr := time.Now().Format("20060102")
	var count int
	err := s.DB.QueryRow(ctx, "SELECT COUNT(*) FROM purchases WHERE business_id = $1 AND po_number LIKE $2", businessID, "PO-"+todayStr+"-%").Scan(&count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("PO-%s-%04d", todayStr, count+1), nil
}

func (s *PurchasesService) GetPurchases(ctx context.Context, businessID uuid.UUID, outletID *uuid.UUID, status, paymentStatus, search string) ([]models.Purchase, error) {
	query := `
		SELECT p.id, p.business_id, p.outlet_id, COALESCE(o.name, '') as outlet_name,
		       p.po_number, p.invoice_no, p.supplier_id, p.supplier_name,
		       p.status, p.payment_status, p.payment_method,
		       TO_CHAR(p.order_date, 'YYYY-MM-DD') as order_date,
		       TO_CHAR(p.due_date, 'YYYY-MM-DD') as due_date,
		       p.received_at, p.subtotal_amount, p.discount_amount, p.tax_amount,
		       p.shipping_cost, p.total_amount, p.amount_paid, p.amount_owed,
		       p.notes, p.created_by, COALESCE(u1.name, '') as created_by_name,
		       p.received_by, COALESCE(u2.name, '') as received_by_name,
		       p.created_at, p.updated_at
		FROM purchases p
		JOIN outlets o ON p.outlet_id = o.id
		LEFT JOIN users u1 ON p.created_by = u1.id
		LEFT JOIN users u2 ON p.received_by = u2.id
		WHERE p.business_id = $1
	`
	args := []interface{}{businessID}
	paramIdx := 2

	if outletID != nil {
		query += fmt.Sprintf(" AND p.outlet_id = $%d", paramIdx)
		args = append(args, *outletID)
		paramIdx++
	}
	if status != "" && status != "all" {
		query += fmt.Sprintf(" AND p.status = $%d", paramIdx)
		args = append(args, status)
		paramIdx++
	}
	if paymentStatus != "" && paymentStatus != "all" {
		query += fmt.Sprintf(" AND p.payment_status = $%d", paramIdx)
		args = append(args, paymentStatus)
		paramIdx++
	}
	if search != "" {
		query += fmt.Sprintf(" AND (p.po_number ILIKE $%d OR p.invoice_no ILIKE $%d OR p.supplier_name ILIKE $%d)", paramIdx, paramIdx, paramIdx)
		args = append(args, "%"+search+"%")
		paramIdx++
	}

	query += " ORDER BY p.created_at DESC"

	rows, err := s.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query purchases: %w", err)
	}
	defer rows.Close()

	var purchases []models.Purchase
	for rows.Next() {
		var p models.Purchase
		if err := rows.Scan(
			&p.ID, &p.BusinessID, &p.OutletID, &p.OutletName,
			&p.PONumber, &p.InvoiceNo, &p.SupplierID, &p.SupplierName,
			&p.Status, &p.PaymentStatus, &p.PaymentMethod,
			&p.OrderDate, &p.DueDate, &p.ReceivedAt,
			&p.SubtotalAmount, &p.DiscountAmount, &p.TaxAmount,
			&p.ShippingCost, &p.TotalAmount, &p.AmountPaid, &p.AmountOwed,
			&p.Notes, &p.CreatedBy, &p.CreatedByName,
			&p.ReceivedBy, &p.ReceivedByName,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan purchase: %w", err)
		}
		purchases = append(purchases, p)
	}
	if purchases == nil {
		purchases = []models.Purchase{}
	}
	return purchases, nil
}

func (s *PurchasesService) GetPurchaseByID(ctx context.Context, businessID, id uuid.UUID) (*models.Purchase, error) {
	query := `
		SELECT p.id, p.business_id, p.outlet_id, COALESCE(o.name, '') as outlet_name,
		       p.po_number, p.invoice_no, p.supplier_id, p.supplier_name,
		       p.status, p.payment_status, p.payment_method,
		       TO_CHAR(p.order_date, 'YYYY-MM-DD') as order_date,
		       TO_CHAR(p.due_date, 'YYYY-MM-DD') as due_date,
		       p.received_at, p.subtotal_amount, p.discount_amount, p.tax_amount,
		       p.shipping_cost, p.total_amount, p.amount_paid, p.amount_owed,
		       p.notes, p.created_by, COALESCE(u1.name, '') as created_by_name,
		       p.received_by, COALESCE(u2.name, '') as received_by_name,
		       p.created_at, p.updated_at
		FROM purchases p
		JOIN outlets o ON p.outlet_id = o.id
		LEFT JOIN users u1 ON p.created_by = u1.id
		LEFT JOIN users u2 ON p.received_by = u2.id
		WHERE p.id = $1 AND p.business_id = $2
	`
	var p models.Purchase
	err := s.DB.QueryRow(ctx, query, id, businessID).Scan(
		&p.ID, &p.BusinessID, &p.OutletID, &p.OutletName,
		&p.PONumber, &p.InvoiceNo, &p.SupplierID, &p.SupplierName,
		&p.Status, &p.PaymentStatus, &p.PaymentMethod,
		&p.OrderDate, &p.DueDate, &p.ReceivedAt,
		&p.SubtotalAmount, &p.DiscountAmount, &p.TaxAmount,
		&p.ShippingCost, &p.TotalAmount, &p.AmountPaid, &p.AmountOwed,
		&p.Notes, &p.CreatedBy, &p.CreatedByName,
		&p.ReceivedBy, &p.ReceivedByName,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("faktur pembelian tidak ditemukan: %w", err)
	}

	// Fetch items
	itemsQuery := `
		SELECT pi.id, pi.purchase_id, pi.item_id, COALESCE(i.name, '') as item_name,
		       COALESCE(i.sku, '') as item_sku, COALESCE(i.item_type, 'finished_good') as item_type,
		       COALESCE(i.base_unit, 'pcs') as base_unit, COALESCE(i.box_unit, 'box') as box_unit,
		       pi.uom, pi.qty_ordered, pi.qty_received, pi.conversion_rate,
		       pi.unit_cost, pi.discount_amount, pi.subtotal, pi.notes, pi.created_at
		FROM purchase_items pi
		JOIN items i ON pi.item_id = i.id
		WHERE pi.purchase_id = $1
		ORDER BY pi.created_at ASC
	`
	rows, err := s.DB.Query(ctx, itemsQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to query purchase items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var it models.PurchaseItem
		if err := rows.Scan(
			&it.ID, &it.PurchaseID, &it.ItemID, &it.ItemName,
			&it.ItemSKU, &it.ItemType, &it.BaseUnit, &it.BoxUnit,
			&it.UOM, &it.QtyOrdered, &it.QtyReceived, &it.ConversionRate,
			&it.UnitCost, &it.DiscountAmount, &it.Subtotal, &it.Notes, &it.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan purchase item: %w", err)
		}
		p.Items = append(p.Items, it)
	}
	if p.Items == nil {
		p.Items = []models.PurchaseItem{}
	}

	return &p, nil
}

func (s *PurchasesService) CreatePurchase(ctx context.Context, businessID uuid.UUID, defaultOutletID uuid.UUID, userID uuid.UUID, userRole string, req CreatePurchaseRequest) (*models.Purchase, error) {
	if len(req.Items) == 0 {
		return nil, errors.New("daftar barang pembelian tidak boleh kosong")
	}
	if req.SupplierName == "" {
		return nil, errors.New("nama supplier wajib diisi")
	}

	targetOutletID := req.OutletID
	if targetOutletID == uuid.Nil {
		targetOutletID = defaultOutletID
	}
	if targetOutletID == uuid.Nil {
		_ = s.DB.QueryRow(ctx, "SELECT id FROM outlets WHERE business_id = $1 ORDER BY is_main DESC, created_at ASC LIMIT 1", businessID).Scan(&targetOutletID)
	}
	if targetOutletID == uuid.Nil {
		return nil, errors.New("outlet tujuan pengadaan wajib ditentukan")
	}

	// 1. Verify outlet existence & direct purchase permission
	var isMain, allowDirect bool
	err := s.DB.QueryRow(ctx, "SELECT is_main, allow_direct_purchase FROM outlets WHERE id = $1 AND business_id = $2", targetOutletID, businessID).Scan(&isMain, &allowDirect)
	if err != nil {
		return nil, fmt.Errorf("outlet tidak ditemukan: %w", err)
	}

	if !isMain && !allowDirect && userRole != "owner" && userRole != "superadmin" {
		return nil, errors.New("outlet ini tidak diizinkan melakukan pengadaan mandiri")
	}

	// 2. Verify all items and check branch purchase restrictions
	for _, it := range req.Items {
		var itAllowBranch, isPurchasable bool
		var itName string
		err := s.DB.QueryRow(ctx, "SELECT name, is_purchasable, allow_branch_purchase FROM items WHERE id = $1 AND business_id = $2", it.ItemID, businessID).Scan(&itName, &isPurchasable, &itAllowBranch)
		if err != nil {
			return nil, fmt.Errorf("item ID %s tidak valid", it.ItemID)
		}
		if !isPurchasable {
			return nil, fmt.Errorf("item '%s' tidak dapat dibeli (is_purchasable = false)", itName)
		}
		if !isMain && !itAllowBranch {
			return nil, fmt.Errorf("item '%s' eksklusif hanya dapat dipasok dari Gudang Pusat", itName)
		}
	}

	// Generate PO Number if not provided
	poNum := ""
	if req.PONumber != nil && *req.PONumber != "" {
		poNum = *req.PONumber
	} else {
		generated, err := s.generatePONumber(ctx, businessID)
		if err != nil {
			return nil, fmt.Errorf("gagal generate nomor PO: %w", err)
		}
		poNum = generated
	}

	status := "draft"
	if req.Status != "" {
		status = req.Status
	}

	paymentStatus := "unpaid"
	if req.PaymentStatus != "" {
		paymentStatus = req.PaymentStatus
	}

	paymentMethod := "credit"
	if req.PaymentMethod != "" {
		paymentMethod = req.PaymentMethod
	}

	if req.AmountPaid < 0 {
		return nil, errors.New("nominal pembayaran tidak boleh kurang dari 0")
	}
	if req.AmountPaid > req.TotalAmount {
		return nil, fmt.Errorf("jumlah pembayaran (Rp %d) melebihi total tagihan faktur (Rp %d)", req.AmountPaid, req.TotalAmount)
	}

	amountOwed := req.TotalAmount - req.AmountPaid
	if amountOwed <= 0 && req.TotalAmount > 0 {
		paymentStatus = "paid"
		amountOwed = 0
	} else if req.AmountPaid > 0 && req.AmountPaid < req.TotalAmount {
		paymentStatus = "partial"
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var receivedAt *time.Time
	var receivedBy *uuid.UUID
	if status == "received" {
		now := time.Now()
		receivedAt = &now
		receivedBy = &userID
	}

	orderDate := time.Now().Format("2006-01-02")
	if req.OrderDate != nil && *req.OrderDate != "" {
		orderDate = *req.OrderDate
	}

	var purchaseID uuid.UUID
	insertPurchaseSQL := `
		INSERT INTO purchases (
			business_id, outlet_id, po_number, invoice_no, supplier_id, supplier_name,
			status, payment_status, payment_method, order_date, due_date, received_at,
			subtotal_amount, discount_amount, tax_amount, shipping_cost,
			total_amount, amount_paid, amount_owed, notes, created_by, received_by
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16,
			$17, $18, $19, $20, $21, $22
		) RETURNING id
	`
	err = tx.QueryRow(ctx, insertPurchaseSQL,
		businessID, targetOutletID, poNum, req.InvoiceNo, req.SupplierID, req.SupplierName,
		status, paymentStatus, paymentMethod, orderDate, req.DueDate, receivedAt,
		req.SubtotalAmount, req.DiscountAmount, req.TaxAmount, req.ShippingCost,
		req.TotalAmount, req.AmountPaid, amountOwed, req.Notes, userID, receivedBy,
	).Scan(&purchaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert purchase: %w", err)
	}

	// Insert line items & handle stock movement if received immediately
	for _, item := range req.Items {
		convRate := item.ConversionRate
		if convRate <= 0 {
			convRate = 1.0
		}

		uom := item.UOM
		if uom != "box" && uom != "base" {
			uom = "box"
		}

		qtyReceived := 0.0
		if status == "received" {
			if item.QtyReceived != nil && *item.QtyReceived > 0 {
				qtyReceived = *item.QtyReceived
			} else {
				qtyReceived = item.QtyOrdered
			}
		}

		subtotal := item.UnitCost*int64(item.QtyOrdered) - item.DiscountAmount
		if subtotal < 0 {
			subtotal = 0
		}

		insertItemSQL := `
			INSERT INTO purchase_items (
				purchase_id, item_id, uom, qty_ordered, qty_received,
				conversion_rate, unit_cost, discount_amount, subtotal, notes
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`
		_, err = tx.Exec(ctx, insertItemSQL,
			purchaseID, item.ItemID, uom, item.QtyOrdered, qtyReceived,
			convRate, item.UnitCost, item.DiscountAmount, subtotal, item.Notes,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert purchase item: %w", err)
		}

		// If 1-Step Direct Purchase (Status = received), execute double-entry stock movement & update Last Buying Price
		if status == "received" && qtyReceived > 0 {
			var qtySealedChange, qtyLooseChange float64
			if uom == "box" {
				qtySealedChange = qtyReceived
				qtyLooseChange = 0
			} else {
				qtySealedChange = 0
				qtyLooseChange = qtyReceived
			}

			// Record in stock_movements ledger (append-only)
			insertMovementSQL := `
				INSERT INTO stock_movements (
					id, business_id, item_id, source_document_type, source_document_id,
					from_location_type, to_location_type, to_outlet_id,
					package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
				) VALUES ($1, $2, $3, 'purchase_inbound', $4, 'vendor', 'outlet', $5, $6, $7, $8, $9, $10, $11, NOW())
			`
			movementNote := fmt.Sprintf("Pembelian Masuk PO: %s (%s)", poNum, req.SupplierName)
			totalCost := int64(qtyReceived * float64(item.UnitCost))
			_, err = tx.Exec(ctx, insertMovementSQL,
				uuid.New(), businessID, item.ItemID, purchaseID,
				targetOutletID, uom, qtyReceived, item.UnitCost, totalCost, userID, movementNote,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to record stock movement: %w", err)
			}

			// Update or Insert item_stocks balance
			var curSealed, curLoose float64
			err = tx.QueryRow(ctx, "SELECT qty_sealed, qty_loose FROM item_stocks WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL FOR UPDATE", item.ItemID, targetOutletID).Scan(&curSealed, &curLoose)
			if err != nil {
				_, err = tx.Exec(ctx, "INSERT INTO item_stocks (id, item_id, outlet_id, qty_sealed, qty_loose, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())", item.ItemID, targetOutletID, qtySealedChange, qtyLooseChange)
				if err != nil {
					return nil, fmt.Errorf("failed to insert initial stock: %w", err)
				}
			} else {
				_, err = tx.Exec(ctx, "UPDATE item_stocks SET qty_sealed = qty_sealed + $1, qty_loose = qty_loose + $2, updated_at = NOW() WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL", qtySealedChange, qtyLooseChange, item.ItemID, targetOutletID)
				if err != nil {
					return nil, fmt.Errorf("failed to update item stock: %w", err)
				}
			}

			// Update items.standard_cost (Last Buying Price)
			costPerBase := item.UnitCost
			if uom == "box" && convRate > 0 {
				costPerBase = int64(float64(item.UnitCost) / convRate)
			}
			if costPerBase > 0 {
				_, _ = tx.Exec(ctx, "UPDATE items SET standard_cost = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3", costPerBase, item.ItemID, businessID)
			}
		}
	}

	// If initial payment was made, record it in purchase_payments
	if req.AmountPaid > 0 {
		payNo := fmt.Sprintf("PAY-%s-%s", time.Now().Format("20060102"), strings.ToUpper(uuid.New().String()[:6]))
		insertPaySQL := `
			INSERT INTO purchase_payments (
				purchase_id, business_id, payment_no, payment_date,
				amount_paid, payment_method, recorded_by, notes
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err = tx.Exec(ctx, insertPaySQL,
			purchaseID, businessID, payNo, orderDate,
			req.AmountPaid, paymentMethod, userID, "Pembayaran Awal Faktur",
		)
		if err != nil {
			return nil, fmt.Errorf("failed to record initial payment: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit purchase transaction: %w", err)
	}

	return s.GetPurchaseByID(ctx, businessID, purchaseID)
}

func (s *PurchasesService) ReceivePurchase(ctx context.Context, businessID, id, userID uuid.UUID, req ReceivePurchaseRequest) (*models.Purchase, error) {
	// Fetch existing purchase
	purchase, err := s.GetPurchaseByID(ctx, businessID, id)
	if err != nil {
		return nil, err
	}
	if purchase.Status == "received" {
		return nil, errors.New("faktur pembelian ini sudah berstatus diterima (received)")
	}
	if purchase.Status == "cancelled" {
		return nil, errors.New("faktur pembelian yang telah dibatalkan tidak dapat diterima")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Map incoming items receive quantities
	receiveMap := make(map[uuid.UUID]PurchaseItemReceiveInput)
	for _, it := range req.Items {
		receiveMap[it.ItemID] = it
	}

	for _, item := range purchase.Items {
		qtyToReceive := item.QtyOrdered
		if in, ok := receiveMap[item.ItemID]; ok && in.QtyReceived > 0 {
			qtyToReceive = in.QtyReceived
		}

		convRate := item.ConversionRate
		if convRate <= 0 {
			convRate = 1.0
		}

		var qtySealedChange, qtyLooseChange float64
		if item.UOM == "box" {
			qtySealedChange = qtyToReceive
			qtyLooseChange = 0
		} else {
			qtySealedChange = 0
			qtyLooseChange = qtyToReceive
		}

		// Update purchase_items line
		_, err = tx.Exec(ctx, "UPDATE purchase_items SET qty_received = $1 WHERE id = $2", qtyToReceive, item.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to update purchase item received qty: %w", err)
		}

		// Record in stock_movements ledger (append-only)
		insertMovementSQL := `
			INSERT INTO stock_movements (
				id, business_id, item_id, source_document_type, source_document_id,
				from_location_type, to_location_type, to_outlet_id,
				package_form, qty, unit_cost, total_cost, performed_by, notes, created_at
			) VALUES ($1, $2, $3, 'purchase_inbound', $4, 'vendor', 'outlet', $5, $6, $7, $8, $9, $10, $11, NOW())
		`
		movementNote := fmt.Sprintf("Penerimaan Barang PO: %s (%s)", purchase.PONumber, purchase.SupplierName)
		totalCost := int64(qtyToReceive * float64(item.UnitCost))
		_, err = tx.Exec(ctx, insertMovementSQL,
			uuid.New(), businessID, item.ItemID, purchase.ID,
			purchase.OutletID, item.UOM, qtyToReceive, item.UnitCost, totalCost, userID, movementNote,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to record stock movement: %w", err)
		}

		// Update or Insert item_stocks balance
		var curSealed, curLoose float64
		err = tx.QueryRow(ctx, "SELECT qty_sealed, qty_loose FROM item_stocks WHERE item_id = $1 AND outlet_id = $2 AND held_by_user_id IS NULL FOR UPDATE", item.ItemID, purchase.OutletID).Scan(&curSealed, &curLoose)
		if err != nil {
			_, err = tx.Exec(ctx, "INSERT INTO item_stocks (id, item_id, outlet_id, qty_sealed, qty_loose, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())", item.ItemID, purchase.OutletID, qtySealedChange, qtyLooseChange)
			if err != nil {
				return nil, fmt.Errorf("failed to insert initial stock: %w", err)
			}
		} else {
			_, err = tx.Exec(ctx, "UPDATE item_stocks SET qty_sealed = qty_sealed + $1, qty_loose = qty_loose + $2, updated_at = NOW() WHERE item_id = $3 AND outlet_id = $4 AND held_by_user_id IS NULL", qtySealedChange, qtyLooseChange, item.ItemID, purchase.OutletID)
			if err != nil {
				return nil, fmt.Errorf("failed to update item stock: %w", err)
			}
		}

		// Update Last Buying Price
		costPerBase := item.UnitCost
		if item.UOM == "box" && convRate > 0 {
			costPerBase = int64(float64(item.UnitCost) / convRate)
		}
		if costPerBase > 0 {
			_, _ = tx.Exec(ctx, "UPDATE items SET standard_cost = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3", costPerBase, item.ItemID, businessID)
		}
	}

	receiveTime := time.Now()
	if req.ReceivedAt != nil {
		receiveTime = *req.ReceivedAt
	}

	updatePurchaseSQL := `
		UPDATE purchases
		SET status = 'received', received_at = $1, received_by = $2, updated_at = NOW()
		WHERE id = $3 AND business_id = $4
	`
	_, err = tx.Exec(ctx, updatePurchaseSQL, receiveTime, userID, id, businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to update purchase status: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit receive transaction: %w", err)
	}

	return s.GetPurchaseByID(ctx, businessID, id)
}

func (s *PurchasesService) AddPurchasePayment(ctx context.Context, businessID, purchaseID, userID uuid.UUID, req AddPaymentRequest) (*models.PurchasePayment, error) {
	if req.AmountPaid <= 0 {
		return nil, errors.New("nominal pembayaran harus lebih besar dari 0")
	}

	purchase, err := s.GetPurchaseByID(ctx, businessID, purchaseID)
	if err != nil {
		return nil, err
	}

	if purchase.AmountOwed <= 0 {
		return nil, errors.New("faktur pembelian ini sudah lunas")
	}

	if req.AmountPaid > purchase.AmountOwed {
		return nil, fmt.Errorf("nominal pembayaran (Rp %d) melebihi sisa hutang faktur (Rp %d)", req.AmountPaid, purchase.AmountOwed)
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	newAmountPaid := purchase.AmountPaid + req.AmountPaid
	newAmountOwed := purchase.TotalAmount - newAmountPaid
	newPaymentStatus := "partial"
	if newAmountOwed <= 0 {
		newAmountOwed = 0
		newPaymentStatus = "paid"
	}

	payDate := time.Now().Format("2006-01-02")
	if req.PaymentDate != nil && *req.PaymentDate != "" {
		payDate = *req.PaymentDate
	}

	payMethod := "cash"
	if req.PaymentMethod != "" {
		payMethod = req.PaymentMethod
	}

	payNo := fmt.Sprintf("PAY-%s-%s", time.Now().Format("20060102"), strings.ToUpper(uuid.New().String()[:6]))

	var payment models.PurchasePayment
	insertPaySQL := `
		INSERT INTO purchase_payments (
			purchase_id, business_id, payment_no, payment_date,
			amount_paid, payment_method, reference_no, recorded_by, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, purchase_id, business_id, payment_no, TO_CHAR(payment_date, 'YYYY-MM-DD'), amount_paid, payment_method, reference_no, recorded_by, notes, created_at
	`
	err = tx.QueryRow(ctx, insertPaySQL,
		purchaseID, businessID, payNo, payDate,
		req.AmountPaid, payMethod, req.ReferenceNo, userID, req.Notes,
	).Scan(
		&payment.ID, &payment.PurchaseID, &payment.BusinessID, &payment.PaymentNo,
		&payment.PaymentDate, &payment.AmountPaid, &payment.PaymentMethod,
		&payment.ReferenceNo, &payment.RecordedBy, &payment.Notes, &payment.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to record payment: %w", err)
	}

	updatePurchaseSQL := `
		UPDATE purchases
		SET amount_paid = $1, amount_owed = $2, payment_status = $3, updated_at = NOW()
		WHERE id = $4 AND business_id = $5
	`
	_, err = tx.Exec(ctx, updatePurchaseSQL, newAmountPaid, newAmountOwed, newPaymentStatus, purchaseID, businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to update purchase payment balance: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit payment: %w", err)
	}

	return &payment, nil
}

func (s *PurchasesService) GetPurchasePayments(ctx context.Context, businessID, purchaseID uuid.UUID) ([]models.PurchasePayment, error) {
	query := `
		SELECT pp.id, pp.purchase_id, pp.business_id, pp.payment_no,
		       TO_CHAR(pp.payment_date, 'YYYY-MM-DD') as payment_date,
		       pp.amount_paid, pp.payment_method, pp.reference_no,
		       pp.recorded_by, COALESCE(u.name, '') as recorded_by_name,
		       pp.notes, pp.created_at
		FROM purchase_payments pp
		LEFT JOIN users u ON pp.recorded_by = u.id
		WHERE pp.purchase_id = $1 AND pp.business_id = $2
		ORDER BY pp.created_at DESC
	`
	rows, err := s.DB.Query(ctx, query, purchaseID, businessID)
	if err != nil {
		return nil, fmt.Errorf("failed to query purchase payments: %w", err)
	}
	defer rows.Close()

	var payments []models.PurchasePayment
	for rows.Next() {
		var pay models.PurchasePayment
		if err := rows.Scan(
			&pay.ID, &pay.PurchaseID, &pay.BusinessID, &pay.PaymentNo,
			&pay.PaymentDate, &pay.AmountPaid, &pay.PaymentMethod,
			&pay.ReferenceNo, &pay.RecordedBy, &pay.RecordedByName,
			&pay.Notes, &pay.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}
		payments = append(payments, pay)
	}
	if payments == nil {
		payments = []models.PurchasePayment{}
	}
	return payments, nil
}
