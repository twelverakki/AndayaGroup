# TESTING_STANDARDS.md — Quality Assurance & Multi-Tenant Isolation

> **Version:** 3.0 (The Lean Odoo Way — Domain Testing & DoD)  
> **Status:** Active Mandatory Standard  
> **Prinsip Kunci:** Isolasi Multi-Tenant Mutlak, Anti-Leakage Blind Opname, Idempotensi Sinkronisasi PWA, dan Double-Entry Stock Movement Auditing.

---

## 1. Cross-Tenant Isolation Test (Aturan Mutlak #1)

Setiap endpoint API yang mengakses atau memodifikasi data tenant WAJIB lolos uji isolasi:

```
                  FIXTURE UJI ISOLASI MULTI-TENANT
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    ▼                             ▼                             ▼
[Tenant A: Retail]       [Tenant B: Kitchen]          [Tenant C: Franchise]
- User: Owner/Staff A    - User: Warehouse B          - User: Manager C
- Outlet: Outlet_A1      - Outlet: Central_Hub_B      - Outlet: Branch_C1
```

### Skenario Uji Wajib:
1. **Cross-Tenant Breach Attempt**: Login sebagai user `Tenant_Retail_A` $\rightarrow$ kirim request manipulasi data ID milik `Tenant_Central_Kitchen_B` $\rightarrow$ Backend **WAJIB MENOLAK** dengan HTTP 403 Forbidden atau 404 Not Found (tanpa membocorkan keberadaan record).
2. **Cross-Outlet Scoping**: Manager pada `Branch_C1` dilarang mengesahkan opname atau melihat laporan keuangan `Branch_C2`, meskipun berada di bawah `business_id` yang sama.
3. **Workspace Switcher Integrity**: Saat Owner beralih konteks bisnis, parameter query di repository layer SELALU mengikat `WHERE business_id = $1` sesuai token aktif.

---

## 2. Double-Entry Stock Ledger & Atomic Movement Test

Untuk setiap aksi yang mengubah saldo inventaris fisik:
1. **Balance Equation Check**: Saldo fisik pada `item_stocks` harus sama persis dengan total akumulasi mutasi di `stock_movements`:
   $$\text{item\_stocks.qty} = \sum \text{stock\_movements.qty\_change}$$
2. **Dual-UOM Conversion Atomicity**: Eksekusi pembongkaran kardus (`unpack`) atau pencairan beku (`thaw`) wajib memotong kemasan besar dan menambah kemasan eceran dalam satu database transaction terisolasi.
3. **Negative Stock Prevention**: Database constraint `CHECK (qty_sealed >= 0)` dan `CHECK (qty_loose >= 0)` wajib menolak transaksi konkuren yang mencoba memotong stok melebihi saldo fisik riil.

---

## 3. Approval & Anti-Fraud Flow Test

1. **Blind Count Opname Payload**: Response API untuk form hitung fisik staff **DILARANG MENYERTAKAN** angka stok sistem (`expected_qty`) pada JSON payload (termasuk di Network tab browser) untuk mencegah kecurangan staff.
2. **Manager PIN Override Verification**:
   - Percobaan void dengan PIN salah wajib ditolak dengan pesan generik.
   - Percobaan void dengan PIN Manager dari outlet lain wajib ditolak.
   - Setiap void yang berhasil wajib mencatat baris baru di `override_logs`.
3. **State Immutability**: Transaksi atau laporan shift yang sudah berstatus `closed`/`verified` tidak dapat di-edit ulang.

---

## 4. Offline-First PWA & Idempotency Test

1. **Local Storage & IndexedDB Queue**: Transaksi yang dilakukan saat koneksi internet terputus tersimpan rapi di local queue dengan status `pending_sync`.
2. **Idempotency Guard (`client_uuid`)**: Pengiriman ulang transaksi yang sama (retry) dengan `client_uuid` yang identik wajib mengembalikan respons sukses tanpa membuat duplikasi baris transaksi atau memotong stok dua kali.
3. **Background Sync**: Begitu koneksi internet kembali aktif, antrean transaksi offline wajib tersinkronisasi otomatis ke server.

---

## 5. Definition of Done (DoD) Checklist

Setiap penambahan atau pembaruan fitur domain dinyatakan **Lolos (DoD Selesai)** jika memenuhi checklist:
- [ ] Automated unit & integration tests lolos 100% (`go test -count=1 ./internal/modules/...`).
- [ ] Lolos static analysis & type safety (`go vet ./...` Exit Code 0 & `npx tsc --noEmit` Exit Code 0).
- [ ] Cross-tenant isolation test lolos tanpa celah raw query yang melompati `TenantContext`.
- [ ] Skema database terbaru telah disinkronkan ke [`docs/DATA_MODEL.md`](file:///D:/laragon/www/Andaya-Group/docs/DATA_MODEL.md).
- [ ] Status domain di [`docs/ROADMAP.md`](file:///D:/laragon/www/Andaya-Group/docs/ROADMAP.md) telah diperbarui ke ✅.
