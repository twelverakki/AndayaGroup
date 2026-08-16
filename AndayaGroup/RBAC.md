# RBAC.md — Role, Permission & Approval Mechanism

> Sumber keputusan: `DECISIONS_LOG.md` (D-03, D-03a/b/c, D-05 s/d D-11, D-14a/b/d, D-14e). Kalau ada konflik, `DECISIONS_LOG.md` yang menang — file ini ringkasan operasional untuk agent implementasi.

---

## 1. Prinsip Dasar

1. **RBAC hardcode, bukan dynamic permission engine.** Matrix di bawah didefinisikan di kode (bisa direvisi lewat migration), tidak ada UI untuk user custom-atur permission sendiri.
2. **Role tidak terikat 1 akun : 1 bisnis.** Kepemilikan (Owner) bersifat many-to-many via tabel `business_owners` — 1 akun bisa punya beberapa record kepemilikan di business/outlet berbeda, lalu switch konteks tanpa re-login.
3. **Role lain (Manager, Admin Gudang, Staff) tetap terikat ketat ke 1 `outlet_id`/`business_id`** — beda dari Owner yang bisa lintas-bisnis, role operasional ini scoped tunggal.
4. **Prinsip pemisahan "yang eksekusi" vs "yang mengesahkan"** berlaku konsisten di semua approval flow (opname, void, wastage) — dirancang untuk anti-fraud, bukan birokrasi berlebihan.
5. **Nonaktifkan, jangan hapus.** Semua akun yang keluar/nonaktif di-soft-delete demi menjaga jejak audit transaksi historis.

---

## 2. Role Definitions

### Superadmin
- **Cakupan:** Lintas-tenant, level developer/pengelola sistem.
- **Fungsi:** Kelola akun langganan (aktif/nonaktif), maintenance sistem, akses mode pause untuk migrasi database.
- **Tidak** masuk ranah operasional bisnis apa pun (tidak lihat data transaksi/stok/finansial bisnis).

### Owner
- **Cakupan:** Scoped per `business_id` (atau per `outlet_id` khusus Yasaka — lihat §5) via tabel `business_owners`. 1 akun bisa punya banyak record.
- **Fungsi:** Lihat laporan finansial, valuasi aset, analytics bisnis yang dimiliki. Approve wastage log & void (setara Manager, plus lebih). Kelola akun Manager & Staff di bisnis miliknya. Switch antar-bisnis via workspace switcher.

### Admin Gudang *(khusus Bakso Kang Gemoy — lihat §5)*
- **Cakupan:** Delegasi penuh dari Owner, terbatas domain gudang pusat.
- **Boleh:** Approve stock request dari titik jualan, input restock gudang pusat, catat produksi.
- **Tidak boleh:** Lihat laporan finansial toko/keseluruhan bisnis, atur akun Manager/Staff, approve wastage log titik jualan.
- **Status saat ini:** posisi dipegang Owner sendiri; role ini disiapkan agar bisa didelegasikan ke orang lain nanti tanpa migrasi skema.

### Manager
- **Cakupan:** Per-outlet.
- **Fungsi:** Approve hasil opname (Blind Count), approve void via PIN (Manager Override), lihat laporan shift harian, approve wastage log outlet-nya.

### Staff
- **Cakupan:** Per-outlet/titik jualan.
- **Fungsi:** Transaksi POS, input hasil opname (blind — tanpa lihat angka sistem), input log harian bahan (untuk bisnis yang relevan — lihat §5), input Internal Take (JnA Mart, dengan approval sesuai kebijakan).
- **Tidak boleh:** hapus riwayat transaksi, lihat harga modal/keuntungan bulanan.

---

## 3. Global Permission Matrix

| Aksi | Staff | Manager | Admin Gudang | Owner | Superadmin |
|---|:---:|:---:|:---:|:---:|:---:|
| Transaksi POS | ✅ | ✅ | — | ✅ | ❌ |
| Input hasil opname (blind count) | ✅ | ✅ | — | ✅ | ❌ |
| **Approve** hasil opname / wastage log | ❌ | ✅ | — | ✅ | ❌ |
| Void transaksi (via PIN Manager) | Minta approval | ✅ Approve | — | ✅ | ❌ |
| Input Internal/Personal Take (JnA Mart) | ✅ | ✅ | — | ✅ | ❌ |
| Lihat harga modal / laporan laba | ❌ | 🟡 opsional* | ❌ | ✅ | ❌ |
| Kelola akun Staff | ❌ | ❌ | ❌ | ✅ | ❌ |
| Kelola akun Manager | ❌ | ❌ | ❌ | ✅ | ❌ |
| Approve stock request gudang → titik jualan (Bakso) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Input restock gudang pusat (Bakso) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Input pengadaan/procurement + status hutang | ❌ | 🟡 opsional* | ✅ (Bakso saja) | ✅ | ❌ |
| Switch antar-bisnis (workspace) | ❌ | ❌ | ❌ | ✅ | — |
| Kelola langganan/akun Owner | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mode pause/maintenance sistem | ❌ | ❌ | ❌ | ❌ | ✅ |

`*` Opsional = tergantung kepercayaan Owner ke Manager tersebut, bisa di-toggle per-Manager di level data (bukan permission engine dinamis, cukup 1 flag boolean `can_view_cost` di record Manager).

---

## 4. Manager Override (Void & Approval Lain)

**Skema:**
```
manager_pins
├── id
├── user_id       (FK ke Manager)
├── pin_hash      (di-hash, bukan plaintext — sama seperti password)
├── created_at
└── updated_at

override_logs
├── id
├── transaction_id
├── staff_id      (siapa yang minta override)
├── manager_id    (siapa yang approve via PIN)
├── action        (VOID | DISCOUNT_OVERRIDE | dst — extensible)
├── reason         (dropdown: "Salah qty", "Salah harga", "Customer batal", dll)
└── created_at
```

**Alur:** Staff input transaksi salah → minta override → Manager input PIN (4-6 digit) di device kasir tanpa perlu standby fisik → sistem verifikasi hash → transaksi ter-void + tercatat di `override_logs` dengan alasan.

**Kenapa generik dari awal:** mekanisme ini dirancang bisa dipakai ulang untuk kasus approval lain di luar void (mis. discount override), bukan cuma nempel di 1 fitur.

---

## 5. Catatan Spesifik per Brand

### JnA Mart
- Role standar: Owner → Manager → Staff.
- Staff duty: transaksi POS (scan barcode), input opname blind count, input restock fisik, input **Internal Take**.
- Fitur unik: Internal/Personal Take (transaction type khusus mencatat pengambilan pribadi, tetap potong stok + tercatat).
- Procurement: field status hutang (Lunas/Belum Lunas) bisa diinput Owner atau Manager (jika di-percaya).

### Bakso Kang Gemoy
- Role tambahan: **Admin Gudang** (unik brand ini — lihat §2). Saat ini dipegang Owner sendiri.
- Staff duty (di titik jualan): transaksi POS Fast Grid, input closing stok harian (`Sealed` + `Opened` dalam pcs).
- **Akun staff dibuat per-orang** (bukan per-titik-jualan generik) karena mereka karyawan bergaji bulanan — basis pelacakan gaji & laporan individual.
- Titik jualan **bukan** `outlet_id` formal — direpresentasikan sebagai lokasi/assignment yang menempel ke akun Staff, bukan entitas tenant terpisah.

### Yasaka Fried Chicken
- Role standar: Owner → Manager → Staff.
- Kepemilikan Owner di-assign di **level outlet** (bukan business), karena franchise — memungkinkan tiap outlet Yasaka punya Owner berbeda di masa depan.
- Scope sekarang: 1 outlet, dimiliki Owner Bakso Kang Gemoy.
- **Approval harian:** Didelegasikan kepada user dengan role `Manager` yang terikat pada outlet Yasaka tersebut (D-11a).

### Gorengan Andalan
- Role standar: Owner → Manager (per-cabang, 2 cabang aktif saat ini) → Staff.
- Tidak butuh role tambahan seperti Admin Gudang — struktur ini paling dekat dengan model RBAC dasar tanpa modifikasi.
- Tiap cabang = 1 `outlet_id` di bawah `business_id` Gorengan Andalan, masing-masing punya Manager sendiri.

---

## 6. Account Lifecycle

- Akun Staff dibuat ringan oleh Manager/Owner: nama, PIN/password sederhana, assign outlet/lokasi.
- Turnover cepat (terutama Yasaka & Gorengan) → proses onboarding sengaja tidak berat.
- Akun yang keluar **dinonaktifkan**, bukan dihapus — riwayat transaksi & audit trail tetap utuh.
- Akun Manager membawa `manager_pins` sendiri — saat dinonaktifkan, PIN otomatis tidak berlaku (bukan dihapus, cukup di-invalidate lewat status akun).

---

## 7. Open Questions Terkait RBAC

Lihat `DECISIONS_LOG.md` untuk status terkini.
- *(Tidak ada pertanyaan terbuka terkait RBAC saat ini)*
