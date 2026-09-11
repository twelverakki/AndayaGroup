-- =========================================================================
-- MASTER DATABASE SCHEMA: ANDAYA GROUP ERP (The Lean Odoo Way v3.1)
-- Multi-Tenant Lean ERP (POS + Inventory + Transfers + Production + Opname + Settlements)
-- Database Target: PostgreSQL 14+
-- =========================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enum Types
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'discontinued');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE business_type AS ENUM ('retail', 'fnb_production', 'fnb_franchise', 'fnb_branch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE staff_role AS ENUM ('manager', 'admin_gudang', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inventory_mode AS ENUM ('dry_strict', 'wet_infinite', 'simple', 'batch_thaw', 'same_day');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE unit_type AS ENUM ('pcs', 'pack', 'kg', 'carton', 'liter', 'portion', 'dus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'qris', 'bank_transfer', 'debt_receivable', 'free_internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tx_type AS ENUM ('sale', 'waste', 'internal_usage', 'return', 'wholesale', 'procurement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone_or_email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    pin_hash VARCHAR(255),
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BUSINESSES (with Universal Capability Flags)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type business_type NOT NULL,
    has_pos BOOLEAN NOT NULL DEFAULT TRUE,
    has_manufacturing BOOLEAN NOT NULL DEFAULT FALSE,
    has_logistics_hub BOOLEAN NOT NULL DEFAULT FALSE,
    has_eod_usage BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. OUTLETS
CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BUSINESS OWNERS (Many-to-Many Ownership)
CREATE TABLE IF NOT EXISTS business_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_owners UNIQUE(user_id, business_id, outlet_id)
);

-- 5. OUTLET STAFF
CREATE TABLE IF NOT EXISTS outlet_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    role staff_role NOT NULL,
    can_view_cost BOOLEAN NOT NULL DEFAULT FALSE,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_outlet_staff UNIQUE(user_id, outlet_id)
);

-- 6. MANAGER OVERRIDE PINS
CREATE TABLE IF NOT EXISTS manager_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pin_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. UNIFIED MASTER ITEMS
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    item_type VARCHAR(30) NOT NULL DEFAULT 'finished_good' CHECK (item_type IN ('finished_good', 'raw_material', 'consumable', 'fixed_tool')),
    is_sellable BOOLEAN NOT NULL DEFAULT TRUE,
    is_inventory_tracked BOOLEAN NOT NULL DEFAULT TRUE,
    requires_thaw BOOLEAN NOT NULL DEFAULT FALSE,
    base_unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    box_unit VARCHAR(20),
    conversion_rate NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
    sell_price BIGINT NOT NULL DEFAULT 0,
    standard_cost BIGINT NOT NULL DEFAULT 0,
    min_stock_alert NUMERIC(14, 4) DEFAULT 5.0000,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PRODUCTS (Legacy POS View & Catalog Compatibility)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    unit_type unit_type NOT NULL DEFAULT 'pcs',
    inventory_mode inventory_mode NOT NULL DEFAULT 'dry_strict',
    purchase_price BIGINT NOT NULL DEFAULT 0,
    sell_price BIGINT NOT NULL DEFAULT 0,
    current_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
    min_stock_alert NUMERIC(14, 4) DEFAULT 5,
    status user_status NOT NULL DEFAULT 'active',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INGREDIENTS (F&B Raw Materials Compatibility)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(50),
    category VARCHAR(50) NOT NULL DEFAULT 'raw_material',
    sub_category VARCHAR(100) DEFAULT 'General',
    unit_type VARCHAR(50) NOT NULL DEFAULT 'kg',
    unit_cost BIGINT DEFAULT 0,
    min_stock_alert NUMERIC(12, 2) DEFAULT 5.00,
    current_stock NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ITEM STOCKS (Current Balance Snapshot per Outlet / Staff)
CREATE TABLE IF NOT EXISTS item_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    held_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    qty_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    qty_loose NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_outlet_user UNIQUE(item_id, outlet_id, held_by_user_id)
);

-- 12. STOCK MOVEMENTS (Double-Entry Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    source_document_type VARCHAR(50) NOT NULL,
    source_document_id UUID,
    from_location_type VARCHAR(30) NOT NULL,
    from_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_location_type VARCHAR(30) NOT NULL,
    to_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    package_form VARCHAR(20) NOT NULL DEFAULT 'loose',
    qty NUMERIC(14, 4) NOT NULL,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. SHIFTS / POS SESSIONS
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opening_cash BIGINT NOT NULL DEFAULT 0,
    closing_cash_actual BIGINT,
    closing_cash_system BIGINT,
    cash_difference BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    notes TEXT
);

-- 14. TRANSACTIONS (Universal Sales Ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid UUID UNIQUE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'pos_retail',
    type tx_type NOT NULL DEFAULT 'sale',
    payment_method payment_method NOT NULL,
    total_amount BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    tax_amount BIGINT NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    debt_due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. TRANSACTION ITEMS
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    sku VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    qty NUMERIC(14, 4) NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. BILL OF MATERIALS (BOM Recipes)
CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    output_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    yield_qty NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. BOM ITEMS
CREATE TABLE IF NOT EXISTS bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    ingredient_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    qty_required NUMERIC(14, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. PRODUCTIONS (Work Orders & Batch Production Runs)
CREATE TABLE IF NOT EXISTS productions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    bom_id UUID REFERENCES boms(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    batch_no VARCHAR(50) NOT NULL,
    qty_produced NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total_material_cost BIGINT NOT NULL DEFAULT 0,
    hpp_per_unit BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    produced_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. PRODUCTION EXPENSES
CREATE TABLE IF NOT EXISTS production_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    qty_used NUMERIC(14, 4) NOT NULL,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. DISTRIBUTIONS / STOCK TRANSFERS
CREATE TABLE IF NOT EXISTS distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    from_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    to_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    sent_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    qty NUMERIC(14, 4) NOT NULL,
    distribution_type VARCHAR(30) NOT NULL DEFAULT 'outbound',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    shrinkage_tolerance_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    shrinkage_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ
);

-- 21. EOD MATERIAL USAGES
CREATE TABLE IF NOT EXISTS eod_material_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    settlement_id UUID,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    initial_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    restock_in NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    final_opname_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    consumed_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. DAILY SETTLEMENTS (Shift / Day Reconciliation)
CREATE TABLE IF NOT EXISTS daily_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid UUID UNIQUE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_target_revenue BIGINT NOT NULL DEFAULT 0,
    cash_collected BIGINT NOT NULL DEFAULT 0,
    qris_collected BIGINT NOT NULL DEFAULT 0,
    total_collected BIGINT NOT NULL DEFAULT 0,
    total_variance BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. DAILY SETTLEMENT ITEMS
CREATE TABLE IF NOT EXISTS daily_settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES daily_settlements(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    opening_loose NUMERIC(14, 4) NOT NULL DEFAULT 0,
    thawed_loose NUMERIC(14, 4) NOT NULL DEFAULT 0,
    actual_loose NUMERIC(14, 4) NOT NULL DEFAULT 0,
    actual_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0,
    discard_loose NUMERIC(14, 4) NOT NULL DEFAULT 0,
    sold_qty NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_price BIGINT NOT NULL DEFAULT 0,
    target_revenue BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. STOCK OPNAME SESSIONS
CREATE TABLE IF NOT EXISTS opname_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    session_name VARCHAR(120) NOT NULL,
    target_category VARCHAR(50) DEFAULT 'all',
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 25. STOCK OPNAME ITEMS
CREATE TABLE IF NOT EXISTS opname_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opname_session_id UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    expected_qty NUMERIC(14, 4) NOT NULL DEFAULT 0,
    actual_qty NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_cost BIGINT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. PROCUREMENTS / PURCHASES
CREATE TABLE IF NOT EXISTS procurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    supplier_name VARCHAR(100) NOT NULL,
    invoice_no VARCHAR(50),
    total_amount BIGINT NOT NULL DEFAULT 0,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. PROCUREMENT ITEMS
CREATE TABLE IF NOT EXISTS procurement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_id UUID NOT NULL REFERENCES procurements(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    qty NUMERIC(14, 4) NOT NULL DEFAULT 1,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. WASTAGE LOGS
CREATE TABLE IF NOT EXISTS wastage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    qty NUMERIC(14, 4) NOT NULL DEFAULT 1,
    cost_amount BIGINT NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 29. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 30. STOCK BATCHES
CREATE TABLE IF NOT EXISTS stock_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    batch_number VARCHAR(50) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    batch_status VARCHAR(30) NOT NULL DEFAULT 'sealed',
    thawed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MIGRATION COMPATIBILITY ENSURANCE
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_pos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_manufacturing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_logistics_hub BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_eod_usage BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE items ADD COLUMN IF NOT EXISTS requires_thaw BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS min_stock_alert NUMERIC(14,4) DEFAULT 5.0000;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(14,4) NOT NULL DEFAULT 1.0000;
ALTER TABLE items ADD COLUMN IF NOT EXISTS box_unit VARCHAR(20);
ALTER TABLE items ADD COLUMN IF NOT EXISTS standard_cost BIGINT NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sell_price BIGINT NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_inventory_tracked BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE productions ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES boms(id) ON DELETE SET NULL;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS batch_no VARCHAR(50);
ALTER TABLE productions ADD COLUMN IF NOT EXISTS qty_produced NUMERIC(14,4) DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS total_material_cost BIGINT DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS hpp_per_unit BIGINT DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed';
ALTER TABLE productions ADD COLUMN IF NOT EXISTS produced_by UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE productions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE productions ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE production_expenses ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE production_expenses ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;
ALTER TABLE production_expenses ADD COLUMN IF NOT EXISTS unit_cost BIGINT DEFAULT 0;
ALTER TABLE production_expenses ADD COLUMN IF NOT EXISTS total_cost BIGINT DEFAULT 0;
ALTER TABLE production_expenses ADD COLUMN IF NOT EXISTS qty_used NUMERIC(14,4) DEFAULT 0;
ALTER TABLE production_expenses ALTER COLUMN ingredient_id DROP NOT NULL;

ALTER TABLE distributions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS from_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS to_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS sent_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS distribution_type VARCHAR(30) NOT NULL DEFAULT 'outbound';
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS shrinkage_tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS shrinkage_qty NUMERIC(14,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE distributions ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash_actual BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_cash_system BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_difference BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE shifts ALTER COLUMN cashier_id DROP NOT NULL;
ALTER TABLE shifts ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS channel VARCHAR(30) NOT NULL DEFAULT 'pos_retail';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subtotal BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN cashier_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS sku VARCHAR(50);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS unit_price BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS price BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS subtotal BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS unit_cost BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS total_cost BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE transaction_items ALTER COLUMN product_name DROP NOT NULL;
ALTER TABLE transaction_items ALTER COLUMN price DROP NOT NULL;

ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS sold_qty NUMERIC(14,4) DEFAULT 0;
ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS unit_price BIGINT DEFAULT 0;
ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS target_revenue BIGINT DEFAULT 0;
ALTER TABLE daily_settlement_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE procurements ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(100);
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS total_amount BIGINT DEFAULT 0;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS total_cost BIGINT DEFAULT 0;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS amount_owed BIGINT DEFAULT 0;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS procurement_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE procurements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE procurements ALTER COLUMN invoice_number DROP NOT NULL;
ALTER TABLE procurements ALTER COLUMN total_cost DROP NOT NULL;

ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;
ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS total_cost BIGINT DEFAULT 0;
ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS subtotal BIGINT DEFAULT 0;
ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS unit_cost BIGINT DEFAULT 0;
ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS cost_per_unit BIGINT DEFAULT 0;
ALTER TABLE procurement_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE procurement_items ALTER COLUMN ingredient_id DROP NOT NULL;

ALTER TABLE opname_sessions ADD COLUMN IF NOT EXISTS target_category VARCHAR(50) DEFAULT 'all';
ALTER TABLE opname_sessions ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE opname_sessions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE opname_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS unit_cost BIGINT DEFAULT 0;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS expected_qty NUMERIC(14,4) DEFAULT 0;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS actual_qty NUMERIC(14,4) DEFAULT 0;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS difference_qty NUMERIC(14,4) DEFAULT 0;
ALTER TABLE opname_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE opname_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE opname_items ALTER COLUMN ingredient_id DROP NOT NULL;

ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS cost_amount BIGINT DEFAULT 0;
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'approved';
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wastage_logs ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE stock_batches ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS source_document_type VARCHAR(50);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS from_location_type VARCHAR(30);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS from_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS from_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_location_type VARCHAR(30);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS package_form VARCHAR(20) DEFAULT 'loose';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS qty NUMERIC(14,4) DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost BIGINT DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost BIGINT DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS movement_type VARCHAR(50);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS qty_sealed_change NUMERIC(14,4) DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS qty_loose_change NUMERIC(14,4) DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE stock_movements ALTER COLUMN movement_type DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN outlet_id DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN source_document_type DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN from_location_type DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN to_location_type DROP NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN performed_by DROP NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE daily_settlements ADD COLUMN IF NOT EXISTS settlement_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE daily_settlements ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE daily_settlements ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE daily_settlements DROP CONSTRAINT IF EXISTS unique_daily_settlement;

ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS qty_sold NUMERIC(14,4) DEFAULT 0;
ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS unit_sell_price BIGINT DEFAULT 0;
ALTER TABLE daily_settlement_items ADD COLUMN IF NOT EXISTS subtotal_target_revenue BIGINT DEFAULT 0;

-- PERFORMANCE INDEXES (Tenant Scoping & Query Optimization)
CREATE INDEX IF NOT EXISTS idx_outlets_business_id ON outlets(business_id);
CREATE INDEX IF NOT EXISTS idx_business_owners_user_id ON business_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_outlet_staff_user_id ON outlet_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_outlet_staff_outlet_id ON outlet_staff(outlet_id);
CREATE INDEX IF NOT EXISTS idx_items_business_id ON items(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_id ON stock_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_item_stocks_lookup ON item_stocks(item_id, outlet_id, held_by_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_business ON daily_settlements(business_id);
CREATE INDEX IF NOT EXISTS idx_eod_material_usages_business ON eod_material_usages(business_id);
