# Phase 2 — JnA Mart

> Rujuk `PRD.md` §6 (JnA Mart), `RBAC.md` §5 (JnA Mart), `DATA_MODEL.md` §4-6, `DECISIONS_LOG.md` D-08, D-09, D-10, D-12, D-14e, D-14f, D-18.

## 1. Scope

**Inventory:**
- Dual inventory: Dry Goods (strict stock) vs Wet Goods (infinite stock di POS)
- Opname Blind Count (staff input tanpa lihat angka sistem → approval Manager/Owner)
- Restock: New SKU Registration + Stock In (scan + qty)

**POS:**
- Global barcode event listener (window-level, mode HID)
- Printer struk terintegrasi
- Cashier Shift Management (open/close shift, rekonsiliasi kas)
- Void via Manager Override (PIN)
- **Internal/Personal Take** — transaction type khusus, potong stok + tercatat

**Procurement:**
- Input pengadaan dry & wet goods
- Tracking status hutang/kredit (Lunas/Belum Lunas + jumlah terutang)
- Wet goods: input berdasarkan berat timbangan riil saat barang tiba

## 2. Prasyarat
Phase 1 berstatus ✅ (auth, tenant scoping, PWA shell sudah jalan).

## 3. Task Breakdown
- [x] Migrasi DB: `products` (mode `dry_strict`/`wet_infinite`), `wastage_logs`, `shifts`, `transactions`, `transaction_items`, `override_logs`, `procurements`, `procurement_items`
- [x] Backend: endpoint CRUD products, endpoint transaksi POS (dengan `client_uuid` untuk idempotency offline)
- [x] Backend: endpoint opname blind count (submit staff → approval Manager/Owner → lock ke `wastage_logs`)
- [x] Backend: endpoint Manager Override (verifikasi PIN, catat `override_logs`)
- [x] Backend: endpoint Internal Take (transaction type khusus)
- [x] Backend: endpoint procurement + status hutang
- [x] Frontend: UI barcode scan (global listener, auto-add ke cart)
- [x] Frontend: UI POS Retail (Desktop Shell — kasir meja tetap) DAN Mobile Shell (kalau diakses dari HP)
- [x] Frontend: integrasi printer struk (Web USB/Bluetooth API atau ESC/POS driver — riset teknis diperlukan)
- [x] Frontend: UI opname blind count (form input tanpa preview angka sistem)
- [x] Frontend: UI approval Manager (lihat discrepancy, approve/reject)
- [x] Frontend: UI Internal Take (form sederhana, pilih produk + qty)
- [x] Frontend: UI procurement + status hutang
- [x] Offline queue: transaksi POS wajib bisa disimpan lokal (IndexedDB) & retry sync (lihat Phase 1 setup)

## 4. Testing Checklist
- [x] Cross-tenant isolation: data JnA Mart tidak bocor ke bisnis lain (dan sebaliknya)
- [x] Dry Goods: transaksi ditolak saat stok 0; Wet Goods: transaksi tetap lolos meski stok fisik menipis
- [x] Blind count: staff tidak bisa melihat `expected_qty` sebelum submit `actual_qty`
- [x] Wastage log tidak terkunci ke sistem sebelum ada `approved_by`
- [x] Void: transaksi tanpa PIN Manager yang valid harus gagal
- [x] Internal Take: stok berkurang, transaksi tercatat dengan `type='internal_take'`, terlihat di laporan Owner
- [x] Procurement: status hutang tersimpan benar, jumlah terutang akurat
- [x] Offline: transaksi dibuat saat offline → tersimpan lokal dengan `client_uuid` → muncul di server setelah online, tidak dobel
- [x] Printer: struk tercetak dengan data transaksi yang benar (atau gagal dengan pesan jelas kalau device tidak terdeteksi, bukan crash)

## 5. Definition of Done
- [x] Semua item Testing Checklist lolos
- [x] Kennan verifikasi manual: transaksi dry+wet goods, opname, void, internal take, procurement hutang
- [x] Status di `ROADMAP.md` diubah ke ✅
