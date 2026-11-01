-- 002_lean_odoo_core_and_unified_items.sql
-- Capability flags, unified 3NF items master, and POS/Production/Wastage item_id alignment

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_pos BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_manufacturing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_logistics_hub BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_eod_usage BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS has_multi_outlets BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hide_central_stock_from_branches BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS allow_cross_branch_stock_view BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE outlets ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS receipt_footer TEXT;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS allow_direct_purchase BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE outlets SET is_main = TRUE WHERE is_main IS FALSE AND (name ILIKE '%utama%' OR name ILIKE '%pusat%' OR name ILIKE '%kaliurang%' OR name ILIKE '%gejayan%');

ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_type VARCHAR(30) NOT NULL DEFAULT 'finished_good';
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_category_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_category_type_check CHECK (category_type IN ('finished_good', 'semi_finished', 'raw_material', 'consumable', 'fixed_tool'));

ALTER TABLE items ADD COLUMN IF NOT EXISTS box_sell_price BIGINT NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS requires_thaw BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_produced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_thawable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_unit VARCHAR(20) NOT NULL DEFAULT 'base';
ALTER TABLE items ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS creation_source VARCHAR(30) NOT NULL DEFAULT 'manual';
ALTER TABLE items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS allow_branch_purchase BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_items_needs_review ON items (business_id) WHERE needs_review = TRUE;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_type_check;
ALTER TABLE items ADD CONSTRAINT items_item_type_check CHECK (item_type IN ('finished_good', 'semi_finished', 'raw_material', 'consumable', 'fixed_tool'));
UPDATE items SET is_thawable = requires_thaw WHERE is_thawable IS FALSE AND requires_thaw IS TRUE;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS channel VARCHAR(30) NOT NULL DEFAULT 'pos_retail';
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS sku VARCHAR(50);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS unit_cost BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS total_cost BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transaction_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE wastage_logs ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE wastage_logs DROP CONSTRAINT IF EXISTS chk_wastage_target;

ALTER TABLE productions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE productions ALTER COLUMN product_id DROP NOT NULL;
