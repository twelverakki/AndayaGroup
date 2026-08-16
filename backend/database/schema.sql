-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Enum Types
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'discontinued');
CREATE TYPE business_type AS ENUM ('retail', 'fnb_production', 'fnb_franchise', 'fnb_branch');
CREATE TYPE staff_role AS ENUM ('manager', 'admin_gudang', 'staff');

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone_or_email TEXT UNIQUE,
    password_hash TEXT,
    pin_hash TEXT,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Businesses Table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type business_type NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Outlets Table
CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Business Owners Table (Many-to-Many Ownership)
CREATE TABLE business_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_business_owners UNIQUE(user_id, business_id, outlet_id)
);

-- 5. Outlet Staff Table (Scoped per Outlet)
CREATE TABLE outlet_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    role staff_role NOT NULL,
    can_view_cost BOOLEAN NOT NULL DEFAULT false,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Manager PINs Table (Manager Override PINs)
CREATE TABLE manager_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Tenant Scoping Performance (D-15, Phase 5)
CREATE INDEX idx_outlets_business_id ON outlets(business_id);
CREATE INDEX idx_business_owners_user_id ON business_owners(user_id);
CREATE INDEX idx_outlet_staff_user_id ON outlet_staff(user_id);
CREATE INDEX idx_outlet_staff_outlet_id ON outlet_staff(outlet_id);

-- =========================================================================
-- PHASE 2 TABLES (JnA Mart: Products, Inventory, POS Transactions & Shifts)
-- =========================================================================

-- Define Custom Enum Types for Phase 2
DO $$ BEGIN
    CREATE TYPE inventory_mode AS ENUM ('dry_strict', 'wet_infinite', 'simple', 'batch_thaw', 'same_day');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE unit_type AS ENUM ('pcs', 'pack', 'kg', 'carton', 'liter');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wastage_status AS ENUM ('pending_approval', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shift_status AS ENUM ('open', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('sale', 'internal_take', 'void');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('completed', 'voided');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'qris', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('paid', 'unpaid', 'partial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE batch_status AS ENUM ('sealed', 'opened');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quality_check_status AS ENUM ('pending', 'pass', 'discard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE override_action AS ENUM ('void', 'discount_override');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_business_category_name UNIQUE(business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);

-- A. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    sku TEXT,
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit_type unit_type NOT NULL,
    inventory_mode inventory_mode NOT NULL,
    purchase_price BIGINT NOT NULL DEFAULT 0,
    sell_price BIGINT NOT NULL DEFAULT 0,
    current_stock NUMERIC NOT NULL DEFAULT 0,
    min_stock_alert NUMERIC,
    image_url TEXT,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- B. Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_type unit_type NOT NULL,
    current_stock NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- C. Stock Conversions Table
CREATE TABLE IF NOT EXISTS stock_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    conversion_rate NUMERIC NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_conversion_target CHECK (
        (product_id IS NOT NULL AND ingredient_id IS NULL) OR 
        (product_id IS NULL AND ingredient_id IS NOT NULL)
    )
);

-- D. Stock Batches Table (For Bakso Kang Gemoy Batch Thaw)
CREATE TABLE IF NOT EXISTS stock_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    held_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_status batch_status NOT NULL DEFAULT 'sealed',
    quantity NUMERIC NOT NULL DEFAULT 0,
    opened_at TIMESTAMP,
    quality_checked_at TIMESTAMP,
    quality_check_status quality_check_status,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- E. Daily Material Logs Table (For Gorengan Andalan Dual-Track)
CREATE TABLE IF NOT EXISTS daily_material_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    qty_start NUMERIC NOT NULL DEFAULT 0,
    qty_remaining NUMERIC,
    qty_used_calculated NUMERIC,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_daily_material_log UNIQUE(outlet_id, ingredient_id, log_date)
);

-- F. Wastage Logs Table (For Blind Count Opname & Reconciliation)
CREATE TABLE IF NOT EXISTS wastage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    daily_material_log_id UUID REFERENCES daily_material_logs(id) ON DELETE SET NULL,
    expected_qty NUMERIC NOT NULL DEFAULT 0,
    actual_qty NUMERIC NOT NULL DEFAULT 0,
    discrepancy NUMERIC NOT NULL DEFAULT 0,
    input_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status wastage_status NOT NULL DEFAULT 'pending_approval',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_wastage_target CHECK (
        (product_id IS NOT NULL AND ingredient_id IS NULL) OR 
        (product_id IS NULL AND ingredient_id IS NOT NULL)
    )
);

-- G. Cashier Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opening_cash BIGINT NOT NULL DEFAULT 0,
    closing_cash_system BIGINT,
    closing_cash_actual BIGINT,
    variance BIGINT,
    status shift_status NOT NULL DEFAULT 'open',
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- H. Transactions Table (POS)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type transaction_type NOT NULL DEFAULT 'sale',
    total_amount BIGINT NOT NULL DEFAULT 0,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    status transaction_status NOT NULL DEFAULT 'completed',
    client_uuid UUID UNIQUE NOT NULL, -- Idempotency key for PWA sync
    synced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- I. Transaction Items Table
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty NUMERIC NOT NULL DEFAULT 0,
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- J. Override Logs Table
CREATE TABLE IF NOT EXISTS override_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action override_action NOT NULL,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- K. Procurements Table
CREATE TABLE IF NOT EXISTS procurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    supplier_name TEXT NOT NULL,
    total_cost BIGINT NOT NULL DEFAULT 0,
    payment_status payment_status NOT NULL DEFAULT 'unpaid',
    amount_owed BIGINT DEFAULT 0,
    procurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- L. Procurement Items Table
CREATE TABLE IF NOT EXISTS procurement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_id UUID NOT NULL REFERENCES procurements(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    qty NUMERIC NOT NULL DEFAULT 0,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    weight_actual NUMERIC,
    CONSTRAINT chk_procurement_target CHECK (
        (product_id IS NOT NULL AND ingredient_id IS NULL) OR 
        (product_id IS NULL AND ingredient_id IS NOT NULL)
    )
);

-- Indexes for Tenant Scoping Performance
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_products_outlet_id ON products(outlet_id);
CREATE INDEX idx_ingredients_business_id ON ingredients(business_id);
CREATE INDEX idx_wastage_logs_business_id ON wastage_logs(business_id);
CREATE INDEX idx_wastage_logs_outlet_id ON wastage_logs(outlet_id);
CREATE INDEX idx_shifts_outlet_id ON shifts(outlet_id);
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_outlet_id ON transactions(outlet_id);
CREATE INDEX idx_procurements_business_id ON procurements(business_id);
