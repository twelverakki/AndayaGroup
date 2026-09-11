# UI MENU & PAGE SPECIFICATION — ANDAYA GROUP LEAN ERP
**Version:** 3.1 (Comprehensive Domain-Driven Navigation & CRUD Mapping — The Lean Odoo Way)  
**Status:** Active Standard  
**Audience:** Frontend Developers, Product Managers, QA Engineers  

---

## 1. Peta Menu Utama & Submenu (Standardized Navigation Tree)

```
Sidebar-Navigation/
├── 1. Dashboard (`dashboard`)
│   └── Ringkasan Bisnis & Quick Action
│
├── 2. Master Katalog Item (`items`)
│   ├── Master Items (`items-master`)
│   └── Tambah Item Baru (`items-add`)
│
├── 3. Inventory & Stok (`inventory`)
│   ├── Saldo Stok Real-time (`inventory-master`)
│   ├── Buku Besar Mutasi / Audit Trail (`inventory-movements`)
│   └── Penyesuaian Stok / Scrap (`inventory-adjustments`)
│
├── 4. Kasir & Transaksi POS (`pos`)
│   ├── Kasir Register (Barcode Scanner & Fast Grid 1-Tap)
│   └── Manajemen Sesi Kasir (`pos-sessions`)
│
├── 5. Mutasi & Logistik Transfer (`transfers`)
│   ├── Riwayat Pengiriman & Transfer Antar-Lokasi (`transfers-history`)
│   ├── Transfer Baru / Kirim Stok (`transfers-new`)
│   └── Pencairan Beku / Transit Thawing (`transfers-thawing`)
│
├── 6. Pabrikasi & Dapur Produksi (`production`)
│   ├── Riwayat Batch Produksi (`production-list`)
│   ├── Catat Batch Produksi Baru (`production-new`)
│   └── Konsumsi Bahan Harian / EOD Usage (`production-eod`)
│
├── 7. Rekonsiliasi & Setoran Kas (`settlements`)
│   ├── Rekap Sesi Kasir & Setoran Mitra (`settlements-list`)
│   └── Penjualan Grosir Langsung Gudang (`settlements-wholesale`)
│
├── 8. Pembelian & Hutang Supplier (`purchases`)
│   ├── Riwayat Faktur Pembelian (`purchases-history`)
│   └── Input Faktur Pembelian Baru (`purchases-new`)
│
├── 9. Stock Opname (`opname`)
│   ├── Sesi Opname Berjalan (`opname-active` - Blind Count)
│   └── Riwayat Rekonsiliasi Selisih (`opname-history`)
│
├── 10. Laporan & Keuangan (`sales-report`)
│   ├── Laporan Omzet & Laba Kotor
│   └── Analisis Margin per Kategori / Konsolidasi Grup
│
├── 11. Organisasi & Unit Bisnis (`organization`)  <-- HOLDING DIRECTORY & BUSINESS DETAIL
│   ├── Index: Kartu 4 Unit Bisnis Holding (JnA Mart, Bakso Gemoy, Yasaka, Gorengan)
│   └── Detail Bisnis Page (Per-Business Scope):
│       ├── Section 1: Saklar Kapabilitas Modular (has_pos, has_manufacturing, has_logistics_hub, has_eod_usage)
│       ├── Section 2: Cabang & Gudang (List & Tambah Cabang scoped ke bisnis ini)
│       └── Section 3: Pengguna & Staf (List & Tambah Pengguna scoped ke bisnis ini)
│
├── 12. Manajemen Pengguna (`users`)  <-- GLOBAL USERS & ADMIN MAKER
│   ├── Index: Direktori seluruh pengguna global Andaya ERP
│   ├── Aksi: Tambah Admin Platform (Superadmin)
│   └── Anchor Link: Buka Detail Bisnis untuk tambah staf/kasir cabang
│
├── 13. Log Keamanan Sistem (`security-logs`)  <-- SENSITIVE SYSTEM AUDIT TRAIL
│   └── Index: Rekaman sensitif (user_created, password_changed, pin_reset, capability_updated)
│
└── 14. Pengaturan Sistem & Alat (Drawer Pop-up)
    ├── Settings Drawer (Bahasa i18n, PPN Kasir, Printer Thermal)
    ├── Calendar Drawer (Jatuh Tempo Faktur Pembelian & Agenda Opname)
    └── Notifications Drawer (Alert Stok Menipis & Selisih Kas)
```

---

## 2. Rincian Detail per Halaman (Cakupan, Modal, & Operasi CRUD)

### 🏢 A. Modul Organisasi & Unit Bisnis (`organization/`) — [HOLDING SCOPE]
```
Menu: Organisasi & Bisnis (`/organization`)
├── 1. Cakupan Halaman:
│   ├── Index: Grid Kartu 4 Unit Bisnis Holding (JnA Mart, Bakso Gemoy, Yasaka, Gorengan)
│   └── Halaman Detail Bisnis (`/organization/:id`):
│       ├── Tab 1: Saklar Kapabilitas Modular (Toggle POS, Manufaktur, Logistik Hub, EOD Usage)
│       ├── Tab 2: Cabang & Gudang Fisik (Daftar & Form Tambah Cabang scoped bisnis ini)
│       └── Tab 3: Pengguna & Staf (Daftar & Form Tambah Staf scoped bisnis ini)
│
├── 2. Modal & Dialog:
│   ├── Modal Tambah Cabang Baru (Terikat langsung ke business_id yang dibuka)
│   ├── Modal Tambah Pengguna Baru (Terikat langsung ke outlet di bisnis yang dibuka)
│   └── Modal Reset PIN Kasir 6-Digit via <InputOTP>
│
└── 3. Penerapan Operasi CRUD:
    ├── [R] Read: `GET /api/v1/organization/businesses` (Daftar seluruh unit bisnis holding)
    ├── [R] Read: `GET /api/v1/organization/business/profile?business_id=:id`
    ├── [U] Update: `PUT /api/v1/organization/business/capabilities?business_id=:id`
    ├── [C] Create: `POST /api/v1/organization/outlets?business_id=:id` (Tambah cabang bisnis ini)
    └── [C] Create: `POST /api/v1/organization/staff?business_id=:id` (Tambah staf bisnis ini)
```

### 👥 B. Modul Manajemen Pengguna Global (`users/`) — [PLATFORM SCOPE]
```
Menu: Manajemen Pengguna (`/users`)
├── 1. Cakupan Halaman:
│   ├── Direktori master seluruh akun pengguna di platform Andaya ERP
│   ├── Ringkasan penugasan (Tenant Bisnis, Cabang, Role)
│   └── Anchor text: "Ingin menambah kasir/staf cabang? Kelola di Halaman Organisasi Bisnis ->"
│
├── 2. Modal:
│   └── Modal Tambah Admin Platform (Superadmin)
│
└── 3. Penerapan Operasi CRUD:
    ├── [R] Read: `GET /api/v1/admin/users` (Semua user dan penugasan)
    ├── [C] Create: `POST /api/v1/admin/users` (Buat Superadmin/Admin baru)
    └── [U] Update: `PUT /api/v1/admin/users/:id` (Ubah status / detail)
```

### 🛡️ C. Modul Log Keamanan Sistem (`security-logs/`) — [PLATFORM SECURITY]
```
Menu: Log Keamanan Sistem (`/security-logs`)
├── 1. Cakupan Halaman:
│   ├── Buku besar jejak kejadian sensitif keamanan platform
│   └── Audit trail: Pembuatan User, Penggantian Password, Reset PIN, dan Modifikasi Kapabilitas
│
└── 2. Penerapan Operasi CRUD:
    └── [R] Read: `GET /api/v1/admin/security-logs`
```

---

### 🛍️ B. Modul Master Katalog Item (`items/`)
```
Menu: Master Katalog Item (`/items`)
├── 1. Cakupan Halaman:
│   ├── Menampilkan seluruh master item (Produk Jadi, Bahan Mentah, Kemasan, Alat)
│   ├── Menampilkan rasio konversi Dual-UOM (1 Dus/Pack = X Pcs/Gram)
│   ├── Menampilkan harga jual eceran (`sell_price`), harga grosir (`box_sell_price`), dan HPP (`standard_cost`)
│   └── Filter dropdown berdasarkan Tipe Domain (`finished_good`, `raw_material`, `consumable`, `fixed_tool`)
│
├── 2. Modal & Dialog:
│   ├── Modal Tambah Item Baru (`<Dialog open={isCreateOpen}>`)
│   │   └── Form input nama, SKU, tipe domain, UOM base/box, rasio konversi, harga jual, dan modal
│   ├── Modal Edit Detail Item
│   └── Modal Ubah Status Cepat (Aktif, Non-aktif, Dihentikan)
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/items` (Tambah katalog baru + inisialisasi saldo stok)
    ├── [R] Read: `GET /api/v1/items?item_type=...` (Menampilkan daftar item + saldo dual-unit)
    ├── [U] Update: `PUT /api/v1/items/:id` (Update harga jual, SKU, atau nama item)
    └── [D] Delete: Soft-delete status (`status = 'discontinued'`)
```

---

### 📦 C. Modul Inventory & Stok (`inventory/`)
```
Menu: Inventory & Stok (`/inventory`)
├── 1. Cakupan Halaman:
│   ├── Saldo stok fisik real-time dengan format Dual-Unit (misal: "9 Kardus + 25 Pcs")
│   ├── Tabel buku besar mutasi stok (`stock_movements`) per outlet
│   └── Filter status stok (Stok Menipis, Stok Aman, Stok Habis)
│
├── 2. Modal & Dialog:
│   ├── Modal Buka Kardus (`[ Buka 1 Kardus ke Etalase / Unpack ]`)
│   │   └── Mengurangi 1 kardus (`qty_sealed - 1`) dan menambah pcs (`qty_loose + conversion_rate`)
│   ├── Modal Penyesuaian Stok Manual (Koreksi stok rusak/kadaluarsa via `stock.scrap`)
│   └── Modal Detail Log Kartu Stok
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/inventory/unpack` (Membongkar kardus ke eceran)
    ├── [R] Read: `GET /api/v1/inventory/balances` (Daftar saldo) & `/movements` (Ledger)
    └── [U] Update: `POST /api/v1/inventory/adjust` (Penyesuaian stok berotorisasi)
```

---

### 🛒 D. Modul Kasir & Transaksi POS (`pos/`)
```
Menu: Kasir & POS (`/pos`)
├── 1. Cakupan Halaman:
│   ├── Mode Retail: Barcode scanning cepat + pencarian SKU + pemilihan satuan (Dus/Pcs)
│   ├── Mode F&B: Fast Grid 1-tap add to cart (tombol besar ergonomis)
│   ├── Panel Keranjang Belanja (Cart Drawer / Right Pane)
│   └── Pembayaran Multi-Metode (Tunai dengan quick cash buttons, QRIS, Transfer, Internal Take)
│
├── 2. Modal & Dialog:
│   ├── Modal Sesi Kasir (`[ Buka Sesi ]` / `[ Tutup Sesi & Hitung Kas ]`)
│   ├── Modal Minta Void Transaksi (Kasir)
│   ├── Modal Otorisasi Manager PIN Override (Verifikasi PIN hash manager)
│   └── Modal Cetak Struk Nota Thermal
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/pos/checkout` (Menyimpan transaksi + potong stok atomik)
    ├── [R] Read: `GET /api/v1/pos/sessions/active` (Status sesi kasir berjalan)
    ├── [U] Update: `POST /api/v1/pos/void` (Void transaksi via Manager PIN)
    └── [S] Sync: `POST /api/v1/pos/sync` (Sinkronisasi transaksi offline PWA via client_uuid)
```

---

### 🚚 E. Modul Mutasi & Logistik Transfer (`transfers/`)
```
Menu: Transfer & Logistik (`/transfers`)
├── 1. Cakupan Halaman:
│   ├── Riwayat pengiriman barang antar-lokasi, cabang, atau serah terima personel
│   ├── Status pengiriman: `in_transit`, `received`, `returned`, `cancelled`
│   └── Monitoring stok transit dan aksi pencairan (*thawing*)
│
├── 2. Modal & Dialog:
│   ├── Modal Buat Surat Jalan Transfer Baru (Pilih asal, tujuan, item, dan kuantitas Dus/Pcs)
│   ├── Modal Konfirmasi Serah Terima (`[ Terima Barang / Handshake ]`)
│   ├── Modal Aksi Pencairan Beku (`[ Thaw 1 Pack -> 20 Pcs ]`)
│   └── Modal Input Status QC Pagi (`pass` / `discard`)
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/transfers` (Buat pengiriman baru)
    ├── [R] Read: `GET /api/v1/transfers` & `GET /api/v1/transfers/thaw-logs`
    └── [U] Update: `PUT /api/v1/transfers/:id/receive` (Handshake serah terima)
```

---

### 🍳 F. Modul Pabrikasi & Dapur Produksi (`production/`)
```
Menu: Produksi & Dapur (`/production`)
├── 1. Cakupan Halaman:
│   ├── Riwayat batch produksi dapur/gudang pusat
│   ├── Snapshot HPP modal per unit produk jadi yang dihasilkan
│   └── Lembar kalkulasi konsumsi bahan harian (*End-of-Day Material Usage*)
│
├── 2. Modal & Dialog:
│   ├── Modal Catat Batch Produksi Baru (Input produk jadi + breakdown bahan baku atomik)
│   └── Modal Input Opname Bahan Akhir Shift (Kalkulasi otomatis Bahan Terpakai)
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/productions` (Catat batch produksi + snapshot HPP)
    ├── [R] Read: `GET /api/v1/productions` & `GET /api/v1/productions/eod-usages`
    └── [C] Create: `POST /api/v1/productions/eod-usages` (Kalkulasi HPP curah harian)
```

---

### 💰 G. Modul Rekonsiliasi & Setoran Kas (`settlements/`)
```
Menu: Rekonsiliasi & Setoran (`/settlements`)
├── 1. Cakupan Halaman:
│   ├── Rekap setoran sesi kasir harian & pelaporan omzet mitra gerobak
│   ├── Komparasi pendapatan yang diharapkan (*expected*) vs kas aktual (*actual*)
│   ├── Indikator selisih kas (*cash variance*) dengan warna peringatan
│   └── Daftar penjualan grosir langsung gudang (*direct wholesale*)
│
├── 2. Modal & Dialog:
│   ├── Modal Input Tutup Shift & Setoran Kas Harian (`client_uuid` protected)
│   ├── Modal Input Penjualan Grosir Langsung Gudang
│   └── Modal Detail Rincian Rekonsiliasi Kas & QRIS
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/settlements` (Submit penutupan shift & rekonsiliasi kas)
    ├── [R] Read: `GET /api/v1/settlements` (Riwayat closing kasir)
    └── [C] Create: `POST /api/v1/settlements/wholesale` (Transaksi grosir gudang)
```

---

### 📋 H. Modul Pembelian & Hutang Supplier (`purchases/`)
```
Menu: Pembelian / Purchases (`/purchases`)
├── 1. Cakupan Halaman:
│   ├── Riwayat faktur pembelian barang ke supplier
│   ├── Status pelunasan: `paid` (Lunas), `unpaid` (Belum Lunas), `partial` (Sebagian)
│   ├── Indikator tanggal jatuh tempo hutang (*due date*)
│   └── Ringkasan total hutang usaha (*Accounts Payable*) yang masih aktif
│
├── 2. Modal & Dialog:
│   ├── Modal Input Faktur Pembelian Baru (Pilih supplier, item Dus/Pcs, harga beli, status hutang)
│   ├── Modal Pelunasan Hutang Supplier
│   └── Modal Detail Faktur Pembelian
│
└── 3. Penerapan Operasi CRUD:
    ├── [C] Create: `POST /api/v1/purchases` (Catat faktur PO + otomatis tambah stok masuk)
    ├── [R] Read: `GET /api/v1/purchases` (Daftar faktur pembelian)
    └── [U] Update: `PUT /api/v1/purchases/:id/pay` (Update pelunasan hutang)
```

---

### 📊 I. Modul Laporan & Keuangan (`sales-report/`)
```
Menu: Laporan & Analisis (`/sales-report`)
├── 1. Cakupan Halaman:
│   ├── Laporan Omzet Penjualan & Laba Kotor Harian/Bulanan
│   ├── Analisis Margin per Kategori Produk
│   ├── Laporan Konsolidasi Finansial Multi-Bisnis untuk Owner (Single Source of Truth)
│   └── Filter rentang tanggal & ekspor laporan
│
├── 2. Penerapan Operasi CRUD:
    └── [R] Read: `GET /api/v1/analytics/gross-margin`, `/sales-summary`, `/consolidated`
```
