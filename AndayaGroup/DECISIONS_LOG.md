# Decisions Log

> Catatan semua keputusan yang sudah dikunci beserta alasannya, plus pertanyaan yang masih terbuka. Tujuan: mencegah keputusan lama ditanyakan ulang atau terlupa, dan mencegah agent berasumsi sendiri di area yang belum final.
>
> Format tiap entri: **Keputusan** → **Alasan** → **Status**

---

## 1. Scope & Arsitektur Umum

**D-01. Scope modul ERP**
Yang dipakai: POS, Inventory, Procurement. CRM masih ongoing (rujuk proyek wallpanel sebelumnya, belum difinalisasi untuk 4 bisnis ini). HRM dan Supplier Portal tidak dipakai — aplikasi ini internal, dioperasikan langsung oleh Owner/Manager.
Status: ✅ Final.

**D-02. Arsitektur backend/frontend**
Pure REST API (Go + Fiber + pgx) dipisah total dari React SPA (Vite) — bukan Inertia.js.
Alasan: lebih sejalan standar industri modern (stateless, siap dipakai mobile app nanti), dan pola ini lebih konsisten dieksekusi AI Agent karena sangat terstruktur.
Status: ✅ Final.

**D-03. Multi-tenancy: `business_id`, `outlet_id`, dan Ownership Many-to-Many**
`outlet_id` = representasi lokasi/cabang fisik. `business_id` = representasi 1 brand. Data tetap terisolasi ketat per-`business_id`/`outlet_id` (JnA Mart tidak pernah bisa lihat data Gorengan Andalan, dst) — ini **tidak berubah**.
Yang berubah dari asumsi awal: kepemilikan (**Owner**) bukan relasi 1:1 ke satu bisnis, tapi **many-to-many** lewat tabel penghubung `business_owners` (`user_id`, `business_id` atau `outlet_id`, `role`). Satu akun (1 orang) bisa memegang role Owner di beberapa `business_id`/`outlet_id` berbeda sekaligus — misalnya Owner JnA Mart yang juga membuka Gorengan Andalan, atau Owner Bakso Kang Gemoy yang juga punya 1 outlet Yasaka.
Kepemilikan Yasaka secara khusus di-assign di **level outlet**, bukan level business — karena Yasaka itu franchise, jadi berpotensi tiap outlet punya Owner berbeda-beda (meski untuk saat ini baru 1 outlet yang aktif — lihat D-03b).
Alasan: ditemukan bahwa ini bukan 4 bisnis independen, tapi 1 grup bisnis di mana pemiliknya bisa lintas-brand.
Status: ✅ Final struktur relasi ownership.

**D-03a. Login: 1 akun, workspace switcher antar-bisnis**
1 akun login bisa dipakai untuk switch konteks antar-bisnis/outlet yang dia miliki (mirip switch workspace di Slack/Notion), bukan harus login ulang tiap ganti bisnis. Saat sesi aktif di 1 konteks bisnis tertentu, semua query & tampilan tetap terscope penuh ke `business_id`/`outlet_id` itu saja (tidak ada campur data).
Alasan: dikonfirmasi Kennan — 1 akun, switchable.
Status: ✅ Final.

**D-03b. Dashboard: per-bisnis (bukan agregat), untuk saat ini**
Owner yang punya beberapa bisnis melihat laporan **satu bisnis dalam satu waktu** (switch, bukan gabungan). Dashboard agregat lintas-bisnis **tidak** dibangun di scope sekarang.
Alasan: dikonfirmasi Kennan — bukan prioritas saat ini. Skema data (D-03) tetap dirancang agar tidak menutup kemungkinan dashboard agregat ditambah nanti, tapi UI/fitur-nya ditunda.
Status: ✅ Final untuk scope sekarang.

**D-03c. Scope Yasaka: 1 outlet dulu, bukan full multi-franchise**
Sistem sekarang cukup menangani 1 outlet Yasaka (milik Owner Bakso Kang Gemoy). Struktur data tetap memakai model ownership di level outlet (D-03) supaya tidak menutup pintu kalau nanti ada outlet Yasaka lain dengan Owner berbeda, tapi **tidak perlu dibangun fitur multi-franchise penuh sekarang** (mis. UI khusus buat Owner-brand-pusat Yasaka mengelola banyak franchisee — itu di luar scope).
Alasan: dikonfirmasi Kennan — cukup 1 outlet dulu.
Status: ✅ Final untuk scope sekarang.

**D-04. Skema valuasi harga modal**
Pakai **Last Buying Price** (harga restock terbaru menimpa `purchase_price`), bukan FIFO/LIFO/Average Cost. Restock dicatat sebagai operational expense, bukan akuntansi penuh.
Alasan: kebutuhan saat ini belum minta akuntansi kompleks; disederhanakan dulu.
Status: ✅ Final untuk saat ini — bisa direview kalau kebutuhan akuntansi berkembang.

---

## 2. Role, Permission & Approval

**D-05. Pendekatan RBAC: hardcode, bukan dynamic permission engine**
Matrix role tetap didefinisikan di kode (bisa direvisi lewat migration), user tidak bisa custom-atur permission dari UI.
Alasan: dynamic permission engine over-engineering untuk skala 4 bisnis kecil saat ini.
Status: ✅ Final.

**D-06. Role dasar (berlaku semua bisnis)**
Superadmin (cross-tenant, level developer) → Owner (scoped per-business/outlet via `business_owners`, 1 akun bisa punya banyak record Owner — lihat D-03) → Manager (per-outlet) → Staff (eksekusi harian, tanpa hak hapus/lihat data sensitif).
Status: ✅ Final.

**D-07. Role tambahan khusus Bakso Kang Gemoy: Admin Gudang**
Role delegasi penuh dari Owner khusus domain gudang pusat — bukan turunan Manager, bukan pengganti Owner secara umum. Boleh: approve stock request dari gerobak, input restock gudang pusat. Tidak boleh: lihat laporan finansial toko, atur akun Manager/Staff, approve wastage log toko/gerobak.
Alasan: struktur Bakso Kang Gemoy unik — Owner bisa hire orang khusus gantikan dia total di urusan gudang, terpisah dari rantai Manager→Staff bisnis lain.
Status: ✅ Final struktur & permission. Hanya berlaku untuk Bakso Kang Gemoy.

**D-08. Opname stok: metode Blind Count**
Staff input hasil hitung fisik **tanpa melihat angka sistem** dulu. Sistem baru bandingkan setelah submit. Hasil akhir wajib **approval Manager/Owner** sebelum terkunci ke `wastage_logs`.
Alasan: mencegah staff menyesuaikan hitungan manual biar cocok sama angka sistem (anti-fraud). Pemisahan "yang menghitung" vs "yang mengesahkan" adalah standar retail.
Status: ✅ Final. Berlaku untuk semua opname (JnA Mart wet goods, opname gerobak Bakso, dll).

**D-09. Retur/Refund vs Void — dipisah tegas**
Kebijakan toko: **tidak ada retur/refund** (barang yang sudah keluar tidak bisa dikembalikan) → modul retur **dihapus dari scope**. **Void** (kasir salah input sebelum transaksi selesai) tetap wajib ada, via mekanisme Manager Override (lihat D-10).
Alasan: retur cuma relevan/mungkin terjadi di JnA Mart, dan Kennan memilih regulasi "no retur" untuk simplifikasi. Void adalah kasus berbeda (kesalahan input, bukan pengembalian barang) dan tetap dibutuhkan untuk cegah fraud/manipulasi manual di luar sistem.
Status: ✅ Final.

**D-10. Mekanisme Manager Override (untuk Void, dan reusable untuk kasus approval lain)**
PIN pendek (4-6 digit) per akun Manager, di-hash, disimpan di tabel `manager_pins`. Setiap pemakaian dicatat di `override_logs` (transaction_id, staff_id, manager_id, action, reason, created_at). Dirancang generik dari awal (bukan cuma untuk void) agar bisa dipakai ulang untuk kasus approval lain (mis. discount override).
Alasan: manager tidak perlu standby fisik di kasir; tetap ada jejak audit siapa approve apa.
Status: ✅ Final.

**D-11. Akun staff: cepat dibuat/dinonaktifkan, tidak dihapus**
Karena turnover staff cepat (terutama Yasaka & Gorengan Andalan) dan jumlah staff tidak fixed, akun dibuat ringan oleh Manager/Owner (nama, PIN, assign outlet). Staff yang keluar **dinonaktifkan**, bukan dihapus — riwayat transaksi tetap punya jejak audit.
Status: ✅ Final.

**D-11a. Struktur approval harian outlet Yasaka (resolves Q-04b)**
Yasaka menggunakan role `Manager` standar untuk persetujuan harian di lokasi (seperti opname atau void). Tidak diperlukan role manajer lokal baru atau kustom; proses persetujuan didelegasikan ke user dengan role `Manager` yang terikat pada outlet tersebut, sedangkan Owner memegang kendali kepemilikan.
Alasan: Sejalan dengan struktur RBAC dasar dan memudahkan pengelolaan otorisasi kasir/staf di outlet.
Status: ✅ Final.

---

## 3. Inventory & Reconciliation per Bisnis

**D-12. JnA Mart — Dual Inventory (Dry vs Wet Goods)**
Dry Goods: strict stock, transaksi ditolak jika stok habis. Wet Goods: infinite stock di POS (tidak mengunci transaksi), direkonsiliasi tiap 2-3 hari via Wastage Log (blind count).
Status: ✅ Final.

**D-12a. Normalisasi Kategori Produk (Categories Table)**
Kategori produk dinormalisasi ke dalam tabel `categories` yang terisolasi per-`business_id` (setiap bisnis memiliki kategori sendiri). Kolom `category` (TEXT) di tabel `products` digantikan dengan foreign key `category_id` (UUID). Input kategori berupa teks dari API otomatis dicarikan atau dibuatkan record kategori baru di database untuk menyederhanakan alur di client (backward-compatible).
Alasan: Standarisasi data master produk dan peningkatan integritas relasional data.
Status: ✅ Final.

**D-13a. Yasaka — Simple Stock Tracking (bukan Dual-Track)**
Setelah story flow dikonfirmasi, kebutuhan Yasaka ternyata lebih simpel dari asumsi awal: cukup **stock tracker gudang** (bungkusan, tepung, ayam bag besar/kecil) + restock mingguan, **tanpa** mesin deteksi wastage otomatis (Dual-Track reconciliation). Fokus utama Yasaka justru di POS + printer untuk minimalkan fraud kasir (lihat D-18), bukan di reconciliation bahan baku.
Alasan: dikonfirmasi langsung oleh Kennan — Yasaka tidak butuh kompleksitas Dual-Track.
Status: ✅ Final. *(Revisi dari asumsi awal D-13 versi lama.)*

**D-13b. Gorengan Andalan — Tetap Pakai Dual-Track Logging**
Track 1: Daily Material Log (staff catat bahan baku siap pakai). Track 2: penjualan hanya kurangi stok produk jadi. End-of-day: `Bahan Terpakai = Bahan Awal − Sisa`, dibandingkan jumlah produk terjual → selisih otomatis jadi Wastage/Loss.
Catatan penting: karena bahan basah **dibeli & habis hari itu juga** (tidak nginep), reconciliation ini sifatnya **harian penuh tanpa carry-over stok bahan** — setiap pagi mulai dari nol lagi, bukan dari sisa kemarin. Inventory yang di-carry hanya barang tahan lama (minyak, bungkusan) via model stock biasa (mirip Dry Goods JnA Mart).
Alasan: dikonfirmasi langsung oleh Kennan — Gorengan tetap ingin ada pencatatan pemakaian bahan meski siklusnya harian penuh.
Status: ✅ Final.

**D-14. Bakso Kang Gemoy — Owner-Produced, Distribution Point Model (bukan Warehouse-to-Outlet formal)**
Owner sendiri yang produksi bakso beku (varian: keju, original, mercon, dll) di rumah/gudang pribadi. Produksi dipicu manual oleh Owner berdasarkan **threshold minimum stok per varian yang ia tentukan sendiri** (bukan hitungan otomatis sistem). Distribusi ke 3 titik jualan (bukan "cabang" — karyawan bergaji bulanan yang simpan stok di kulkas rumah masing-masing) sebelumnya manual via WA, sekarang digantikan **stock tracker + notif alert** biar Owner tidak perlu tanya manual.
Alasan: 3 titik ini bukan entitas outlet formal (tidak ada sewa tempat/cabang terpisah), tapi personel bergaji yang jadi titik distribusi — jadi tidak butuh struktur `outlet_id` terpisah seperti Yasaka, cukup direpresentasikan sebagai lokasi/assignment yang menempel ke akun staff.
Status: ✅ Final. *(Revisi dari asumsi awal "Warehouse-to-Cart" — modelnya benar tapi entitasnya bukan outlet formal.)*

**D-14a. Konversi Stok Bakso: Batch Thaw Tracking (resolves Q-01)**
1 pack = 20 pcs. Status stok punya 2 tingkat:
- `Sealed` (pack utuh, belum dibuka) — tahan lama, dihitung per-pack.
- `Opened` (pack sudah dibuka, dihitung per-pcs) — wajib **quality check tiap pagi** sebelum boleh dijual lagi, umur maksimal 1-2 hari sejak dibuka.
Alur harian: staff bawa pulang sisa `Sealed` (utuh) + sisa `Opened` (dalam pcs, hasil hitung fisik) → dilaporkan sebagai closing stock harian per titik distribusi.
Status: ✅ Final.

**D-14b. Akun Staff Bakso Kang Gemoy per-orang (resolves Q-02)**
Karena titik distribusi diisi karyawan bergaji bulanan (bukan sekadar "operator gerobak" anonim), akun dibuat **per-orang**, bukan per-gerobak generik. Ini juga jadi basis pelacakan gaji, laporan closing stock, dan alert restock per individu.
Status: ✅ Final.

**D-14c. Yasaka — Konversi Carton→Pcs (minuman)**
Minuman dibeli per-karton dari grosir tetangga, dijual per-pcs di toko. Butuh conversion layer sama seperti pack→pcs Bakso, tapi **tanpa** gate perishable/kualitas (minuman tidak butuh quality check harian seperti bakso yang sudah dibuka).
Status: ✅ Final.

**D-14d. Gorengan Andalan — RBAC mengikuti pola standar (resolves sebagian Q-04)**
2 cabang, masing-masing punya Manager/Kepala Cabang sendiri, beda daerah, beda penjualan, beda pengeluaran. Ini cocok langsung dengan struktur dasar Owner→Manager→Staff (D-06), **tanpa** perlu role tambahan seperti Admin Gudang. Tiap cabang = 1 `outlet_id` di bawah `business_id` Gorengan Andalan.
Status: ✅ Final untuk Gorengan. *(Struktur Yasaka masih terpisah — lihat Q-03 & Q-04b.)*

---

## 3a. Temuan Baru — JnA Mart (Fraud & Procurement)

**D-14e. Internal/Personal Take — fitur pencatatan pengambilan pribadi**
JnA Mart secara historis tidak punya catatan penjualan sama sekali, dan sumber loss terbesar adalah "pengambilan pribadi langsung" (barang diambil untuk konsumsi pribadi/keluarga tanpa tercatat). Solusi: tambahkan **transaction type khusus** di POS — "Internal Take" — yang tetap memotong stok dan tercatat di sistem (harga bisa Rp0 atau harga modal, tergantung kebijakan Owner), sehingga pengambilan tetap legal & terlacak, bukan hilang tanpa jejak.
Alasan: mengatasi akar masalah fraud yang disebutkan eksplisit oleh Kennan, tanpa melarang praktik yang mungkin memang sah (kebutuhan pribadi Owner/keluarga), cukup dibikin *accountable*.
Status: ✅ Final (masuk scope Phase 2 — JnA Mart).

**D-14f. Procurement — Tracking Hutang/Kredit ke Supplier**
JnA Mart terbiasa membeli barang secara "utangan" ke sebagian supplier. Modul Procurement butuh field status pembayaran (Lunas/Belum Lunas) dan jumlah terutang per transaksi pengadaan, bukan hanya asumsi cash langsung lunas.
Alasan: mencerminkan kondisi riil operasional JnA Mart yang sudah berjalan lama dengan pola ini.
Status: ✅ Final struktur dasar.

**D-14g. Detail Hutang/Kredit JnA Mart (resolves Q-06)**
Sistem pelacakan hutang pembelian untuk JnA Mart di MVP awal dibatasi pada status biner (`paid` / `unpaid`), total nominal terutang (`amount_owed`), dan tanggal jatuh tempo (`due_date`) pada transaksi pengadaan (`procurements`). Riwayat cicilan parsial secara kronologis dan tabel terkait ditangguhkan untuk menjaga sistem tetap lean di awal.
Alasan: Memberikan kapabilitas dasar pelacakan jatuh tempo hutang tanpa kompleksitas pencatatan angsuran di versi pertama.
Status: ✅ Final.

---

## 4. Reliabilitas Sistem

**D-15. Tenant data isolation**
Bukan cuma dijaga manual per-query, tapi di-enforce di level middleware/repository layer (auto-inject filter `outlet_id`/`business_id` dari JWT). Wajib ada automated test cross-tenant isolation di setiap fase yang menyentuh database, masuk Definition of Done. "Pause/maintenance mode" tetap ada tapi sebagai safety net operasional (migrasi skema dsb), bukan pengganti proteksi ini.
Status: ✅ Final.

**D-16. Offline Support: Full PWA (bukan queue sederhana)**
Wajib Service Worker + precache UI POS + IndexedDB (local queue transaksi) + Background Sync API + installable to home screen.
Alasan: tujuan pengembangan klien secara eksplisit ingin membuktikan kapabilitas "bisa support offline" — ini requirement arsitektur inti, bukan nice-to-have, dan masuk sejak Phase 1.
Status: ✅ Final.

**D-17. Concurrency stok**
Risiko dinilai kecil (1 kasir per bisnis, inventory antar-bisnis independen), tapi tetap dipasang sebagai insurance murah: DB-level `CHECK (stock >= 0)` + atomic update (bukan read-then-write).
Status: ✅ Final.

**D-18. Hardware scope Phase 1 — Printer masuk balik ke scope**
Barcode scanner (mode HID) tetap masuk. **Printer struk/nota kini masuk Phase 1** — dikonfirmasi dibutuhkan oleh 3 dari 4 bisnis (JnA Mart, Yasaka, Gorengan Andalan), terutama Yasaka yang eksplisit menyebut printer sebagai alat anti-fraud kasir (bukti transaksi fisik tanpa harus mengawasi manual). Bakso Kang Gemoy tidak menyebutkan kebutuhan printer — cukup digital receipt seperti disepakati sebelumnya. Timbangan digital tetap **out of scope**, belum ada kebutuhan eksplisit.
Alasan: revisi dari D-18 versi lama setelah story flow 4 bisnis dikonfirmasi — mayoritas bisnis butuh bukti fisik transaksi.
Status: ✅ Final.

---

## 5. Design System

**D-19. Unified Design Token (One UI + Samsung DeX inspired)**
1 set token visual (tipografi, radius 28px, touch target minimum 56px, motion, warna Primary #CCF657/Secondary #3F73F7) berlaku sama di semua shell. Yang berbeda hanya **komposisi layout**: Mobile Shell (single-column stack, bottom nav, app-in-app style ala Gojek) vs Desktop/Tablet Shell (multi-pane grid). Preseden: Samsung DeX tidak mengubah token visual saat adaptasi ke layar besar, hanya struktur window/layout.
Alasan: satu sistem token lebih murah dieksekusi AI Agent daripada 2 filosofi visual berbeda; prinsip reachability One UI tetap relevan sebagai pedoman ergonomi, bukan ditiru sebagai skin literal.
Status: ✅ Final prinsip.

**D-19a. Navigasi Utama Desktop/Tablet Shell (resolves Q-05)**
Desktop/Tablet Shell (viewport >= 1024px) menggunakan sidebar navigasi persisten di sebelah kiri/bawah (Taskbar style terinspirasi dari Samsung DeX) untuk mempermudah perpindahan antar-modul utama (POS, Inventory, Reports) pada area layar lebar.
Alasan: Konsisten dengan referensi ergonomi Samsung DeX dan reachability di layar lebar/hybrid.
Status: ✅ Final.

**D-20. Basis pemilihan shell: device/context, bukan jenis bisnis**
Shell (Mobile vs Desktop) ditentukan oleh device & konteks pemakaian saat itu, bukan oleh bisnis mana yang diakses. Kasir JnA Mart yang cek stok dari HP tetap pakai Mobile Shell; Owner Bakso Kang Gemoy yang buka laporan dari laptop tetap pakai Desktop Shell.
Status: ✅ Final.

---

## 6. Dokumentasi Proyek

**D-21. Struktur file pendukung**
9 file: `CLAUDE.md`, `PRD.md`, `DESIGN_SYSTEM.md`, `RBAC.md`, `DATA_MODEL.md`, `DECISIONS_LOG.md` (file ini), `ROADMAP.md`, `/phases/phase-x-*.md`, `TESTING_STANDARDS.md`.
Alasan: tiap file punya kepemilikan jelas, hindari duplikasi konteks yang bikin AI Agent baca dokumen usang.
Status: ✅ Final.

---

## Open Questions (Belum Final — Jangan Diasumsikan Agent)

**~~Q-01. Konversi stok Bakso Kang Gemoy~~ — ✅ RESOLVED, lihat D-14a (Batch Thaw Tracking).**

**~~Q-02. Akun per-gerobak/karyawan Bakso Kang Gemoy~~ — ✅ RESOLVED, lihat D-14b (akun per-orang).**

**~~Q-03. Model stok Yasaka multi-cabang~~ — ✅ RESOLVED, lihat D-03a/D-03b/D-03c. Scope sekarang: 1 outlet Yasaka, dimiliki Owner Bakso Kang Gemoy via model ownership many-to-many.**

**~~Q-04b. Struktur karyawan detail Yasaka~~ — ✅ RESOLVED, lihat D-11a.**

**~~Q-05. Navigasi Desktop/Tablet Shell~~ — ✅ RESOLVED, lihat D-19a.**

**~~Q-06. Detail Hutang/Kredit JnA Mart~~ — ✅ RESOLVED, lihat D-14g.**

---

## Cara Update File Ini
- Setiap kali sebuah **Open Question** terjawab, pindahkan jadi entri **Decision** baru (jangan dihapus riwayatnya — beri nomor Q- yang sama sebagai referensi silang).
- Setiap keputusan baru di luar yang sudah tercatat di sini WAJIB ditambahkan sebelum agent mulai mengerjakan bagian yang terdampak.
