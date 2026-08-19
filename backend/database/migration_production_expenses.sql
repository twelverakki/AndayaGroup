-- Migration: Production Expenses (Bakso Kang Gemoy)
-- Connects production runs with the raw ingredients or tools used as expenses.

CREATE TABLE IF NOT EXISTS production_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_production_expenses_production_id ON production_expenses(production_id);
CREATE INDEX IF NOT EXISTS idx_production_expenses_ingredient_id ON production_expenses(ingredient_id);
