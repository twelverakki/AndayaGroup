# TESTING_STANDARDS.md — Checklist Reusable Lintas Fase

> File ini berisi standar pengujian yang **berlaku di semua fase**, supaya tidak ditulis ulang di tiap `/phases/phase-x-*.md`. Tiap phase file cukup merujuk ke sini plus menambah testing checklist yang spesifik ke fitur fase itu sendiri.

---

## 1. Cross-Tenant Isolation Test (WAJIB — setiap fase yang menyentuh database)

Ini bukan opsional. Rujuk `CLAUDE.md` Aturan Mutlak #1 dan `DECISIONS_LOG.md` D-15.

**Skenario wajib diuji untuk SETIAP endpoint baru yang mengakses data tenant:**
1. Login sebagai Owner/Manager/Staff bisnis A → coba akses/modifikasi data milik bisnis B lewat endpoint yang sama (ganti ID di request, bukan lewat UI) → harus gagal (403/404), tidak boleh 200 dengan data kosong (itu masih bocor informasi keberadaan record).
2. Untuk bisnis dengan multi-outlet (Gorengan Andalan 2 cabang, Yasaka multi-outlet di masa depan): Manager cabang A tidak bisa approve wastage log / lihat laporan cabang B, meski masih 1 `business_id` yang sama.
3. Untuk Owner dengan kepemilikan lintas-bisnis (D-03): pastikan konteks aktif (`business_id`/`outlet_id` dari token workspace switcher) benar-benar membatasi query — bukan cuma UI yang menyembunyikan, tapi API-nya sendiri menolak.
4. Automated test wajib ditulis untuk skenario di atas (bukan cuma manual check sekali), dan masuk test suite yang jalan otomatis tiap ada perubahan di repository/middleware layer.

**Kalau ditemukan 1 saja endpoint yang lolos tanpa scoping otomatis dari middleware** (query manual yang lupa filter tenant) → **fase tidak boleh naik status ✅**, harus diperbaiki dulu.

---

## 2. Approval & Anti-Fraud Flow Test

Rujuk `RBAC.md` §4, `DECISIONS_LOG.md` D-08, D-10.

- **Blind Count:** pastikan response API untuk form input opname staff **tidak menyertakan** `expected_qty`/angka stok sistem di payload manapun (termasuk di Network tab browser) — kalau staff bisa lihat lewat DevTools, itu tetap bocor meski UI menyembunyikannya.
- **Manager Override (PIN):** PIN salah → ditolak dengan pesan generik (jangan bocorkan apakah PIN itu "hampir benar"); PIN benar tapi milik Manager outlet lain → tetap ditolak (Manager cuma bisa approve di outlet-nya sendiri, kecuali dia juga Owner).
- **Approval state machine:** wastage log/void yang sudah `approved` tidak bisa diubah lagi (immutable setelah approved) — cek langsung di DB level, bukan cuma dicegah di UI.

---

## 3. Offline & Sync Test (PWA)

Rujuk `DECISIONS_LOG.md` D-16.

- Transaksi dibuat dalam mode offline (matikan network di DevTools) → transaksi tersimpan di IndexedDB dengan status `pending_sync`.
- Nyalakan kembali koneksi → transaksi otomatis sync ke server tanpa aksi manual user (Background Sync API).
- Kirim transaksi yang sama 2x dengan `client_uuid` yang sama (simulasi retry) → server harus mendeteksi duplikat, tidak membuat 2 record.
- Tutup tab/aplikasi saat masih offline dengan transaksi pending → buka lagi nanti → transaksi pending tidak hilang, tetap coba sync.
- Uji di kondisi koneksi lambat/putus-nyambung (throttling), bukan cuma airplane mode penuh.

---

## 4. Concurrency Test

Rujuk `DECISIONS_LOG.md` D-17.

- 2 request pengurangan stok bersamaan pada produk dengan stok terbatas (mis. stok = 1, 2 transaksi checkout bersamaan) → hanya 1 yang berhasil, yang lain gagal dengan pesan stok habis (bukan stok jadi -1).
- Constraint `CHECK (stock >= 0)` di level database diuji langsung dengan query paralel, bukan cuma lewat 1 request berurutan.

---

## 5. Testing Checklist Generik per Fase (Template)

Setiap `/phases/phase-x-*.md` minimal mencakup ini sebelum ✅ (di luar testing spesifik fitur fase itu):
- [ ] Cross-Tenant Isolation Test (§1) — lolos untuk semua endpoint baru di fase ini
- [ ] Approval/anti-fraud flow yang relevan (§2) — kalau fase ini menyentuh opname/void/override
- [ ] Offline & sync (§3) — kalau fase ini menambah alur transaksi baru
- [ ] Concurrency (§4) — kalau fase ini menyentuh pengurangan stok
- [ ] Tidak ada regresi di fase-fase sebelumnya (regression check ringan — jalankan test suite fase sebelumnya juga)

---

## 6. Definition of Done — Template Umum

Selain DoD spesifik yang tertulis di tiap phase file, semua fase HARUS memenuhi:
- [ ] Semua item di §5 checklist generik lolos
- [ ] Code review manual: tidak ada raw query yang skip `TenantContext` middleware
- [ ] Kennan sudah verifikasi manual fitur inti fase ini (bukan cuma automated test yang lolos)
- [ ] Dokumentasi terkait (`DATA_MODEL.md` kalau ada tabel baru, `RBAC.md` kalau ada role/permission baru) sudah disinkronkan di commit yang sama
- [ ] Status di `ROADMAP.md` diperbarui ke ✅
