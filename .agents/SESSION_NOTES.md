# Catatan Sesi Pengembangan (Session Handover Notes)
> **Tanggal Update**: 27 September 2026 (WITA)  
> **Status Sistem**: Stable, Production-Ready & 100% Type-Safe  
> **Kompilasi Frontend TypeScript**: `npx tsc --noEmit` Lolos 100% (`Exit Code 0`)  
> **Kompilasi Backend Go**: `go test -p 1 ./...` Lolos 100% (`Exit Code 0`)  

---

## 1. Rangkuman Eksekusi Sesi Ini (Completed Work)

### A. Tata Kelola Wewenang & Invarian Manajer Cabang (Domain 9 & RBAC)
1. **Invarian 1 Active Manager per Outlet (Single Active Manager Invariant)**:
   - Menegakkan aturan bahwa setiap outlet fisik hanya boleh memiliki maksimal 1 Manager berstatus `active` untuk mencegah konflik otorisasi void PIN kasir dan persetujuan selisih opname.
   - Pendaftaran staf baru dengan role `manager`, pengubahan role ke `manager`, atau pemindahan staf ber-role `manager` ke cabang yang sudah memiliki manager aktif otomatis ditolak oleh backend (`400 Bad Request`) dan divalidasi reaktif di frontend.
   - Unit test backend [`TestSingleManagerPerOutletInvariant`](file:///D:/laragon/www/Andaya-Group/backend/internal/modules/organization/organization_test.go) lulus 100%.

2. **Dialog Konfirmasi Penempatan & Delegasi Peran Cabang (Delegation & Reassignment Dialog)**:
   - Ketika memindahkan staf kasir/operasional ke cabang yang **belum memiliki Manager aktif**, sistem menampilkan modal dialog interaktif:
     - **Opsi 1**: *Tetap sebagai Staff / Kasir* (Cabang diselia langsung secara terpusat oleh Owner).
     - **Opsi 2**: *Promosikan Menjadi Manager Cabang* (Mendelegasikan wewenang operasional penuh, otorisasi PIN void kasir, dan persetujuan opname).
   - Memberikan fleksibilitas penuh bagi Owner dalam mengelola cabang baru atau gerai tanpa manajer.

### B. Sentralisasi Kepemilikan Master Items (Owner-Only Mutation)
1. **Proteksi Hak Akses Master Items**:
   - Seluruh mutasi master barang (`POST /items`, `PUT /items/:id`, `PATCH /items/:id/status`, `POST/DELETE /categories`) diproteksi ketat khusus untuk `owner`, `superadmin`, dan `admin_gudang`.
   - Staf kasir dan manajer cabang hanya memiliki hak akses **Read-Only** (melihat katalog item dan harga jual aktif).
   - Modal dasar HPP (`standard_cost` dan `purchase_price`) disamarkan (*masked* ke 0) bagi staf non-manajer (`can_view_cost = false`).
2. **Pengalaman UI Master Items**:
   - Ditampilkan badge status *"Mode Baca (Read-Only)"* pada header halaman master barang.
   - Tombol wizard *TAMBAH ITEM* dan menu aksi ubah status/edit/arsip disembunyikan bagi non-owner.

### C. Tata Kelola Visibilitas Stok Lintas-Cabang (`allow_cross_branch_stock_view`)
1. **Isolasi Stok Multi-Cabang**:
   - Menambahkan *capability flag* boolean `allow_cross_branch_stock_view` pada tabel `businesses` (default `false`).
   - Bila `false`, staf cabang terisolasi ketat hanya dapat melihat saldo fisik di outlet penempatannya sendiri. Endpoint Matriks Stok Multi-Cabang (`/inventory/matrix`) mengembalikan `403 Forbidden` bagi staf non-admin.
   - Bila `true`, staf cabang diizinkan memeriksa ketersediaan stok di outlet lain untuk keperluan pelayanan pelanggan (cross-selling / referral antar-cabang).
2. **UI Settings & Contextual Help (The Lean Odoo Way)**:
   - Toggle saklar kapabilitas disematkan pada Drawer *Unified Business Settings* lengkap dengan Popover *"Pelajari Selengkapnya"*.
   - Navigasi sidebar (`navigation.ts`, `desktop-shell.tsx`, `mobile-shell.tsx`) otomatis menyembunyikan sub-menu *Matrik Stok* jika akun tidak memiliki izin.
   - Halaman Matriks Stok (`stock-matrix-view.tsx`) memiliki tampilan fallback kartu akses terbatas dengan tombol kembali ke inventori cabang.

### D. Fitur Logistik & Rantai Pasok Terintegrasi (The Lean Odoo Way)
1. **Blind Requisition Mode (`hide_central_stock_from_branches`)**:
   - Saldo stok gudang pusat disembunyikan dari cabang saat pengajuan pasokan untuk menjaga kebiasaan permintaan berbasis kebutuhan riil (*Blind Requisition*).
2. **Audit Permintaan vs Alokasi (Requested vs Allocated Tracking)**:
   - Pencatatan kuantitas yang diminta vs kuantitas yang disetujui/dikirim oleh gudang pusat.
3. **Penyesuaian Kuota & Preset Alasan (Quota Adjustment Governance)**:
   - Preset alasan pemotongan alokasi (stok pusat menipis dibagi rata, kapasitas armada, buffer batch, pasokan supplier).
4. **Otomasi Pembuatan Dokumen Backorder (Backorder Generation)**:
   - Pembuatan dokumen draf pesanan susulan secara otomatis untuk sisa kuantitas pasokan yang belum terpenuhi.
5. **Auto-Suggest Reorder Pintar (Smart Replenishment Calculation)**:
   - Rekomendasi restock cerdas berbasis batas min stok, velocity 14 hari, dan buffer 7 hari.
6. **Matriks Alokasi Kuota Pasokan Multi-Cabang (Central Quota Matrix)**:
   - Agregasi permintaan barang tertunda dari semua cabang dan tombol *Bagi Rata (Equal Split)*.

---

## 2. Berkas Utama yang Dimodifikasi / Dibuat

1. [backend/database/schema.sql](file:///D:/laragon/www/Andaya-Group/backend/database/schema.sql) & [backend/internal/config/config.go](file:///D:/laragon/www/Andaya-Group/backend/internal/config/config.go) (Penambahan `allow_cross_branch_stock_view` dan `hide_central_stock_from_branches`)
2. [backend/internal/models/models.go](file:///D:/laragon/www/Andaya-Group/backend/internal/models/models.go) (Struct `Business`, `ActiveContext`, `UpdateBusinessCapabilitiesRequest`, `Workspace`)
3. [backend/internal/modules/auth/service.go](file:///D:/laragon/www/Andaya-Group/backend/internal/modules/auth/service.go) & [handler.go](file:///D:/laragon/www/Andaya-Group/backend/internal/modules/auth/handler.go) (Propagasi context `allow_cross_branch_stock_view`)
4. [backend/internal/modules/organization/service.go](file:///D:/laragon/www/Andaya-Group/backend/internal/modules/organization/service.go) (Invarian 1 Manager per outlet di `CreateStaffMember`, `UpdateStaffMember`, dan persistensi capability flag)
5. [backend/internal/modules/organization/organization_test.go](file:///D:/laragon/www/Andaya-Group/backend/internal/modules/organization/organization_test.go) (Unit test `TestSingleManagerPerOutletInvariant`)
6. [backend/internal/modules/items/handler.go](file:///D:/laragon/www/Andaya-Group/backend/internal/modules/items/handler.go) (Proteksi CRUD Master Items untuk Owner/Admin Gudang, masking HPP, isolasi outlet scoping di query barang)
7. [frontend/app/lib/store.ts](file:///D:/laragon/www/Andaya-Group/frontend/app/lib/store.ts) (Penambahan `allow_cross_branch_stock_view` pada `Workspace` dan `ActiveContext`)
8. [frontend/app/lib/i18n.ts](file:///D:/laragon/www/Andaya-Group/frontend/app/lib/i18n.ts) (Bilingual i18n keys untuk Read-Only Master Items, Invarian Single Manager, Cross-Branch Stock View)
9. [frontend/app/config/navigation.ts](file:///D:/laragon/www/Andaya-Group/frontend/app/config/navigation.ts), [desktop-shell.tsx](file:///D:/laragon/www/Andaya-Group/frontend/app/shells/desktop-shell.tsx), [mobile-shell.tsx](file:///D:/laragon/www/Andaya-Group/frontend/app/shells/mobile-shell.tsx) (Penyaringan sub-menu berbasis role dan capability `requireCrossBranchStock`)
10. [frontend/app/features/items/item-list-module.tsx](file:///D:/laragon/www/Andaya-Group/frontend/app/features/items/item-list-module.tsx) (Read-Only badge & pemblokiran mutasi bagi non-owner)
11. [frontend/app/features/inventory/stock-matrix-view.tsx](file:///D:/laragon/www/Andaya-Group/frontend/app/features/inventory/stock-matrix-view.tsx) (Fallback UI saat akses matriks dibatasi 403)
12. [frontend/app/features/organization/business-expandable-card.tsx](file:///D:/laragon/www/Andaya-Group/frontend/app/features/organization/business-expandable-card.tsx) (Toggle switch visibilitas stok Odoo way, warning banner manager, dialog delegasi peran promosi staf)
13. [docs/DATA_MODEL.md](file:///D:/laragon/www/Andaya-Group/docs/DATA_MODEL.md), [docs/RBAC.md](file:///D:/laragon/www/Andaya-Group/docs/RBAC.md), [docs/DECISIONS_LOG.md](file:///D:/laragon/www/Andaya-Group/docs/DECISIONS_LOG.md) (Dokumentasi keputusan arsitektur **D-28**)

---

## 3. Status Kompilasi & Pengujian

* **TypeScript Frontend**: `npx tsc --noEmit` $\rightarrow$ **100% Success (0 Errors / Clean Exit Code 0)**
* **Backend Go Unit & Integration Tests**: `go test -p 1 ./...` $\rightarrow$ **100% Success (0 Errors)**
* **Zero Full-Page Reload**: Seluruh mutasi berjalan reaktif (*optimistic UI* + Sonner toast feedback).

---

## 4. Agenda untuk Sesi Berikutnya (Next Session Agenda)

1. **Perampingan Menu Kasir (Lean Cashier Scope)**:
   - Menerapkan penyesuaian hak akses kasir agar tampilan POS benar-benar bersih dan bebas distraksi (menyembunyikan master inventori/pengadaan/keuangan dari kasir).
2. **Phase 4: Modul Dapur & Formula Produksi (BOM)**:
   - Pengujian formula adonan Bakso Kang Gemoy, bumbu marinasi Yasaka, dan EOD material usage Gorengan Andalan ke mutasi stok double-entry.
3. **Phase 4.5: Preview Cetak Dokumen Surat Jalan**:
   - Templating cetak thermal receipt surat jalan pengiriman pasokan antar-cabang.
4. **Phase 5: Analytics & Laporan Konsolidasi Grup**:
   - Dashboard omzet gabungan 4 unit bisnis holding untuk Owner (Kennan).

---
*Catatan sesi dibuat dan diperbarui secara otomatis untuk memandu pengembang pada sesi berikutnya.*
