# CLAUDE.md — Project Compass

> File ini dibaca otomatis oleh Claude Code di awal setiap sesi. Jaga tetap pendek — ini kompas, bukan gudang arsip. Untuk detail lengkap, ikuti link ke file terkait, jangan copy-paste isinya ke sini.

## Apa Proyek Ini
Multi-tenant lean ERP (POS + Inventory + Procurement) untuk 4 bisnis milik Kennan: **JnA Mart** (retail), **Bakso Kang Gemoy** (F&B gerobak), **Yasaka Fried Chicken** (F&B franchise, multi-cabang), **Gorengan Andalan** (F&B personal brand). Dibangun sebagai PWA installable dengan dukungan offline penuh.

## Baca File Ini Sesuai Kebutuhan
| Butuh tahu... | Baca |
|---|---|
| Requirement bisnis & arsitektur besar | `PRD.md` |
| Token visual, layout Mobile vs Desktop Shell | `DESIGN_SYSTEM.md` |
| Siapa boleh apa, mekanisme approval | `RBAC.md` |
| Struktur tabel database | `DATA_MODEL.md` |
| Keputusan yang sudah/belum final | `DECISIONS_LOG.md` |
| Fase mana yang sedang dikerjakan | `ROADMAP.md` → `/phases/phase-x-*.md` |
| Checklist wajib sebelum lanjut fase | `TESTING_STANDARDS.md` |

## Aturan Mutlak (Non-Negotiable)
1. **Tenant scoping wajib lewat middleware/repository layer**, bukan ditulis manual per-query. Setiap query yang menyentuh data milik tenant WAJIB terfilter otomatis oleh `outlet_id`/`business_id` dari JWT context. Dilarang menulis raw query yang skip lapisan ini.
2. **Jangan pernah hapus (hard delete) data transaksi atau akun staff.** Gunakan soft-delete/deactivate. Riwayat transaksi dan jejak audit harus tetap utuh selamanya.
3. **Stack sudah dikunci** — Go (Fiber) + PostgreSQL (pgx) di backend, React (Vite) di frontend, Tailwind + Shadcn UI di styling. Jangan tambah library UI lain (Material UI/Chakra/dll dilarang) atau ganti framework tanpa persetujuan eksplisit Kennan.
4. **Vertical slicing** — selesaikan 1 modul end-to-end (DB → API → UI) sebelum pindah ke modul lain. Jangan kerjakan banyak modul setengah-setengah sekaligus.
5. **Jangan lanjut ke fase berikutnya** sebelum checklist Definition of Done di file fase berjalan dan `TESTING_STANDARDS.md` (khususnya cross-tenant isolation test) dinyatakan lolos.
6. **Desktop Shell bukan versi mobile yang di-stretch** — token visual (warna, radius, tipografi) identik di semua shell; yang berbeda hanya komposisi layout (lihat `DESIGN_SYSTEM.md`).
7. Kalau menemukan ambiguitas requirement yang belum tercatat di `DECISIONS_LOG.md`, **berhenti dan tanyakan ke Kennan** — jangan asumsi sendiri, terutama untuk logic yang menyangkut uang (harga, stok, wastage).
8. **Setiap dropdown pilihan wajib menggunakan komponen dropdown/select dari Shadcn UI** — dilarang menggunakan tag native `<select>` HTML bawaan untuk dropdown pilihan agar konsisten dengan design system yang premium.

## Konvensi Kerja
- Bahasa dokumentasi: Bahasa Indonesia. Bahasa kode/nama variabel: Inggris standar.
- Commit/PR granular per-slice, bukan 1 commit raksasa per-fase.
- Setiap penambahan tabel baru ke database WAJIB disinkronkan ke `DATA_MODEL.md` di commit yang sama.
