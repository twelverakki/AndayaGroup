# DATABASE_SNAPSHOT.md — Live Snapshot Database PostgreSQL

> **Waktu Pembaruan Terakhir**: 11 September 2026 (WITA)  
> **Database Host & Name**: `localhost:5432` / `andaya_group`  
> **Backend Engine**: Go (Fiber v2) + pgxpool  
> **Status Integrasi**: Terverifikasi 100% via PostgreSQL Live Query (`psql`) & `backend/cmd/seed`

---

## 1. Rangkuman Jumlah Baris Data per Tabel (`row_count`)

Total **31 Tabel Eksisting** di skema `public` database PostgreSQL `andaya_group`:

| No | Nama Tabel (`table_name`) | Jumlah Baris (`row_count`) | Status / Kategori | Keterangan & Peran Domain (The Lean Odoo Way) |
|---|---|:---:|---|---|
| 1 | `users` | **11** | ✅ Populated | Akun pengguna sistem (Superadmin, Owner, Manager, Staff Kasir, Gudang). |
| 2 | `businesses` | **4** | ✅ Populated | Master 4 unit bisnis terpasang Capability Flags (`has_pos`, `has_manufacturing`, dll). |
| 3 | `outlets` | **7** | ✅ Populated | Master outlet fisik, gudang pusat, dapur produksi, & gerobak mobile. |
| 4 | `business_owners` | **4** | ✅ Populated | Relasi kepemilikan bisnis multi-tenant (Many-to-Many). |
| 5 | `outlet_staff` | **8** | ✅ Populated | Penugasan akun staff/manager ke outlet fisik & gerobak. |
| 6 | `manager_pins` | **3** | ✅ Populated | Hash PIN otorisasi Manager Override (Void, Retur, & Approval). |
| 7 | `categories` | **10** | ✅ Populated | Master kategori barang retail, F&B, dan bahan baku per tenant. |
| 8 | `items` | **20** | ✅ Populated | **[Active 3NF]** Single Table of Truth Master Items + Dual-UOM & `requires_thaw`. |
| 9 | `products` | **13** | ✅ Populated | Master produk siap jual (Legacy sync for backward compatibility). |
| 10 | `item_stocks` | **20** | ✅ Populated | **[Active 3NF]** Saldo stok fisik Dual-UOM (`qty_sealed` & `qty_loose`). |
| 11 | `stock_movements` | **2** | ✅ Populated | **[Active 3NF]** Buku besar mutasi inventaris *double-entry / append-only*. |
| 12 | `shifts` | **2** | ✅ Populated | Sesi register kasir buka/tutup kas (`sessions`). |
| 13 | `transactions` | **1** | ✅ Populated | Single transaction sales ledger + kolom `channel` (`pos_retail`). |
| 14 | `transaction_items` | **4** | ✅ Populated | Detail line item transaksi penjualan retail. |
| 15 | `boms` | **1** | ✅ Populated | Bill of Materials formula resep produksi (Bakso Halus). |
| 16 | `bom_items` | **3** | ✅ Populated | Rincian takaran bahan baku per 1 porsi/pack output BOM. |
| 17 | `productions` | **1** | ✅ Populated | Histori batch produksi dapur/gudang pusat & snapshot HPP modal. |
| 18 | `production_expenses` | **3** | ✅ Populated | Rincian pemotongan atomik bahan baku & tenaga kerja per batch. |
| 19 | `distributions` | **1** | ✅ Populated | Pengiriman stok antar-lokasi + `shrinkage_tolerance_pct` (Handshake). |
| 20 | `eod_material_usages` | **2** | ✅ Populated | Lembar konsumsi bahan baku curah harian akhir shift (Gorengan Andalan). |
| 21 | `daily_settlements` | **1** | ✅ Populated | Header penutupan sesi harian & rekonsiliasi kas/QRIS (Bakso Gerobak). |
| 22 | `daily_settlement_items` | **1** | ✅ Populated | Detail rincian porsi/stok terjual pada penutupan sesi harian F&B gerobak. |
| 23 | `opname_sessions` | **1** | ✅ Populated | Sesi audit fisik stok gudang/toko berjalan (`completed`). |
| 24 | `opname_items` | **2** | ✅ Populated | Detail item hasil perhitungan stok opname fisik. |
| 25 | `procurements` | **1** | ✅ Populated | Histori faktur pembelian supplier & status pembayaran (`purchases`). |
| 26 | `procurement_items` | **2** | ✅ Populated | Detail item pada faktur pembelian supplier. |
| 27 | `security_audit_logs` | **0** | ⏳ Empty (Ready) | Jejak audit keamanan sistem, auth, dan mutasi otorisasi holding. |
| 28 | `stock_batches` | **0** | ⏳ Empty (Ready) | Batch stok thawing/perishable transit di lapangan. |
| 29 | `wastage_logs` | **0** | ⏳ Empty (Ready) | Catatan barang rusak/dibuang (*stock scrap* & QC Discard). |
| 30 | `audit_logs` | **0** | ⏳ Empty (Ready) | Jejak audit keamanan & perubahan data kritis. |
| 31 | `ingredients` | **0** | ⏳ Empty (Legacy) | Master bahan baku legacy (Telah diserap penuh ke `items`). |

---

## 2. Snapshot Data Pengguna & Kredensial Seeder (`users`)

| UUID User (`id`) | Nama Lengkap | Phone / Email | Role & Penugasan Tenant | Kredensial Default & Fitur Reset |
|---|---|---|---|---|
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10` | **Superadmin Platform** | `superadmin@andaya.com` | **Superadmin**: Global System Control Center | Pass: `password123`<br>PIN: `123456`<br>✅ *Platform Admin Access* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` | **Hendra Owner (JnA & Gorengan)** | `hendra.owner@gmail.com` | **Owner**: JnA Mart & Gorengan Andalan | Pass: `password123`<br>PIN: `123456`<br>✅ *Forgot Password Supported* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12` | **Budi Owner (Bakso & Yasaka)** | `baksokanggemoy@gmail.com` | **Owner**: Bakso Kang Gemoy & Yasaka | Pass: `password123`<br>PIN: `123456`<br>✅ *Forgot Password Supported* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13` | **Siti Manager JnA** | `siti@jnamart.com` | **Manager**: JnA Mart (Toko Utama) | Pass: `password123`<br>Override PIN: `9999`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15` | **Dewi Manager Gorengan**| `dewi@gorengan.com` | **Manager**: Gorengan Andalan (Cabang 1) | Pass: `password123`<br>Override PIN: `8888`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18` | **Rian Manager Yasaka** | `rian@yasaka.com` | **Manager**: Yasaka Fried Chicken (Seturan) | Pass: `password123`<br>Override PIN: `7777`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14` | **Adi Kasir JnA** | `adi@jnamart.com` | **Staff / Kasir**: JnA Mart (Toko Utama) | Pass: `password123`<br>PIN: `123456`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16` | **Eko Staff Gorengan** | `eko@gorengan.com` | **Staff**: Gorengan Andalan (Cabang 1) | Pass: `password123`<br>PIN: `123456`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17` | **Gani Mitra Bakso** | `gani@bakso.com` | **Staff**: Bakso Kang Gemoy (Gerobak UGM) | Pass: `password123`<br>PIN: `123456`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19` | **Fajar Kasir Yasaka** | `fajar@yasaka.com` | **Staff / Kasir**: Yasaka Fried Chicken (Seturan) | Pass: `password123`<br>PIN: `123456`<br>⚠️ *Edge-case Non-Gmail* |
| `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20` | **Bambang Admin Gudang** | `gudang@andaya.com` | **Staff / Gudang**: Central Warehouse & Kitchen | Pass: `password123`<br>PIN: `123456`<br>⚠️ *Edge-case Non-Gmail* |

---

## 3. Snapshot 4 Bisnis & 7 Outlet Master Data

| Bisnis (`businesses`) | Outlet (`outlets`) | Tipe Outlet | Capability Flags Aktif |
|---|---|---|---|
| **JnA Mart** (`retail`) | 1. Toko Utama Gejayan<br>2. Toko Cabang Palagan | Toko Retail Fisik | `has_pos=true`, `has_manufacturing=false`, `has_logistics_hub=false`, `has_eod_usage=false` |
| **Bakso Kang Gemoy** (`fnb`) | 3. Dapur Pusat & Beku<br>4. Titik Gerobak UGM | Dapur / Mobile Cart | `has_pos=true`, `has_manufacturing=true`, `has_logistics_hub=true`, `has_eod_usage=false` |
| **Yasaka Fried Chicken** (`fnb`) | 5. Cabang Seturan<br>6. Cabang Jakal KM 5 | Resto Cepat Saji | `has_pos=true`, `has_manufacturing=false`, `has_logistics_hub=false`, `has_eod_usage=false` |
| **Gorengan Andalan** (`fnb`) | 7. Gerobak Pinggir Jalan | Gerobak Sederhana | `has_pos=true`, `has_manufacturing=false`, `has_logistics_hub=false`, `has_eod_usage=true` |

---

## 4. Catatan Integritas Skema Database

1. **3NF Master Items (`items`)**: Menampung 20 data terpadu (produk retail, F&B porsi, raw ingredients, packaging) dengan kolom `requires_thaw`, UOM konversi `conversion_rate`, dan harga modal `standard_cost`.
2. **Business Capability Flags (`businesses`)**: 4 entitas bisnis terkonfigurasi secara dinamis dengan boolean `has_pos`, `has_manufacturing`, `has_logistics_hub`, dan `has_eod_usage`.
3. **Single Transaction Ledger (`transactions`)**: Kolom `channel` terpasang untuk mengklasifikasikan kanal penjualan (`pos_retail`, `pos_fnb`, `direct_wholesale`, `partner_settlement`).
4. **End-of-Day Material Usages (`eod_material_usages`)**: Berisi sampel data konsumsi minyak curah dan tepung terigu harian untuk Gorengan Andalan.
5. **Daily Settlements (`daily_settlements`)**: Berisi rekonsiliasi setoran harian untuk Bakso Kang Gemoy Gerobak UGM.
6. **Manufacturing & Logistics Handshake**: Terisi lengkap BOM resep, batch produksi, transfer antar-outlet (Central Kitchen ke Gerobak UGM) dengan verifikasi toleransi susut.

