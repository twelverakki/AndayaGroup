# GEMINI.md — Project Compass & Antigravity Rules

> File ini dibaca secara otomatis oleh Antigravity Agent di awal setiap sesi. File ini memandu aturan pengembangan, standar UI/UX, dan panduan arsitektur proyek Andaya Group Multi-Tenant Lean ERP.

---

## 1. Tentang Proyek Ini
Multi-tenant lean ERP (POS + Inventory + Procurement + Opname + Analytics) untuk 4 bisnis milik Kennan:
1. **JnA Mart** (Retail kelontong modern, barcode scanning, dry/wet goods)
2. **Bakso Kang Gemoy** (F&B gerobak, Fast Grid UI, batch thaw tracking)
3. **Yasaka Fried Chicken** (F&B franchise, multi-cabang, Fast Grid & Retail hybrid)
4. **Gorengan Andalan** (F&B personal brand, Fast Grid sederhana)

Dibangun sebagai PWA installable dengan dukungan offline dan responsif terhadap 2 *form factor*:
* **Mobile Shell** (App-in-app ala Gojek)
* **Desktop Shell** (Multi-pane ala Samsung DeX)

---

## 2. Peta Dokumen & Spesifikasi (`AndayaGroup/`)
Gunakan berkas spesifikasi di folder [AndayaGroup/](file:///D:/laragon/www/Andaya-Group/AndayaGroup) untuk detail mendalam:

| Topik | File Referensi | Keterangan |
|---|---|---|
| **Kebutuhan Bisnis & Scope** | [PRD.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/PRD.md) | Requirement operasional 4 bisnis & arsitektur besar. |
| **Design System & Shell** | [DESIGN_SYSTEM.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DESIGN_SYSTEM.md) | Token visual (#CCF657 / #3F73F7, radius 28px/16px), komposisi shell. |
| **Hak Akses & Otorisasi** | [RBAC.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/RBAC.md) | Role Owner, Manager, Kasir, mekanisme approval. |
| **Struktur Database** | [DATA_MODEL.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DATA_MODEL.md) | Skema tabel multi-tenant, foreign keys, indeks, audit log. |
| **Log Keputusan Final** | [DECISIONS_LOG.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DECISIONS_LOG.md) | Rekam jejak keputusan arsitektur (D-01 s/d D-22). |
| **Roadmap & Milestone** | [ROADMAP.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/ROADMAP.md) | Indeks Fase 1 (Selesai) s/d Fase 5 (Analytics). |
| **Standar Pengujian** | [TESTING_STANDARDS.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/TESTING_STANDARDS.md) | Checklist DoD & uji isolasi tenant. |

---

## 3. Aturan Mutlak (Non-Negotiable)
1. **Tenant Scoping Otomatis**: Tenant scoping WAJIB melalui middleware/repository layer. Setiap query yang menyentuh data milik tenant wajib terfilter secara otomatis oleh `outlet_id` atau `business_id` dari JWT context. **Dilarang keras menulis raw query yang melompati lapisan ini.**
2. **Tidak Boleh Hard Delete**: Jangan pernah menghapus data transaksi atau akun staff secara fisik dari database. Gunakan mekanisme *soft-delete* atau deaktifasi. Riwayat transaksi dan jejak audit harus tetap utuh selamanya.
3. **Stack Teknologi Dikunci**:
   * **Backend**: Go (Fiber) + PostgreSQL (pgx)
   * **Frontend**: React (Vite / React Router) + Tailwind CSS + Shadcn UI
   * *Jangan menambah UI framework lain (MUI, Chakra, dll.) tanpa persetujuan eksplisit.*
4. **Vertical Slicing**: Selesaikan satu modul secara *end-to-end* (DB → API → UI) sebelum berpindah ke modul lainnya. Jangan mengerjakan banyak modul setengah-setengah secara bersamaan.
5. **Prasyarat Lolos Fase**: Jangan melangkah ke fase berikutnya sebelum checklist *Definition of Done* di fase berjalan dan [TESTING_STANDARDS.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/TESTING_STANDARDS.md) (terutama uji isolasi cross-tenant) dinyatakan lolos.
6. **Desain Desktop Shell**: Desktop Shell bukan versi mobile yang di-stretch. Token visual (warna, radius, tipografi) identik di semua shell; perbedaannya hanya pada komposisi layout multi-pane (lihat [DESIGN_SYSTEM.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DESIGN_SYSTEM.md)).
7. **Ambiguitas Logika Keuangan**: Jika menemukan ketidakjelasan requirement yang belum tercatat di [DECISIONS_LOG.md](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DECISIONS_LOG.md), **berhenti dan tanyakan ke user (Kennan)**. Jangan berasumsi sendiri pada logika yang menyangkut uang, harga, stok, atau wastage.
8. **Dropdown Harus Shadcn UI**: Setiap dropdown pilihan wajib menggunakan komponen `<Select>` / Dropdown dari Shadcn UI. **Dilarang** menggunakan tag native HTML `<select>` bawaan.

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
