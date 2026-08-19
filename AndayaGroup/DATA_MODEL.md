# DATA_MODEL.md — Skema Database

> Sumber keputusan: `DECISIONS_LOG.md`, `PRD.md`, `RBAC.md`. PostgreSQL. Kolom `id` semua tabel = UUID (bukan auto-increment int), supaya aman dipakai sebagai idempotency reference di sinkronisasi offline (PWA).

---

## 1. Konvensi Wajib

1. **Tenant scoping wajib.** Semua tabel yang menyimpan data spesifik bisnis WAJIB punya kolom `business_id`, dan kalau relevan juga `outlet_id`. Tidak ada pengecualian — ini yang di-filter otomatis oleh middleware (lihat `CLAUDE.md` Aturan Mutlak #1).
2. **Soft delete, bukan hard delete.** Tabel `users` dan tabel transaksi (`transactions`, `wastage_logs`, dll) pakai kolom `status` (`active`/`inactive`) atau `deleted_at` (nullable timestamp) — tidak ada `DELETE` query untuk data ini.
3. **Timestamps standar:** `created_at`, `updated_at` di semua tabel kecuali log murni (yang cukup `created_at`, karena tidak pernah diubah — log bersifat append-only).
4. **Naming:** snake_case, tabel jamak (`products`, bukan `product`).
5. **Uang** disimpan sebagai `BIGINT` (satuan rupiah terkecil, hindari floating point).

---

## 2. Identity & Ownership

```
users
├── id                UUID PK
├── name               TEXT
├── phone_or_email     TEXT (unique, nullable — staff mungkin cuma pakai PIN)
├── password_hash      TEXT (nullable — staff bisa login PIN-only)
├── pin_hash           TEXT (nullable — dipakai staff/kasir untuk login cepat)
├── status             ENUM('active','inactive')
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

business_owners                              -- role Owner, many-to-many
├── id                 UUID PK
├── user_id            UUID FK → users
├── business_id        UUID FK → businesses (nullable jika scoped ke outlet)
├── outlet_id          UUID FK → outlets (nullable — dipakai khusus Yasaka, franchise per-outlet)
├── created_at         TIMESTAMP
└── UNIQUE(user_id, business_id, outlet_id)

outlet_staff                                  -- role Manager, Admin Gudang, Staff — scoped ketat per outlet
├── id                 UUID PK
├── user_id            UUID FK → users
├── outlet_id          UUID FK → outlets
├── role               ENUM('manager','admin_gudang','staff')
├── can_view_cost      BOOLEAN DEFAULT false   -- flag opsional untuk Manager (lihat RBAC.md §3)
├── status             ENUM('active','inactive')
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

manager_pins
├── id                 UUID PK
├── user_id            UUID FK → users (role manager)
├── pin_hash           TEXT
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP
```

> Catatan desain: `business_owners` sengaja dipisah dari `outlet_staff` karena Owner butuh relasi many-to-many lintas-bisnis (D-03), sementara Manager/Admin Gudang/Staff selalu terikat ketat ke 1 `outlet_id` saja.

---

## 3. Business Structure

```
businesses
├── id                 UUID PK
├── name               TEXT              -- "JnA Mart", "Bakso Kang Gemoy", "Yasaka Fried Chicken", "Gorengan Andalan"
├── type               ENUM('retail','fnb_production','fnb_franchise','fnb_branch')
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

outlets
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── name               TEXT              -- "JnA Mart - Toko Utama", "Yasaka - Outlet A", "Gorengan - Cabang 1", dst
├── address             TEXT (nullable)
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP
```

> Catatan Bakso Kang Gemoy: titik jualan **bukan** row di `outlets` (bukan entitas tenant formal — lihat D-14). Titik jualan direpresentasikan lewat `outlet_staff` yang menempel ke 1 `outlet_id` gudang pusat, dibedakan per-orang lewat `user_id`. Distribusi dicatat di `distributions` (§7), bukan lewat multi-outlet.

---

## 4. Products & Inventory

```
categories
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── name               TEXT               -- e.g. "Makanan", "Minuman"
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

products
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets (nullable — null jika stok terpusat, mis. gudang Bakso)
├── sku                TEXT (nullable — dry goods JnA Mart pakai barcode; F&B biasanya null)
├── name               TEXT
├── category_id        UUID FK → categories (nullable)
├── unit_type          ENUM('pcs','pack','kg','carton','liter', ...)
├── inventory_mode     ENUM('dry_strict','wet_infinite','simple','batch_thaw','same_day')
├── purchase_price     BIGINT             -- Last Buying Price
├── sell_price         BIGINT
├── current_stock      NUMERIC            -- interpretasi tergantung inventory_mode & unit_type
├── min_stock_alert    NUMERIC (nullable) -- threshold custom per varian (Bakso Kang Gemoy)
├── image_url          TEXT (nullable)    -- tautan gambar kustom produk
├── status             ENUM('active','inactive')
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

ingredients
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets (nullable)
├── name               TEXT               -- "Ayam bag besar", "Tepung", "Minyak goreng"
├── unit_type          ENUM('kg','pcs','liter', ...)
├── current_stock      NUMERIC
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

stock_conversions                          -- generic conversion layer, reusable
├── id                 UUID PK
├── product_id         UUID FK → products (nullable)
├── ingredient_id      UUID FK → ingredients (nullable)
├── from_unit          TEXT               -- "pack", "carton"
├── to_unit             TEXT               -- "pcs"
├── conversion_rate    NUMERIC            -- mis. 1 pack = 20 pcs; 1 carton = 24 pcs
└── created_at         TIMESTAMP

stock_batches                              -- KHUSUS Bakso Kang Gemoy: Batch Thaw Tracking (D-14a)
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets (nullable)
├── product_id         UUID FK → products
├── held_by_user_id    UUID FK → users     -- staff di titik jualan yang pegang batch ini
├── batch_status       ENUM('sealed','opened')
├── quantity           NUMERIC            -- pack (sealed) atau pcs (opened)
├── distribution_id    UUID FK → distributions (nullable) -- traceability ke pengiriman
├── opened_at          TIMESTAMP (nullable)
├── quality_checked_at TIMESTAMP (nullable)  -- dicek tiap pagi, umur maks 1-2 hari sejak opened_at
├── quality_check_status ENUM('pending','pass','discard') (nullable)
└── created_at         TIMESTAMP

daily_material_logs                        -- KHUSUS Gorengan Andalan: Dual-Track siklus harian (D-13b)
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets
├── ingredient_id      UUID FK → ingredients
├── staff_id           UUID FK → users
├── log_date           DATE
├── qty_start          NUMERIC            -- bahan siap pakai pagi hari
├── qty_remaining       NUMERIC (nullable) -- diisi staff saat closing (end-of-day)
├── qty_used_calculated NUMERIC (nullable) -- qty_start - qty_remaining, dihitung sistem
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

wastage_logs                               -- hasil opname Blind Count SEMUA bisnis (D-08), + hasil reconciliation
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets
├── product_id         UUID FK → products (nullable)
├── ingredient_id      UUID FK → ingredients (nullable)
├── daily_material_log_id UUID FK → daily_material_logs (nullable — kalau asalnya dari Dual-Track Gorengan)
├── stock_batch_id     UUID FK → stock_batches (nullable — jika terkait batch Bakso)
├── expected_qty       NUMERIC            -- angka sistem (staff TIDAK melihat ini saat blind input)
├── actual_qty         NUMERIC            -- hasil hitung fisik staff
├── discrepancy        NUMERIC            -- actual - expected
├── input_by           UUID FK → users (staff)
├── status             ENUM('pending_approval','approved','rejected')
├── source_stage       ENUM('production','distribution_transit','qc_discard','daily_closing','blind_opname') (nullable)
├── approved_by        UUID FK → users (nullable — Manager/Owner)
├── approved_at        TIMESTAMP (nullable)
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP
```

---

## 5. Transactions & POS

```
shifts
├── id                 UUID PK
├── outlet_id          UUID FK → outlets
├── staff_id           UUID FK → users
├── opening_cash        BIGINT
├── closing_cash_system BIGINT (nullable)  -- dihitung sistem dari transaksi
├── closing_cash_actual BIGINT (nullable)  -- input fisik staff saat tutup shift
├── variance            BIGINT (nullable)  -- actual - system (shortage/overage)
├── status              ENUM('open','closed')
├── opened_at           TIMESTAMP
└── closed_at           TIMESTAMP (nullable)

transactions
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets
├── shift_id           UUID FK → shifts
├── staff_id           UUID FK → users
├── type               ENUM('sale','internal_take','void')
├── total_amount       BIGINT
├── payment_method     ENUM('cash','qris','other')
├── status             ENUM('completed','voided')
├── client_uuid        UUID (unique)       -- idempotency key dari device offline (D-16)
├── synced_at          TIMESTAMP (nullable) -- null = masih pending_sync di client
├── created_at         TIMESTAMP
└── updated_at         TIMESTAMP

transaction_items
├── id                 UUID PK
├── transaction_id     UUID FK → transactions
├── product_id         UUID FK → products
├── qty                NUMERIC
├── unit_price         BIGINT
├── subtotal           BIGINT
└── created_at         TIMESTAMP

override_logs                              -- Manager Override, reusable (D-10)
├── id                 UUID PK
├── transaction_id     UUID FK → transactions
├── staff_id           UUID FK → users     -- yang minta
├── manager_id         UUID FK → users     -- yang approve via PIN
├── action             ENUM('void','discount_override', ...)
├── reason             TEXT
└── created_at         TIMESTAMP
```

---

## 6. Procurement

```
procurements
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── outlet_id          UUID FK → outlets (nullable — Bakso: gudang pusat)
├── supplier_name       TEXT
├── total_cost          BIGINT
├── payment_status      ENUM('paid','unpaid','partial')   -- D-14f
├── amount_owed         BIGINT (nullable)
├── procurement_date    DATE
├── due_date            DATE (nullable)     -- D-14g
├── created_by          UUID FK → users
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

procurement_items
├── id                 UUID PK
├── procurement_id     UUID FK → procurements
├── product_id         UUID FK → products (nullable)
├── ingredient_id      UUID FK → ingredients (nullable)
├── qty                NUMERIC
├── unit_cost          BIGINT
└── weight_actual       NUMERIC (nullable) -- untuk wet goods JnA Mart, berat timbangan riil saat barang tiba
```

> Catatan Q-06 (masih open di `DECISIONS_LOG.md`): skema di atas baru mendukung status biner Lunas/Belum Lunas + jumlah terutang. Kalau nanti butuh jatuh tempo/cicilan, tambahkan tabel `procurement_payments` (id, procurement_id, amount_paid, paid_at) tanpa mengubah struktur di atas.

---

## 7. Bakso Kang Gemoy — Produksi & Distribusi

```
productions
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── product_id         UUID FK → products
├── qty_produced        NUMERIC            -- dalam pack
├── produced_by         UUID FK → users     -- Owner/Admin Gudang
├── produced_at         TIMESTAMP
└── created_at          TIMESTAMP

production_expenses                         -- pencatatan pengeluaran bahan & alat per produksi
├── id                 UUID PK
├── production_id      UUID FK → productions
├── ingredient_id      UUID FK → ingredients (Master Bahan & Alat)
└── quantity           NUMERIC

distributions                               -- gudang pusat ↔ titik jualan (staff individu)
├── id                 UUID PK
├── business_id        UUID FK → businesses
├── product_id         UUID FK → products
├── sent_to_user_id     UUID FK → users     -- staff titik jualan penerima/pengirim
├── qty                 NUMERIC            -- dalam pack
├── status              ENUM('sent','received')
├── type                ENUM('outbound','return') -- arah kiriman/retur
├── production_id       UUID FK → productions (nullable) -- traceability ke log produksi
├── sent_at             TIMESTAMP
├── received_at         TIMESTAMP (nullable)
└── created_at          TIMESTAMP
```

---

## 8. Ringkasan Relasi Antar-Tabel Kunci

```
users ──< business_owners >── businesses (many-to-many, role Owner)
users ──< business_owners >── outlets    (many-to-many khusus, role Owner Yasaka per-outlet)
users ──< outlet_staff >── outlets       (many-to-one, role Manager/Admin Gudang/Staff)
businesses ──< outlets

products ──< stock_batches               (khusus Bakso — status sealed/opened)
products/ingredients ──< stock_conversions (pack→pcs, carton→pcs)
ingredients ──< daily_material_logs      (khusus Gorengan — Dual-Track harian)
products/ingredients ──< wastage_logs    (hasil blind count opname, semua bisnis)

outlets ──< shifts ──< transactions ──< transaction_items
transactions ──< override_logs           (void/discount, via Manager PIN)

businesses ──< procurements ──< procurement_items
businesses ──< productions               (khusus Bakso)
businesses ──< distributions             (khusus Bakso — gudang → staff titik jualan)
```

---

## 9. Catatan Implementasi untuk AI Agent

- **Jangan generate tabel `product_ingredients`/BOM** kecuali diminta eksplisit — keputusan sudah final bahwa Yasaka & Gorengan **tidak** pakai resep/BOM kaku (lihat PRD §6.2). Kalau butuh nanti, desainnya polymorphic dan bisa ditambah tanpa migrasi besar.
- **Middleware wajib inject `business_id`/`outlet_id`** ke setiap query di tabel yang punya kolom itu — lihat `CLAUDE.md` Aturan Mutlak #1. Jangan generate repository function yang menerima `business_id` sebagai parameter manual dari handler; ambil dari JWT context di middleware.
- **`client_uuid` di tabel `transactions` wajib diisi dari device**, bukan digenerate server — ini kunci idempotency untuk sinkronisasi PWA offline (D-16).
- Tabel log (`wastage_logs`, `override_logs`, `daily_material_logs`) bersifat **append-only** — tidak ada UPDATE selain field approval (`status`, `approved_by`, `approved_at`).
