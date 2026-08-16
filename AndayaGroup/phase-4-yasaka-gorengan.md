# Phase 4 — Yasaka & Gorengan Andalan

> Rujuk `PRD.md` §6 (Yasaka, Gorengan Andalan), `RBAC.md` §5, `DATA_MODEL.md` §4, `DECISIONS_LOG.md` D-03c, D-13a, D-13b, D-14c, D-14d.
>
> Dua bisnis digabung 1 fase karena keduanya F&B kecil dengan kompleksitas jauh lebih rendah dari Bakso/JnA — tapi tetap kerjakan **vertical slice terpisah** (selesaikan Yasaka dulu end-to-end, baru Gorengan), jangan dicampur sekaligus.

## 1. Scope

**Yasaka (simple, resolves D-13a):**
- Stock tracker gudang (bungkusan, tepung, ayam bag besar/kecil), restock mingguan
- Konversi carton→pcs untuk minuman (tanpa gate perishable)
- POS + printer struk (prioritas tinggi — anti-fraud kasir)
- **Tidak** ada Dual-Track reconciliation

**Gorengan Andalan (Dual-Track harian, resolves D-13b):**
- 2 cabang, masing-masing 1 Manager, `outlet_id` terpisah
- Daily Material Log (mulai dari nol tiap pagi, tanpa carry-over — bahan basah habis hari itu)
- End-of-day reconciliation: `Bahan Terpakai = Awal - Sisa`, dibandingkan penjualan POS
- POS Fast Grid + printer nota

## 2. Prasyarat
Phase 1 ✅. Phase 2 & 3 tidak wajib, tapi disarankan sudah selesai.

## 3. Task Breakdown — Yasaka
- [ ] Migrasi/pakai ulang: `ingredients`, `products`, `stock_conversions` (carton→pcs)
- [ ] Backend: endpoint stock tracker gudang + restock
- [ ] Frontend: UI POS (Fast Grid/Retail hybrid) + integrasi printer
- [ ] Frontend: UI restock mingguan sederhana

## 4. Task Breakdown — Gorengan Andalan
- [ ] Migrasi/pakai ulang: `daily_material_logs`, `wastage_logs`
- [ ] Backend: endpoint input Daily Material Log (qty_start pagi) + closing (qty_remaining)
- [ ] Backend: endpoint reconciliation otomatis (bandingkan ke penjualan POS produk terkait)
- [ ] Frontend: UI POS Fast Grid + printer nota
- [ ] Frontend: UI input log harian per cabang (Manager/Staff)
- [ ] Frontend: Dashboard selisih wastage per cabang untuk Owner

## 5. Testing Checklist
- [ ] Cross-tenant isolation: Yasaka & Gorengan (dan 2 cabang Gorengan satu sama lain) tidak saling bocor data
- [ ] Yasaka: konversi carton→pcs akurat, tidak ada mesin wastage yang jalan (dipastikan benar-benar off, bukan cuma disembunyikan di UI)
- [ ] Gorengan: reconciliation reset ke nol tiap hari baru (tidak carry-over qty_remaining kemarin)
- [ ] Gorengan: 2 cabang punya Manager berbeda, masing-masing hanya approve wastage log cabangnya sendiri
- [ ] Printer: struk/nota tercetak benar di kedua bisnis

## 6. Definition of Done
- [ ] Semua item Testing Checklist lolos
- [ ] Kennan verifikasi manual kedua bisnis secara terpisah
- [ ] Status di `ROADMAP.md` diubah ke ✅
