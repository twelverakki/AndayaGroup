# SYSTEM ARCHITECTURE BLUEPRINT — ANDAYA GROUP MODULAR LEAN ERP
**Version:** 3.1 (Domain-Driven Capability Architecture — The Lean Odoo Way)  
**Status:** Active & Implemented Standard  
**Audience:** System Architects, Lead Engineers, Frontend/Backend Developers  

---

## 1. Executive Summary & Tree Arsitektur Sistem

Andaya Group Multi-Tenant Lean ERP dibangun menggunakan arsitektur **Domain-Driven Modular Capabilities** yang terinspirasi oleh prinsip inti Odoo:
* **Product & Business Capability Flags**: Perilaku bisnis dan produk dikendalikan oleh sekumpulan *flags* konfigurasi, bukan oleh nama brand atau tipe hardcoded.
* **Double-Entry Stock Ledger**: Setiap pergerakan inventaris dicatat sebagai mutasi atomik append-only di `stock_movements`.
* **Single Transactions Ledger**: Semua aliran pendapatan bermuara pada satu tabel `transactions` yang terbagi ke dalam *Sales Channels* (`pos_retail`, `pos_fnb`, `direct_wholesale`, `partner_settlement`).
* **First-Class Organization & Staff Management**: Manajemen staf kasir, penugasan outlet, dan reset PIN supervisor dikelola langsung oleh Owner secara mandiri.

```
Andaya-ERP-System/
├── 1. Client / Shell Layer (Adaptive Dual-Form Factor)
│   ├── Mobile Shell (Gojek-style thumb-zone bottom navigation for < 1024px)
│   └── Desktop Shell (Samsung DeX-style multi-pane sidebar taskbar for ≥ 1024px)
│
├── 2. Frontend Domain Feature Packages (React + Vite + Tailwind + Shadcn)
│   ├── items/            --> Master Catalog, Dual-UOM & Product Capabilities
│   ├── inventory/        --> Realtime Balances (Dus + Pcs), Unpack & Stock Movement Ledger
│   ├── pos/              --> Retail Barcode Scanner & F&B Fast Grid Touch Checkout
│   ├── transfers/        --> Warehouse Outbound, Handshake Receive & Transit Thawing
│   ├── production/       --> Kitchen Batch Runs, Atomik Raw Deduction & HPP Snapshot
│   ├── settlement/       --> Cashier Sessions, Cash Variance & Direct Wholesale Sales
│   ├── purchases/        --> Supplier PO Invoicing & Accounts Payable Debt Tracker
│   ├── sales-report/     --> Multi-Tenant Consolidated Financial Analytics
│   └── organization/     --> Staff Management, Outlet Setup & Business Capability Config
│
├── 3. Backend Gateway & Scoping Layer (Go Fiber v2)
│   ├── Middleware/
│   │   ├── AuthGuard      --> JWT Token Verification & Secure Cookie Extraction
│   │   ├── TenantContext  --> Automatic Scoping (c.Locals["business_id" | "outlet_id"])
│   │   └── AuditLogger    --> Real-time HTTP & Mutation Audit Trail
│   │
│   └── Route Mapping/ (/api/v1/...)
│       ├── /auth/         --> Authentication & Workspace Switcher
│       ├── /items/        --> Master Catalog & Capability Filtering
│       ├── /inventory/    --> Stock Movement Ledger & Physical Balances
│       ├── /pos/          --> Session Management & Checkout API
│       ├── /transfers/    --> Outbound Transfers, Handshake & Thawing
│       ├── /productions/  --> Central Batch Runs & Material Usage Calculations
│       ├── /settlements/  --> Cash Variance, Blind Count Opname & Direct Sales
│       ├── /purchases/    --> Supplier Orders & Accounts Payable
│       ├── /analytics/    --> Consolidated Gross Margin & Net Revenue
│       └── /organization/ --> Staff Accounts, Outlet Assignments & Capability Toggles
│
├── 4. Backend Domain Modules Layer (Go internal/modules/)
│   ├── items/            --> service.go + handler.go
│   ├── inventory/        --> service.go + handler.go
│   ├── transactions/     --> service.go + handler.go
│   ├── logistics/        --> service.go + handler.go (transfers)
│   ├── production/       --> service.go + handler.go
│   ├── settlements/      --> service.go + handler.go
│   ├── purchases/        --> service.go + handler.go
│   ├── admin/            --> service.go + handler.go (superadmin)
│   └── organization/     --> service.go + handler.go (owner tenant admin)
│
└── 5. PostgreSQL 3NF Relational Database & Ledger Layer
    ├── items             --> Unified Master Table (Finished, Raw, Consumable, Tool)
    ├── item_stocks       --> Dual-Unit Physical Balances (qty_sealed + qty_loose)
    ├── stock_movements   --> Immutable Append-Only Ledger (Audit Trail)
    ├── sessions          --> Cashier Register Open/Close Sessions
    ├── transactions      --> Single Unified Sales Ledger (Categorized by Channel)
    ├── transaction_items --> Detail Line Items per Sale
    ├── daily_settlements --> Shift Closing Header (Cash, QRIS, Variance, Client UUID)
    ├── daily_settlement_items --> Detail Item Settlement per Closing
    ├── stock_transfers   --> Supply Chain Handshake Delivery & Thaw Records
    ├── eod_material_usages --> Fast-Cooking End-of-Day Raw Material Usage Sheet
    ├── purchases         --> Supplier Purchase Invoices & Payment Due Dates
    ├── users             --> Identity & Login Credentials
    ├── business_owners   --> Many-to-Many Ownership Assignments
    └── outlet_staff      --> Physical Staff & Manager Outlet Assignments
```

---

## 2. Multi-Tenant Scoping & Security Pipeline

```
Incoming Request
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. AuthGuard Middleware                                     │
│    - Validasi JWT Bearer Token / HTTP-Only Cookie           │
│    - Ekstraksi user_id, tenant roles, dan active context    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. TenantContext Middleware                                 │
│    - Validasi hak akses user terhadap target business/outlet│
│    - Inject c.Locals("business_id"), c.Locals("outlet_id")  │
│    - Tolak otomatis (403 Forbidden) jika akses ilegal       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Domain Service & Query Isolation                         │
│    - Parameter query SELALU mengikat WHERE business_id = $1 │
│    - Zero Data Leakage antar-tenant dijamin oleh sistem     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Lean Odoo Core Engines

### A. Business & Product Capability Flags Engine
* **Product Capabilities (`items`)**:
  - `is_sellable`: Muncul di katalog POS kasir.
  - `is_inventory_tracked`: Menghasilkan mutasi di `stock_movements`.
  - `requires_thaw`: Mengaktifkan alur pencairan beku & timer basi.
  - `item_type`: Mengklasifikasikan barang (`finished_good`, `raw_material`, `consumable`, `fixed_tool`).
* **Business Capabilities (`businesses`)**:
  - `has_pos`: Mengaktifkan modul kasir register retail/F&B.
  - `has_manufacturing`: Mengaktifkan modul batch produksi dapur & formula HPP.
  - `has_logistics_hub`: Mengaktifkan fitur pengiriman *outbound transfer* & serah terima.
  - `has_eod_usage`: Mengaktifkan lembar kalkulasi konsumsi bahan curah harian di penutupan sesi.

### B. Double-Entry Stock Movement Ledger Engine
Saldo fisik pada `item_stocks` tidak diubah secara sembarangan. Setiap penambahan/pengurangan stok WAJIB membukukan baris pada `stock_movements` secara atomik di dalam database transaction:

$$\Delta\text{Saldo} = \sum \text{Stock Movements (In)} - \sum \text{Stock Movements (Out)}$$

### C. Unified Sales Channels & Single Transactions Ledger
Seluruh penjualan dicatat dalam tabel `transactions` dengan kolom `channel`:
1. `pos_retail`: Transaksi kasir minimarket (Barcode scanning, Dual-UOM).
2. `pos_fnb`: Transaksi kasir cepat F&B (Fast Grid 1-Tap).
3. `direct_wholesale`: Penjualan partai besar langsung dari gudang.
4. `partner_settlement`: Penjualan berbasis rekap setoran shift mitra lapangan.
5. `internal_consumption`: Pengambilan barang operasional internal berotorisasi.

### D. End-of-Day Material Usage Engine (Fast-Cooking FnB)
$$\text{Konsumsi Bahan Riil} = \text{Stok Awal} + \text{Restock Masuk} - \text{Sisa Fisik Opname}$$
$$\text{HPP Aktual per Porsi} = \frac{\sum (\text{Konsumsi Bahan} \times \text{Harga Modal})}{\text{Total Produk Jadi Terjual}}$$

---

## 4. Standar Penataan Folder (GEMINI.md Rule #9 Compliance)

```
frontend/app/features/
├── items/           --> items-module.tsx, item-form-modal.tsx
├── inventory/       --> inventory-module.tsx, unpack-modal.tsx, movement-ledger.tsx
├── pos/             --> pos-module.tsx, cart-drawer.tsx, barcode-scanner.tsx
├── transfers/       --> transfers-module.tsx, thaw-modal.tsx, handshake-modal.tsx
├── production/      --> production-module.tsx, batch-form-modal.tsx, material-usage.tsx
├── settlement/      --> settlement-module.tsx, shift-modal.tsx, direct-sale-modal.tsx
├── purchases/       --> purchases-module.tsx, invoice-form-modal.tsx
├── sales-report/    --> sales-report-module.tsx, margin-analytics.tsx
└── organization/    --> staff-module.tsx, outlets-modal.tsx, business-settings.tsx
```
