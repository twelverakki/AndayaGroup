-- =========================================================================
-- MASTER SEED DATA: ANDAYA GROUP ERP (The Lean Odoo Way v3.1)
-- Multi-Tenant Realistic Dataset for 4 Businesses:
-- 1. JnA Mart (Modern Retail Grocery)
-- 2. Bakso Kang Gemoy (F&B Central Kitchen & Mobile Carts)
-- 3. Yasaka Fried Chicken (F&B Franchise / Multi-Branch)
-- 4. Gorengan Andalan (F&B Personal Brand / EOD Usage)
-- =========================================================================

-- Clean existing data in reverse FK order
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE wastage_logs CASCADE;
TRUNCATE TABLE stock_batches CASCADE;
TRUNCATE TABLE opname_items CASCADE;
TRUNCATE TABLE opname_sessions CASCADE;
TRUNCATE TABLE procurement_items CASCADE;
TRUNCATE TABLE procurements CASCADE;
TRUNCATE TABLE eod_material_usages CASCADE;
TRUNCATE TABLE daily_settlement_items CASCADE;
TRUNCATE TABLE daily_settlements CASCADE;
TRUNCATE TABLE distributions CASCADE;
TRUNCATE TABLE production_expenses CASCADE;
TRUNCATE TABLE productions CASCADE;
TRUNCATE TABLE bom_items CASCADE;
TRUNCATE TABLE boms CASCADE;
TRUNCATE TABLE transaction_items CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE shifts CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE item_stocks CASCADE;
TRUNCATE TABLE ingredients CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE items CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE manager_pins CASCADE;
TRUNCATE TABLE outlet_staff CASCADE;
TRUNCATE TABLE business_owners CASCADE;
TRUNCATE TABLE outlets CASCADE;
TRUNCATE TABLE businesses CASCADE;
TRUNCATE TABLE users CASCADE;

-- =========================================================================
-- 1. USERS
-- Password for all accounts: "password123" (Bcrypt: $2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje)
-- Default PIN for all accounts: "1234" / "123456" (Bcrypt: $2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta)
-- =========================================================================
INSERT INTO users (id, name, phone_or_email, password_hash, pin_hash, status) VALUES
-- Superadmin Platform (Forgot Password Supported via Superadmin Email)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', 'Superadmin Platform', 'superadmin@andaya.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Owner A: JnA Mart & Gorengan Andalan (Forgot Password Supported via Gmail)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Hendra Owner (JnA & Gorengan)', 'hendra.owner@gmail.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Owner B: Bakso Kang Gemoy & Yasaka (Forgot Password Supported via Gmail)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Budi Owner (Bakso & Yasaka)', 'baksokanggemoy@gmail.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Managers (Edge-Case Non-Gmail / Domain Akun)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Siti Manager JnA', 'siti@jnamart.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Dewi Manager Gorengan', 'dewi@gorengan.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'Rian Manager Yasaka', 'rian@yasaka.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Staff / Cashiers (Edge-Case PIN-First & Non-Gmail)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Adi Kasir JnA', 'adi@jnamart.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Eko Staff Gorengan', 'eko@gorengan.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Gani Mitra Bakso', 'gani@bakso.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'Fajar Kasir Yasaka', 'fajar@yasaka.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Admin Gudang Pusat
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'Bambang Admin Gudang', 'gudang@andaya.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active');

-- =========================================================================
-- 2. BUSINESSES (with Domain Capability Flags)
-- =========================================================================
INSERT INTO businesses (id, name, type, has_pos, has_manufacturing, has_logistics_hub, has_eod_usage) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'JnA Mart', 'retail', TRUE, FALSE, FALSE, FALSE),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bakso Kang Gemoy', 'fnb_production', TRUE, TRUE, TRUE, FALSE),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Yasaka Fried Chicken', 'fnb_franchise', TRUE, FALSE, TRUE, FALSE),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Andalan', 'fnb_branch', TRUE, FALSE, FALSE, TRUE);

-- =========================================================================
-- 3. OUTLETS
-- =========================================================================
INSERT INTO outlets (id, business_id, name, address) VALUES
-- JnA Mart
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'JnA Mart - Toko Utama', 'Jl. Raya Pasar Tradisional No. 12, Sleman'),
-- Bakso Kang Gemoy
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bakso Kang Gemoy - Gudang Pusat', 'Jl. Magelang KM 8, Sleman'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bakso Kang Gemoy - Gerobak Titik 1', 'Depan Kampus UGM, Yogyakarta'),
-- Yasaka Fried Chicken
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Yasaka - Outlet Kaliurang', 'Jl. Kaliurang KM 5 No. 40, Sleman'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c23', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Yasaka - Outlet Seturan', 'Jl. Seturan Raya No. 18, Sleman'),
-- Gorengan Andalan
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Andalan - Cabang Gejayan', 'Jl. Affandi Gejayan No. 45, Yogyakarta'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Andalan - Cabang Malioboro', 'Jl. Malioboro No. 88, Yogyakarta');

-- =========================================================================
-- 4. BUSINESS OWNERS (Many-to-Many Ownership Assignments)
-- =========================================================================
INSERT INTO business_owners (user_id, business_id, outlet_id) VALUES
-- Kennan owns JnA Mart & Gorengan Andalan
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', NULL),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', NULL),
-- Budi owns Bakso Kang Gemoy & Yasaka Fried Chicken
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', NULL),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', NULL);

-- =========================================================================
-- 5. OUTLET STAFF (Role Assignments)
-- =========================================================================
INSERT INTO outlet_staff (user_id, outlet_id, role, can_view_cost, status) VALUES
-- JnA Mart
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'manager', TRUE, 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'staff', FALSE, 'active'),
-- Bakso Kang Gemoy
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'admin_gudang', TRUE, 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'staff', FALSE, 'active'),
-- Yasaka Fried Chicken
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'manager', TRUE, 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'staff', FALSE, 'active'),
-- Gorengan Andalan
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'manager', TRUE, 'active'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'staff', FALSE, 'active');

-- =========================================================================
-- 6. MANAGER OVERRIDE PINS
-- =========================================================================
INSERT INTO manager_pins (user_id, pin_hash) VALUES
-- Siti (JnA Manager): "9999" (Hash: $2a$12$oa1oF6A.NwBbOb2fLfNhy.ygNXKlhsNWv/q7bCD2w7cMrF8u6mS4W)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '$2a$12$oa1oF6A.NwBbOb2fLfNhy.ygNXKlhsNWv/q7bCD2w7cMrF8u6mS4W'),
-- Dewi (Gorengan Manager): "8888" (Hash: $2a$12$.GOPxOGc1aLgtPTbrLd/ruoLCY8dyJcishSTH7a2yqqNIP4gG0W96)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', '$2a$12$.GOPxOGc1aLgtPTbrLd/ruoLCY8dyJcishSTH7a2yqqNIP4gG0W96'),
-- Rian (Yasaka Manager): "7777" (Hash: $2a$12$oa1oF6A.NwBbOb2fLfNhy.ygNXKlhsNWv/q7bCD2w7cMrF8u6mS4W)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', '$2a$12$oa1oF6A.NwBbOb2fLfNhy.ygNXKlhsNWv/q7bCD2w7cMrF8u6mS4W');

-- =========================================================================
-- 7. CATEGORIES
-- =========================================================================
INSERT INTO categories (id, business_id, name) VALUES
-- JnA Mart Categories
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Makanan Ringan'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Minuman Dingin'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Sembako & Kebutuhan'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Sayuran Segar'),
-- Bakso Kang Gemoy Categories
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d21', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bahan Mentah Produksi'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Produk Olahan Beku'),
-- Yasaka Fried Chicken Categories
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d31', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Bahan Baku Ayam & Tepung'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d32', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Menu Siap Saji'),
-- Gorengan Andalan Categories
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d41', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Bahan Curah Harian'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Hangat');

-- =========================================================================
-- 8. UNIFIED MASTER ITEMS & PRODUCTS
-- =========================================================================

-- A. JnA Mart Items & Products (Retail)
INSERT INTO items (id, business_id, category_id, sku, name, item_type, is_sellable, is_inventory_tracked, requires_thaw, base_unit, box_unit, conversion_rate, sell_price, standard_cost, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', '8886008101053', 'Indomie Goreng Spesial 85g', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'dus', 40.0, 3500, 2600, 20.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', '8992775023018', 'Chitato Sapi Panggang 68g', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'dus', 30.0, 9500, 7500, 10.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12', '8992761136015', 'Coca Cola Botol 390ml', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'dus', 24.0, 5500, 4100, 15.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', '8998866009988', 'Minyak Goreng Bimoli 1L', 'finished_good', TRUE, TRUE, FALSE, 'liter', 'dus', 12.0, 19500, 16000, 8.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', '8998077610012', 'Beras Pandan Wangi 5kg', 'finished_good', TRUE, TRUE, FALSE, 'sak', 'sak', 1.0, 70000, 62000, 5.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e16', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14', 'WG-BAYAM-01', 'Bayam Ikat Segar', 'finished_good', TRUE, TRUE, FALSE, 'ikat', 'ikat', 1.0, 2500, 1500, 5.0, 'active');

INSERT INTO products (id, business_id, outlet_id, category_id, sku, name, unit_type, inventory_mode, purchase_price, sell_price, current_stock, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', '8886008101053', 'Indomie Goreng Spesial 85g', 'pcs', 'dry_strict', 2600, 3500, 120, 20, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', '8992775023018', 'Chitato Sapi Panggang 68g', 'pcs', 'dry_strict', 7500, 9500, 50, 10, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12', '8992761136015', 'Coca Cola Botol 390ml', 'pcs', 'dry_strict', 4100, 5500, 60, 15, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', '8998866009988', 'Minyak Goreng Bimoli 1L', 'liter', 'simple', 16000, 19500, 35, 8, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', '8998077610012', 'Beras Pandan Wangi 5kg', 'kg', 'simple', 62000, 70000, 25, 5, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e16', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14', 'WG-BAYAM-01', 'Bayam Ikat Segar', 'pcs', 'wet_infinite', 1500, 2500, 0, NULL, 'active');

-- B. Bakso Kang Gemoy Items & Products (Central Kitchen & Mobile Carts)
INSERT INTO items (id, business_id, category_id, sku, name, item_type, is_sellable, is_inventory_tracked, requires_thaw, base_unit, box_unit, conversion_rate, sell_price, standard_cost, min_stock_alert, status) VALUES
-- Raw Materials
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e21', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d21', 'RAW-DAGING-01', 'Daging Sapi Giling Segar', 'raw_material', FALSE, TRUE, FALSE, 'kg', 'dus', 10.0, 0, 110000, 10.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d21', 'RAW-TEPUNG-01', 'Tepung Tapioka Super', 'raw_material', FALSE, TRUE, FALSE, 'kg', 'sak', 25.0, 0, 18000, 25.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e23', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d21', 'RAW-BUMBU-01', 'Bumbu Racik Kuah Bakso', 'raw_material', FALSE, TRUE, FALSE, 'kg', 'pack', 5.0, 0, 45000, 5.0, 'active'),
-- Finished Goods
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'FG-BAKSO-ORI', 'Bakso Sapi Kuah Pack (20 pcs)', 'finished_good', TRUE, TRUE, TRUE, 'pcs', 'pack', 20.0, 2500, 30000, 15.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e25', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'FG-BAKSO-MRC', 'Bakso Mercon Pack (20 pcs)', 'finished_good', TRUE, TRUE, TRUE, 'pcs', 'pack', 20.0, 3000, 35000, 10.0, 'active');

INSERT INTO products (id, business_id, outlet_id, category_id, sku, name, unit_type, inventory_mode, purchase_price, sell_price, current_stock, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'FG-BAKSO-ORI', 'Bakso Sapi Kuah Pack (20 pcs)', 'pack', 'batch_thaw', 30000, 45000, 60, 10, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e25', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'FG-BAKSO-MRC', 'Bakso Mercon Pack (20 pcs)', 'pack', 'batch_thaw', 35000, 55000, 40, 10, 'active');

-- C. Yasaka Fried Chicken Items & Products (Franchise)
INSERT INTO items (id, business_id, category_id, sku, name, item_type, is_sellable, is_inventory_tracked, requires_thaw, base_unit, box_unit, conversion_rate, sell_price, standard_cost, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e31', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d31', 'RAW-AYAM-MAR', 'Ayam Potong Marinasi', 'raw_material', FALSE, TRUE, TRUE, 'potong', 'pack', 10.0, 0, 60000, 20.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e32', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d31', 'RAW-TEPUNG-YSK', 'Tepung Bumbu Yasaka Crispy', 'raw_material', FALSE, TRUE, FALSE, 'kg', 'sak', 20.0, 0, 22000, 10.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d32', 'YSK-PAHA-ATS', 'Yasaka Ayam Crispy Paha Atas', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'porsi', 1.0, 11000, 6500, 15.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e34', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d32', 'YSK-DADA-ORI', 'Yasaka Ayam Crispy Dada', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'porsi', 1.0, 12000, 7000, 15.0, 'active');

INSERT INTO products (id, business_id, outlet_id, category_id, sku, name, unit_type, inventory_mode, purchase_price, sell_price, current_stock, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d32', 'YSK-PAHA-ATS', 'Yasaka Ayam Crispy Paha Atas', 'pcs', 'simple', 6500, 11000, 45, 10, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e34', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d32', 'YSK-DADA-ORI', 'Yasaka Ayam Crispy Dada', 'pcs', 'simple', 7000, 12000, 40, 10, 'active');

-- D. Gorengan Andalan Items & Products (EOD Usage)
INSERT INTO items (id, business_id, category_id, sku, name, item_type, is_sellable, is_inventory_tracked, requires_thaw, base_unit, box_unit, conversion_rate, sell_price, standard_cost, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e41', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d41', 'RAW-MINYAK-CUR', 'Minyak Goreng Curah Drum', 'raw_material', FALSE, TRUE, FALSE, 'liter', 'drum', 200.0, 0, 14000, 20.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e42', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d41', 'RAW-TEPUNG-TER', 'Tepung Terigu Segitiga', 'raw_material', FALSE, TRUE, FALSE, 'kg', 'sak', 25.0, 0, 11500, 25.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e43', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'GOR-BAKWAN', 'Bakwan Sayur Gurih', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'pcs', 1.0, 1500, 650, 20.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'GOR-TEMPE-MND', 'Tempe Mendoan Panas', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'pcs', 1.0, 1500, 700, 20.0, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e45', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'GOR-TAHU-ISI', 'Tahu Isi Pedas', 'finished_good', TRUE, TRUE, FALSE, 'pcs', 'pcs', 1.0, 2000, 900, 20.0, 'active');

INSERT INTO products (id, business_id, outlet_id, category_id, sku, name, unit_type, inventory_mode, purchase_price, sell_price, current_stock, min_stock_alert, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e43', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'GOR-BAKWAN', 'Bakwan Sayur Gurih', 'pcs', 'simple', 650, 1500, 80, 20, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'GOR-TEMPE-MND', 'Tempe Mendoan Panas', 'pcs', 'simple', 700, 1500, 75, 20, 'active'),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e45', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d42', 'GOR-TAHU-ISI', 'Tahu Isi Pedas', 'pcs', 'simple', 900, 2000, 60, 20, 'active');

-- =========================================================================
-- 9. ITEM STOCKS (Warehouse & Staff Personal Balances)
-- =========================================================================
INSERT INTO item_stocks (item_id, outlet_id, held_by_user_id, qty_sealed, qty_loose) VALUES
-- JnA Mart Main Store Stock
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', NULL, 3.0, 120.0), -- 3 dus + 120 pcs
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', NULL, 2.0, 50.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', NULL, 2.0, 60.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', NULL, 3.0, 35.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e15', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', NULL, 25.0, 0.0),
-- Bakso Gudang Pusat Stock
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e21', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', NULL, 5.0, 50.0), -- 50 kg Daging
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', NULL, 4.0, 100.0), -- 100 kg Tepung
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e23', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', NULL, 4.0, 20.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', NULL, 60.0, 0.0), -- 60 Pack Bakso Ori
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e25', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', NULL, 40.0, 0.0), -- 40 Pack Bakso Mercon
-- Bakso Gani Personal Stock (Mobile Cart)
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 8.0, 40.0), -- 8 pack sealed + 40 pcs loose (thawed)
-- Yasaka Fried Chicken Stock
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e31', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', NULL, 5.0, 50.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e32', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', NULL, 2.0, 40.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', NULL, 0.0, 45.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e34', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', NULL, 0.0, 40.0),
-- Gorengan Andalan Stock
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e41', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', NULL, 1.0, 150.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e42', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', NULL, 2.0, 50.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e43', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', NULL, 0.0, 80.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e44', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', NULL, 0.0, 75.0),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e45', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', NULL, 0.0, 60.0);

-- =========================================================================
-- 10. BILL OF MATERIALS (BOM Recipes)
-- =========================================================================
INSERT INTO boms (id, business_id, output_item_id, name, yield_qty, notes) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'Resep Standar Bakso Sapi Kuah 20 Pack', 20.0, 'Batch standar Central Kitchen');

INSERT INTO bom_items (id, bom_id, ingredient_item_id, qty_required) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e21', 4.0),  -- 4 kg Daging
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f13', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 8.0),  -- 8 kg Tepung Tapioka
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f14', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e23', 0.5);  -- 0.5 kg Bumbu Racik

-- =========================================================================
-- 11. PRODUCTION RUN (Completed Work Order)
-- =========================================================================
INSERT INTO productions (id, business_id, outlet_id, bom_id, item_id, product_id, batch_no, qty_produced, total_material_cost, hpp_per_unit, status, produced_by) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380111', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'BATCH-2026-0901', 20.0, 606500, 30325, 'completed', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20');

INSERT INTO production_expenses (id, production_id, item_id, qty_used, unit_cost, total_cost) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380112', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380111', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e21', 4.0, 110000, 440000),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380113', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380111', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 8.0, 18000, 144000),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380114', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380111', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e23', 0.5, 45000, 22500);

-- =========================================================================
-- 12. DISTRIBUTIONS / TRANSFERS (Handshake Delivery)
-- =========================================================================
INSERT INTO distributions (id, business_id, item_id, product_id, from_outlet_id, to_outlet_id, outlet_id, sent_by_user_id, sent_to_user_id, received_by_user_id, qty, distribution_type, status, shrinkage_tolerance_pct, shrinkage_qty, notes, received_at) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380121', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 10.0, 'outbound', 'received', 2.0, 0.0, 'Pengiriman 10 pack beku ke Gerobak UGM', NOW());

-- =========================================================================
-- 13. POS SHIFTS & TRANSACTIONS
-- =========================================================================
-- JnA Mart Cashier Shift
INSERT INTO shifts (id, outlet_id, cashier_id, user_id, staff_id, opening_cash, closing_cash_actual, closing_cash_system, cash_difference, status, started_at, ended_at) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380131', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 100000, 245000, 245000, 0, 'closed', NOW() - INTERVAL '8 HOURS', NOW() - INTERVAL '1 HOUR'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380132', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 150000, NULL, NULL, NULL, 'open', NOW() - INTERVAL '30 MINUTES', NULL);

-- JnA Mart POS Sales Transaction
INSERT INTO transactions (id, client_uuid, business_id, outlet_id, shift_id, cashier_id, user_id, staff_id, channel, type, payment_method, total_amount, subtotal, tax_amount, discount_amount, created_at) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380141', gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380131', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'pos_retail', 'sale', 'cash', 145000, 145000, 0, 0, NOW() - INTERVAL '4 HOURS');

INSERT INTO transaction_items (id, transaction_id, item_id, product_id, sku, name, qty, unit_price, subtotal, unit_cost, total_cost) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380142', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380141', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', '8886008101053', 'Indomie Goreng Spesial 85g', 10.0, 3500, 35000, 2600, 26000),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380143', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380141', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e15', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e15', '8998077610012', 'Beras Pandan Wangi 5kg', 1.0, 70000, 70000, 62000, 62000),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380144', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380141', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', '8998866009988', 'Minyak Goreng Bimoli 1L', 2.0, 19500, 39000, 16000, 32000),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380145', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380141', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e16', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e16', 'WG-BAYAM-01', 'Bayam Ikat Segar', 1.0, 2500, 2500, 1500, 1500);

-- =========================================================================
-- 14. DAILY SETTLEMENT (Bakso Mobile Settlement)
-- =========================================================================
INSERT INTO daily_settlements (id, client_uuid, business_id, outlet_id, user_id, staff_id, settlement_date, total_target_revenue, cash_collected, qris_collected, total_collected, total_variance, notes) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380151', gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', CURRENT_DATE, 85000, 70000, 15000, 85000, 0, 'Setoran harian Gerobak UGM lancar');

INSERT INTO daily_settlement_items (id, settlement_id, item_id, product_id, opening_loose, thawed_loose, actual_loose, actual_sealed, discard_loose, sold_qty, qty_sold, unit_price, unit_sell_price, target_revenue, subtotal_target_revenue) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380152', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380151', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 0.0, 40.0, 5.0, 8.0, 1.0, 34.0, 34.0, 2500, 2500, 85000, 85000);

-- =========================================================================
-- 15. EOD MATERIAL USAGE (Gorengan Andalan)
-- =========================================================================
INSERT INTO eod_material_usages (id, business_id, outlet_id, item_id, initial_stock, restock_in, final_opname_stock, consumed_qty, unit_cost, total_cost) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380161', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e41', 20.0, 0.0, 12.0, 8.0, 14000, 112000), -- 8 Liter Minyak Curah terpakai
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380162', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e42', 25.0, 0.0, 15.0, 10.0, 11500, 115000); -- 10 Kg Tepung Terigu terpakai

-- =========================================================================
-- 16. PROCUREMENTS / PURCHASES
-- =========================================================================
INSERT INTO procurements (id, business_id, outlet_id, supplier_name, invoice_no, invoice_number, total_amount, total_cost, amount_owed, procurement_date, payment_status, notes, created_by) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380171', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'PT Indomarco Adi Prima', 'INV-IND-20260901', 'INV-IND-20260901', 520000, 520000, 0, NOW(), 'paid', 'Restock Indomie & Bimoli', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13');

INSERT INTO procurement_items (id, procurement_id, item_id, product_id, qty, unit_cost, total_cost) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380172', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380171', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 100.0, 2600, 260000),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380173', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380171', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 16.0, 16250, 260000);

-- =========================================================================
-- 17. STOCK OPNAME SESSIONS
-- =========================================================================
INSERT INTO opname_sessions (id, business_id, outlet_id, session_name, target_category, status, notes, created_by, audited_by, completed_at) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380181', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'Opname Bulanan Toko Utama September', 'all', 'completed', 'Audit fisik berjalan lancar', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', NOW());

INSERT INTO opname_items (id, opname_session_id, item_id, product_id, expected_qty, actual_qty, unit_cost, notes) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380182', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380181', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 120.0, 120.0, 2600, 'Sesuai fisik'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380183', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380181', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12', 50.0, 50.0, 7500, 'Sesuai fisik');

-- =========================================================================
-- 18. INITIAL DOUBLE-ENTRY STOCK MOVEMENTS
-- =========================================================================
INSERT INTO stock_movements (id, business_id, outlet_id, item_id, movement_type, source_document_type, from_location_type, to_location_type, to_outlet_id, package_form, qty, unit_cost, total_cost, performed_by, created_by, notes) VALUES
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380191', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'initial_balance', 'initial_balance', 'vendor', 'outlet', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'loose', 120.0, 2600, 312000, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Saldo awal sistem'),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380192', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'production', 'production', 'production', 'outlet', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'sealed', 60.0, 30325, 1819500, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'Hasil produksi Batch-01');
