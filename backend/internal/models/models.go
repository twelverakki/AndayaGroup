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
	ID        uuid.UUID    `json:"id"`
	Name      string       `json:"name"`
	Type      BusinessType `json:"type"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

// Outlet represents a physical branch/location under a business
type Outlet struct {
	ID         uuid.UUID `json:"id"`
	BusinessID uuid.UUID `json:"business_id"`
	Name       string    `json:"name"`
	Address    *string   `json:"address,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
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
	BusinessID *uuid.UUID   `json:"business_id"`
	OutletID   *uuid.UUID   `json:"outlet_id"`
	Role       string       `json:"role"` // "owner", "manager", "admin_gudang", "staff"
	Name       string       `json:"name"`
	Type       BusinessType `json:"type,omitempty"`
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
	ID         uuid.UUID `json:"id"`
	BusinessID uuid.UUID `json:"business_id"`
	Name       string    `json:"name"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
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

// Ingredient represents an ingredient raw material
type Ingredient struct {
	ID           uuid.UUID  `json:"id"`
	BusinessID   uuid.UUID  `json:"business_id"`
	OutletID     *uuid.UUID `json:"outlet_id,omitempty"`
	Name         string     `json:"name"`
	UnitType     UnitType   `json:"unit_type"`
	CurrentStock float64    `json:"current_stock"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
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

// StockBatch represents product batch (specifically for Bakso thawing)
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
	ID            uuid.UUID         `json:"id"`
	BusinessID    uuid.UUID         `json:"business_id"`
	OutletID      uuid.UUID         `json:"outlet_id"`
	ShiftID       *uuid.UUID        `json:"shift_id,omitempty"`
	StaffID       uuid.UUID         `json:"staff_id"`
	Type          TransactionType   `json:"type"`
	TotalAmount   int64             `json:"total_amount"`
	PaymentMethod PaymentMethod     `json:"payment_method"`
	Status        TransactionStatus `json:"status"`
	ClientUUID    uuid.UUID         `json:"client_uuid"`
	SyncedAt      *time.Time        `json:"synced_at,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

// TransactionItem represents an item within a transaction
type TransactionItem struct {
	ID            uuid.UUID `json:"id"`
	TransactionID uuid.UUID `json:"transaction_id"`
	ProductID     uuid.UUID `json:"product_id"`
	Qty           float64   `json:"qty"`
	UnitPrice     int64     `json:"unit_price"`
	Subtotal      int64     `json:"subtotal"`
	CreatedAt     time.Time `json:"created_at"`
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
// PHASE 3 MODELS (Bakso Kang Gemoy: Production & Distribution)
// =========================================================================

// ProductionExpense represents the expense log of ingredients/tools per production
type ProductionExpense struct {
	ID           uuid.UUID `json:"id"`
	ProductionID uuid.UUID `json:"production_id"`
	IngredientID uuid.UUID `json:"ingredient_id"`
	Quantity     float64   `json:"quantity"`
	CreatedAt    time.Time `json:"created_at"`
}

// Production represents production log of a product (for Bakso Kang Gemoy)
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
	DistSent     DistributionStatus = "sent"
	DistReceived DistributionStatus = "received"
)

// DistributionType ENUM type
type DistributionType string

const (
	TypeOutbound DistributionType = "outbound"
	TypeReturn   DistributionType = "return"
)

// Distribution represents stock distribution from gudang to cart/staff (or return)
type Distribution struct {
	ID            uuid.UUID          `json:"id"`
	BusinessID    uuid.UUID          `json:"business_id"`
	ProductID     uuid.UUID          `json:"product_id"`
	SentToUserID  uuid.UUID          `json:"sent_to_user_id"`
	Qty           float64            `json:"qty"`
	Status        DistributionStatus `json:"status"`
	Type          DistributionType   `json:"type"`
	ProductionID  *uuid.UUID         `json:"production_id,omitempty"`
	SentAt        time.Time          `json:"sent_at"`
	ReceivedAt    *time.Time         `json:"received_at,omitempty"`
	CreatedAt     time.Time          `json:"created_at"`
}

