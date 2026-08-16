# Phase 4.5 — Dashboard & Fitur Tambahan (JnA Mart & Fase Lain)

> Rujuk `ROADMAP.md`, `CLAUDE.md`, `PRD.md` §6, `DECISIONS_LOG.md` D-03b.

## 1. Scope

**JnA Mart:**
- Dashboard Owner: fraud indicator, outstanding hutang, total sales/turnover, dan profit margin.
- Dashboard Kasir/Manager: log shift detail, ringkasan transaksi harian per shift.

**Poin Tambahan Fase Lain (Placeholder):**
- *Poin/Fitur tambahan dari Phase 1, Phase 2, Phase 3, dan Phase 4 yang ditangguhkan atau ditemukan selama pengembangan akan ditampung di sini.*

## 2. Prasyarat
Phase 1, Phase 2, Phase 3, dan Phase 4 berstatus ✅.

## 3. Task Breakdown
- [ ] Backend: API/Endpoint untuk visualisasi data/grafik dashboard JnA Mart (fraud indicator, outstanding hutang, analytics dasar)
- [ ] Frontend: UI Dashboard Owner untuk JnA Mart (grafik tren penjualan, highlight hutang jatuh tempo, panel fraud alert)
- [ ] Frontend: UI Dashboard Kasir/Manager (visualisasi ringkasan shift saat ini)
- [ ] TBD: Poin-poin tambahan dari fase lainnya yang dimasukkan ke scope ini setelah Phase 4 selesai.

## 4. Testing Checklist
- [ ] Cross-tenant isolation: data dashboard JnA Mart terisolasi penuh dan tidak bocor ke tenant lain.
- [ ] Perhitungan statistik fraud indicator (misal: void rate tinggi, over-limit override) akurat dan sesuai log override.
- [ ] Outstanding hutang menampilkan list procurement yang berstatus `Belum Lunas` beserta total nilai terutang dengan benar.
- [ ] Dashboard memuat data dalam waktu < 2 detik untuk data simulasi 3 bulan.

## 5. Definition of Done
- [ ] Semua item Testing Checklist lolos
- [ ] Kennan verifikasi manual: visualisasi dashboard JnA Mart & fitur tambahan lainnya
- [ ] Status di `ROADMAP.md` diubah ke ✅
