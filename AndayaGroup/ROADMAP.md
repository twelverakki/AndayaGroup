# ROADMAP.md — Index Fase Implementasi

> Peta besar saja — detail teknis tiap fase ada di `/phases/phase-x-*.md`. Update kolom **Status** di file ini setiap fase berpindah tahap; jangan duplikasi detail teknis ke sini.

| Fase | Fokus | File Detail | Status |
|---|---|---|---|
| Phase 1 | Fondasi backend/frontend, auth, ownership many-to-many, PWA shell | phase-1-foundation.md | ✅ Selesai |
| Phase 2 | JnA Mart — POS, scanner+printer, dual inventory, Blind Count, Internal Take, Procurement+hutang | phase-2-jna-mart.md | ✅ Selesai |
| Phase 3 | Bakso Kang Gemoy — produksi, Batch Thaw Tracking, distribusi ke titik jualan | phase-3-bakso-kang-gemoy.md | 🟦 Menunggu verifikasi Kennan |
| Phase 4 | Yasaka & Gorengan Andalan — simple tracking, Dual-Track harian, printer | phase-4-yasaka-gorengan.md | ⬜ Belum mulai |
| Phase 4.5 | Dashboard JnA Mart & Fitur Tambahan (Poin Tambahan Fase Lain) | phase-4.5-additional.md | ⬜ Belum mulai |
| Phase 5 | Analytics per-bisnis & performance tuning | phase-5-analytics.md | ⬜ Belum mulai |

**Legenda status:** ⬜ Belum mulai → 🟨 Sedang dikerjakan → 🟦 Menunggu verifikasi Kennan → ✅ Selesai (DoD lolos)

## Aturan Eksekusi (rujuk `CLAUDE.md`)
- Tidak boleh mulai fase berikutnya sebelum fase berjalan berstatus ✅.
- Vertical slicing — 1 modul end-to-end (DB → API → UI) sebelum modul lain, bahkan di dalam 1 fase yang sama.
- Setiap fase yang menyentuh database wajib lolos cross-tenant isolation test (`TESTING_STANDARDS.md`) sebelum naik status ✅.
