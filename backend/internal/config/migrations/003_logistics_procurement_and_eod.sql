-- 003_logistics_procurement_and_eod.sql
-- Stock transfers (Distribution), Suppliers, Purchases (PO), and EOD Material Usages

CREATE TABLE IF NOT EXISTS stock_transfers (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	transfer_no VARCHAR(50) NOT NULL UNIQUE,
	business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
	from_outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
	to_outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
	sent_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	sent_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	status VARCHAR(30) NOT NULL DEFAULT 'in_transit',
	transfer_type VARCHAR(30) NOT NULL DEFAULT 'outbound',
	notes TEXT,
	sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	received_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS carrier_type VARCHAR(30) DEFAULT 'internal_fleet';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(30);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(30);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS shipping_cost BIGINT DEFAULT 0;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS shipping_cost_payer VARCHAR(30) DEFAULT 'origin';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS shipping_payment_method VARCHAR(30) DEFAULT 'cash';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS tracking_ref_no VARCHAR(100);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS shipping_cost_mode VARCHAR(30) DEFAULT 'fixed';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS max_claim_budget BIGINT DEFAULT 0;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claim_token VARCHAR(64) UNIQUE;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claim_status VARCHAR(30) DEFAULT 'none';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claimed_amount BIGINT DEFAULT 0;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claimed_notes TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claimed_attachment_url TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claim_reviewed_by UUID REFERENCES users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claim_reviewed_at TIMESTAMPTZ;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS claim_rejection_reason TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS backorder_status VARCHAR(30) DEFAULT 'none';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS parent_transfer_id UUID REFERENCES stock_transfers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS stock_transfer_items (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
	item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
	qty_sent_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	qty_sent_loose NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	qty_received_sealed NUMERIC(14, 4) DEFAULT 0.0000,
	qty_received_loose NUMERIC(14, 4) DEFAULT 0.0000,
	shrinkage_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS qty_requested_sealed NUMERIC(14, 4) DEFAULT 0.0000;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS qty_requested_loose NUMERIC(14, 4) DEFAULT 0.0000;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS allocation_notes TEXT;

CREATE TABLE IF NOT EXISTS suppliers (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
	name VARCHAR(150) NOT NULL,
	contact_person VARCHAR(100),
	phone VARCHAR(50),
	email VARCHAR(100),
	address TEXT,
	payment_terms_days INT NOT NULL DEFAULT 0,
	status VARCHAR(20) NOT NULL DEFAULT 'active',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
	outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
	po_number VARCHAR(50) UNIQUE NOT NULL,
	invoice_no VARCHAR(100),
	supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
	supplier_name VARCHAR(150) NOT NULL,
	status VARCHAR(30) NOT NULL DEFAULT 'draft',
	payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
	payment_method VARCHAR(30) DEFAULT 'credit',
	order_date DATE NOT NULL DEFAULT CURRENT_DATE,
	due_date DATE,
	received_at TIMESTAMPTZ,
	subtotal_amount BIGINT NOT NULL DEFAULT 0,
	discount_amount BIGINT NOT NULL DEFAULT 0,
	tax_amount BIGINT NOT NULL DEFAULT 0,
	shipping_cost BIGINT NOT NULL DEFAULT 0,
	total_amount BIGINT NOT NULL DEFAULT 0,
	amount_paid BIGINT NOT NULL DEFAULT 0,
	amount_owed BIGINT NOT NULL DEFAULT 0,
	notes TEXT,
	created_by UUID REFERENCES users(id),
	received_by UUID REFERENCES users(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	purchase_type VARCHAR(20) NOT NULL DEFAULT 'standard'
);

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_type VARCHAR(20) NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS purchase_items (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
	item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
	uom VARCHAR(10) NOT NULL DEFAULT 'box',
	qty_ordered NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
	qty_received NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	conversion_rate NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
	unit_cost BIGINT NOT NULL DEFAULT 0,
	discount_amount BIGINT NOT NULL DEFAULT 0,
	subtotal BIGINT NOT NULL DEFAULT 0,
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_payments (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
	business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
	payment_no VARCHAR(50) UNIQUE NOT NULL,
	payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
	amount_paid BIGINT NOT NULL,
	payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
	reference_no VARCHAR(100),
	recorded_by UUID REFERENCES users(id),
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eod_material_usages (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
	outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
	settlement_id UUID REFERENCES daily_settlements(id) ON DELETE SET NULL,
	item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
	initial_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	restock_in NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	final_opname_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	consumed_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
	unit_cost BIGINT NOT NULL DEFAULT 0,
	total_cost BIGINT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
