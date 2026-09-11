# SYSTEM_MODULAR_ARCHITECTURE_AND_ROADMAP.md
> **Dokumen Blueprint Arsitektur Modular & Status Sistem Terkini**  
> **Target Sistem**: Andaya Group Multi-Tenant Lean ERP  
> **Status**: Live, Stable & 100% Tested (The Lean Odoo Way)  
> **Tanggal Update**: 05 September 2026 (WITA)  

---

## 1. Executive Summary: Transformasi dari *Brand-Centric* ke *Domain-Driven*

Sistem Lean ERP Andaya Group beroperasi di atas **8 Universal Domain Capabilities** yang agnostik terhadap merek dagang:
1. **Core Auth & Multi-Tenancy**: Ownership many-to-many & instant workspace switcher.
2. **Master Items & Stock Ledger**: Single Table of Truth `items` & Double-Entry `stock_movements`.
3. **Commercial POS & Sessions**: Barcode scanning, fast grid touch, & register `sessions`.
4. **Stock Transfers & Thawing**: Outbound/return `stock_transfers`, handshake, & cold transit thawing.
5. **Kitchen Production & COGS**: Batch central kitchen, atomic raw deduction, & HPP snapshot.
6. **Daily Reconciliation & Settlements**: Sesi closing, cash variance, & direct wholesale.
7. **Purchases & Accounts Payable**: PO faktur supplier (`purchases`) & pelacakan hutang usaha.
8. **Group Consolidated Analytics**: Single source of truth laporan finansial grup.

```
                              ANDAYA LEAN ERP ARCHITECTURE
                                           │
    ┌───────────────┬──────────────────────┼──────────────────────┬─────────────────┐
    ▼               ▼                      ▼                      ▼                 ▼
[1. Master]    [2. Commerce]          [3. Production]        [4. Transfers]    [5. Settlement]
 Unified Items  POS Barcode Retail     Central Kitchen Batch  Stock Transfers   Daily Sessions
 Dual-UOM       Fast Grid 1-Tap POS    Raw Material Deduct    Handshake Receive Cash Variance
 Stock Ledger   Register Sessions      Real HPP Snapshot      Transit Thawing   Blind Opname
```

---

## 2. Kondisi Sistem Eksisting Saat Ini (Current Live Snapshot)

### A. Database Layer (PostgreSQL 3NF — Live)
* **Master Terpadu (`items`)**: Menyatukan produk jadi, bahan baku, kemasan, dan alat dengan *Product Capability Flags* (`is_sellable`, `is_inventory_tracked`, `requires_thaw`).
* **Saldo Stok Fisik (`item_stocks`)**: Mencatat saldo `qty_sealed` (Dus/Pack), `qty_loose` (Pcs/Gram), dan `held_by_user_id` (lapangan).
* **Ledger Mutasi Append-Only (`stock_movements`)**: Double-entry ledger immutable untuk seluruh pergerakan barang.
* **Single Transactions Ledger (`transactions`)**: Satu tabel terpadu dengan pembeda kanal (`channel`: `'pos_retail'`, `'pos_fnb'`, `'direct_wholesale'`, `'partner_settlement'`).
* **Sesi Kasir & Rekonsiliasi (`sessions` & `daily_settlements`)**: Penguncian register kas harian dengan token idempotency `client_uuid`.

### B. Backend Layer (Go Fiber v2 — Clean Modular Architecture)
* **`backend/internal/modules/items/`**: CRUD master item, kategori per-tenant, wastage logs, UOM conversion.
* **`backend/internal/modules/production/`**: Batch run dapur pusat, kalkulasi snapshot HPP, dan EOD material usage.
* **`backend/internal/modules/logistics/`**: Pengiriman gudang (`stock_transfers`), handshake receive, dan pencairan beku (`thaw`).
* **`backend/internal/modules/settlements/`**: Penutupan sesi kasir, kalkulasi selisih kas (*cash variance*), dan direct wholesale sales.
* **`backend/internal/modules/transactions/`**: POS checkout register, manager PIN override (void), dan session control.

### C. Automated Test Suites & DoD Status (100% Lolos)
| Modul Test | Cakupan Uji | Hasil Eksekusi |
|---|---|---|
| `items_test.go` | Cross-tenant isolation, category & wastage scoping | **`PASS`** (Exit Code 0) |
| `production_test.go` | Tenant boundary guard, atomicity bahan baku, kalkulasi HPP snapshot | **`PASS`** (Exit Code 0) |
| `logistics_test.go` | Pemotongan stok pusat, penolakan unauthorized receive, handshake & thawing | **`PASS`** (Exit Code 0) |
| `settlements_test.go` | Target revenue vs collected, idempotency `client_uuid`, unifikasi direct sales | **`PASS`** (Exit Code 0) |
| `integration_test.go` | POS Dry/Wet goods, Manager PIN Void override, Blind Count opname | **`PASS`** (Exit Code 0) |
| **Kompilasi Global** | `go test ./...` + `go vet ./...` + `npx tsc --noEmit` | **`PASS 100%` (0 Error)** |

---

## 3. Matriks Pemetaan 4 Business Archetypes ke Capability Flags

| Arketipe Bisnis | Contoh Unit | `has_pos` | `has_manufacturing` | `has_logistics_hub` | `has_eod_usage` | Karakteristik Operasional |
|---|---|:---:|:---:|:---:|:---:|---|
| **Archetype 1: Retail & Dual-UOM** | JnA Mart | ✅ | ❌ | ❌ | ❌ | Ribuan SKU, Barcode Scanner, Dual-UOM Dus $\leftrightarrow$ Pcs, Supplier AP. |
| **Archetype 2: Kitchen & Cold Transit** | Bakso Gemoy | ✅ | ✅ | ✅ | ❌ | Central Kitchen Batch Run, Cold Transit Thaw, Handshake Delivery, Gerobak Shift. |
| **Archetype 3: Fast-Food Franchise** | Yasaka | ✅ | ❌ | ❌ | ❌ | Fast Grid Touch POS, Receipt Anti-Fraud, Restock Gudang/Outlet. |
| **Archetype 4: Fast-Cooking Direct** | Gorengan | ✅ | ❌ | ❌ | ✅ | Fast Grid POS, Zero-Carryover Bahan Basah, End-of-Day Material Opname. |

---

## 4. Rencana Kerja Penyelarasan Kode (Code Alignment Plan)

1. **Frontend Clean Sweep**:
   - Selaraskan penamaan modul dan rute navigasi di [`frontend/app/config/navigation.ts`](file:///D:/laragon/www/Andaya-Group/frontend/app/config/navigation.ts) dan shell menjadi generic: `transfers`, `purchases`, `settlements`, `production`.
   - Hapus sisa string matching `cat.includes("bakso")` di POS module.
2. **Backend Route Standardization**:
   - Pastikan seluruh rute backend menggunakan format baku `/api/v1/items`, `/api/v1/pos`, `/api/v1/transfers`, `/api/v1/productions`, `/api/v1/settlements`, `/api/v1/purchases`.
3. **Penyatuan Laporan Keuangan Konsolidasi (Domain 8)**:
   - Menghubungkan tabel `transactions` dan `purchases` untuk menghasilkan Laporan Laba Kotor Konsolidasi Grup bagi Owner.
