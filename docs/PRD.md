# Product Requirement Document (PRD)
## Multi-Tenant Lean ERP System (The Lean Odoo Way)

| Metrik | Keterangan |
|---|---|
| **Project Owner** | Kennan |
| **Document Version** | v3.0 (Domain-Driven & Capability-Based Architecture) |
| **Target Pembangun** | AI Coding Agent (Autonomous Build) & Core Engineers |
| **Dokumen Acuan** | [`DECISIONS_LOG.md`](file:///D:/laragon/www/Andaya-Group/docs/DECISIONS_LOG.md), [`ARCHITECTURE.md`](file:///D:/laragon/www/Andaya-Group/docs/ARCHITECTURE.md), [`DATA_MODEL.md`](file:///D:/laragon/www/Andaya-Group/docs/DATA_MODEL.md) |

---

## 1. Latar Belakang & Visi Produk

Kennan mengelola grup usaha multi-sektor yang menaungi berbagai unit bisnis (retail minimarket, produksi kuliner terpusat, gerobak lapangan, franchise cepat saji, dan kedai olahan langsung). Seluruh operasional dikelola melalui **satu sistem server ERP terpusat yang ramping (Lean ERP)**.

### Prinsip Utama: The Lean Odoo Way
Sistem tidak lagi dibangun dengan logika yang terikat pada merek dagang (*brand-centric hardcoding*), melainkan mengadopsi prinsip desain modular standar industri:
1. **Universal Domain Capabilities**: Sistem terdiri dari 8 domain fungsional independen.
2. **Business & Product Capability Flags**: Setiap unit bisnis dan katalog produk dikonfigurasi melalui sekumpulan *flag kemampuan* (seperti `has_pos`, `has_manufacturing`, `is_sellable`, `track_inventory`).
3. **Double-Entry Stock Ledger**: Setiap mutasi fisik barang dicatat dalam buku besar mutasi yang *immutable* (`stock_movements`).
4. **Single Transaction Ledger**: Seluruh pendapatan dari berbagai kanal penjualan bermuara pada satu tabel transaksi dengan pembeda `channel`.

---

## 2. Cakupan 8 Domain Capability Sistem

| Domain | Nama Capability | Cakupan & Fitur Inti yang Wajib Ditunjang |
|---|---|---|
| **Domain 1** | **Core Auth & Multi-Tenancy** | Autentikasi JWT aman, relasi kepemilikan *many-to-many* (`business_owners`), *Workspace Switcher* instan, isolasi data mutlak per tenant via middleware. |
| **Domain 2** | **Unified Master Items & Stock Ledger** | Katalog master 3NF terpadu (`items`), format saldo Dual-UOM (Dus/Pack + Pcs), rasio konversi satuan berpresisi tinggi, buku besar mutasi barang append-only. |
| **Domain 3** | **Commercial POS & Cashier Sessions** | Mode Kasir Retail (Barcode Scanning + Multi-UOM) dan Kasir F&B (Fast Grid 1-Tap), manajemen shift kasir (buka/tutup register), otorisasi Manager PIN Override untuk void transaksi, pencetakan struk nota. |
| **Domain 4** | **Internal Logistics & Transit Thawing** | Pengiriman stok antar-lokasi (*outbound delivery*), serah terima fisik (*handshake receive*), konversi transit/pencairan beku dengan toleransi susut air (*shrinkage tolerance*). |
| **Domain 5** | **Kitchen Production & Real COGS** | Pencatatan batch produksi dapur/gudang pusat, pemotongan bahan baku atomik, snapshot HPP per unit, dan kalkulasi pemakaian bahan harian (*End-of-Day Material Usage*) untuk olahan cepat. |
| **Domain 6** | **Daily Reconciliation & Settlements** | Rekonsiliasi setoran kas & QRIS harian, kalkulasi selisih kas (*cash variance*), stock opname berkala metode *Blind Count*, dan transaksi penjualan langsung (*direct wholesale sales*). |
| **Domain 7** | **Procurement & Accounts Payable** | Purchase Order (PO) ke supplier, pelacakan faktur dan status hutang jatuh tempo (*Accounts Payable*), penambahan stok otomatis ke gudang/outlet. |
| **Domain 8** | **Group Consolidated Analytics** | Laporan laba-rugi per-bisnis dan konsolidasi grup, analisis margin kotor per kategori, pelacakan arus kas dan valuasi aset riil Owner. |

---

## 3. Empat Model Operasional Universal (Business Archetypes)

Sistem wajib menunjang 4 arketipe proses bisnis di lapangan tanpa mengubah kode backend/frontend:

```
                              ANDAYA LEAN ERP CAPABILITIES
                                           │
    ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
    ▼                      ▼                               ▼                      ▼
[Archetype 1]          [Archetype 2]                   [Archetype 3]          [Archetype 4]
High-SKU Retail &      Central Kitchen &               Fast-Food Franchise &  Fast-Cooking Direct &
Dual-UOM (JnA Mart)    Cold Transit (Bakso Gemoy)      Hub-Branch (Yasaka)    End-of-Day Opname (Gorengan)
```

### Archetype 1: High-SKU Retail & Dual-UOM
* **Karakteristik**: Ribuan SKU barang campuran (barang kering tahan lama & bahan basah pasar).
* **Kebutuhan Sistem**:
  * POS kasir cepat dengan input barcode scanner.
  * Dukungan penjualan dalam satuan eceran (pcs) maupun grosir (dus/kardus).
  * Validasi stok ketat untuk barang kering (*dry goods*) vs stok tanpa batas (*infinite stock*) untuk barang basah pasar yang di-opname berkala.
  * Pelacakan faktur hutang/kredit ke supplier pengadaan pasar.
  * Fitur pencatatan pemakaian internal (*Internal Consumption*) berotorisasi untuk mencegah kebocoran stok.

### Archetype 2: Central Kitchen Fabrication & Cold Transit
* **Karakteristik**: Produksi massal terpusat di dapur/gudang pusat, didistribusikan ke titik-titik penjualan/gerobak mitra lapangan.
* **Kebutuhan Sistem**:
  * Form batch produksi terpusat yang otomatis memotong stok bahan baku dan mengunci snapshot HPP per unit jadi.
  * Logistik pengiriman barang beku kemasan utuh (*sealed pack*) ke personel lapangan.
  * Konfirmasi penerimaan dua arah (*handshake confirmation*).
  * Pencatatan konversi pencairan beku (*thawing*) menjadi stok siap jual (*opened pcs*) dengan memperhitungkan faktor susut air wajar (2–5%).
  * Rekonsiliasi setoran kas dan sisa fisik harian per personel lapangan via penutupan shift (*daily settlement*).

### Archetype 3: Fast-Food Franchise & Hub-to-Branch Flow
* **Karakteristik**: Unit usaha cepat saji dengan outlet cabang terstandarisasi.
* **Kebutuhan Sistem**:
  * POS Fast Grid layar sentuh (1-tap add to cart).
  * Cetak struk fisik wajib sebagai bukti transaksi anti-fraud kasir.
  * Penerimaan stok bahan marinasi/kemasan dari gudang pusat ke outlet.
  * Otomatisasi pembukaan dan penutupan shift kasir harian.

### Archetype 4: Fast-Cooking Direct Processing & End-of-Day Material Opname
* **Karakteristik**: Pengolahan makanan langsung di tempat dengan bahan baku curah yang habis hari itu juga (*zero carry-over*).
* **Kebutuhan Sistem**:
  * POS Fast Grid sederhana untuk melayani transaksi cepat di jam sibuk tanpa menimbang gramasi per porsi.
  * Perhitungan HPP riil di akhir shift menggunakan rumus pemakaian bahan:
    $$\text{Bahan Terpakai} = \text{Bahan Awal} + \text{Restock Hari Ini} - \text{Sisa Fisik Opname}$$
  * Perbandingan otomatis antara bahan yang terpakai dengan jumlah produk yang terjual untuk mendeteksi *wastage* atau kebocoran minyak/adonan.

---

## 4. Tujuan Sistem (Goals & Non-Goals)

### System Goals
1. **Single Engine Multi-Tenant**: Satu database dan backend Go Fiber melayani seluruh arketipe bisnis dengan isolasi data 100% aman via `business_id` dan `outlet_id`.
2. **Offline-First PWA**: PWA dapat diinstal di homescreen, mendukung transaksi kasir offline dengan antrean lokal IndexedDB dan sinkronisasi otomatis via Background Sync.
3. **Anti-Fraud & Auditability**:
   - Stock Opname wajib menggunakan metode *Blind Count* (staff hitung fisik tanpa melihat angka sistem).
   - Void transaksi wajib memerlukan otorisasi *Manager PIN Override* yang tercatat di `override_logs`.
   - Tidak ada penghapusan data fisik (*hard delete*) pada data transaksi dan stok.
4. **Adaptive Dual Shell**: Tampilan menyesuaikan faktor bentuk perangkat (Mobile Shell ala Gojek untuk smartphone kasir vs Desktop Shell ala Samsung DeX untuk laptop/tablet manajemen).

### Non-Goals (Di Luar Scope Saat Ini)
* Modul HRM dan penggajian kompleks (*payroll*).
* Portal supplier mandiri (*supplier self-service*).
* Akuntansi multi-currency atau metode inventaris FIFO/LIFO berkala (sistem menggunakan *Last Buying Price* dan *Real Production HPP Snapshot*).

---

## 5. Struktur Kepemilikan & Hak Akses (RBAC)

```
User (Identitas Akun Login)
  └── business_owners (Relasi Many-to-Many)
        ├── Owner Bisnis A (Retail)
        ├── Owner Bisnis B (Kitchen)
        └── Owner Outlet C (Franchise)
```

* **Superadmin**: Pemeliharaan sistem dan infrastruktur (lintas-tenant, tanpa akses data operasional).
* **Owner**: Akses eksekutif penuh ke seluruh bisnis yang dimilikinya (berpindah via Workspace Switcher).
* **Manager**: Bertanggung jawab atas 1 outlet fisik (approve opname, approve void via PIN, melihat laporan shift).
* **Admin Gudang (Warehouse Admin)**: Bertanggung jawab atas mutasi gudang, pengiriman logistik, dan penerimaan barang pengadaan.
* **Staff / Kasir**: Bertanggung jawab atas transaksi kasir POS, input opname blind count, dan pelaporan kas harian.
