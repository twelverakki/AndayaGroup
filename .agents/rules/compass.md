# PROJECT COMPASS — Andaya Group Multi-Tenant Lean ERP

> File ini dimuat secara otomatis oleh Antigravity Agent di awal setiap sesi sebagai kompas arsitektur dan peta referensi proyek.

---

## 1. Apa Proyek Ini
Multi-tenant lean ERP (POS + Inventory + Procurement + Opname + Analytics) untuk 4 bisnis milik Kennan:
1. **JnA Mart** (Retail kelontong modern, barcode scanning, dry/wet goods)
2. **Bakso Kang Gemoy** (F&B gerobak, Fast Grid UI, batch thaw tracking)
3. **Yasaka Fried Chicken** (F&B franchise, multi-cabang, Fast Grid & Retail hybrid)
4. **Gorengan Andalan** (F&B personal brand, Fast Grid sederhana)

Dibangun sebagai PWA installable dengan dukungan offline dan responsif terhadap 2 form factor: **Mobile Shell** (App-in-app ala Gojek) & **Desktop Shell** (Multi-pane ala Samsung DeX).

---

## 2. Peta Dokumen Bisnis & Arsitektur (`AndayaGroup/`)
Rujuk file-file spesifikasi di folder `AndayaGroup/` sesuai kebutuhan:

| Topik Kebutuhan | File Referensi | Keterangan |
|---|---|---|
| **Kebutuhan Bisnis & Scope** | [`AndayaGroup/PRD.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/PRD.md) | Requirement operasional 4 bisnis & arsitektur besar. |
| **Design System & Shell** | [`AndayaGroup/DESIGN_SYSTEM.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DESIGN_SYSTEM.md) | Token visual (#CCF657 / #3F73F7, radius 28px/16px), komposisi shell. |
| **Hak Akses & Otorisasi** | [`AndayaGroup/RBAC.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/RBAC.md) | Role Owner, Manager, Kasir, mekanisme approval opname & shift. |
| **Struktur Database** | [`AndayaGroup/DATA_MODEL.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DATA_MODEL.md) | Skema tabel multi-tenant, foreign keys, indeks, dan audit log. |
| **Log Keputusan Final** | [`AndayaGroup/DECISIONS_LOG.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/DECISIONS_LOG.md) | Rekam jejak keputusan arsitektur (D-01 s/d D-21). |
| **Roadmap & Milestone** | [`AndayaGroup/ROADMAP.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/ROADMAP.md) | Fase pengerjaan modul (Phase 1 Foundation s/d Phase 5 Analytics). |
| **Standar Pengujian** | [`AndayaGroup/TESTING_STANDARDS.md`](file:///D:/laragon/www/Andaya-Group/AndayaGroup/TESTING_STANDARDS.md) | Checklist Definition of Done & uji isolasi tenant. |

---

## 3. Aturan Mutlak (Non-Negotiable)
1. **Tenant scoping wajib lewat middleware/repository layer**, bukan ditulis manual per-query. Setiap query yang menyentuh data milik tenant WAJIB terfilter otomatis oleh `outlet_id`/`business_id` dari JWT context. Dilarang menulis raw query yang skip lapisan ini.
2. **Jangan pernah hapus (hard delete) data transaksi atau akun staff.** Gunakan soft-delete/deactivate. Riwayat transaksi dan jejak audit harus tetap utuh selamanya.
3. **Stack sudah dikunci**:
   - Backend: Go (Fiber) + PostgreSQL (pgx)
   - Frontend: React (Vite / React Router) + Tailwind CSS + Shadcn UI
   - Dilarang menambah UI framework lain (Material UI/Chakra dilarang) tanpa persetujuan eksplisit.
4. **Vertical Slicing**: Selesaikan 1 modul end-to-end (DB → API → UI) sebelum pindah ke modul lain.
5. **Jangan lanjut ke fase berikutnya** sebelum checklist Definition of Done di file fase berjalan dan `TESTING_STANDARDS.md` dinyatakan lolos.
6. **Desktop Shell bukan versi mobile yang di-stretch**: Token visual identik di semua shell; yang berbeda hanya komposisi layout multi-pane (lihat `DESIGN_SYSTEM.md`).
7. **Jika ada ambiguitas requirement** yang belum tercatat di `DECISIONS_LOG.md`, **berhenti dan tanyakan ke Kennan** (jangan berasumsi sendiri pada logic uang/stok).
8. **Dropdown pilihan wajib menggunakan ShadCN UI**: Dilarang menggunakan tag native `<select>` HTML bawaan.

---

## 4. Konvensi Kerja & UI Rules
- **Bahasa Dokumentasi**: Bahasa Indonesia.
- **Bahasa Kode/Variabel**: Bahasa Inggris standar.
- **Tabel Data (Master Table Rules)**: Mengacu pada Section 10 `general_rules.md` (Pill thead `bg-[#E7E9ED] dark:bg-[#2E2E34]`, border-separate tanpa outer border box, `border-b` per `td`, pagination bulat dengan highlight neon lime `#E2FF66`).
- **Drawer & Interaksi**: Gunakan slide-in ShadCN `Drawer` / `Sheet` dengan animasi kubik bezier halus dan handle grab yang responsif.
- **I18n**: Seluruh teks UI harus bilingual (Indonesian `id` & English `en`).

---

## 5. Status Dev Servers & Terminal Sesi
- **Server Sudah Dijalankan oleh User**: Kedua terminal server development berikut sudah selalu aktif dan dijalankan secara mandiri oleh User di lingkungan lokal:
  1. **Backend Go Server**: Berjalan di folder `backend` (port `8080`).
  2. **Frontend Vite Server**: Berjalan di folder `frontend` (port `5173`).
- **Aturan Agent**: Agent **DILARANG** menjalankan ulang perintah start server seperti `go run main.go` atau `npm run dev` di background agar tidak terjadi konflik proses atau tabrakan port (*port collision*). Untuk pengecekan kode/tipe, gunakan perintah non-server seperti `npx tsc --noEmit` atau `go vet ./...`.


