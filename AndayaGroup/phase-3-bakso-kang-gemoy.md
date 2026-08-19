# Phase 3 — Bakso Kang Gemoy

> Rujuk `PRD.md` §6 (Bakso Kang Gemoy), `RBAC.md` §5 (Bakso Kang Gemoy), `DATA_MODEL.md` §4 & §7, `DECISIONS_LOG.md` D-14, D-14a, D-14b, D-14c, D-22.

## 1. Scope

**Produksi & Gudang (revised):**
- Owner/Admin Gudang mencatat produksi bakso jadi (Pack).
- **Expense Produksi**: Mencatat bahan/alat yang dipakai dari Master Bahan & Alat (tanpa running balance/pengurangan stok otomatis).

**Batch Thaw Tracking:**
- Stok 2 status: `Sealed` (pack, 1 pack = 20 pcs) → `Opened` (pcs, quality check harian).

**Distribusi & Retur (revised):**
- Distribusi: Kirim Pack dari Gudang ke staff, status `sent` → `received`.
- Retur: Staff mengembalikan Pack/Pcs ke Gudang Pusat.

**QC Pagi & Closing Harian:**
- QC Pagi: Cek kelayakan opened yesterday (pass/discard pcs) secara manual.
- Closing Harian: Staff input sisa stok sealed, sisa stok opened, + catat rusak/dimakan/jatuh dll sebagai wastage.

**POS:**
- **Dihapus**: Bakso Kang Gemoy tidak menggunakan POS.

---

## 2. Prasyarat
Phase 1 ✅. Phase 2 tidak wajib selesai duluan (independen), tetapi direkomendasikan.

---

## 3. Task Breakdown

### Database & Migrations
- [x] Migrasi DB: `stock_batches`, `stock_conversions` (pack→pcs, rate=20), `productions`, `distributions`
- [x] Migrasi DB: Tambah tabel `production_expenses` & kolom traceability di `distributions`, `stock_batches`, `wastage_logs`

### Backend (Go API)
- [x] Backend: Update Go models (`StockBatch`, `Distribution`, `WastageLog`) dengan kolom baru hasil migrasi.
- [x] Backend: Perbaiki database query `INSERT` pada `ReceiveDistribution`, `ThawBatch`, dan `CloseDailyStock` agar menyertakan `business_id` (karena `NOT NULL`).
- [x] Backend: Revamp endpoint input produksi (input hasil produksi + daftar bahan & alat yang dipakai).
- [x] Backend: Implementasi endpoint Retur Distribusi (kirim balik ke gudang pusat).
- [x] Backend: Tambahkan warning/alert untuk pengiriman distribusi yang menggantung (`sent` > 24 jam).
- [x] Backend: Tambahkan traceability check endpoint (`stock_batch_id` -> `distribution_id` -> `production_id`).

### Frontend (React)
- [x] Frontend: Hapus menu POS untuk Bakso Kang Gemoy (tidak pakai POS).
- [x] Frontend: UI Master Bahan & Alat (CRUD List untuk Owner).
- [x] Frontend: UI form Produksi & Expense (input produk jadi + list bahan & alat yang dipakai).
- [x] Frontend: UI Retur Distribusi (staff return ke gudang pusat).
- [x] Frontend: UI Approval Wastage (Owner approve/reject).

---

## 4. Testing Checklist
- [x] Cross-tenant isolation: data Bakso tidak bocor ke bisnis lain
- [x] Konversi pack→pcs akurat: 1 pack terbuka menghasilkan tepat 20 pcs di stok `Opened`
- [x] QC pagi murni keputusan manual staff, sistem tidak menghitung umur otomatis
- [x] Distribusi: qty yang dikirim dari gudang otomatis kurangi stok gudang, dan bertambah di sisi penerima setelah status `received`
- [x] Notif alert: trigger tepat saat stok sentuh threshold, tidak spam berulang untuk kondisi yang sama
- [x] Staff titik jualan hanya bisa lihat/kelola batch yang di-assign ke dirinya (`held_by_user_id`), bukan punya staff lain
- [x] Tenant scoping test khusus `stock_batches` (Isolasi data business_id/outlet_id di stock_batches)
- [x] Trace test: 1 batch di staff/gudang bisa ditelusuri balik ke `production_id`
- [x] `wastage_logs` breakdown by `source_stage` muncul benar di laporan
- [x] Distribusi yang `sent` lebih dari 24 jam ter-flag ke Owner
- [x] Retur: stok di staff berkurang dan bertambah kembali ke gudang pusat setelah disetujui/diterima

---

## 5. Definition of Done
- [x] Semua item Testing Checklist lolos
- [ ] Kennan verifikasi manual: alur produksi/expense → distribusi → retur → closing harian → notif alert, end-to-end
- [ ] Status di `ROADMAP.md` diubah ke ✅ (Saat ini dikembalikan ke 🟨 Sedang dikerjakan karena revisi spesifikasi)
