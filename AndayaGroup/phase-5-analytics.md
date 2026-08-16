# Phase 5 — Analytics & Performance Tuning

> Rujuk `PRD.md` §6.5, `DECISIONS_LOG.md` D-03b.

## 1. Scope

- Dashboard analytics **per-bisnis** (bukan agregat lintas-brand — lihat D-03b)
- Bakso Kang Gemoy: analitik seminimal mungkin, ramah pengguna non-teknis, tapi tetap edukatif (Owner siap belajar baca diagram bertahap)
- Yasaka & Gorengan: dashboard nice-to-have — laporan penjualan, wastage, dan restock dasar
- JnA Mart: laporan fraud/loss (termasuk breakdown Internal Take vs wastage biasa), laporan hutang procurement
- Performance tuning: query optimization, index review, evaluasi beban server single-deployment melayani 4 bisnis

## 2. Prasyarat
Phase 2, 3, 4 berstatus ✅ (butuh data transaksi riil dari semua bisnis untuk analytics bermakna).

## 3. Task Breakdown
- [ ] Backend: endpoint agregasi laporan per-bisnis (penjualan harian/mingguan, wastage trend, top produk)
- [ ] Backend: endpoint laporan fraud JnA Mart (Internal Take vs discrepancy opname vs void frequency)
- [ ] Backend: endpoint laporan hutang procurement (outstanding, per-supplier)
- [ ] Frontend: dashboard sederhana Bakso Kang Gemoy (grafik dasar, angka besar, minim jargon)
- [ ] Frontend: dashboard Yasaka & Gorengan (grafik penjualan, wastage per cabang untuk Gorengan)
- [ ] Frontend: dashboard JnA Mart (fraud indicator, hutang outstanding)
- [ ] Performance: index review di kolom yang sering di-filter (`business_id`, `outlet_id`, `created_at`)
- [ ] Performance: uji beban — simulasikan transaksi bersamaan dari 4 bisnis, cek response time

## 4. Testing Checklist
- [ ] Cross-tenant isolation: laporan 1 bisnis tidak pernah menampilkan angka bisnis lain, bahkan di endpoint agregasi
- [ ] Dashboard load time wajar (< 2 detik) meski dengan data beberapa bulan
- [ ] Grafik Bakso Kang Gemoy benar-benar sederhana — validasi langsung ke Kennan (bukan asumsi developer soal "sederhana")

## 5. Definition of Done
- [ ] Semua item Testing Checklist lolos
- [ ] Kennan verifikasi manual tiap dashboard per-bisnis
- [ ] Status di `ROADMAP.md` diubah ke ✅ — seluruh MVP selesai
