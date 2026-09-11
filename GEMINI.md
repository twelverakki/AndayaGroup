# GEMINI.md — Project Compass & Antigravity Rules

> File ini dibaca secara otomatis oleh Antigravity Agent di awal setiap sesi. File ini memandu aturan pengembangan, standar UI/UX, dan panduan arsitektur proyek Andaya Group Multi-Tenant Lean ERP.

---

## 1. Tentang Proyek Ini
Multi-tenant lean ERP (POS + Inventory + Procurement + Opname + Analytics) untuk 4 bisnis milik Kennan:
1. **JnA Mart** (Retail kelontong modern, barcode scanning, dry/wet goods)
2. **Bakso Kang Gemoy** (F&B gerobak, Fast Grid UI, batch thaw tracking)
3. **Yasaka Fried Chicken** (F&B franchise, multi-cabang, Fast Grid & Retail hybrid)
4. **Gorengan Andalan** (F&B personal brand, Fast Grid sederhana)

### 🏆 Benchmarking ke Odoo (The Lean Odoo Way)
Di Odoo, seluruh jenis bisnis (Retail, Restoran Dine-In, Fast Food, Takeaway, Bengkel, Pabrik) menggunakan **1 Core App / Framework yang SAMA**. Odoo tidak pernah membuat aplikasi berbeda untuk tiap industri. 
Dalam lingkup Retail, F&B, dan Fast Food / Takeaway, 1 aplikasi menangani seluruh variasi tersebut dengan prinsip:
1. **Single Master Engine**: 1 Master Item (`items`), 1 Double-Entry Inventory Ledger (`stock_movements`), 1 Transaction Sales Ledger (`transactions`).
2. **Dynamic Capability & Layout Flags**:
   * **Retail (JnA Mart)**: Mode POS Scan Barcode, Dual-UOM (Dus + Pcs), harga beli supplier sebagai HPP modal dasar.
   * **F&B Restoran / Dine-In**: Mengaktifkan table management, kitchen routing, dan split bill.
   * **Fast Food / Street Cart / Takeaway (Bakso Gemoy, Yasaka, Gorengan)**: Mode POS Fast Touch Grid (1-Tap checkout), tanpa meja dine-in, didukung formula batch BOM dapur (`productions`) atau lembar konsumsi bahan akhir hari (`eod_material_usages`).
3. **Zero Hardcoded Business Logic**: Semua unit bisnis baru di masa depan cukup mengaktifkan/menonaktifkan *capability flags* (`has_pos`, `has_manufacturing`, `has_logistics_hub`, `has_eod_usage`) tanpa menambah kode/aplikasi baru.

Dibangun sebagai PWA installable dengan dukungan offline dan responsif terhadap 2 *form factor*:
* **Mobile Shell** (App-in-app ala Gojek)
* **Desktop Shell** (Multi-pane ala Samsung DeX)

---

## 2. Peta Dokumen & Spesifikasi (`docs/`)
Gunakan berkas spesifikasi di folder [docs/](file:///D:/laragon/www/Andaya-Group/docs) untuk detail mendalam:

| Topik | File Referensi | Keterangan |
|---|---|---|
| **Kebutuhan Bisnis & Scope** | [PRD.md](file:///D:/laragon/www/Andaya-Group/docs/PRD.md) | Requirement operasional 4 bisnis & arsitektur besar. |
| **Blueprint Arsitektur Sistem** | [ARCHITECTURE.md](file:///D:/laragon/www/Andaya-Group/docs/ARCHITECTURE.md) | Blueprint arsitektur domain-driven modular (5 layer stack). |
| **Spesifikasi Menu & CRUD UI** | [UI_MENU_SPECIFICATION.md](file:///D:/laragon/www/Andaya-Group/docs/UI_MENU_SPECIFICATION.md) | Pohon hierarki menu, modal, CRUD, & alur page. |
| **Design System & Shell** | [DESIGN_SYSTEM.md](file:///D:/laragon/www/Andaya-Group/docs/DESIGN_SYSTEM.md) | Token visual (#CCF657 / #3F73F7, radius 28px/16px), komposisi shell. |
| **Hak Akses & Otorisasi** | [RBAC.md](file:///D:/laragon/www/Andaya-Group/docs/RBAC.md) | Role Owner, Manager, Kasir, mekanisme approval. |
| **Struktur Database** | [DATA_MODEL.md](file:///D:/laragon/www/Andaya-Group/docs/DATA_MODEL.md) | Skema tabel multi-tenant, foreign keys, indeks, audit log. |
| **Snapshot Live DB** | [DATABASE_SNAPSHOT.md](file:///D:/laragon/www/Andaya-Group/docs/DATABASE_SNAPSHOT.md) | Snapshot kondisi live database PostgreSQL & jumlah data (`row_count`). |
| **Evaluasi Versi Kode** | [evaluasi/](file:///D:/laragon/www/Andaya-Group/docs/evaluasi) | Log evaluasi sistem berversi (`eval_v-x-x.txt`). |
| **Plan Versi Kode** | [plan/](file:///D:/laragon/www/Andaya-Group/docs/plan) | Log rancangan & perbaikan sistem berversi (`plan-v_x-x.txt`). |
| **Log Keputusan Final** | [DECISIONS_LOG.md](file:///D:/laragon/www/Andaya-Group/docs/DECISIONS_LOG.md) | Rekam jejak keputusan arsitektur (D-01 s/d D-22). |
| **Roadmap & Milestone** | [ROADMAP.md](file:///D:/laragon/www/Andaya-Group/docs/ROADMAP.md) | Indeks Fase 1 (Selesai) s/d Fase 5 (Analytics). |
| **Standar Pengujian** | [TESTING_STANDARDS.md](file:///D:/laragon/www/Andaya-Group/docs/TESTING_STANDARDS.md) | Checklist DoD & uji isolasi tenant. |

---

## 3. Aturan Mutlak (Non-Negotiable)
1. **Tenant Scoping Otomatis**: Tenant scoping WAJIB melalui middleware/repository layer. Setiap query yang menyentuh data milik tenant wajib terfilter secara otomatis oleh `outlet_id` atau `business_id` dari JWT context. **Dilarang keras menulis raw query yang melompati lapisan ini.**
2. **Tidak Boleh Hard Delete**: Jangan pernah menghapus data transaksi atau akun staff secara fisik dari database. Gunakan mekanisme *soft-delete* atau deaktifasi. Riwayat transaksi dan jejak audit harus tetap utuh selamanya.
3. **Stack Teknologi Dikunci**:
   * **Backend**: Go (Fiber) + PostgreSQL (pgx)
   * **Frontend**: React (Vite / React Router) + Tailwind CSS + Shadcn UI
   * *Jangan menambah UI framework lain (MUI, Chakra, dll.) tanpa persetujuan eksplisit.*
4. **Vertical Slicing**: Selesaikan satu modul secara *end-to-end* (DB → API → UI) sebelum berpindah ke modul lainnya. Jangan mengerjakan banyak modul setengah-setengah secara bersamaan.
5. **Prasyarat Lolos Fase**: Jangan melangkah ke fase berikutnya sebelum checklist *Definition of Done* di fase berjalan dan [TESTING_STANDARDS.md](file:///D:/laragon/www/Andaya-Group/docs/TESTING_STANDARDS.md) (terutama uji isolasi cross-tenant) dinyatakan lolos.
6. **Desain Desktop Shell**: Desktop Shell bukan versi mobile yang di-stretch. Token visual (warna, radius, tipografi) identik di semua shell; perbedaannya hanya pada komposisi layout multi-pane (lihat [DESIGN_SYSTEM.md](file:///D:/laragon/www/Andaya-Group/docs/DESIGN_SYSTEM.md)).
7. **Ambiguitas Logika Keuangan**: Jika menemukan ketidakjelasan requirement yang belum tercatat di [DECISIONS_LOG.md](file:///D:/laragon/www/Andaya-Group/docs/DECISIONS_LOG.md), **berhenti dan tanyakan ke user (Kennan)**. Jangan berasumsi sendiri pada logika yang menyangkut uang, harga, stok, atau wastage.
8. **Dropdown & Form Harus Shadcn UI (Shadcn First)**: Setiap elemen form (Input, Label, Button, Dropdown `<Select>`, Switch, dan **`<InputOTP>` untuk PIN Kasir**) WAJIB menggunakan komponen dari Shadcn UI. **Dilarang** menggunakan tag native HTML `<select>` atau input PIN non-Shadcn.
9. **Struktur Folder Modular Feature**: Seluruh modul pada `frontend/app/features/` WAJIB disusun berdasarkan **Domain Capability** sebagai nama folder tingkat atas, dan **Varian Modul** di dalamnya (contoh: `features/production/fnb-module.tsx`, `features/pos/retail-module.tsx`, `features/pos/fnb-module.tsx`). **Dilarang keras** menggunakan nama brand dagang (seperti `bakso`) atau nama gabungan tidak terstruktur sebagai nama folder tingkat atas.
10. **Wajib Dukungan Dwi-Bahasa (Bilingual / i18n)**: Seluruh teks UI (label, judul, button, modal, toast message, placeholder, error message) WAJIB dideklarasikan di `frontend/app/lib/i18n.ts` dan mendukung dua bahasa (`id` Indonesia dan `en` Inggris). **Dilarang keras menanam hardcoded string secara langsung di dalam elemen JSX/TSX.**
11. **Do Not Sugarcoating Ever**: Agent WAJIB menyampaikan masukan, kritik teknis, evaluasi arsitektur, dan feedback secara 100% jujur, obyektif, kritis, to-the-point, dan langsung tanpa pemanisan kata (*no sugarcoating*). Jika ada kelemahan, celah bug, atau desain yang tidak efisien, sampaikan secara terbuka dan lugas.
12. **Standar Auth & Akun (Gmail & Forgot Password)**:
    * Akun email pengguna WAJIB menggunakan domain `@gmail.com`.
    * Form login wajib mendukung mode Password (Owner/Manager/Superadmin) dan mode PIN Kasir 6-digit via `<InputOTP>` (Staff Kasir).
    * Halaman login wajib memiliki alur **Lupa Password (Forgot Password)** yang terhubung ke email Gmail terdaftar.
13. **Konsep "Pelajari Selengkapnya" Ala Odoo (Contextual Help on Demand)**:
    * Mengikuti standar **The Lean Odoo Way**, UI konfigurasi (seperti saklar modular capability flags, mode stok inventori, rule batch thaw, pajak, dsb.) **DILARANG** dipenuhi oleh paragraf penjelasan panjang atau essay yang memakan tempat secara permanen di bawah input/toggle.
    * Label dan toggle harus tetap ringkas, bersih, dan to-the-point (contoh: label nama fitur + toggle switch).
    * Penjelasan mendalam (definisi kapabilitas, modul yang terbuka, dampak ke double-entry ledger & stok) WAJIB disematkan secara kontekstual menggunakan icon line Lucide (`HelpCircle` / `Info`) yang membuka Shadcn `<Tooltip>` (untuk intisari 1 kalimat) atau Shadcn `<Popover>` / Drawer *"Pelajari Selengkapnya"* (*Learn More*).
    * Dengan pendekatan ini, pengguna operasional harian tidak terganggu oleh teks berulang, namun tetap dapat membaca dokumentasi lengkap kapan pun dibutuhkan secara on-demand.

14. **Wajib Pakai Komponen Reusable yang Sudah Dibuat (No Raw Hardcoding)**:
    * **Dilarang keras menulis ulang atau meng-hardcode markup HTML mentah** jika sudah ada komponen UI standar proyek di `frontend/app/components/`:
      - **Tabel Data Master**: WAJIB menggunakan `<ErpDataTable<T> />` (bukan tag manual `<table>`). Mendukung toggle visibilitas kolom, header kapsul, dan dual view desktop/mobile otomatis.
      - **Kolom Pencarian**: WAJIB menggunakan `<ErpSearchBar />` dengan shortcut keyboard `/` otomatis.
      - **Input Uang / Nominal**: WAJIB menggunakan `<CurrencyInput />` dengan format titik ribuan real-time dan nilai internal `number`.
      - **Konfirmasi Aksi Bahaya**: WAJIB menggunakan `<ConfirmDialog />` untuk konfirmasi hapus/arsip/status penting.
      - **Pengaturan Modul**: Gunakan komponen drawer/modal standar (`POSSettingsDrawer`, `TransactionHistoryDrawer`, dll.).
    * Setiap pembuatan modul baru WAJIB memeriksa daftar komponen yang ada di folder `frontend/app/components/` dan menggunakannya.

15. **Wajib Kontras Warna Teks Terbaca (No Low-Contrast Text)**:
    * **Dilarang keras** menggunakan teks berwarna terang (seperti lime `#E2FF66` atau `text-primary`) di atas latar belakang terang/putih/abu-abu (`bg-white`, `bg-slate-100`, dll.).
    * Teks di atas latar belakang terang WAJIB menggunakan warna gelap yang jelas (`text-slate-800`, `text-slate-900`, atau `text-slate-700`).
    * Warna neon lime (`#E2FF66`) HANYA boleh digunakan sebagai latar belakang tombol solid (`bg-[#E2FF66] text-slate-900 font-bold`) atau teks di atas latar belakang gelap/hitam murni (`dark:text-white` / `dark:bg-slate-900`).

16. **Zero Full-Page Reload & Reactive Local Updates (Optimistic UI)**:
    * Pada setiap aksi CRUD, submit form drawer, reset PIN, atau toggle switch, aplikasi **DILARANG me-reload seluruh halaman atau mereset posisi scroll pengguna**.
    * Gunakan pendekatan **Optimistic Update** pada state lokal komponen (seperti `useState` atau mutate store) seketika saat tombol ditekan bersamaan dengan `toast.promise()`.
    * Data yang di-update di server cukup disinkronkan melalui fetching API granular pada sub-komponen terkait (`loadSubDetails()` atau callback `onUpdated(payload)`), bukan memanggil fungsi fetch master level atas yang memicu loading spinner satu halaman penuh.

---

## 4. Standar UI/UX & Aturan Coding Frontend
Detail lengkap aturan visual dan interaksi dikelola di [.agents/rules/general_rules.md](file:///D:/laragon/www/Andaya-Group/.agents/rules/general_rules.md), dengan ringkasan poin utama sebagai berikut:

* **Keyboard Shortcut Pencarian**:
  * Menekan tombol `/` harus langsung memfokuskan kursor ke input pencarian utama halaman tersebut, kecuali saat pengguna sedang mengetik di input/textarea lain.
  * Tampilkan petunjuk visual `<kbd className="px-1.5 py-0.5 rounded border text-[10px]">/</kbd>` di sisi kanan kolom pencarian.
* **Line Icons Only**: Hanya gunakan icon garis dari library `lucide-react`. Dilarang menggunakan emoji atau icon gambar berwarna (seperti ⚠️, ✅, 🟢, 🚪) di dalam UI.
* **Bilingual (i18n)**: Seluruh teks UI harus dideklarasikan di [frontend/app/lib/i18n.ts](file:///D:/laragon/www/Andaya-Group/frontend/app/lib/i18n.ts) (mendukung bahasa Indonesia `id` dan Inggris `en`).
* **Format Titik Ribuan**: Setiap input nilai uang/harga wajib memformat angka secara real-time dengan tanda pemisah ribuan (titik `.` untuk Indonesia) saat mengetik. State internal yang dikirim ke backend harus tetap berupa `number` murni.
* **Styling Tabel Data Utama (Master Table)**:
  1. **Floating Capsule Header**: Header baris `th` menggunakan latar belakang `bg-[#E7E9ED] dark:bg-[#2E2E34]`. Kolom paling kiri wajib memiliki class `rounded-l-full` dan kolom paling kanan memiliki class `rounded-r-full`.
  2. **Tanpa Border Luar**: Gunakan class `w-full text-left border-separate` dengan `borderSpacing: 0` pada elemen `<table>`. Dilarang membungkus tabel dengan border keliling.
  3. **Row Bottom Border**: Gunakan class `px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C]` pada elemen `<td>` (bukan menggunakan `divide-y` pada `tbody`).
  4. **Tombol Pagination Bulat**: Tombol nomor halaman harus bulat sempurna (`w-9 h-9 rounded-full`). Halaman aktif menggunakan warna neon lime (`bg-[#E2FF66] text-[#1a1a1a] font-bold border-none`).
* **Feedback System (Toast - Wajib)**: Setiap kali aksi penting (seperti menyimpan data, mengubah status, menyalin ID/SKU, melakukan arsip, atau ketika terjadi error/kegagalan sistem) dieksekusi, aplikasi **WAJIB** memanggil `toast` dari Sonner untuk menampilkan status aksi kepada pengguna secara real-time. Gunakan `toast.success()`, `toast.error()`, `toast.info()`, dst. dengan latar belakang netral/bersih (`bg-white dark:bg-[#202024]`). Status sukses/gagal diwakili sepenuhnya oleh icon garis dari Lucide.
* **Aksi Cepat**: Pada menu baris tabel, selalu sediakan aksi langsung untuk mengubah status operasional (Aktif, Non-aktif, Dihentikan) agar pengguna tidak perlu masuk ke halaman edit detail.
* **Contextual Help on Demand ("Pelajari Selengkapnya")**: Gunakan icon `HelpCircle` / `Info` dengan popover/tooltip berdesain bersih untuk semua penjelasan fungsional modul, bukan meletakkan teks panjang langsung di form.

---

## 5. Konvensi Kerja & Kontrol Server
* **Bahasa**:
  * Bahasa Dokumentasi & Diskusi: **Bahasa Indonesia**
  * Bahasa Kode, Variabel, & Skema DB: **Bahasa Inggris**
* **Pengembangan Bertahap**: Lakukan commit/PR secara granular per-slice fitur, bukan dalam satu commit raksasa di akhir fase.
* **Sinkronisasi Skema**: Setiap penambahan tabel baru wajib disinkronkan ke dalam berkas [DATA_MODEL.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DATA_MODEL.md) pada commit yang sama.
* **Dev Server Port & Terminal Sesi**:
  * **Backend Go Server** berjalan di direktori `backend` (port `8080`).
  * **Frontend Vite Server** berjalan di direktori `frontend` (port `5173`).
  * **PENTING**: Kedua server ini sudah dijalankan secara mandiri oleh user. **Agent dilarang keras menjalankan ulang perintah start server** (`go run main.go`, `npm run dev`) di background demi mencegah konflik port.
  * Gunakan perintah non-blocking dan non-server untuk pengetesan, seperti `go vet ./...` atau `npx tsc --noEmit`.
