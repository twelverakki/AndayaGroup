-- Migration: Phase 3 Enhancements (Traceability & Tenant Isolation)
-- Business: Bakso Kang Gemoy & System Audit

-- 1. Ensure stock_batches has business_id and outlet_id for auto-scoping
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id);

-- Update existing rows to Bakso Kang Gemoy business ID if any exist
UPDATE stock_batches SET business_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12' WHERE business_id IS NULL;

-- Alter to NOT NULL once filled
ALTER TABLE stock_batches ALTER COLUMN business_id SET NOT NULL;

-- Indexes for scoping performance
CREATE INDEX IF NOT EXISTS idx_stock_batches_business_id ON stock_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_outlet_id ON stock_batches(outlet_id);

-- 2. Traceability links: productions -> distributions -> stock_batches
ALTER TABLE distributions ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES productions(id) ON DELETE SET NULL;
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS distribution_id UUID REFERENCES distributions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_distributions_production_id ON distributions(production_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_distribution_id ON stock_batches(distribution_id);

-- 3. Wastage log details: link to stock_batches and identify origin stage
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS stock_batch_id UUID REFERENCES stock_batches(id) ON DELETE SET NULL;
ALTER TABLE wastage_logs ADD COLUMN IF NOT EXISTS source_stage TEXT;

-- Constraint check for source_stage
ALTER TABLE wastage_logs DROP CONSTRAINT IF EXISTS chk_wastage_source_stage;
ALTER TABLE wastage_logs ADD CONSTRAINT chk_wastage_source_stage 
    CHECK (source_stage IN ('production', 'distribution_transit', 'qc_discard', 'daily_closing', 'blind_opname'));

CREATE INDEX IF NOT EXISTS idx_wastage_logs_stock_batch_id ON wastage_logs(stock_batch_id);

-- 4. Return support in distributions
DO $$ BEGIN
    CREATE TYPE distribution_type AS ENUM ('outbound', 'return');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE distributions ADD COLUMN IF NOT EXISTS type distribution_type NOT NULL DEFAULT 'outbound';
