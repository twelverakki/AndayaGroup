-- Phase 3 Database Migration SQL Script
-- Sets up productions and distributions tables for Bakso Kang Gemoy (Batch Thaw Tracking & Distribution).

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE distribution_status AS ENUM ('sent', 'received');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tables

-- A. Productions Table
CREATE TABLE IF NOT EXISTS productions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty_produced NUMERIC NOT NULL DEFAULT 0,            -- dalam pack
    produced_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,     -- Owner/Admin Gudang
    produced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- B. Distributions Table (Gudang Pusat -> Titik Jualan/Staff Individu)
CREATE TABLE IF NOT EXISTS distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sent_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,     -- staff titik jualan penerima
    qty NUMERIC NOT NULL DEFAULT 0,            -- dalam pack
    status distribution_status NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Tenant Scoping Performance Indexes
CREATE INDEX IF NOT EXISTS idx_productions_business_id ON productions(business_id);
CREATE INDEX IF NOT EXISTS idx_productions_product_id ON productions(product_id);
CREATE INDEX IF NOT EXISTS idx_distributions_business_id ON distributions(business_id);
CREATE INDEX IF NOT EXISTS idx_distributions_product_id ON distributions(product_id);
CREATE INDEX IF NOT EXISTS idx_distributions_sent_to_user_id ON distributions(sent_to_user_id);
