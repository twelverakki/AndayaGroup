-- Seed Data for Andaya Group ERP

-- Clean existing seed data (optional, for safety)
TRUNCATE TABLE manager_pins CASCADE;
TRUNCATE TABLE outlet_staff CASCADE;
TRUNCATE TABLE business_owners CASCADE;
TRUNCATE TABLE outlets CASCADE;
TRUNCATE TABLE businesses CASCADE;
TRUNCATE TABLE users CASCADE;

-- 1. Insert Users
-- Password for all accounts: "password123"
-- Bcrypt hash: $2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje
-- PIN for all accounts: "123456"
-- Bcrypt PIN hash: $2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta
INSERT INTO users (id, name, phone_or_email, password_hash, pin_hash, status) VALUES
-- Owner A (Kennan - JnA Mart & Gorengan Andalan)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Kennan Owner A', 'kennan.a@andaya.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Owner B (Budi - Bakso Kang Gemoy & Yasaka)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Budi Owner B', 'budi.b@andaya.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Manager JnA Mart
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Siti Manager JnA', 'siti@jnamart.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Staff JnA Mart
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Adi Staff JnA', 'adi@jnamart.com', NULL, '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Manager Gorengan Cabang 1
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Dewi Manager Gorengan 1', 'dewi@gorengan.com', '$2a$12$CoEh/d9gsZsz4CsxT3/fiuji6sD.SEmoaXMtdUqOOunwROQxIyjje', '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Staff Gorengan Cabang 1
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Eko Staff Gorengan 1', NULL, NULL, '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active'),
-- Staff Bakso Kang Gemoy (Titik Jualan 1)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Gani Staff Bakso', NULL, NULL, '$2a$12$p8pv7vpKjayQuB4N18Mh5uIVaLGy13j2jQjIHRWGqpns5VvITw8Ta', 'active');

-- 2. Insert Businesses
INSERT INTO businesses (id, name, type) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'JnA Mart', 'retail'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bakso Kang Gemoy', 'fnb_production'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Yasaka Fried Chicken', 'fnb_franchise'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Andalan', 'fnb_branch');

-- 3. Insert Outlets
INSERT INTO outlets (id, business_id, name, address) VALUES
-- JnA Mart Outlet
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'JnA Mart - Toko Utama', 'Jl. Raya Pasar Tradisional No. 12'),
-- Bakso Kang Gemoy Gudang Pusat (Bakso uses individual staff targets, not outlets)
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'Bakso Kang Gemoy - Gudang Pusat', 'Sleman, Yogyakarta'),
-- Yasaka Outlet (Ownership assigned per-outlet)
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13', 'Yasaka Fried Chicken - Outlet A', 'Jl. Kaliurang KM 5'),
-- Gorengan Andalan Outlets
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Andalan - Cabang 1', 'Jl. Gejayan No. 45'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', 'Gorengan Andalan - Cabang 2', 'Jl. Malioboro No. 88');

-- 4. Insert Business Owners (Many-to-Many Ownership)
INSERT INTO business_owners (user_id, business_id, outlet_id) VALUES
-- Kennan owns JnA Mart
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', NULL),
-- Kennan owns Gorengan Andalan
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14', NULL),
-- Budi owns Bakso Kang Gemoy
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', NULL),
-- Budi owns Yasaka Fried Chicken Outlet A (assigned at outlet level)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', NULL, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c13');

-- 5. Insert Outlet Staff
INSERT INTO outlet_staff (user_id, outlet_id, role, can_view_cost, status) VALUES
-- Siti is JnA Manager
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'manager', true, 'active'),
-- Adi is JnA Staff
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'staff', false, 'active'),
-- Dewi is Gorengan 1 Manager
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'manager', false, 'active'),
-- Eko is Gorengan 1 Staff
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c14', 'staff', false, 'active'),
-- Gani is Bakso Staff (assigned to center warehouse outlet, tracked individually)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12', 'staff', false, 'active');

-- 6. Insert Manager PINs for Overrides
INSERT INTO manager_pins (user_id, pin_hash) VALUES
-- Siti (JnA Manager) PIN: "9999" (Bcrypt hash: $2a$12$oa1oF6A.NwBbOb2fLfNhy.ygNXKlhsNWv/q7bCD2w7cMrF8u6mS4W)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '$2a$12$oa1oF6A.NwBbOb2fLfNhy.ygNXKlhsNWv/q7bCD2w7cMrF8u6mS4W'),
-- Dewi (Gorengan Manager) PIN: "8888" (Bcrypt hash: $2a$12$.GOPxOGc1aLgtPTbrLd/ruoLCY8dyJcishSTH7a2yqqNIP4gG0W96)
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', '$2a$12$.GOPxOGc1aLgtPTbrLd/ruoLCY8dyJcishSTH7a2yqqNIP4gG0W96');
