# ROADMAP.md — Domain Capability Implementation Roadmap

> **Arsitektur**: Multi-Tenant Lean ERP (The Lean Odoo Way)  
> **Prinsip**: Domain-Driven Modular Capabilities (Agnostik Merek)  
> **Status Pelacakan**: Selesaikan per-domain capability end-to-end (DB $\rightarrow$ API $\rightarrow$ UI).

---

## 1. Peta Milestone 9 Domain Capabilities

| Domain Capability | Cakupan & Fitur Inti yang Wajib Ditunjang | Acuan Arsitektur | Status |
|---|---|---|:---:|
| **Domain 1: Core Auth, Multi-Tenancy & Workspace** | Multi-tenant auth, workspace switcher, ownership many-to-many, PWA dual-shell (Mobile + Desktop). | [ARCHITECTURE.md](file:///D:/laragon/www/Andaya-Group/docs/ARCHITECTURE.md) | ✅ Selesai |
| **Domain 2: Master Items & Stock Ledger** | Unified Item Master (3NF), format Dual-UOM (Dus + Pcs), konversi satuan, buku besar mutasi append-only (`stock_movements`). | [DATA_MODEL.md](file:///D:/laragon/www/Andaya-Group/docs/DATA_MODEL.md) | ✅ Selesai |
| **Domain 3: Commercial POS & Cashier Sessions** | Checkout retail barcode scanning, touch grid F&B, sesi kasir register (`sessions`), manager PIN void override, auto session summary, rule-based promotions. | [UI_MENU_SPECIFICATION.md](file:///D:/laragon/www/Andaya-Group/docs/UI_MENU_SPECIFICATION.md) | ✅ Selesai |
| **Domain 4: Stock Transfers & Transit Thawing** | Pengiriman stok antar-lokasi (`distributions`), serah terima personel (`handshake receive`), nomor surat jalan sequential, toleransi susut transit, konversi pencairan beku F&B & QC Log (`thaw_logs`). | [ARCHITECTURE.md](file:///D:/laragon/www/Andaya-Group/docs/ARCHITECTURE.md) | 🟨 Sedang Dikerjakan |
| **Domain 5: Kitchen Production & Real COGS** | Batch produksi dapur/gudang pusat, pemotongan bahan baku atomik, snapshot HPP per unit, kalkulasi konsumsi bahan harian (*End-of-Day Material Usages*). | [ARCHITECTURE.md](file:///D:/laragon/www/Andaya-Group/docs/ARCHITECTURE.md) | ⬜ Belum Mulai |
| **Domain 6: Daily Reconciliation & Settlements** | Rekonsiliasi setoran kas & QRIS, penghitungan selisih (*variance*), pencatatan blind count opname, unifikasi direct wholesale sales. | [DECISIONS_LOG.md](file:///D:/laragon/www/Andaya-Group/docs/DECISIONS_LOG.md) | ⬜ Belum Mulai |
| **Domain 7: Purchases & Accounts Payable** | PO ke supplier (`purchases`), pencatatan faktur & jatuh tempo hutang, penambahan stok otomatis ke gudang/outlet. | [DATA_MODEL.md](file:///D:/laragon/www/Andaya-Group/docs/DATA_MODEL.md) | ⬜ Belum Mulai |
| **Domain 8: Group Consolidated Analytics** | Laporan laba-rugi per-bisnis & konsolidasi grup, metrik margin omzet, analisis arus kas Owner. | [ARCHITECTURE.md](file:///D:/laragon/www/Andaya-Group/docs/ARCHITECTURE.md) | ⬜ Belum Mulai |
| **Domain 9: Organization, Outlets & Staff Management** | CRUD akun kasir & staff oleh Owner, reset PIN kasir, assignment outlet cabang, dan konfigurasi capability flags bisnis. | [UI_MENU_SPECIFICATION.md](file:///D:/laragon/www/Andaya-Group/docs/UI_MENU_SPECIFICATION.md) | 🟨 Hampir Selesai |

---

## 2. Legenda Status & Aturan Eksekusi

* **Legenda Status**:
  * ⬜ Belum mulai
  * 🟨 Sedang dikerjakan / diselaraskan
  * 🟦 Menunggu verifikasi Kennan
  * ✅ Selesai (DoD & Test lolos 100%)

* **Aturan Kunci**:
  1. **Agnostik Merek**: Dilarang membuat modul atau route berdasarkan nama brand dagang. Seluruh logika harus modular berbasis *item capability* dan *domain feature*.
  2. **Isolasi Multi-Tenant Wajib**: Setiap query yang menyentuh data tenant wajib terfilter ketat melalui `business_id` / `outlet_id` JWT context ([`TESTING_STANDARDS.md`](file:///D:/laragon/www/Andaya-Group/docs/TESTING_STANDARDS.md)).
  3. **Vertical Slicing**: Selesaikan satu modul secara penuh (DB $\rightarrow$ API $\rightarrow$ UI) sebelum berpindah.
