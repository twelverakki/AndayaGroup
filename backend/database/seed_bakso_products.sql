-- Seed Products and Category for Bakso Kang Gemoy
-- Business: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12 (Bakso Kang Gemoy)
-- Outlet: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12 (Bakso Kang Gemoy - Gudang Pusat)

-- 1. Insert Category
INSERT INTO categories (id, business_id, name, created_at, updated_at)
VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bakso Frozen', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Products
INSERT INTO products (
    id, business_id, outlet_id, sku, name, category_id,
    unit_type, inventory_mode, purchase_price, sell_price,
    current_stock, min_stock_alert, status, created_at, updated_at
) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e31', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12',
 'BK-ORIGINAL', 'Bakso Original', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22',
 'pack', 'batch_thaw', 20000, 30000, 50, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e32', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12',
 'BK-KEJU', 'Bakso Keju', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22',
 'pack', 'batch_thaw', 25000, 35000, 40, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12',
 'BK-MERCON', 'Bakso Mercon', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22',
 'pack', 'batch_thaw', 25000, 35000, 35, 5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Conversions (1 Pack = 20 Pcs)
INSERT INTO stock_conversions (id, product_id, ingredient_id, from_unit, to_unit, conversion_rate, created_at)
VALUES 
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f31', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e31', NULL, 'pack', 'pcs', 20.0, CURRENT_TIMESTAMP),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f32', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e32', NULL, 'pack', 'pcs', 20.0, CURRENT_TIMESTAMP),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380f33', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380e33', NULL, 'pack', 'pcs', 20.0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
