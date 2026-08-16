# Product Requirement Document (PRD)
## Multi-Tenant ERP System — POS, Inventory & Procurement

| | |
|---|---|
| **Project Owner** | Kennan |
| **Document Status** | v2.0 — disinkronkan dengan story flow & keputusan terbaru |
| **Target Pembangun** | AI Coding Agent (Autonomous Build) |
| **Dokumen Pendamping** | `CLAUDE.md` (kompas agent), `DECISIONS_LOG.md` (riwayat keputusan lengkap + alasan), `DESIGN_SYSTEM.md`, `RBAC.md`, `DATA_MODEL.md`, `ROADMAP.md` + `/phases/*` |

> Dokumen ini adalah ringkasan requirement yang stabil. Untuk alasan di balik tiap keputusan dan status open question terbaru, selalu rujuk `DECISIONS_LOG.md` — dokumen itu sumber kebenaran paling update.

---

## 1. Latar Belakang & Konteks

Kennan mengelola **grup bisnis** yang menaungi 4 brand berbeda, dengan sistem ERP ringan (lean ERP — tanpa modul HRM) untuk seluruhnya dalam **satu server tunggal**. Empat brand ini punya karakteristik operasional, jumlah SKU, dan kompleksitas inventaris yang sangat berbeda — tidak bisa didekati satu template POS generik.

**Penting:** ini bukan 4 bisnis yang dimiliki 4 orang berbeda secara independen. Kepemilikan bersifat **lintas-brand** — 1 orang bisa memegang peran Owner di lebih dari 1 bisnis sekaligus (lihat Bagian 3).

Sistem dibangun secara otonom oleh AI Agent, sehingga seluruh business logic didokumentasikan presisi agar agent tidak salah menerapkan logika 1 bisnis ke bisnis lain.

### 1.1 Modul ERP yang Digunakan (Scope)
- ✅ POS (Point of Sale) / Sales
- ✅ Inventory Management
- ✅ Procurement (termasuk tracking hutang/kredit ke supplier)
- 🟡 CRM — ongoing, rujuk proyek sebelumnya (wallpanel), belum difinalisasi untuk 4 bisnis ini
- ❌ HRM — tidak digunakan
- ❌ Supplier self-service portal — aplikasi internal, dioperasikan langsung Owner/Manager

---

## 2. Tujuan Produk (Goals)

1. Satu backend & database terpusat melayani 4 brand tanpa data bentrok — multi-tenant, isolasi ketat per `business_id`/`outlet_id`.
2. UI POS **disesuaikan per karakter bisnis** (bukan 1 UI generik dipaksakan ke semua).
3. Kecepatan transaksi kasir sebagai prioritas, khususnya bisnis F&B jalanan.
4. Kontrol internal ke Owner untuk deteksi fraud & pemborosan — termasuk kasus spesifik "pengambilan pribadi langsung" (JnA Mart) — tanpa membebani staff dengan input ribet.
5. Dukungan **offline penuh** (PWA) — bagian dari tujuan pengembangan grup klien, bukan sekadar nice-to-have.
6. Media pembelajaran arsitektur software modern (REST API + SPA decoupled) sekaligus portofolio *industry-ready*.

### Non-Goals (di luar scope saat ini)
- Akuntansi lanjutan (FIFO/LIFO/Average Cost) — pakai skema **Last Buying Price**.
- Modul Supplier self-service.
- Modul HRM/Payroll.
- Dashboard finansial agregat lintas-bisnis untuk Owner multi-brand (lihat Bagian 3) — untuk sekarang Owner melihat satu bisnis dalam satu waktu via workspace switcher.
- Fitur multi-franchise penuh untuk Yasaka (manajemen banyak franchisee dari 1 brand pusat) — scope sekarang cukup 1 outlet.

---

## 3. Struktur Kepemilikan Grup Bisnis

Model kepemilikan bersifat **many-to-many**, bukan 1 Owner : 1 Bisnis:

```
User (1 akun login = 1 identitas orang)
  └── business_owners (tabel penghubung: user_id, business_id/outlet_id, role)
        ├── contoh: Owner A → Owner di JnA Mart + Owner di Gorengan Andalan
        └── contoh: Owner B → Owner di Bakso Kang Gemoy + Owner di 1 outlet Yasaka
```

- **1 akun login bisa switch antar-bisnis yang dia miliki** (workspace switcher, seperti Slack/Notion) — tidak perlu login ulang per-bisnis.
- Saat sesi aktif di 1 konteks bisnis, seluruh data & tampilan terscope penuh ke `business_id`/`outlet_id` itu — tidak ada campur data antar-bisnis, walau dimiliki orang yang sama.
- Dashboard tetap **per-bisnis** (lihat satu per satu), bukan agregat gabungan — ini keputusan scope sekarang, bukan keterbatasan teknis (skema data tidak menutup kemungkinan fitur agregat ditambah nanti).
- **Yasaka** khusus: karena franchise, kepemilikan di-assign di **level outlet** (bukan level business) — supaya tiap outlet bisa punya Owner berbeda di masa depan. Untuk sekarang, cukup 1 outlet Yasaka (dimiliki Owner Bakso Kang Gemoy).

---

## 4. Profil 4 Brand

| Brand | Kategori | Skala | Ciri Khas Operasional |
|---|---|---|---|
| **JnA Mart** | Retail minimarket + jualan pasar tradisional | Ribuan SKU (dry + wet goods) | Historis **tanpa catatan penjualan sama sekali**; fraud utama dari pengambilan pribadi; pengadaan sering terikat hari pasar (Rabu/Minggu); sebagian pengadaan sistem "utangan" ke supplier |
| **Bakso Kang Gemoy** | F&B — produksi rumahan didistribusikan ke titik jualan | < 10 varian produk | Owner produksi sendiri di rumah; 3 titik jualan diisi karyawan bergaji bulanan (bukan cabang formal); stok pack (beku) → pcs (dibuka, perishable) |
| **Yasaka Fried Chicken** | F&B franchise | Belasan produk + minuman kardusan | 1 outlet (dimiliki Owner Bakso Kang Gemoy); restock mingguan; fokus utama: POS + printer anti-fraud kasir |
| **Gorengan Andalan** | F&B — 2 cabang formal | 6 produk | Tiap cabang punya Manager/Kepala Cabang sendiri; bahan basah dibeli & habis hari itu juga (tanpa carry-over) |

---

## 5. User Roles & Hak Akses

| Role | Cakupan | Deskripsi |
|---|---|---|
| **Superadmin** | Lintas-tenant (level developer) | Kelola akun langganan, maintenance sistem. Tidak masuk ranah operasional bisnis. |
| **Owner** | Scoped per `business_id`/`outlet_id` via `business_owners`; 1 akun bisa punya banyak record Owner | Lihat laporan finansial, valuasi aset, analytics bisnis yang dia miliki. Switch antar-bisnis dalam 1 akun. |
| **Admin Gudang** *(khusus Bakso Kang Gemoy)* | Delegasi penuh dari Owner, domain gudang pusat saja | Approve stock request dari titik jualan, input restock gudang. **Tidak** lihat laporan finansial toko atau atur akun Manager/Staff. Untuk sekarang posisi ini dipegang Owner sendiri. |
| **Manager** | Per-outlet | Approve hasil opname (Blind Count) & wastage log, approve void via PIN (Manager Override), lihat laporan shift harian. |
| **Staff** | Per-outlet/titik jualan | Transaksi POS, input hasil opname (blind, tanpa lihat angka sistem), input log harian bahan (bisnis yang relevan). **Tidak** boleh hapus riwayat transaksi, **tidak** boleh lihat harga modal/keuntungan bulanan. Akun dibuat ringan & cepat dinonaktifkan (bukan dihapus) — turnover cepat terutama di Yasaka/Gorengan. |

**RBAC bersifat hardcode** (matrix tetap di kode, bisa direvisi via migration), bukan dynamic permission engine yang bisa dikustom dari UI — sesuai skala 4 bisnis saat ini.

### Manager Override (Void & approval lain)
PIN pendek (4-6 digit) per akun Manager, di-hash, tabel `manager_pins`. Setiap pemakaian tercatat di `override_logs` (siapa minta, siapa approve, transaksi mana, alasan). Manager tidak perlu standby fisik di kasir. Mekanisme ini generik — bisa dipakai ulang untuk approval lain (mis. discount override), bukan cuma void.

### Retur vs Void
Kebijakan toko: **tidak ada retur/refund** (barang keluar tidak bisa dikembalikan) → modul retur dihapus dari scope. **Void** (kasir salah input sebelum transaksi selesai) tetap wajib ada via Manager Override di atas — ini kasus berbeda dari retur.

---

## 6. Functional Requirements

### 6.1 POS
- **JnA Mart:** Global barcode event listener (window-level, mode HID). Printer struk terintegrasi (Phase 1). Dual inventory logic (lihat 6.2).
- **Bakso Kang Gemoy:** Fast Grid UI (tanpa barcode). Tidak perlu printer — cukup digital receipt/notifikasi QRIS.
- **Yasaka:** Fast Grid/Retail hybrid + printer struk (prioritas tinggi — alat anti-fraud kasir tanpa perlu diawasi terus-menerus).
- **Gorengan Andalan:** Fast Grid UI sederhana + printer nota.
- **Cashier Shift Management** (semua bisnis): Open Shift (input modal kas awal) → transaksi → Close Shift (rekonsiliasi kas fisik vs sistem).
- **Internal/Personal Take** (khusus JnA Mart): transaction type khusus di POS untuk mencatat pengambilan barang untuk konsumsi pribadi/keluarga — tetap memotong stok dan tercatat di sistem (harga bisa Rp0 atau harga modal sesuai kebijakan Owner), supaya praktik ini *accountable*, bukan hilang tanpa jejak.

### 6.2 Inventory Management — Berbeda per Brand

**JnA Mart — Dual Inventory + Blind Count**
- Dry Goods: strict stock, transaksi ditolak jika stok habis.
- Wet Goods: infinite stock di POS (tidak mengunci transaksi); direkonsiliasi via **opname Blind Count** setiap 2-3 hari.
- Opname: staff hitung fisik tanpa lihat angka sistem dulu → submit → sistem bandingkan → **wajib approval Manager/Owner** sebelum terkunci ke `wastage_logs` (anti-fraud: pemisahan yang menghitung vs yang mengesahkan).
- Restock: *New SKU Registration* (produk baru) vs *Stock In* (restock existing, scan + qty).
- Valuasi: Last Buying Price, restock dicatat sebagai opex.

**Bakso Kang Gemoy — Batch Thaw Tracking**
- Owner produksi bakso beku sendiri; produksi dipicu manual berdasarkan threshold minimum per varian yang ia tentukan sendiri (bukan otomatis sistem).
- Stok punya 2 status: `Sealed` (pack utuh, 1 pack = 20 pcs, tahan lama) → `Opened` (dihitung per-pcs, wajib quality check tiap pagi, umur maks 1-2 hari).
- Distribusi ke 3 titik jualan (karyawan bergaji, bukan outlet formal) — sebelumnya manual via WA, kini **stock tracker + notif alert** otomatis.
- Closing harian per titik jualan: laporkan sisa `Sealed` (utuh) + sisa `Opened` (pcs).

**Yasaka — Simple Stock Tracking**
- Cukup tracking gudang (bungkusan, tepung, ayam bag besar/kecil) + restock mingguan.
- **Tidak** pakai mesin deteksi wastage otomatis (Dual-Track) — fokus Yasaka ada di POS + printer, bukan reconciliation bahan.
- Minuman kardusan: konversi **carton → pcs** (dibeli per-karton, dijual per-pcs), tanpa gate perishable.

**Gorengan Andalan — Dual-Track Logging (siklus harian penuh)**
- Track 1: Daily Material Log (bahan siap pakai pagi hari). Track 2: penjualan hanya kurangi stok produk jadi.
- End-of-day: `Bahan Terpakai = Bahan Awal − Sisa`, dibandingkan penjualan POS → selisih otomatis jadi Wastage/Loss.
- Khusus: karena bahan basah **habis hari itu juga** (tidak nginep), reconciliation mulai dari nol tiap pagi — tanpa carry-over. Barang tahan lama (minyak, bungkusan) pakai model stock biasa.

**Database inventory dirancang polymorphic:** tabel `products`, `ingredients/raw_materials`, pivot `product_ingredients` (kosong untuk Retail, terisi untuk F&B berbasis resep). Detail skema lengkap di `DATA_MODEL.md`.

### 6.3 Procurement
- Owner/Manager/Admin Gudang mencatat kedatangan barang & biaya (tanpa modul self-service supplier).
- **Tracking Hutang/Kredit** (khusus JnA Mart): field status pembayaran (Lunas/Belum Lunas) + jumlah terutang per transaksi pengadaan — mencerminkan pola beli "utangan" yang sudah berjalan lama. *(Detail jatuh tempo/cicilan masih open — lihat `DECISIONS_LOG.md` Q-06.)*
- Wet goods (JnA Mart): dicatat berdasarkan berat timbangan riil saat barang tiba, bukan estimasi tetap.
- Dry goods: PO/Receiving → scan SKU → strict increment stok + validasi HPP terbaru.

### 6.4 CRM
Status: ongoing, rujuk proyek wallpanel sebelumnya. Detail requirement untuk 4 brand ini belum difinalisasi, dibahas terpisah.

### 6.5 Analytics
- **Bakso Kang Gemoy:** analitik seminimal mungkin, ramah untuk Owner yang tidak terlalu melek teknologi — tapi tetap dirancang agar Owner bisa belajar baca diagram sederhana secara bertahap.
- **Yasaka & Gorengan:** dashboard/analisis "nice-to-have", bukan requirement inti Phase awal.
- Semua dashboard bersifat **per-bisnis**, bukan agregat lintas-brand (lihat Bagian 3).

---

## 7. Technical Architecture

### 7.1 Stack (Final)

| Layer | Teknologi |
|---|---|
| Backend | Go (Golang) — **Fiber** (`gofiber/fiber/v2`) |
| Database Driver | `jackc/pgx/v5` (native PostgreSQL, connection pooling) |
| Autentikasi | `golang-jwt/jwt/v5` — JWT via HTTP-Only Cookie (mitigasi XSS), fallback header Bearer untuk mobile |
| Konfigurasi | `joho/godotenv` |
| Database | PostgreSQL — multi-tenant, isolasi baris via `business_id`/`outlet_id` |
| Frontend | React (Vite SPA) |
| Routing FE | `react-router-dom` |
| HTTP Client | `axios` (interceptor 401) |
| State Management | `zustand` |
| Styling | Tailwind CSS + Shadcn UI — dilarang tambah library UI lain |
| Animasi | Framer Motion |

Arsitektur: **Pure REST API (Go) + Decoupled React SPA** — bukan Inertia.js. Alasan: stateless, siap diakses klien lain (mobile) nanti, lebih konsisten dieksekusi AI Agent karena sangat terstruktur.

### 7.2 Multi-Tenancy & Auth
- Token JWT memuat: `user_id`, `role`, konteks bisnis aktif (`business_id`/`outlet_id` sesuai workspace yang sedang di-switch).
- **Tenant scoping wajib di-enforce di middleware/repository layer** — auto-inject filter tenant dari JWT context, dilarang query manual per-handler tanpa lapisan ini.
- Ownership many-to-many (`business_owners`) memungkinkan 1 akun switch konteks tanpa re-login (lihat Bagian 3).
- **Cross-tenant isolation test otomatis wajib** di setiap fase yang menyentuh database — masuk Definition of Done, dicatat di `TESTING_STANDARDS.md`.

### 7.3 Offline Support — Full PWA
Ini requirement arsitektur inti sejak Phase 1, bukan opsional — bagian dari tujuan pengembangan klien untuk membuktikan kapabilitas offline:
- Service Worker: precache asset + intercept request, aplikasi tetap bisa dibuka meski internet mati total.
- IndexedDB: local queue transaksi (bukan sekadar localStorage), lebih cocok untuk antrean + cache produk.
- Background Sync API: browser otomatis sync begitu koneksi balik, walau tab ditutup.
- Installable to home screen (manifest.json).
- Idempotency key per transaksi (UUID di client) untuk cegah dobel-input saat retry sync.

### 7.4 Hardware Integration (Phase 1)
- **Barcode scanner** — mode HID (terbaca sebagai keyboard), sudah tercover global event listener. Berlaku JnA Mart.
- **Printer struk/nota** — masuk scope Phase 1, dibutuhkan JnA Mart, Yasaka, dan Gorengan Andalan (Bakso Kang Gemoy cukup digital receipt).
- Timbangan digital — **out of scope**, belum ada kebutuhan eksplisit.

### 7.5 Concurrency & Data Integrity
Risiko concurrency dinilai kecil (1 kasir per outlet, inventory antar-bisnis independen), tapi tetap dipasang insurance murah: DB-level `CHECK (stock >= 0)` + atomic update (bukan read-then-write).

### 7.6 Struktur Direktori (Decoupled Monorepo)
```text
├── backend/                  # Go REST API
│   ├── main.go
│   ├── go.mod / go.sum
│   ├── .env
│   └── internal/
│       ├── config/           # DB Connection & JWT Keys
│       ├── middleware/       # AuthGuard, TenantContext, CORS
│       ├── models/           # DB Structs & JSON Transforms
│       └── modules/          # Vertical Slices per modul bisnis
│           └── auth/
│               ├── handler.go
│               └── service.go
│
└── frontend/                 # React SPA (Vite, PWA)
    ├── package.json
    ├── vite.config.js
    ├── manifest.json
    ├── index.html
    └── src/
        ├── main.jsx
        ├── sw.js              # Service Worker
        ├── routes/            # React Router config
        ├── api/               # Axios client + interceptors
        ├── store/             # Zustand global stores + IndexedDB queue
        ├── shells/            # MobileShell, DesktopShell (lihat DESIGN_SYSTEM.md)
        ├── components/        # Shared UI
        └── pages/             # Feature modules per bisnis
```

---

## 8. Design System (ringkas — detail penuh di `DESIGN_SYSTEM.md`)

- **1 unified design token** (tipografi, radius 28px, touch target minimum 56px, motion, warna Primary `#CCF657`/Secondary `#3F73F7`) berlaku sama di semua shell — terinspirasi prinsip One UI (reachability, chunky card, touch target besar) + preseden Samsung DeX (adaptasi layar besar tanpa ganti token visual).
- **Shell dipilih berdasarkan device/context, bukan jenis bisnis:** Mobile Shell (single-column, bottom nav, app-in-app ala Gojek) vs Desktop/Tablet Shell (multi-pane grid). Kasir JnA yang cek stok dari HP tetap pakai Mobile Shell; Owner Bakso yang kerja dari laptop tetap pakai Desktop Shell.
- Yang berbeda antar-shell hanya **komposisi layout**, bukan gaya visual.
- Strategi development: **Vertical Slicing** — 1 modul end-to-end (DB → API → UI) sebelum modul berikutnya.

---

## 9. Roadmap Implementasi (ringkas — detail penuh di `ROADMAP.md` & `/phases/*`)

| Fase | Fokus |
|---|---|
| **Phase 1** | Fondasi: Go backend (Fiber + pgx + CORS + TenantContext + JWT + ownership many-to-many) & React frontend (Vite + PWA shell + Router + Axios + Zustand + AuthGuard + workspace switcher) |
| **Phase 2** | JnA Mart (POS + scanner + printer, dual dry/wet inventory, Blind Count opname, Internal Take, Procurement + hutang tracking) |
| **Phase 3** | Bakso Kang Gemoy (produksi & threshold alert, Batch Thaw Tracking, distribusi ke titik jualan) |
| **Phase 4** | Yasaka (simple stock tracking + carton-pcs conversion + POS/printer) & Gorengan Andalan (Dual-Track harian, 2 outlet dengan Manager masing-masing) |
| **Phase 5** | Analytics per-bisnis & performance tuning |

**Aturan eksekusi AI Agent:** tidak lanjut fase berikutnya sebelum Definition of Done fase berjalan (termasuk cross-tenant isolation test) lolos verifikasi manual Kennan.

---

## 10. Non-Functional Requirements

- **Single server deployment** — resource-efficient meski melayani banyak tenant sekaligus.
- **Data isolation** ketat secara logis (row-level), meski berbagi 1 instance database.
- **Performa kasir** — input barcode/tap menu instan, tanpa re-render berat di komponen POS.
- **Offline-first** — lihat Bagian 7.3, requirement inti bukan tambahan.
- **Ekstensibilitas** — REST API terbuka untuk klien lain (mobile app) tanpa merombak core logic.

---

## 11. Open Questions

Status terkini selalu di `DECISIONS_LOG.md`. Ringkasan yang masih terbuka saat ini:
1. **Struktur approval harian outlet Yasaka** — siapa yang pegang di lokasi (Owner sendiri atau ada Manager lokal)?
2. **Navigasi Desktop/Tablet Shell** — sidebar persisten ala DeX taskbar, atau top-nav biasa?
3. **Detail hutang/kredit JnA Mart** — perlu jatuh tempo & riwayat cicilan, atau cukup status biner lunas/belum untuk versi awal?

---

## 12. Referensi Desain (Eksplorasi UI/UX)
- Godly — godly.website (referensi micro-interaction & animasi)
- Samsung One UI & Samsung DeX (referensi prinsip reachability & adaptasi layar besar)
- Dribbble / Behance — kata kunci: "Dashboard Glassmorphism", "Modern POS Lightmode"
- Component Gallery — component.gallery
