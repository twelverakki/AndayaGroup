-- =========================================================================
-- SEED DATA: ANDAYA ERP - MODUL POS (Point of Sale)
-- Business: JnA Mart | Outlet: JnA Toko Utama
-- Catatan: sesuaikan business_id & outlet_id dengan UUID asli di database Anda.
-- =========================================================================

-- =========================================================================
-- TEMPLATE 1: INSERT CATEGORIES (6 kategori)
-- =========================================================================
INSERT INTO categories (id, business_id, name, created_at, updated_at) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Makanan Ringan',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Minuman Dingin',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Kebutuhan Harian',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Sayur & Buah Segar', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Frozen Food',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d16', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Roti & Bakery',      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);


-- =========================================================================
-- TEMPLATE 2: INSERT PRODUCTS (15 produk, mencakup semua inventory_mode)
-- =========================================================================
INSERT INTO products (
    id, business_id, outlet_id, sku, name, category_id,
    unit_type, inventory_mode, purchase_price, sell_price,
    current_stock, min_stock_alert, status, created_at, updated_at
) VALUES

-- ================== Kategori: Makanan Ringan (dry_strict) ==================
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8886008101053', 'Indomie Goreng Spesial 85g', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
 'pcs', 'dry_strict', 2500, 3500, 150, 20, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8992775023018', 'Chitato Sapi Panggang 68g', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
 'pcs', 'dry_strict', 7500, 9500, 60, 12, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8993675511201', 'Oreo Original 137g', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
 'pack', 'dry_strict', 8000, 10500, 45, 10, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- ================== Kategori: Minuman Dingin (dry_strict) ==================
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8992761136015', 'Coca Cola Botol 390ml', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12',
 'pcs', 'dry_strict', 4000, 5500, 80, 10, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8998866201234', 'Teh Botol Sosro 450ml', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12',
 'pcs', 'dry_strict', 3500, 5000, 100, 15, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e16', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8993675512345', 'Air Mineral Galon 19L', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d12',
 'liter', 'simple', 15000, 20000, 25, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- ================== Kategori: Kebutuhan Harian (simple) ==================
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e17', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8998866009988', 'Minyak Goreng Bimoli 1L', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13',
 'liter', 'simple', 16000, 19500, 40, 8, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e18', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8998077610012', 'Beras Pandan Wangi 5kg', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13',
 'kg', 'simple', 62000, 70000, 30, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e19', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 '8993137554321', 'Gula Pasir 1kg', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d13',
 'kg', 'simple', 13500, 16000, 55, 10, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- ================== Kategori: Sayur & Buah Segar (wet_infinite) ==================
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e20', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 'WG-BAYAM-01', 'Bayam Ikat Segar', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14',
 'pcs', 'wet_infinite', 1500, 2500, 0, NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e21', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 'WG-TOMAT-01', 'Tomat Merah per Kg', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d14',
 'kg', 'wet_infinite', 8000, 12000, 0, NULL, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- ================== Kategori: Frozen Food (batch_thaw) ==================
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 'FZ-NUGGET-01', 'Nugget Ayam Fiesta 500g', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d15',
 'pack', 'batch_thaw', 22000, 28000, 18, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e23', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 'FZ-SOSIS-01', 'Sosis Sapi Kanzler 500g', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d15',
 'pack', 'batch_thaw', 25000, 32000, 20, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- ================== Kategori: Roti & Bakery (same_day) ==================
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e24', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 'BK-ROTI-01', 'Roti Tawar Sari Roti', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d16',
 'pcs', 'same_day', 9000, 13000, 12, 3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e25', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11',
 'BK-DONAT-01', 'Donat Coklat (isi 6)', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d16',
 'pack', 'same_day', 12000, 18000, 10, 2, 'discontinued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
