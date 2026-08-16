# Phase 3 — Bakso Kang Gemoy

> Rujuk `PRD.md` §6 (Bakso Kang Gemoy), `RBAC.md` §5 (Bakso Kang Gemoy), `DATA_MODEL.md` §4 & §7, `DECISIONS_LOG.md` D-14, D-14a, D-14b, D-14c.

## 1. Scope

**Produksi & Gudang:**
- Owner (atau nanti Admin Gudang) produksi bakso beku, threshold minimum per varian ditentukan manual
- Stock tracker + notif alert (menggantikan cek manual via WA)

**Batch Thaw Tracking:**
- Stok 2 status: `Sealed` (pack, 1 pack = 20 pcs) → `Opened` (pcs, quality check harian, umur maks 1-2 hari)

**Distribusi:**
- Distribusi dari gudang pusat ke 3 titik jualan (staff individu, bukan outlet formal)
- Closing harian per titik jualan: laporkan sisa `Sealed` + sisa `Opened`

**POS:**
- Fast Grid UI, tanpa barcode, tanpa printer (digital receipt/QRIS cukup)

## 2. Prasyarat
Phase 1 ✅. Phase 2 tidak wajib selesai duluan (independen), tapi disarankan sudah selesai untuk konsistensi pola vertical slicing.

## 3. Task Breakdown
- [x] Migrasi DB: `stock_batches`, `stock_conversions` (pack→pcs, rate=20), `productions`, `distributions`
- [x] Backend: endpoint input produksi (Owner/Admin Gudang)
- [x] Backend: endpoint distribusi (kirim ke `sent_to_user_id`, status sent/received)
- [x] Backend: endpoint notif alert (trigger saat stok gudang menyentuh `min_stock_alert` per produk)
- [x] Backend: endpoint closing harian per staff (input sisa Sealed + Opened)
- [x] Backend: endpoint quality check pagi (ubah `quality_check_status` batch yang `opened`)
- [x] Frontend: Dashboard Owner — stock tracker real-time gudang, tanpa perlu WA manual
- [x] Frontend: UI POS Fast Grid (Mobile Shell — titik jualan dominan akses dari HP)
- [x] Frontend: UI closing harian staff (input sisa per varian, Sealed vs Opened)
- [x] Frontend: UI quality check pagi (checklist per batch opened, pass/discard)
- [x] Frontend: Notif alert (push notification atau in-app badge saat stok menipis)

## 4. Testing Checklist
- [x] Cross-tenant isolation: data Bakso tidak bocor ke bisnis lain
- [x] Konversi pack→pcs akurat: 1 pack terbuka menghasilkan tepat 20 pcs di stok `Opened`
- [x] Batch `Opened` yang lewat 2 hari tanpa quality check → sistem flag (bukan otomatis terjual)
- [x] Distribusi: qty yang dikirim dari gudang otomatis kurangi stok gudang, dan bertambah di sisi penerima setelah status `received`
- [x] Notif alert: trigger tepat saat stok sentuh threshold, tidak spam berulang untuk kondisi yang sama
- [x] Staff titik jualan hanya bisa lihat/kelola batch yang di-assign ke dirinya (`held_by_user_id`), bukan punya staff lain

## 5. Definition of Done
- [x] Semua item Testing Checklist lolos
- [ ] Kennan verifikasi manual: alur produksi → distribusi → closing harian → notif alert, end-to-end
- [ ] Status di `ROADMAP.md` diubah ke ✅ (Saat ini: 🟦 Menunggu verifikasi Kennan)
