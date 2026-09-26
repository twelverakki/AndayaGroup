package models

import (
	"time"

	"github.com/google/uuid"
)

// UserStatus ENUM type
type UserStatus string

const (
	StatusActive       UserStatus = "active"
	StatusInactive     UserStatus = "inactive"
	StatusDiscontinued UserStatus = "discontinued"
)

// BusinessType ENUM type
type BusinessType string

const (
	TypeRetail        BusinessType = "retail"
	TypeFnBProduction BusinessType = "fnb_production"
	TypeFnBFranchise  BusinessType = "fnb_franchise"
	TypeFnBBranch     BusinessType = "fnb_branch"
)

// StaffRole ENUM type
type StaffRole string

const (
	RoleManager     StaffRole = "manager"
	RoleAdminGudang StaffRole = "admin_gudang"
	RoleStaff       StaffRole = "staff"
)

// User represents a system user (Owner, Manager, Staff)
type User struct {
	ID           uuid.UUID  `json:"id"`
	Name         string     `json:"name"`
	PhoneOrEmail *string    `json:"phone_or_email,omitempty"`
	PasswordHash *string    `json:"-"`
	PinHash      *string    `json:"-"`
	Status       UserStatus `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Business represents a tenant brand/business entity
type Business struct {
	ID                           uuid.UUID    `json:"id"`
	Name                         string       `json:"name"`
	Type                         BusinessType `json:"type"`
	Phone                        *string      `json:"phone,omitempty"`
	Email                        *string      `json:"email,omitempty"`
	TaxID                        *string      `json:"tax_id,omitempty"`
	TaxRatePct                   float64      `json:"tax_rate_pct"`
	HasPos                       bool         `json:"has_pos"`
	HasManufacturing             bool         `json:"has_manufacturing"`
	HasLogisticsHub              bool         `json:"has_logistics_hub"`
	HasEodUsage                  bool         `json:"has_eod_usage"`
	HasMultiOutlets              bool         `json:"has_multi_outlets"`
	HideCentralStockFromBranches bool         `json:"hide_central_stock_from_branches"`
	AllowCrossBranchStockView    bool         `json:"allow_cross_branch_stock_view"`
	CreatedAt                    time.Time    `json:"created_at"`
	UpdatedAt                    time.Time    `json:"updated_at"`
}

// Outlet represents a physical branch/location under a business
type Outlet struct {
	ID            uuid.UUID `json:"id"`
	BusinessID    uuid.UUID `json:"business_id"`
	Name          string    `json:"name"`
	IsMain        bool      `json:"is_main"`
	Address       *string   `json:"address,omitempty"`
	Phone         *string   `json:"phone,omitempty"`
	ReceiptFooter *string   `json:"receipt_footer,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// BusinessOwner represents many-to-many business ownership for Owners
type BusinessOwner struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	BusinessID *uuid.UUID `json:"business_id,omitempty"`
	OutletID   *uuid.UUID `json:"outlet_id,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// OutletStaff represents staff and managers assigned to a specific outlet
type OutletStaff struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"user_id"`
	OutletID    uuid.UUID  `json:"outlet_id"`
	Role        StaffRole  `json:"role"`
	CanViewCost bool       `json:"can_view_cost"`
	Status      UserStatus `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ManagerPIN represents manager override PIN details
type ManagerPIN struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	PinHash   string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ActiveContext represents the current active tenant workspace after user login/switch
type ActiveContext struct {
	BusinessID                   *uuid.UUID   `json:"business_id"`
	OutletID                     *uuid.UUID   `json:"outlet_id"`
	Role                         string       `json:"role"` // "owner", "manager", "admin_gudang", "staff", "superadmin"
	Name                         string       `json:"name"`
	Type                         BusinessType `json:"type"`
	HasPOS                       bool         `json:"has_pos"`
	HasManufacturing             bool         `json:"has_manufacturing"`
	HasLogisticsHub              bool         `json:"has_logistics_hub"`
	HasEODUsage                  bool         `json:"has_eod_usage"`
	HasMultiOutlets              bool         `json:"has_multi_outlets"`
	HideCentralStockFromBranches bool         `json:"hide_central_stock_from_branches"`
	AllowCrossBranchStockView    bool         `json:"allow_cross_branch_stock_view"`
}

// UserClaims holds JWT structure
type UserClaims struct {
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
	BusinessID string `json:"business_id,omitempty"`
	OutletID   string `json:"outlet_id,omitempty"`
}

// =========================================================================
// PHASE 2 MODELS (JnA Mart: Products, Inventory, POS Transactions & Shifts)
// =========================================================================

// InventoryMode ENUM type
type InventoryMode string

const (
	ModeDryStrict   InventoryMode = "dry_strict"
	ModeWetInfinite InventoryMode = "wet_infinite"
	ModeSimple      InventoryMode = "simple"
	ModeBatchThaw   InventoryMode = "batch_thaw"
	ModeSameDay     InventoryMode = "same_day"
)

// UnitType ENUM type
type UnitType string

const (
	UnitPcs    UnitType = "pcs"
	UnitPack   UnitType = "pack"
	UnitKg     UnitType = "kg"
	UnitCarton UnitType = "carton"
	UnitLiter  UnitType = "liter"
)

// WastageStatus ENUM type
type WastageStatus string

const (
	WastagePending  WastageStatus = "pending_approval"
	WastageApproved WastageStatus = "approved"
	WastageRejected WastageStatus = "rejected"
)

// ShiftStatus ENUM type
type ShiftStatus string

const (
	ShiftOpen   ShiftStatus = "open"
	ShiftClosed ShiftStatus = "closed"
)

// TransactionType ENUM type
type TransactionType string

const (
	TxSale         TransactionType = "sale"
	TxInternalTake TransactionType = "internal_take"
	TxVoid         TransactionType = "void"
)

// TransactionStatus ENUM type
type TransactionStatus string

const (
	TxCompleted TransactionStatus = "completed"
	TxVoided     TransactionStatus = "voided"
)

// PaymentMethod ENUM type
type PaymentMethod string

const (
	PayCash  PaymentMethod = "cash"
	PayQRIS  PaymentMethod = "qris"
	PayOther PaymentMethod = "other"
)

// PaymentStatus ENUM type
type PaymentStatus string

const (
	PayPaid    PaymentStatus = "paid"
	PayUnpaid  PaymentStatus = "unpaid"
	PayPartial PaymentStatus = "partial"
)

// BatchStatus ENUM type
type BatchStatus string

const (
	BatchSealed BatchStatus = "sealed"
	BatchOpened BatchStatus = "opened"
)

// QualityCheckStatus ENUM type
type QualityCheckStatus string

const (
	QCPending QualityCheckStatus = "pending"
	QCPass    QualityCheckStatus = "pass"
	QCDiscard QualityCheckStatus = "discard"
)

// OverrideAction ENUM type
type OverrideAction string

const (
	ActionVoid             OverrideAction = "void"
	ActionDiscountOverride OverrideAction = "discount_override"
)

// Category represents a product category
type Category struct {
	ID           uuid.UUID `json:"id"`
	BusinessID   uuid.UUID `json:"business_id"`
	Name         string    `json:"name"`
	CategoryType string    `json:"category_type"`
	ItemCount    int       `json:"item_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Product represents a product
type Product struct {
	ID            uuid.UUID     `json:"id"`
	BusinessID    uuid.UUID     `json:"business_id"`
	OutletID      *uuid.UUID    `json:"outlet_id,omitempty"`
	SKU           *string       `json:"sku,omitempty"`
	Name          string        `json:"name"`
	CategoryID    *uuid.UUID    `json:"category_id,omitempty"`
	Category      *string       `json:"category,omitempty"` // populated via join for backwards compatibility
	UnitType      UnitType      `json:"unit_type"`
	InventoryMode InventoryMode `json:"inventory_mode"`
	PurchasePrice int64         `json:"purchase_price"`
	SellPrice     int64         `json:"sell_price"`
	CurrentStock  float64       `json:"current_stock"`
	MinStockAlert *float64      `json:"min_stock_alert,omitempty"`
	ImageURL      *string       `json:"image_url,omitempty"`
	Status        UserStatus    `json:"status"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// Ingredient represents an ingredient raw material or tool supply
type Ingredient struct {
	ID            uuid.UUID          `json:"id"`
	BusinessID    uuid.UUID          `json:"business_id"`
	OutletID      *uuid.UUID         `json:"outlet_id,omitempty"`
	Category      IngredientCategory `json:"category"`
	SubCategory   string             `json:"sub_category,omitempty"`
	Name          string             `json:"name"`
	UnitType      UnitType           `json:"unit_type"`
	CurrentStock  float64            `json:"current_stock"`
	MinStockAlert *float64           `json:"min_stock_alert,omitempty"`
	UnitCost      int64              `json:"unit_cost"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

// StockConversion represents inventory unit conversion rule
type StockConversion struct {
	ID             uuid.UUID  `json:"id"`
	ProductID      *uuid.UUID `json:"product_id,omitempty"`
	IngredientID   *uuid.UUID `json:"ingredient_id,omitempty"`
	FromUnit       string     `json:"from_unit"`
	ToUnit         string     `json:"to_unit"`
	ConversionRate float64    `json:"conversion_rate"`
	CreatedAt      time.Time  `json:"created_at"`
}

// StockBatch represents product batch (Cold Transit & Thawing Lifecycle)
type StockBatch struct {
	ID                 uuid.UUID           `json:"id"`
	BusinessID         uuid.UUID           `json:"business_id"`
	OutletID           *uuid.UUID          `json:"outlet_id,omitempty"`
	ProductID          uuid.UUID           `json:"product_id"`
	HeldByUserID       uuid.UUID           `json:"held_by_user_id"`
	BatchStatus        BatchStatus         `json:"batch_status"`
	Quantity           float64             `json:"quantity"`
	DistributionID     *uuid.UUID          `json:"distribution_id,omitempty"`
	OpenedAt           *time.Time          `json:"opened_at,omitempty"`
	QualityCheckedAt   *time.Time          `json:"quality_checked_at,omitempty"`
	QualityCheckStatus *QualityCheckStatus `json:"quality_check_status,omitempty"`
	CreatedAt          time.Time           `json:"created_at"`
}

// DailyMaterialLog represents daily material tracking log (specifically for Gorengan)
type DailyMaterialLog struct {
	ID                 uuid.UUID  `json:"id"`
	BusinessID         uuid.UUID  `json:"business_id"`
	OutletID           uuid.UUID  `json:"outlet_id"`
	IngredientID       uuid.UUID  `json:"ingredient_id"`
	StaffID            uuid.UUID  `json:"staff_id"`
	LogDate            time.Time  `json:"log_date"`
	QtyStart           float64    `json:"qty_start"`
	QtyRemaining       *float64   `json:"qty_remaining,omitempty"`
	QtyUsedCalculated *float64   `json:"qty_used_calculated,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// WastageLog represents wastage log / inventory discrepancy from opname
type WastageLog struct {
	ID                 uuid.UUID     `json:"id"`
	BusinessID         uuid.UUID     `json:"business_id"`
	OutletID           uuid.UUID     `json:"outlet_id"`
	ProductID          *uuid.UUID    `json:"product_id,omitempty"`
	IngredientID       *uuid.UUID    `json:"ingredient_id,omitempty"`
	DailyMaterialLogID *uuid.UUID    `json:"daily_material_log_id,omitempty"`
	StockBatchID       *uuid.UUID    `json:"stock_batch_id,omitempty"`
	ExpectedQty        float64       `json:"expected_qty"`
	ActualQty          float64       `json:"actual_qty"`
	Discrepancy        float64       `json:"discrepancy"`
	InputBy            uuid.UUID     `json:"input_by"`
	Status             WastageStatus `json:"status"`
	SourceStage        *string       `json:"source_stage,omitempty"`
	ApprovedBy         *uuid.UUID    `json:"approved_by,omitempty"`
	ApprovedAt         *time.Time    `json:"approved_at,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`
}

// OpnameSession represents a stock opname audit session
type OpnameSession struct {
	ID             uuid.UUID    `json:"id"`
	BusinessID     uuid.UUID    `json:"business_id"`
	OutletID       *uuid.UUID   `json:"outlet_id,omitempty"`
	SessionName    string       `json:"session_name"`
	TargetCategory string       `json:"target_category"`
	Status         string       `json:"status"` // 'open', 'submitted', 'completed', 'rejected'
	Notes          *string      `json:"notes,omitempty"`
	CreatedBy      uuid.UUID    `json:"created_by"`
	CreatedByName  string       `json:"created_by_name,omitempty"`
	AuditedBy      *uuid.UUID   `json:"audited_by,omitempty"`
	AuditedByName  string       `json:"audited_by_name,omitempty"`
	ApprovedBy     *uuid.UUID   `json:"approved_by,omitempty"`
	ApprovedByName string       `json:"approved_by_name,omitempty"`
	CreatedAt      time.Time    `json:"created_at"`
	CompletedAt    *time.Time   `json:"completed_at,omitempty"`
	Items          []OpnameItem `json:"items,omitempty"`
}

// OpnameItem represents an item audited during an opname session
type OpnameItem struct {
	ID              uuid.UUID  `json:"id"`
	OpnameSessionID uuid.UUID  `json:"opname_session_id"`
	ProductID       *uuid.UUID `json:"product_id,omitempty"`
	ProductName     string     `json:"product_name,omitempty"`
	ProductSKU      string     `json:"product_sku,omitempty"`
	IngredientID    *uuid.UUID `json:"ingredient_id,omitempty"`
	IngredientName  string     `json:"ingredient_name,omitempty"`
	UnitType        string     `json:"unit_type"`
	ExpectedQty     *float64   `json:"expected_qty,omitempty"` // Protected: Omitted for staff during blind count!
	ActualQty       float64    `json:"actual_qty"`
	Discrepancy     float64    `json:"discrepancy"`
	UnitCost        int64      `json:"unit_cost"`
	Notes           *string    `json:"notes,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// Shift represents a cashier session
type Shift struct {
	ID                 uuid.UUID   `json:"id"`
	OutletID           uuid.UUID   `json:"outlet_id"`
	StaffID            uuid.UUID   `json:"staff_id"`
	OpeningCash        int64       `json:"opening_cash"`
	ClosingCashSystem *int64      `json:"closing_cash_system,omitempty"`
	ClosingCashActual *int64      `json:"closing_cash_actual,omitempty"`
	Variance           *int64      `json:"variance,omitempty"`
	Status             ShiftStatus `json:"status"`
	OpenedAt           time.Time   `json:"opened_at"`
	ClosedAt           *time.Time  `json:"closed_at,omitempty"`
}

// Transaction represents a sale, void, or internal take transaction
type Transaction struct {
	ID             uuid.UUID         `json:"id"`
	BusinessID     uuid.UUID         `json:"business_id"`
	OutletID       uuid.UUID         `json:"outlet_id"`
	ShiftID        *uuid.UUID        `json:"shift_id,omitempty"`
	StaffID        uuid.UUID         `json:"staff_id"`
	Type           TransactionType   `json:"type"`
	Channel        string            `json:"channel"`
	TotalAmount    int64             `json:"total_amount"`
	Subtotal       int64             `json:"subtotal"`
	DiscountAmount int64             `json:"discount_amount"`
	PromotionID    *uuid.UUID        `json:"promotion_id,omitempty"`
	PaymentMethod  PaymentMethod     `json:"payment_method"`
	Status         TransactionStatus `json:"status"`
	ClientUUID     uuid.UUID         `json:"client_uuid"`
	SyncedAt       *time.Time        `json:"synced_at,omitempty"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}

// TransactionItem represents an item within a transaction
type TransactionItem struct {
	ID             uuid.UUID  `json:"id"`
	TransactionID  uuid.UUID  `json:"transaction_id"`
	ProductID      uuid.UUID  `json:"product_id"`
	Qty            float64    `json:"qty"`
	UnitPrice      int64      `json:"unit_price"`
	Subtotal       int64      `json:"subtotal"`
	DiscountAmount int64      `json:"discount_amount"`
	PromotionID    *uuid.UUID `json:"promotion_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// OverrideLog represents a log of manager authorization for cashier override (e.g. void)
type OverrideLog struct {
	ID            uuid.UUID      `json:"id"`
	TransactionID uuid.UUID      `json:"transaction_id"`
	StaffID       uuid.UUID      `json:"staff_id"`
	ManagerID     uuid.UUID      `json:"manager_id"`
	Action        OverrideAction `json:"action"`
	Reason        *string        `json:"reason,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
}

// Procurement represents a purchase order or inventory stock-in log
type Procurement struct {
	ID              uuid.UUID     `json:"id"`
	BusinessID      uuid.UUID     `json:"business_id"`
	OutletID        *uuid.UUID    `json:"outlet_id,omitempty"`
	SupplierName    string        `json:"supplier_name"`
	InvoiceNumber   *string       `json:"invoice_number,omitempty"`
	TotalCost       int64         `json:"total_cost"`
	PaymentStatus   PaymentStatus `json:"payment_status"`
	AmountOwed      *int64        `json:"amount_owed,omitempty"`
	ProcurementDate time.Time     `json:"procurement_date"`
	DueDate         *time.Time    `json:"due_date,omitempty"`
	CreatedBy       uuid.UUID     `json:"created_by"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

// ProcurementItem represents an item purchased under a procurement log
type ProcurementItem struct {
	ID            uuid.UUID  `json:"id"`
	ProcurementID uuid.UUID  `json:"procurement_id"`
	ProductID     *uuid.UUID `json:"product_id,omitempty"`
	IngredientID  *uuid.UUID `json:"ingredient_id,omitempty"`
	Qty           float64    `json:"qty"`
	UnitCost      int64      `json:"unit_cost"`
	WeightActual  *float64   `json:"weight_actual,omitempty"`
}

// =========================================================================
// MANUFACTURING & CENTRAL KITCHEN DOMAIN MODELS
// =========================================================================

// ProductionExpense represents the expense log of ingredients/tools per production
type ProductionExpense struct {
	ID           uuid.UUID `json:"id"`
	ProductionID uuid.UUID `json:"production_id"`
	IngredientID uuid.UUID `json:"ingredient_id"`
	Quantity     float64   `json:"quantity"`
	CreatedAt    time.Time `json:"created_at"`
}

// Production represents production log of a product in central kitchen / manufacturing
type Production struct {
	ID           uuid.UUID           `json:"id"`
	BusinessID   uuid.UUID           `json:"business_id"`
	ProductID    uuid.UUID           `json:"product_id"`
	QtyProduced  float64             `json:"qty_produced"`
	ProducedBy   uuid.UUID           `json:"produced_by"`
	ProducedAt   time.Time           `json:"produced_at"`
	CreatedAt    time.Time           `json:"created_at"`
	Expenses     []ProductionExpense `json:"expenses,omitempty"`
}

// DistributionStatus ENUM type
type DistributionStatus string

const (
	DistInTransit DistributionStatus = "in_transit"
	DistSent      DistributionStatus = "sent"
	DistReceived  DistributionStatus = "received"
	DistReturned  DistributionStatus = "returned"
	DistCancelled DistributionStatus = "cancelled"
)

// DistributionType ENUM type
type DistributionType string

const (
	TypeOutbound DistributionType = "outbound"
	TypeReturn   DistributionType = "return"
)

// Distribution represents stock distribution / inter-outlet transfer
type Distribution struct {
	ID                    uuid.UUID          `json:"id"`
	TransferNo            string             `json:"transfer_no,omitempty"`
	BusinessID            uuid.UUID          `json:"business_id"`
	ItemID                *uuid.UUID         `json:"item_id,omitempty"`
	ProductID             *uuid.UUID         `json:"product_id,omitempty"`
	FromOutletID          *uuid.UUID         `json:"from_outlet_id,omitempty"`
	ToOutletID            *uuid.UUID         `json:"to_outlet_id,omitempty"`
	OutletID              *uuid.UUID         `json:"outlet_id,omitempty"`
	SentByUserID          *uuid.UUID         `json:"sent_by_user_id,omitempty"`
	SentToUserID          *uuid.UUID         `json:"sent_to_user_id,omitempty"`
	ReceivedByUserID      *uuid.UUID         `json:"received_by_user_id,omitempty"`
	Qty                   float64            `json:"qty"`
	QtySealed             float64            `json:"qty_sealed"`
	QtyLoose              float64            `json:"qty_loose"`
	QtyReceivedSealed     float64            `json:"qty_received_sealed"`
	QtyReceivedLoose      float64            `json:"qty_received_loose"`
	Status                DistributionStatus `json:"status"`
	Type                  DistributionType   `json:"type"`
	DistributionType      string             `json:"distribution_type,omitempty"`
	ShrinkageTolerancePct float64            `json:"shrinkage_tolerance_pct"`
	ShrinkageQty          float64            `json:"shrinkage_qty"`
	Notes                 string             `json:"notes,omitempty"`
	ProductionID          *uuid.UUID         `json:"production_id,omitempty"`
	SentAt                time.Time          `json:"sent_at"`
	ReceivedAt            *time.Time         `json:"received_at,omitempty"`
	CreatedAt             time.Time          `json:"created_at"`

	// Joined Display Helpers
	ItemName         string  `json:"item_name,omitempty"`
	ItemSKU          string  `json:"item_sku,omitempty"`
	BaseUnit         string  `json:"base_unit,omitempty"`
	BoxUnit          string  `json:"box_unit,omitempty"`
	ConversionRate   float64 `json:"conversion_rate,omitempty"`
	FromOutletName   string  `json:"from_outlet_name,omitempty"`
	ToOutletName     string  `json:"to_outlet_name,omitempty"`
	SentByUserName   string  `json:"sent_by_user_name,omitempty"`
	SentToUserName   string  `json:"sent_to_user_name,omitempty"`
	ReceivedUserName string  `json:"received_by_user_name,omitempty"`
}

// ThawLog represents a thaw and QC operation record
type ThawLog struct {
	ID                 uuid.UUID `json:"id"`
	BusinessID         uuid.UUID `json:"business_id"`
	OutletID           uuid.UUID `json:"outlet_id"`
	ItemID             uuid.UUID `json:"item_id"`
	UserID             uuid.UUID `json:"user_id"`
	QtySealedThawed    float64   `json:"qty_sealed_thawed"`
	QtyLooseProduced   float64   `json:"qty_loose_produced"`
	ShrinkageLossLoose float64   `json:"shrinkage_loss_loose"`
	QCStatus           string    `json:"qc_status"`
	Notes              string    `json:"notes,omitempty"`
	ThawedAt           time.Time `json:"thawed_at"`
	CreatedAt          time.Time `json:"created_at"`

	// Joined Display Helpers
	ItemName       string  `json:"item_name,omitempty"`
	ItemSKU        string  `json:"item_sku,omitempty"`
	BaseUnit       string  `json:"base_unit,omitempty"`
	BoxUnit        string  `json:"box_unit,omitempty"`
	ConversionRate float64 `json:"conversion_rate,omitempty"`
	OutletName     string  `json:"outlet_name,omitempty"`
	UserName       string  `json:"user_name,omitempty"`
}

// IngredientCategory ENUM type
type IngredientCategory string

const (
	CategoryRawMaterial  IngredientCategory = "raw_material"
	CategoryToolSupplies IngredientCategory = "tool_supplies"
)

// DirectSale represents a direct frozen pack sale from central warehouse
type DirectSale struct {
	ID            uuid.UUID `json:"id"`
	BusinessID    uuid.UUID `json:"business_id"`
	ProductID     uuid.UUID `json:"product_id"`
	QtyPack       float64   `json:"qty_pack"`
	UnitPrice     int64     `json:"unit_price"`
	TotalAmount   int64     `json:"total_amount"`
	PaymentMethod string    `json:"payment_method"`
	SoldBy        uuid.UUID `json:"sold_by"`
	SoldAt        time.Time `json:"sold_at"`
	CreatedAt     time.Time `json:"created_at"`
}

// DailySettlement represents daily revenue and stock reconciliation settlement for cart staff
type DailySettlement struct {
	ID               uuid.UUID  `json:"id"`
	BusinessID       uuid.UUID  `json:"business_id"`
	OutletID         *uuid.UUID `json:"outlet_id,omitempty"`
	StaffID          uuid.UUID  `json:"staff_id"`
	ProductID        uuid.UUID  `json:"product_id"`
	SettlementDate   time.Time  `json:"settlement_date"`
	OpeningPcs       float64    `json:"opening_pcs"`
	ThawedPcs        float64    `json:"thawed_pcs"`
	ActualOpenedPcs  float64    `json:"actual_opened_pcs"`
	ActualSealedPack float64    `json:"actual_sealed_pack"`
	QCDiscardPcs     float64    `json:"qc_discard_pcs"`
	PcsSold          float64    `json:"pcs_sold"`
	UnitSellPrice    int64      `json:"unit_sell_price"`
	TargetRevenue    int64      `json:"target_revenue"`
	CashCollected    int64      `json:"cash_collected"`
	QRISCollected    int64      `json:"qris_collected"`
	TotalCollected   int64      `json:"total_collected"`
	Variance         int64      `json:"variance"`
	Notes            *string    `json:"notes,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

// Recipe represents a Bill of Materials (BOM) standard recipe template
type Recipe struct {
	ID              uuid.UUID    `json:"id"`
	BusinessID      uuid.UUID    `json:"business_id"`
	ProductID       uuid.UUID    `json:"product_id"`
	Name            string       `json:"name"`
	TargetOutputQty float64      `json:"target_output_qty"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
	Items           []RecipeItem `json:"items,omitempty"`
}

// RecipeItem represents an ingredient line item in a recipe
type RecipeItem struct {
	ID           uuid.UUID `json:"id"`
	RecipeID     uuid.UUID `json:"recipe_id"`
	IngredientID uuid.UUID `json:"ingredient_id"`
	StandardQty  float64   `json:"standard_qty"`
}

// ProductionMaterialLog represents actual material issue log during a production run
type ProductionMaterialLog struct {
	ID              uuid.UUID `json:"id"`
	ProductionRunID uuid.UUID `json:"production_run_id"`
	IngredientID    uuid.UUID `json:"ingredient_id"`
	StandardQty     float64   `json:"standard_qty"`
	ActualQty       float64   `json:"actual_qty"`
	UnitCost        int64     `json:"unit_cost"`
	SubtotalCost    int64     `json:"subtotal_cost"`
}

// ProductionRun represents a standard batch manufacturing run
type ProductionRun struct {
	ID                uuid.UUID               `json:"id"`
	BusinessID        uuid.UUID               `json:"business_id"`
	BatchCode         string                  `json:"batch_code"`
	ProductID         uuid.UUID               `json:"product_id"`
	RecipeID          *uuid.UUID              `json:"recipe_id,omitempty"`
	TargetQty         float64                 `json:"target_qty"`
	ActualYieldQty    float64                 `json:"actual_yield_qty"`
	ScrapQty          float64                 `json:"scrap_qty"`
	HPPPerUnit        int64                   `json:"hpp_per_unit"`
	TotalMaterialCost int64                   `json:"total_material_cost"`
	ExpiryDate        *time.Time              `json:"expiry_date,omitempty"`
	ProducedBy        uuid.UUID               `json:"produced_by"`
	ProducedAt        time.Time               `json:"produced_at"`
	CreatedAt         time.Time               `json:"created_at"`
	MaterialLogs      []ProductionMaterialLog `json:"material_logs,omitempty"`
}

// ItemType ENUM type for Unified Item Master (Phase 0 Patch v-1.1)
type ItemType string

const (
	ItemFinishedGood   ItemType = "finished_good"
	ItemSemiFinished   ItemType = "semi_finished"
	ItemRawMaterial    ItemType = "raw_material"
	ItemConsumable     ItemType = "consumable"
	ItemFixedTool      ItemType = "fixed_tool"
)

// Item represents the Unified Item Master catalog (Products, Ingredients, Tools)
type Item struct {
	ID                 uuid.UUID  `json:"id"`
	BusinessID         uuid.UUID  `json:"business_id"`
	CategoryID         *uuid.UUID `json:"category_id,omitempty"`
	SKU                *string    `json:"sku,omitempty"`
	Name               string     `json:"name"`
	ItemType           ItemType   `json:"item_type"`
	IsSellable         bool       `json:"is_sellable"`
	IsInventoryTracked bool       `json:"is_inventory_tracked"`
	IsTrackingStock    bool       `json:"is_tracking_stock"` // Unified alias
	IsProduced         bool       `json:"is_produced"`
	IsPurchasable      bool       `json:"is_purchasable"`
	IsThawable         bool       `json:"is_thawable"`
	RequiresThaw       bool       `json:"requires_thaw"` // Backward compatibility alias
	BaseUnit           string     `json:"base_unit"`
	BoxUnit            string     `json:"box_unit"`
	ConversionRate     float64    `json:"conversion_rate"`
	PriceUnit          string     `json:"price_unit"`
	SellPrice          int64      `json:"sell_price"`
	BoxSellPrice       int64      `json:"box_sell_price"`
	StandardCost       int64      `json:"standard_cost"`
	MinStockAlert      float64    `json:"min_stock_alert"`
	ImageURL           *string    `json:"image_url,omitempty"`
	Status             string     `json:"status"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// ItemStock represents normalized dual-unit stock per outlet and held user
type ItemStock struct {
	ID            uuid.UUID  `json:"id"`
	ItemID        uuid.UUID  `json:"item_id"`
	OutletID      uuid.UUID  `json:"outlet_id"`
	HeldByUserID  *uuid.UUID `json:"held_by_user_id,omitempty"`
	QtySealed     float64    `json:"qty_sealed"`
	QtyLoose      float64    `json:"qty_loose"`
	MinStockAlert float64    `json:"min_stock_alert"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// StockMovement represents an audit trail ledger entry for stock mutations
type StockMovement struct {
	ID              uuid.UUID  `json:"id"`
	ItemID          uuid.UUID  `json:"item_id"`
	OutletID        uuid.UUID  `json:"outlet_id"`
	MovementType    string     `json:"movement_type"`
	QtySealedChange float64    `json:"qty_sealed_change"`
	QtyLooseChange  float64    `json:"qty_loose_change"`
	UnitCost        int64      `json:"unit_cost"`
	ReferenceID     *uuid.UUID `json:"reference_id,omitempty"`
	CreatedBy       *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// HeaderDailySettlement represents header settlement for shift cash and QRIS reconciliation
type HeaderDailySettlement struct {
	ID                 uuid.UUID                   `json:"id"`
	BusinessID         uuid.UUID                   `json:"business_id"`
	OutletID           uuid.UUID                   `json:"outlet_id"`
	StaffID            uuid.UUID                   `json:"staff_id"`
	SettlementDate     time.Time                   `json:"settlement_date"`
	CashCollected      int64                       `json:"cash_collected"`
	QRISCollected      int64                       `json:"qris_collected"`
	TotalCollected     int64                       `json:"total_collected"`
	TotalTargetRevenue int64                       `json:"total_target_revenue"`
	TotalVariance      int64                       `json:"total_variance"`
	Notes              *string                     `json:"notes,omitempty"`
	ClientUUID         uuid.UUID                   `json:"client_uuid"`
	CreatedAt          time.Time                   `json:"created_at"`
	Items              []DailySettlementItemDetail `json:"items,omitempty"`
}

// DailySettlementItemDetail represents item physical count detail line in a settlement
type DailySettlementItemDetail struct {
	ID                     uuid.UUID `json:"id"`
	SettlementID           uuid.UUID `json:"settlement_id"`
	ItemID                 uuid.UUID `json:"item_id"`
	OpeningLoose           float64   `json:"opening_loose"`
	ThawedLoose            float64   `json:"thawed_loose"`
	ActualLoose            float64   `json:"actual_loose"`
	ActualSealed           float64   `json:"actual_sealed"`
	DiscardLoose           float64   `json:"discard_loose"`
	QtySold                float64   `json:"qty_sold"`
	UnitSellPrice          int64     `json:"unit_sell_price"`
	SubtotalTargetRevenue int64     `json:"subtotal_target_revenue"`
}

// EodMaterialUsage represents End-of-Day raw material consumption log (The Lean Odoo Way)
type EodMaterialUsage struct {
	ID               uuid.UUID  `json:"id"`
	BusinessID       uuid.UUID  `json:"business_id"`
	OutletID         uuid.UUID  `json:"outlet_id"`
	SettlementID     *uuid.UUID `json:"settlement_id,omitempty"`
	ItemID           uuid.UUID  `json:"item_id"`
	ItemName         string     `json:"item_name,omitempty"`
	InitialStock     float64    `json:"initial_stock"`
	RestockIn        float64    `json:"restock_in"`
	FinalOpnameStock float64    `json:"final_opname_stock"`
	ConsumedQty      float64    `json:"consumed_qty"`
	UnitCost         int64      `json:"unit_cost"`
	TotalCost        int64      `json:"total_cost"`
	CreatedAt        time.Time  `json:"created_at"`
}

// StaffMember represents staff or manager details for tenant organization management
type StaffMember struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	Name         string     `json:"name"`
	PhoneOrEmail *string    `json:"phone_or_email,omitempty"`
	OutletID     uuid.UUID  `json:"outlet_id"`
	OutletName   string     `json:"outlet_name,omitempty"`
	Role         StaffRole  `json:"role"`
	CanViewCost  bool       `json:"can_view_cost"`
	Status       UserStatus `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
}

// CreateStaffRequest represents payload to create a new staff account under an outlet
type CreateStaffRequest struct {
	Name         string    `json:"name" validate:"required"`
	PhoneOrEmail string    `json:"phone_or_email" validate:"required"`
	Password     string    `json:"password" validate:"required"`
	PIN          string    `json:"pin" validate:"required"`
	OutletID     uuid.UUID `json:"outlet_id" validate:"required"`
	Role         StaffRole `json:"role" validate:"required"`
	CanViewCost  bool      `json:"can_view_cost"`
}

// UpdateStaffRequest represents payload to update a staff account
type UpdateStaffRequest struct {
	Name         *string     `json:"name,omitempty"`
	PhoneOrEmail *string     `json:"phone_or_email,omitempty"`
	OutletID     *uuid.UUID  `json:"outlet_id,omitempty"`
	Role         *StaffRole  `json:"role,omitempty"`
	CanViewCost  *bool       `json:"can_view_cost,omitempty"`
	Status       *UserStatus `json:"status,omitempty"`
	PIN          *string     `json:"pin,omitempty"`
}

// UpdateBusinessCapabilitiesRequest represents payload for Owner to configure active modules
type UpdateBusinessCapabilitiesRequest struct {
	HasPos                       *bool `json:"has_pos,omitempty"`
	HasManufacturing             *bool `json:"has_manufacturing,omitempty"`
	HasLogisticsHub              *bool `json:"has_logistics_hub,omitempty"`
	HasEodUsage                  *bool `json:"has_eod_usage,omitempty"`
	HasMultiOutlets              *bool `json:"has_multi_outlets,omitempty"`
	HideCentralStockFromBranches *bool `json:"hide_central_stock_from_branches,omitempty"`
	AllowCrossBranchStockView    *bool `json:"allow_cross_branch_stock_view,omitempty"`
}

// SecurityAuditLog represents sensitive system security & auth audit events
type SecurityAuditLog struct {
	ID        uuid.UUID              `json:"id"`
	ActorID   *uuid.UUID             `json:"actor_id,omitempty"`
	ActorName *string                `json:"actor_name,omitempty"`
	ActorRole *string                `json:"actor_role,omitempty"`
	Action    string                 `json:"action"`
	TargetType string                `json:"target_type"`
	TargetID  *string                `json:"target_id,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	IPAddress *string                `json:"ip_address,omitempty"`
	UserAgent *string                `json:"user_agent,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

// Promotion represents a rule-based promotional discount program
type Promotion struct {
	ID              uuid.UUID        `json:"id"`
	BusinessID      uuid.UUID        `json:"business_id"`
	OutletID        *uuid.UUID       `json:"outlet_id,omitempty"`
	OutletName      *string          `json:"outlet_name,omitempty"`
	Name            string           `json:"name"`
	Code            *string          `json:"code,omitempty"`
	PromoType       string           `json:"promo_type"` // 'automatic', 'coupon_code', 'catalog_sale', 'manual_select'
	StartDate       time.Time        `json:"start_date"`
	EndDate         *time.Time       `json:"end_date,omitempty"`
	ActiveDays      []int            `json:"active_days"`
	ActiveTimeStart *string          `json:"active_time_start,omitempty"`
	ActiveTimeEnd   *string          `json:"active_time_end,omitempty"`
	MinOrderAmount  int64            `json:"min_order_amount"`
	MinQty          float64          `json:"min_qty"`
	UsageLimit      *int             `json:"usage_limit,omitempty"`
	UsageCount      int              `json:"usage_count"`
	RewardType      string           `json:"reward_type"` // 'discount_pct', 'discount_fixed', 'fixed_price'
	RewardValue     float64          `json:"reward_value"`
	MaxDiscountCap  *int64           `json:"max_discount_cap,omitempty"`
	TargetScope     string           `json:"target_scope"` // 'entire_order', 'specific_items', 'specific_categories'
	IsActive        bool             `json:"is_active"`
	CreatedBy       *uuid.UUID       `json:"created_by,omitempty"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
	TargetIDs       []uuid.UUID      `json:"target_ids,omitempty"`
	TargetItems     []TargetItemInfo `json:"target_items,omitempty"`
}

type TargetItemInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	SKU  string    `json:"sku,omitempty"`
}

// CreatePromotionRequest represents payload to create a new promotion
type CreatePromotionRequest struct {
	OutletID        *uuid.UUID  `json:"outlet_id,omitempty"`
	Name            string      `json:"name" validate:"required"`
	Code            *string     `json:"code,omitempty"`
	PromoType       string      `json:"promo_type" validate:"required"`
	StartDate       time.Time   `json:"start_date"`
	EndDate         *time.Time  `json:"end_date,omitempty"`
	ActiveDays      []int       `json:"active_days"`
	ActiveTimeStart *string     `json:"active_time_start,omitempty"`
	ActiveTimeEnd   *string     `json:"active_time_end,omitempty"`
	MinOrderAmount  int64       `json:"min_order_amount"`
	MinQty          float64     `json:"min_qty"`
	UsageLimit      *int        `json:"usage_limit,omitempty"`
	RewardType      string      `json:"reward_type" validate:"required"`
	RewardValue     float64     `json:"reward_value" validate:"required"`
	MaxDiscountCap  *int64      `json:"max_discount_cap,omitempty"`
	TargetScope     string      `json:"target_scope" validate:"required"`
	IsActive        bool        `json:"is_active"`
	TargetIDs       []uuid.UUID `json:"target_ids,omitempty"`
}

// UpdatePromotionRequest represents payload to update an existing promotion
type UpdatePromotionRequest struct {
	OutletID        *uuid.UUID  `json:"outlet_id,omitempty"`
	Name            *string     `json:"name,omitempty"`
	Code            *string     `json:"code,omitempty"`
	PromoType       *string     `json:"promo_type,omitempty"`
	StartDate       *time.Time  `json:"start_date,omitempty"`
	EndDate         *time.Time  `json:"end_date,omitempty"`
	ActiveDays      []int       `json:"active_days,omitempty"`
	ActiveTimeStart *string     `json:"active_time_start,omitempty"`
	ActiveTimeEnd   *string     `json:"active_time_end,omitempty"`
	MinOrderAmount  *int64      `json:"min_order_amount,omitempty"`
	MinQty          *float64    `json:"min_qty,omitempty"`
	UsageLimit      *int        `json:"usage_limit,omitempty"`
	RewardType      *string     `json:"reward_type,omitempty"`
	RewardValue     *float64    `json:"reward_value,omitempty"`
	MaxDiscountCap  *int64      `json:"max_discount_cap,omitempty"`
	TargetScope     *string     `json:"target_scope,omitempty"`
	IsActive        *bool       `json:"is_active,omitempty"`
	TargetIDs       []uuid.UUID `json:"target_ids,omitempty"`
}

// =========================================================================
// STOCK TRANSFERS & LOGISTICS (Multi-Item Delivery Orders / Surat Jalan)
// =========================================================================

type StockTransfer struct {
	ID                 uuid.UUID           `json:"id"`
	TransferNo         string              `json:"transfer_no"`
	BusinessID         uuid.UUID           `json:"business_id"`
	FromOutletID       uuid.UUID           `json:"from_outlet_id"`
	FromOutletName     string              `json:"from_outlet_name,omitempty"`
	ToOutletID         uuid.UUID           `json:"to_outlet_id"`
	ToOutletName       string              `json:"to_outlet_name,omitempty"`
	SentByUserID       uuid.UUID           `json:"sent_by_user_id"`
	SentByUserName     string              `json:"sent_by_user_name,omitempty"`
	SentToUserID       *uuid.UUID          `json:"sent_to_user_id,omitempty"`
	SentToUserName     string              `json:"sent_to_user_name,omitempty"`
	ReceivedByUserID   *uuid.UUID          `json:"received_by_user_id,omitempty"`
	ReceivedByUserName string              `json:"received_by_user_name,omitempty"`
	DriverName            *string             `json:"driver_name,omitempty"`
	DriverPhone           *string             `json:"driver_phone,omitempty"`
	VehiclePlate          *string             `json:"vehicle_plate,omitempty"`
	CarrierType           string              `json:"carrier_type,omitempty"` // internal_fleet, online_courier, 3rd_party, pickup
	ShippingCost          int64               `json:"shipping_cost"`
	ShippingCostPayer     string              `json:"shipping_cost_payer,omitempty"`
	ShippingPaymentMethod string              `json:"shipping_payment_method,omitempty"`
	TrackingRefNo         *string             `json:"tracking_ref_no,omitempty"`
	ShippingCostMode      string              `json:"shipping_cost_mode,omitempty"` // fixed, driver_claim, free
	MaxClaimBudget        int64               `json:"max_claim_budget,omitempty"`
	ClaimToken            *string             `json:"claim_token,omitempty"`
	ClaimStatus           string              `json:"claim_status,omitempty"` // none, pending, approved, rejected
	ClaimedAmount         int64               `json:"claimed_amount,omitempty"`
	ClaimedNotes          *string             `json:"claimed_notes,omitempty"`
	ClaimedAttachmentURL  *string             `json:"claimed_attachment_url,omitempty"`
	ClaimedAt             *time.Time          `json:"claimed_at,omitempty"`
	ClaimReviewedBy       *uuid.UUID          `json:"claim_reviewed_by,omitempty"`
	ClaimReviewedByName   string              `json:"claim_reviewed_by_name,omitempty"`
	ClaimReviewedAt       *time.Time          `json:"claim_reviewed_at,omitempty"`
	ClaimRejectionReason  *string             `json:"claim_rejection_reason,omitempty"`
	BackorderStatus       string              `json:"backorder_status,omitempty"` // none, has_backorder, is_backorder, closed
	ParentTransferID      *uuid.UUID          `json:"parent_transfer_id,omitempty"`
	Status                string              `json:"status"` // draft, pending_approval, in_transit, received, returned, cancelled
	TransferType          string              `json:"transfer_type"` // outbound, return, requisition
	Notes                 *string             `json:"notes,omitempty"`
	SentAt                time.Time           `json:"sent_at"`
	ReceivedAt            *time.Time          `json:"received_at,omitempty"`
	CreatedAt             time.Time           `json:"created_at"`
	UpdatedAt             time.Time           `json:"updated_at"`
	Items                 []StockTransferItem `json:"items,omitempty"`
}

type StockTransferItem struct {
	ID                 uuid.UUID `json:"id"`
	TransferID         uuid.UUID `json:"transfer_id"`
	ItemID             uuid.UUID `json:"item_id"`
	ItemName           string    `json:"item_name,omitempty"`
	ItemSKU            string    `json:"item_sku,omitempty"`
	BaseUnit           string    `json:"base_unit,omitempty"`
	BoxUnit            string    `json:"box_unit,omitempty"`
	ConversionRate     float64   `json:"conversion_rate,omitempty"`
	QtyRequestedSealed float64   `json:"qty_requested_sealed"`
	QtyRequestedLoose  float64   `json:"qty_requested_loose"`
	QtySentSealed      float64   `json:"qty_sent_sealed"`
	QtySentLoose       float64   `json:"qty_sent_loose"`
	QtyReceivedSealed  float64   `json:"qty_received_sealed"`
	QtyReceivedLoose   float64   `json:"qty_received_loose"`
	ShrinkageQty       float64   `json:"shrinkage_qty"`
	AllocationNotes    *string   `json:"allocation_notes,omitempty"`
	Notes              *string   `json:"notes,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}
