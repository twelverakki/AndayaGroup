# Decisions Log — Architectural Decisions (The Lean Odoo Way)

> Catatan resmi seluruh keputusan arsitektur sistem yang mengikat dan telah dikunci beserta rasionalisasinya.
> 
> **Prinsip Utama**: Domain-Driven Modular ERP, Capability Flags, Double-Entry Movements, Single Transaction Ledger, dan Agnostik Merek.
>
> Format tiap entri: **Keputusan** → **Rasionalisasi / Alasan** → **Status**

---

## 1. Arsitektur Umum & Multi-Tenancy

**D-01. Scope Modul ERP (Domain Capabilities)**
Sistem mencakup 8 Domain Capability terintegrasi: Core Auth/Tenant, Unified Items, Commercial POS, Logistics/Distribution, Kitchen/Production, Daily Reconciliation/Settlements, Procurement, dan Analytics. Modul HRM dan Supplier Self-Service Portal ditiadakan (aplikasi internal dioperasikan langsung Owner/Staff).
- **Rasionalisasi:** Menjaga sistem tetap lean, fokus pada operasional riil perputaran uang dan barang tanpa overhead modul HR/payroll.
- **Status:** ✅ Final.

**D-02. Arsitektur Decoupled REST API + React PWA**
Backend murni REST API (Go + Fiber + pgx) terpisah total dari Frontend React SPA (Vite + Tailwind + Shadcn).
- **Rasionalisasi:** Standar industri modern, stateless, performa tinggi (sub-millisecond latency Go), dan siap mendukung PWA offline-first di lapangan.
- **Status:** ✅ Final.

**D-03. Multi-Tenancy & Ownership Many-to-Many**
`outlet_id` merepresentasikan lokasi/cabang fisik. `business_id` merepresentasikan entitas bisnis/legal. Data terisolasi ketat per `business_id`/`outlet_id`. Relasi kepemilikan (**Owner**) bersifat **many-to-many** via tabel `business_owners` (`user_id`, `business_id`, `outlet_id`).
- **Rasionalisasi:** Kennan dan partner memiliki beberapa bisnis sekaligus dalam satu grup. 1 akun login dapat berpindah konteks bisnis via *Workspace Switcher* tanpa login ulang.
- **Status:** ✅ Final.

**D-04. Penghapusan Brand-Centric Enums Diganti Universal Capability Flags (The Lean Odoo Way)**
Menghapus seluruh logika berbasis string nama brand (`bakso`, `yasaka`, `jna-mart`) maupun string type kaku (`fnb_production`, `fnb_branch`). Unit bisnis dan produk dikendalikan oleh **Capability Flags** (`has_pos`, `has_manufacturing`, `has_logistics_hub`, `is_sellable`, `is_purchased`, `is_manufactured`, `track_inventory`).
- **Rasionalisasi:** Mencegah jebakan *hardcoded logic* dan *if-else hell*. Bisnis apa pun di masa depan (misal: Yasaka mulai produksi bumbu sendiri, atau retail membuka cabang baru) cukup mengaktifkan capability tanpa perlu mengubah kode sumber.
- **Status:** ✅ Final.

---

## 2. Master Data & Stock Ledger (Double-Entry Engine)

**D-05. Unified Item Master 3NF**
Menggabungkan tabel terpisah (`products` dan `ingredients`) menjadi satu tabel master terpadu: `items` dengan klasifikasi `item_type` (`finished_good`, `raw_material`, `consumable`, `fixed_tool`).
- **Rasionalisasi:** Mengeliminasi redundansi data master dan menyederhanakan pelacakan inventaris lintas-domain.
- **Status:** ✅ Final.

**D-06. Saldo Stok Dual-UOM (Dual-Unit Balances)**
Tabel `item_stocks` mencatat saldo fisik secara terpisah: `qty_sealed` (kemasan besar: dus/pack) dan `qty_loose` (satuan dasar: pcs/gram/ml) dengan rasio konversi `conversion_rate` berpresisi tinggi (NUMERIC(14,4)). Dilengkapi kolom `held_by_user_id` untuk stok yang sedang dibawa personel lapangan.
- **Rasionalisasi:** Mengatasi friksi operasional riil di mana barang dibeli dalam karton/pack tetapi dijual atau dimasak dalam satuan eceran.
- **Status:** ✅ Final.

**D-07. Immutable Append-Only Stock Movement Ledger**
Setiap pergerakan fisik barang (pembelian, penjualan POS, mutasi gudang, pembongkaran dus, pencairan beku, pemakaian produksi, dan opname) WAJIB mencatat record di `stock_movements`.
- **Rasionalisasi:** Prinsip *double-entry stock moves* ala Odoo. Menghilangkan risiko korupsi saldo akibat race-condition dan menyediakan jejak audit forensik 100% jika terjadi selisih stok.
- **Status:** ✅ Final.

**D-08. Konversi Transit & Toleransi Susut Air (Shrinkage Tolerance)**
Konversi bahan beku/transit (pack beku $\rightarrow$ pcs siap olah) mencatat pergerakan stok dengan memperhitungkan faktor toleransi penyusutan air/drip loss (`shrinkage_tolerance_pct` 2–5%) yang dibukukan otomatis sebagai biaya operasional wajar (*normal operational loss*).
- **Rasionalisasi:** Mencegah tuduhan kecurangan (*false fraud accusation*) saat stock opname akibat penyusutan alami bahan basah/beku.
- **Status:** ✅ Final.

**D-09. Skema Valuasi Harga Modal (Last Buying Price)**
Valuasi harga modal menggunakan **Last Buying Price** (harga pembelian terakhir menimpa `standard_cost`), didukung snapshot HPP otomatis saat *batch production run*.
- **Rasionalisasi:** Memberikan kalkulasi laba kotor yang akurat untuk UKM tanpa beban kompleksitas akuntansi FIFO/LIFO berkala.
- **Status:** ✅ Final.

---

## 3. Commerce, POS & Daily Settlements

**D-10. Single Source of Truth: Unified Transactions Ledger & Sales Channels**
Seluruh transaksi penjualan (baik kasir retail scan barcode, kasir cepat F&B, maupun direct wholesale gudang) dicatat di tabel tunggal `transactions` yang dibedakan melalui kolom `channel` (`'pos_retail'`, `'direct_wholesale'`, `'partner_settlement'`).
- **Rasionalisasi:** Menghindari fragmentasi data pendapatan dan memungkinkan laporan laba-rugi grup ditarik secara instan dalam satu query konsolidasi.
- **Status:** ✅ Final.

**D-11. Shift Sessions & Rekonsiliasi Kas Harian (Daily Settlements)**
Penutupan kas kasir dan setoran mitra harian dicatat dalam struktur header-detail (`daily_settlements` dan `daily_settlement_items`) dengan validasi token idempotency `client_uuid` dan kalkulasi selisih kas otomatis (`cash_variance = actual_cash - expected_cash`).
- **Rasionalisasi:** Mencegah duplikasi data saat sinkronisasi offline PWA dan mengunci tanggung jawab finansial per shift kasir.
- **Status:** ✅ Final.

**D-12. End-of-Day Material Usage Calculation (Fast-Cooking FnB)**
Untuk operasional F&B olahan cepat/curah (seperti gorengan & dapur cabang), HPP dihitung melalui metode selisih pemakaian bahan harian: `Bahan Terpakai = Bahan Awal + Restock Hari Ini - Sisa Opname Tutup Shift`.
- **Rasionalisasi:** Kasir/koki tidak dibebani menimbang gramasi bahan di jam sibuk, namun Owner tetap mendapatkan angka konsumsi bahan baku dan HPP riil harian yang akurat.
- **Status:** ✅ Final.

**D-13. Kebijakan Toko: No Refund / Return, PIN Manager Override untuk Void**
Kebijakan grup tidak melayani retur barang keluar. Kesalahan input kasir sebelum struk selesai diselesaikan via **Void** yang memerlukan otorisasi PIN 4–6 digit Manager (`manager_pins`), tercatat otomatis di `override_logs`.
- **Rasionalisasi:** Anti-fraud di titik kasir tanpa mewajibkan kehadiran fisik Manager di depan layar register.
- **Status:** ✅ Final.

**D-14. Stock Opname Metode Blind Count**
Staff menginput hasil hitung fisik barang tanpa melihat saldo sistem. Selisih baru dikalkulasi saat submit dan wajib disetujui Manager/Owner sebelum membukukan koreksi stok ke ledger.
- **Rasionalisasi:** Mencegah manipulasi angka hitungan fisik oleh staff (standar audit retail internasional).
- **Status:** ✅ Final.

---

## 4. Keamanan, RBAC & Akses Kontrol

**D-15. Role-to-Domain Matrix (Agnostik Merek)**
RBAC didefinisikan secara tegas di kode berdasarkan domain:
- **Superadmin:** Developer/infrastruktur (tidak mengakses data operasional).
- **Owner:** Akses penuh lintas bisnis yang dimiliki via `business_owners`.
- **Manager:** Otorisasi outlet (opname, void PIN, shift closing, audit log).
- **Admin Gudang (Warehouse Admin):** Operasional inventory, logistik outbound, penerimaan pengadaan (PO).
- **Staff / Cashier:** Operasional kasir POS, blind count opname, pelaporan shift.
- **Rasionalisasi:** Menghilangkan pengikatan role pada nama brand tertentu. Role berlaku universal pada semua jenis unit usaha.
- **Status:** ✅ Final.

**D-16. Soft Delete & Audit Trail Integrity**
Dilarang melakukan `HARD DELETE` pada data transaksi, stok, dan akun staff. Seluruh entitas menggunakan status aktif/inaktif atau `deleted_at`.
- **Rasionalisasi:** Menjaga integritas data historis dan keabsahan laporan finansial selamanya.
- **Status:** ✅ Final.

**D-17. Tenant Scoping Otomatis di Middleware**
Setiap query database wajib disaring oleh `business_id` dan `outlet_id` yang diekstrak dari JWT context. Dilarang menulis raw query yang melompati lapisan ini.
- **Rasionalisasi:** Menjamin data tidak bocor antar-tenant (*zero data leakage*).
- **Status:** ✅ Final.

---

## 5. UI/UX & PWA Form Factor

**D-18. Dual-Form Factor Shell Adaptif (Bukan Brand-Specific UI)**
Shell dipilih berdasarkan viewport perangkat:
- **Mobile Shell (< 1024px):** Thumb-zone bottom nav, drawer modal, app-in-app feel.
- **Desktop Shell (≥ 1024px):** Multi-pane taskbar sidebar (ala Samsung DeX), floating capsule table header.
- **Rasionalisasi:** Memberikan ergonomi maksimal pada HP kasir lapangan maupun layar monitor laptop Owner.
- **Status:** ✅ Final.

**D-19. Full Offline-First PWA**
Dukungan Service Worker + precaching aset + local IndexedDB queue + Background Sync.
- **Rasionalisasi:** Menjamin kasir tetap dapat melayani penjualan meskipun koneksi internet terputus di lapangan.
- **Status:** ✅ Final.

**D-20. Standar Dokumentasi Tunggal (`docs/`)**
Seluruh spesifikasi sistem dipusatkan di folder `docs/` dengan struktur modular berbasis domain tanpa ada lagi file fase per-merek (`phase-1`, `phase-2`, dll).
- **Rasionalisasi:** Menjaga kebersihan mental model tim dan AI Agent dari duplikasi dokumen usang.
- **Status:** ✅ Final.

---

## 6. Fresh Produce, Gram Precision & Retail Field Agility

**D-21. Fresh Produce & Wet Goods: Non-Tracked Inventory with Direct Expense Costing**
Untuk barang basah/curah (sayuran, tomat, buah segar, cabe), sistem mengizinkan flag `track_inventory = false`. Pembelian supplier diakui sebagai biaya belanja operasional langsung (*Expense Cost*), dan penjualan kasir mencatat pendapatan (*Revenue*) tanpa mengunci saldo stok fisik per gram secara kaku.
- **Rasionalisasi:** Mencegah sistem macet akibat *minus stock* dan tidak membebani staf toko kelontong (1–2 orang) dengan SOP penimbangan ulang susut air atau pencatatan barang busuk yang memperlambat penjualan.
- **Status:** ✅ Final.

**D-22. Micro-Gram Precision & Dual Decimal Input di POS**
Master item dan POS mendukung kuantiti desimal presisi tinggi hingga pecahan 3–4 desimal (contoh: 0.005 kg = 5 gram untuk bumbu kemasan kecil seperti merica/ketumbar).
- **Rasionalisasi:** Mengakomodasi kebiasaan pembeli retail lokal yang membeli bumbu rempah dalam porsi kecil tanpa kehilangan margin.
- **Status:** ✅ Final.

**D-23. Non-Blocking 1-Click Wastage & Clearance Sale Price Override**
Menyediakan tombol cepat 1-klik untuk mencatat barang busuk/rusak (opsional, non-blocking), serta fitur *Quick Discount / Price Override* di kasir POS untuk obral sore/cuci gudang barang segar tanpa memerlukan otorisasi PIN Manager.
- **Rasionalisasi:** Memberikan fleksibilitas maksimal bagi kasir lapangan untuk menghabiskan stok barang segar sebelum basi tanpa birokrasi antrean.
- **Status:** ✅ Final.

