-- Migration: Add Categories Table and reference in Products
-- Created at: 2026-08-02

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_business_category_name UNIQUE(business_id, name)
);

-- Create index for tenant scoping speed
CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);

-- 2. Seed default categories for JnA Mart
INSERT INTO categories (business_id, name) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Makanan'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Minuman'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Lain-lain')
ON CONFLICT (business_id, name) DO NOTHING;

-- 3. Alter products to add category_id column
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 4. Migrate existing text category data to category_id
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.business_id = p.business_id 
  AND LOWER(c.name) = LOWER(p.category)
  AND p.category_id IS NULL;

-- If a product has a custom category text that doesn't exist yet, create it and map it
DO $$
DECLARE
    prod RECORD;
    cat_id UUID;
BEGIN
    FOR prod IN 
        SELECT DISTINCT business_id, category 
        FROM products 
        WHERE category IS NOT NULL AND category != '' AND category_id IS NULL
    LOOP
        INSERT INTO categories (business_id, name) 
        VALUES (prod.business_id, prod.category)
        ON CONFLICT (business_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO cat_id;

        UPDATE products 
        SET category_id = cat_id 
        WHERE business_id = prod.business_id AND category = prod.category AND category_id IS NULL;
    END LOOP;
END $$;

-- 5. Drop the old category column
ALTER TABLE products DROP COLUMN IF EXISTS category;
