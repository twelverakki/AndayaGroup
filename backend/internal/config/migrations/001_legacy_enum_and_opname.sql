-- 001_legacy_enum_and_opname.sql
-- Versioned schema migration extracted from legacy startup DDL

ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'discontinued';

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'raw_material';
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100) DEFAULT 'General';
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock_alert NUMERIC(12,2) DEFAULT 5.00;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS unit_cost BIGINT DEFAULT 0;
ALTER TABLE ingredients ALTER COLUMN unit_type TYPE VARCHAR(50) USING unit_type::text;
ALTER TABLE businesses ALTER COLUMN type TYPE VARCHAR(50) USING type::text;
ALTER TABLE ingredients ALTER COLUMN category TYPE VARCHAR(50) USING category::text;

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
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS opname_items (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	opname_session_id UUID NOT NULL REFERENCES opname_sessions(id) ON DELETE CASCADE,
	product_id UUID REFERENCES products(id) ON DELETE CASCADE,
	ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
	expected_qty NUMERIC NOT NULL DEFAULT 0,
	actual_qty NUMERIC NOT NULL DEFAULT 0,
	unit_cost BIGINT DEFAULT 0,
	notes TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
