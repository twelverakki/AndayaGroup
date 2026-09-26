# DATA_MODEL.md — Relational Schema & Double-Entry Ledger (3NF)

> **Version:** 3.1 (The Lean Odoo Way — Standardized Naming)  
> **Database Target:** PostgreSQL 14+ with `pgcrypto`  
> **Standardized Domains:** `items`, `inventory` (`stock_movements`), `pos` (`sessions`, `transactions`), `transfers` (`stock_transfers`), `production`, `settlements`, `purchases`.

---

## 1. Konvensi Wajib Arsitektur Database

1. **UUID Primary Keys**: Seluruh tabel menggunakan `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` agar aman dipakai sebagai token idempotency saat sinkronisasi offline PWA.
2. **Tenant Scoping Wajib**: Seluruh tabel bisnis WAJIB memiliki `business_id` (dan `outlet_id` jika terikat lokasi fisik) untuk penyaringan otomatis oleh middleware backend.
3. **Soft Delete & Immutability**: Dilarang menggunakan raw `DELETE` pada data transaksi, mutasi, dan user. Gunakan status `active`/`inactive` atau `deleted_at`. Buku besar mutasi (`stock_movements`) bersifat *append-only* (tidak pernah di-update).
4. **Monetary Value in BIGINT**: Seluruh nominal uang/rupiah disimpan dalam satuan integer `BIGINT` untuk mencegah kesalahan floating-point math.
5. **High-Precision Decimal for Inventory**: Kuantitas dan rasio konversi disimpan dalam `NUMERIC(14, 4)` untuk menampung gramasi, mililiter, maupun pecahan konversi.

---

## 2. Entity Relationship Diagram (High-Level Schema)

```
[businesses] ─────────┐
      │               ▼
      ├───────────► [outlets] ◄────────────── [users]
      │                   │                      │
      ▼                   ▼                      ▼
   [items] ◄────── [item_stocks] ◄────── [business_owners]
      │                   ▲                      ▲
      ▼                   │                      │
[stock_movements] ────────┘               [outlet_staff]
      │                                          │
      ▼                                          ▼
[transactions] ──► [transaction_items]    [manager_pins]
      │
      ▼
[daily_settlements] ──► [daily_settlement_items]
```

---

## 3. Identity, Ownership & Multi-Tenancy

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    phone_or_email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relasi Kepemilikan Many-to-Many (Owner bisa memiliki multi-bisnis/outlet)
CREATE TABLE business_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_owner_assignment UNIQUE(user_id, business_id, outlet_id)
);

-- Penugasan Staff & Manager per Outlet Fisik
CREATE TABLE outlet_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('manager', 'warehouse_admin', 'staff')),
    can_view_cost BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_staff_outlet UNIQUE(user_id, outlet_id)
);

-- PIN Hash Khusus Otorisasi Manager Override (Void & Approval)
CREATE TABLE manager_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pin_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Business & Outlet Structure with Capability Flags

```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'retail',
    phone VARCHAR(50),                     -- No. Telepon / WhatsApp Resmi Brand
    email VARCHAR(100),                    -- Email Resmi Perusahaan
    tax_id VARCHAR(50),                    -- NPWP / NIB Legalitas Bisnis
    tax_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- Tarif Pajak PPN / PB1 Restoran (%)
    
    -- Universal Business Capability Flags (The Lean Odoo Way)
    has_pos BOOLEAN NOT NULL DEFAULT TRUE,
    has_manufacturing BOOLEAN NOT NULL DEFAULT FALSE,
    has_logistics_hub BOOLEAN NOT NULL DEFAULT FALSE,
    has_eod_usage BOOLEAN NOT NULL DEFAULT FALSE,
    has_multi_outlets BOOLEAN NOT NULL DEFAULT FALSE,
    hide_central_stock_from_branches BOOLEAN NOT NULL DEFAULT FALSE, -- Blind Requisition Mode (Sembunyikan Saldo Fisik Pusat dari Kasir/Staff Cabang)
    allow_cross_branch_stock_view BOOLEAN NOT NULL DEFAULT FALSE,    -- Izinkan staf/kasir cabang memeriksa saldo stok di outlet cabang lain
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_main BOOLEAN NOT NULL DEFAULT FALSE, -- Penanda Cabang Utama / Central Hub
    address TEXT,                          -- Alamat Lengkap Fisik Cabang
    phone VARCHAR(50),                     -- No. HP / Kontak Cabang Kasir
    receipt_footer TEXT,                   -- Pesan Kaki Struk Kasir POS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. Unified Master Items & Double-Entry Stock Ledger

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category_type VARCHAR(30) NOT NULL DEFAULT 'finished_good' CHECK (category_type IN ('finished_good', 'raw_material', 'consumable', 'fixed_tool')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single Table of Truth Master Items (Finished Goods, Raw, Consumables, Tools)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    
    -- Klasifikasi Domain
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('finished_good', 'raw_material', 'consumable', 'fixed_tool')),
    
    -- Product Capabilities
    is_sellable BOOLEAN NOT NULL DEFAULT TRUE,          -- Tampil di kasir POS / Grosir?
    is_inventory_tracked BOOLEAN NOT NULL DEFAULT TRUE,  -- Dipantau saldonya di stock ledger?
    requires_thaw BOOLEAN NOT NULL DEFAULT FALSE,       -- Perlu alur pencairan beku & QC harian?
    
    -- Dual-UOM & Pricing UOM Konfigurasi
    base_unit VARCHAR(20) NOT NULL DEFAULT 'pcs',       -- Satuan eceran (pcs, gram, ml, porsi)
    box_unit VARCHAR(20),                               -- Satuan kemasan besar (dus, pack, karung)
    conversion_rate NUMERIC(14, 4) NOT NULL DEFAULT 1.0000, -- 1 box_unit = N base_unit
    price_unit VARCHAR(20) NOT NULL DEFAULT 'base',     -- Patokan harga ('base', 'kg', '100g', 'liter')
    
    -- Nilai Finansial
    sell_price BIGINT NOT NULL DEFAULT 0,               -- Harga eceran sesuai price_unit
    box_sell_price BIGINT DEFAULT 0,                    -- Harga grosir
    standard_cost BIGINT DEFAULT 0,                     -- Harga modal (HPP baseline sesuai price_unit)
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_business_sku UNIQUE(business_id, sku)
);

-- Saldo Stok Fisik Realtime per Lokasi / Personel (Mirip stock.quant di Odoo)
CREATE TABLE item_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    held_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Terisi jika dibawa personel lapangan
    
    qty_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000, -- Saldo kemasan besar (Dus/Pack Beku)
    qty_loose NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,  -- Saldo kemasan eceran (Pcs/Gram/Siap Jual)
    min_stock_alert NUMERIC(14, 4) NOT NULL DEFAULT 5.0000,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX unique_outlet_general_stock ON item_stocks (item_id, outlet_id) 
WHERE held_by_user_id IS NULL;

CREATE UNIQUE INDEX unique_outlet_user_stock ON item_stocks (item_id, outlet_id, held_by_user_id) 
WHERE held_by_user_id IS NOT NULL;

-- Immutable Append-Only Stock Movement Ledger (Mirip stock.move di Odoo)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    
    movement_type VARCHAR(40) NOT NULL CHECK (movement_type IN (
        'purchase_in', 'pos_sale_out', 'direct_sale_out', 'production_in',
        'production_raw_out', 'unpack_conversion', 'thaw_conversion',
        'transfer_outbound', 'transfer_inbound', 'opname_adjustment',
        'wastage_discard', 'internal_consumption'
    )),
    
    qty_sealed_change NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    qty_loose_change NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    
    reference_id UUID,                                  -- FK ke transactions / purchases / productions / settlements
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Commerce, POS Sessions & Single Transaction Ledger

```sql
-- Sesi Kasir Register (Mirip pos.session di Odoo / Toast POS)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    opening_cash BIGINT NOT NULL DEFAULT 0,
    actual_cash BIGINT DEFAULT 0,
    expected_cash BIGINT DEFAULT 0,
    cash_variance BIGINT DEFAULT 0,                     -- actual_cash - expected_cash
    
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single Source of Truth Pendapatan Seluruh Kanal Penjualan (Mirip pos.order / sale.order)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    
    client_uuid UUID NOT NULL UNIQUE,                   -- Idempotency key untuk offline PWA sync
    invoice_no VARCHAR(50) NOT NULL,
    
    -- Kanal Penjualan Universal
    channel VARCHAR(30) NOT NULL CHECK (channel IN (
        'pos_retail', 'pos_fnb', 'direct_wholesale', 'partner_settlement', 'internal_consumption'
    )),
    
    total_amount BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'qris', 'transfer', 'internal_take')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid', 'voided')),
    is_void BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    quantity NUMERIC(14, 4) NOT NULL,
    uom_type VARCHAR(10) NOT NULL DEFAULT 'base' CHECK (uom_type IN ('base', 'box')),
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    standard_cost BIGINT NOT NULL DEFAULT 0              -- Snapshot HPP saat checkout
);

-- Header-Detail Rekonsiliasi Penutupan Sesi Kasir Harian
CREATE TABLE daily_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    client_uuid UUID NOT NULL UNIQUE,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    total_expected_revenue BIGINT NOT NULL DEFAULT 0,
    total_actual_cash BIGINT NOT NULL DEFAULT 0,
    total_actual_qris BIGINT NOT NULL DEFAULT 0,
    cash_variance BIGINT NOT NULL DEFAULT 0,
    
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'disputed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES daily_settlements(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    initial_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    initial_loose NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    received_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    returned_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    
    sold_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal_revenue BIGINT NOT NULL DEFAULT 0
);
```

---

## 7. Logistics, Transfers & Transit Thawing

```sql
-- Pengiriman Antar-Lokasi / Surat Jalan Multi-Item (Mirip stock.picking di Odoo)
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_no VARCHAR(50) NOT NULL UNIQUE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    from_outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    to_outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    sent_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Armada & Kurir
    carrier_type VARCHAR(30) DEFAULT 'internal_fleet', -- internal_fleet, online_courier, 3rd_party, pickup
    driver_name VARCHAR(100),
    driver_phone VARCHAR(30),
    vehicle_plate VARCHAR(30),

    -- Ongkir & Biaya Distribusi Logistik
    shipping_cost BIGINT DEFAULT 0,
    shipping_cost_payer VARCHAR(30) DEFAULT 'origin', -- origin, destination, central
    shipping_payment_method VARCHAR(30) DEFAULT 'cash', -- cash, bank_transfer, on_account
    tracking_ref_no VARCHAR(100),
    shipping_cost_mode VARCHAR(30) DEFAULT 'fixed', -- fixed, driver_claim, free
    max_claim_budget BIGINT DEFAULT 0,
    claim_token VARCHAR(64) UNIQUE,
    claim_status VARCHAR(30) DEFAULT 'none', -- none, pending, approved, rejected
    claimed_amount BIGINT DEFAULT 0,
    claimed_notes TEXT,
    claimed_attachment_url TEXT,
    claimed_at TIMESTAMPTZ,
    claim_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    claim_reviewed_at TIMESTAMPTZ,
    claim_rejection_reason TEXT,

    -- Backorder & Chain of Custody
    backorder_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (backorder_status IN ('none', 'has_backorder', 'is_backorder', 'closed')),
    parent_transfer_id UUID REFERENCES stock_transfers(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'in_transit' CHECK (status IN ('draft', 'pending_approval', 'in_transit', 'received', 'returned', 'cancelled')),
    transfer_type VARCHAR(20) NOT NULL DEFAULT 'outbound' CHECK (transfer_type IN ('outbound', 'return', 'requisition')),
    notes TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rincian Multi-Barang dalam Surat Jalan
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    qty_requested_sealed NUMERIC(14, 4) DEFAULT 0.0000, -- Kuantitas Awal yang Diminta Cabang (Dus)
    qty_requested_loose NUMERIC(14, 4) DEFAULT 0.0000,  -- Kuantitas Awal yang Diminta Cabang (Pcs/Eceran)
    qty_sent_sealed NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    qty_sent_loose NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    qty_received_sealed NUMERIC(14, 4) DEFAULT 0.0000,
    qty_received_loose NUMERIC(14, 4) DEFAULT 0.0000,
    shrinkage_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    allocation_notes TEXT,                              -- Catatan / Preset Alasan Penyesuaian Kuota oleh Gudang Pusat
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log Pencairan Beku & QC Pagi
CREATE TABLE thaw_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    qty_sealed_thawed NUMERIC(14, 4) NOT NULL,          -- Berapa pack beku yang dicairkan
    qty_loose_produced NUMERIC(14, 4) NOT NULL,         -- Berapa pcs hasil konversi
    shrinkage_loss_loose NUMERIC(14, 4) DEFAULT 0.0000,
    
    thawed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quality_checked_at TIMESTAMPTZ,
    qc_status VARCHAR(20) DEFAULT 'pass' CHECK (qc_status IN ('pending', 'pass', 'discard'))
);
```

---

## 8. Kitchen Production & Material Usages

```sql
CREATE TABLE productions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    
    batch_no VARCHAR(50) NOT NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE, -- Produk jadi yang dihasilkan
    qty_produced NUMERIC(14, 4) NOT NULL,
    
    total_material_cost BIGINT NOT NULL DEFAULT 0,
    hpp_per_unit BIGINT NOT NULL DEFAULT 0,              -- total_material_cost / qty_produced
    
    produced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE TABLE production_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE, -- Bahan mentah yang dipotong atomik
    
    quantity_used NUMERIC(14, 4) NOT NULL,
    unit_cost BIGINT NOT NULL DEFAULT 0,
    subtotal_cost BIGINT NOT NULL DEFAULT 0
);

-- Kalkulasi Konsumsi Bahan Harian (Olahan Cepat / Gorengan / Dapur)
CREATE TABLE eod_material_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    settlement_id UUID REFERENCES daily_settlements(id) ON DELETE SET NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    initial_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    restock_in NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    final_opname_stock NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    consumed_qty NUMERIC(14, 4) NOT NULL DEFAULT 0.0000, -- initial + restock - final
    
    unit_cost BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. Purchases & Accounts Payable (Vendor Bills)

```sql
-- Faktur Pembelian Supplier (Mirip purchase.order / account.move di Odoo)
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    
    invoice_no VARCHAR(50) NOT NULL,
    supplier_name VARCHAR(100) NOT NULL,
    
    total_amount BIGINT NOT NULL DEFAULT 0,
    amount_paid BIGINT NOT NULL DEFAULT 0,
    amount_owed BIGINT NOT NULL DEFAULT 0,              -- total_amount - amount_paid
    payment_status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
    due_date DATE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    quantity NUMERIC(14, 4) NOT NULL,
    uom VARCHAR(10) NOT NULL DEFAULT 'box' CHECK (uom IN ('box', 'base')),
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0
);
```

---

## 10. Audit Trails, Overrides & Blind Opname

```sql
CREATE TABLE override_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    staff_id UUID NOT NULL REFERENCES users(id),
    manager_id UUID NOT NULL REFERENCES users(id),
    
    action VARCHAR(30) NOT NULL CHECK (action IN ('VOID', 'DISCOUNT_OVERRIDE', 'OPNAME_OVERRIDE')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wastage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    quantity NUMERIC(14, 4) NOT NULL,
    uom VARCHAR(10) NOT NULL DEFAULT 'base' CHECK (uom IN ('base', 'box')),
    reason TEXT NOT NULL,                               -- 'expired', 'damaged', 'spoiled_thaw', 'sampling'
    
    reported_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log Keamanan Platform & Auth Audit Trail (Sensitif & Anti-Tampering)
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,     -- Pelaku aksi
    actor_name VARCHAR(150),                                     -- Snapshot nama pelaku
    actor_role VARCHAR(50),                                     -- Snapshot role saat kejadian
    action VARCHAR(50) NOT NULL,                                 -- 'USER_CREATED', 'PASSWORD_CHANGED', 'CAPABILITY_UPDATED', dll.
    target_type VARCHAR(50) NOT NULL,                           -- 'USER', 'BUSINESS', 'AUTH'
    target_id VARCHAR(100),                                     -- ID target yang dimodifikasi
    details JSONB,                                              -- Detail perubahan parameter
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_security_logs_created_at ON security_audit_logs(created_at DESC);
```
