# RBAC.md — Role-Based Access Control & Approval Security

> **Version:** 3.0 (The Lean Odoo Way — Role-to-Domain Matrix)  
> **Status:** Active Standard  
> **Prinsip Utama:** Agnostik Merek, Pemisahan Eksekusi vs Pengesahan (*Separation of Duties*), Otorisasi Cepat via Manager PIN Override, dan Akses Lintas-Bisnis Many-to-Many.

---

## 1. Prinsip Dasar Akses & Keamanan

1. **Role-to-Domain Matrix (Hardcoded di Kode)**: Matriks izin (*permission matrix*) didefinisikan secara tegas di level kode backend (middleware & service layer) untuk menjamin performa tinggi dan kesederhanaan operasional UKM.
2. **Many-to-Many Business Ownership**: Role `Owner` terikat secara many-to-many melalui tabel `business_owners`. Seorang Owner dapat mengelola banyak unit bisnis/outlet sekaligus dan berpindah konteks secara instan via *Workspace Switcher* tanpa perlu login ulang.
3. **Strict Outlet Scoping untuk Operasional**: Role operasional (`Manager`, `Warehouse Admin`, `Staff`) terikat ketat ke 1 `outlet_id` fisik pada tabel `outlet_staff`.
4. **Pemisahan Eksekusi vs Pengesahan (Anti-Fraud)**:
   - Staff yang menghitung fisik saat opname **dilarang** mengesahkan koreksi stoknya sendiri (*Blind Count*).
   - Kasir yang melakukan kesalahan input transaksi **wajib** meminta otorisasi PIN Manager untuk melakukan *Void*.
5. **Soft-Delete & Immutability**: Akun yang dinonaktifkan tidak pernah dihapus secara fisik (`status = 'inactive'`) demi menjaga keutuhan jejak audit transaksi.

---

## 2. Definisi 5 Role Universal (Agnostik Merek)

```
                              STRUKTUR PERAN SISTEM
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
    [Superadmin]                                                  [Owner]
 (Developer/Infra)                                       (Eksekutif Lintas-Bisnis)
                                                                     │
                                    ┌────────────────────────────────┼────────────────────────────────┐
                                    ▼                                ▼                                ▼
                                [Manager]                    [Warehouse Admin]                 [Staff / Kasir]
                            (Otoritas Outlet)              (Logistik & Inventory)             (Eksekusi Transaksi)
```

### 1. Superadmin (Developer / System Administrator)
* **Cakupan:** Lintas-tenant global.
* **Tanggung Jawab:** Pemeliharaan infrastruktur, migrasi database, pemantauan sistem, dan aktivasi tenant.
* **Batasan:** Dilarang mengakses data rahasia operasional bisnis (omzet, stok detail, resep modal).

### 2. Owner (Pemilik Usaha / Eksekutif)
* **Cakupan:** Scoped ke seluruh unit bisnis/outlet yang dimilikinya via `business_owners`.
* **Tanggung Jawab:** Melihat laporan finansial konsolidasi, valuasi aset, analisis margin laba kotor, persetujuan pengeluaran modal, dan manajemen akun Manager/Staff.

### 3. Manager (Kepala Outlet / Supervisor)
* **Cakupan:** 1 Outlet fisik tertentu.
* **Tanggung Jawab:** Otorisasi *Manager PIN Override* untuk void transaksi kasir, persetujuan hasil *Stock Opname (Blind Count)*, verifikasi selisih setoran kas shift (*cash variance*), dan persetujuan penghapusan barang rusak (*wastage*).
* **Flag Opsional:** `can_view_cost` (bisa diaktifkan Owner jika Manager dipercaya melihat harga modal/HPP).

### 4. Warehouse Admin (Admin Gudang & Logistik)
* **Cakupan:** 1 Gudang/Hub logistik atau Dapur Pusat.
* **Tanggung Jawab:** Input penerimaan pengadaan supplier (PO), pembuatan surat jalan pengiriman antar-lokasi (*outbound shipment*), pencatatan batch produksi dapur, dan pelaporan stok gudang.

### 5. Staff / Kasir (Operator Lapangan)
* **Cakupan:** Titik kasir register, dapur gerai, atau rombong lapangan.
* **Tanggung Jawab:** Melayani transaksi POS (Barcode/Fast Grid), input hasil hitung fisik opname (tanpa melihat angka sistem), aksi pencairan (*thaw/unpack*), dan penutupan kasir shift harian.
* **Batasan:** Dilarang melihat harga modal HPP, dilarang menghapus transaksi, dilarang melakukan void tanpa PIN Manager.

---

## 3. Global Role-to-Domain Permission Matrix

| Domain Capability | Aksi / Fitur Operasional | Staff | Warehouse Admin | Manager | Owner | Superadmin |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Domain 1: Auth** | Switch Workspace Bisnis | ❌ | ❌ | ❌ | ✅ | — |
| | Kelola Akun Staff & Manager | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Domain 2: Items** | Lihat Katalog Master Item | ✅ (Harga Jual) | ✅ | ✅ | ✅ | ❌ |
| | Tambah / Edit Master Item & UOM | ❌ | ❌ | ❌ | ✅ | ❌ |
| | Buka Kemasan Dus (`unpack`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Domain 3: POS** | Buka / Layani Transaksi POS | ✅ | — | ✅ | ✅ | ❌ |
| | Minta Void Transaksi Kasir | ✅ (Minta) | — | ✅ (Approve) | ✅ (Approve) | ❌ |
| | Cetak Ulang Struk / Nota | ✅ | — | ✅ | ✅ | ❌ |
| **Domain 4: Logistics** | Buat Outbound Shipment | ❌ | ✅ | ✅ | ✅ | ❌ |
| | Konfirmasi Penerimaan (`handshake`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| | Aksi Pencairan Beku (`thaw`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Domain 5: Production**| Catat Batch Produksi Dapur | ❌ | ✅ | ✅ | ✅ | ❌ |
| | Input Konsumsi Bahan Harian (EOD) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Domain 6: Settlements**| Input Opname Hitung Fisik (Blind) | ✅ | ✅ | ✅ | ✅ | ❌ |
| | **Approve** Selisih Opname / Wastage | ❌ | ❌ | ✅ | ✅ | ❌ |
| | Submit Setoran Kas Shift Harian | ✅ | — | ✅ | ✅ | ❌ |
| | Input Penjualan Grosir (`direct`) | — | ✅ | ✅ | ✅ | ❌ |
| **Domain 7: Procurement**| Input Faktur PO Supplier | ❌ | ✅ | 🟡 opsional* | ✅ | ❌ |
| | Pelunasan Hutang Supplier | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Domain 8: Analytics** | Laporan Omzet & Keuangan Kas | ❌ | ❌ | ✅ (Outletnya) | ✅ (Semua) | ❌ |
| | Analisis Margin HPP & Laba Bersih | ❌ | ❌ | 🟡 `can_view_cost` | ✅ | ❌ |

`*` *Catatan: Akses melihat HPP dan input procurement bagi Manager dikendalikan oleh toggle boolean `can_view_cost` di tabel `outlet_staff`.*

---

## 4. Manager PIN Override Security Engine

Mekanisme otorisasi instan di titik kasir menggunakan PIN hash 4–6 digit tanpa mewajibkan perpindahan akun login:

```
[Kasir Melakukan Kesalahan Input]
              │
              ▼
[Tekan Tombol "Minta Void Transaksi"]
              │
              ▼
[Dialog Modal: Input PIN Manager & Alasan]
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Verification:                                       │
│ 1. Cek hash PIN pada tabel `manager_pins`                   │
│ 2. Validasi apakah user terdaftar sebagai Manager di outlet │
│ 3. Jika valid: update `is_void = true` pada `transactions`  │
│ 4. Insert audit log ke `override_logs`                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
[Transaksi Dibatalkan + Struk Void Tercetak]
```

### Struktur Data Log Otorisasi (`override_logs`):
* `transaction_id`: Referensi transaksi yang dibatalkan.
* `staff_id`: Kasir yang mengajukan void.
* `manager_id`: Manager yang memasukkan PIN pengesahan.
* `action`: Jenis aksi (`VOID`, `DISCOUNT_OVERRIDE`, `OPNAME_OVERRIDE`).
* `reason`: Alasan pengesahan (dipilih dari opsi standar: *Salah Input Qty*, *Salah Harga*, *Customer Batal*, dll).

---

## 5. Account Lifecycle & Security Standards

1. **Pembuatan Akun Cepat**: Akun Staff dan Kasir dibuat secara instan oleh Owner atau Manager dengan memasukkan nama dan PIN login 6 digit tanpa birokrasi email.
2. **Deaktivasi Instan (Turnover Guard)**: Jika karyawan berhenti bekerja, akun langsung diubah statusnya menjadi `status = 'inactive'`. Seluruh sesi login JWT dan hak PIN Manager seketika hangus, namun data transaksi masa lalu tetap utuh.
3. **Penyimpanan Password & PIN**: Seluruh password dan PIN wajib di-hash menggunakan algoritma **Bcrypt** (`password_hash` & `pin_hash`) sebelum disimpan ke database PostgreSQL.
