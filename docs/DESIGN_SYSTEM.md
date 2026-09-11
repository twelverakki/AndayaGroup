# UI/UX & DESIGN SYSTEM ARCHITECTURE — ANDAYA GROUP LEAN ERP
**Version:** 3.0 (Adaptive Dual-Shell & Capability-Driven Design System)  
**Status:** Active Standard  
**Audience:** Frontend Engineers, UI/UX Designers, AI Agents  

---

## 1. Filosofi & Tree Hierarki Komponen Frontend

Sistem UI/UX Andaya ERP dibangun dengan filosofi **"Fast Ergonomics, Zero Clutter"**:
* **1 Set Token Visual, 2 Komposisi Shell Berbeda**: Warna (`#CCF657`, `#3F73F7`), radius card (`28px`), dan tipografi identik di semua form factor.
* **Capability-Based Dynamic Rendering**: Antarmuka me-render panel input dan tombol aksi secara otomatis berdasarkan *Product & Business Capabilities* tanpa hardcoded logic.
* **Line Icons Only**: 100% menggunakan icon garis dari library `lucide-react`. Dilarang menggunakan emoji atau icon gambar berwarna (⚠️, ✅, 🟢, 🚪).
* **Bilingual Single-Language**: Menampilkan teks tunggal sesuai bahasa aktif (`id` atau `en`) via `i18n.ts`.

### 🌳 Tree Hierarki Komponen Frontend

```
Frontend-Component-Architecture/
├── 1. Shell Containers/
│   ├── DesktopShell (≥ 1024px)
│   │   ├── Persistent Taskbar Sidebar (Left/Bottom DeX style)
│   │   ├── Slide-Over Tools Drawer (Settings, Calendar, Notifications)
│   │   └── Main Multi-Pane Content Area
│   │
│   └── MobileShell (< 1024px)
│       ├── Top Brand & Active Workspace Header
│       ├── Single-Column Focus Content Area
│       └── Thumb-Zone Bottom Navigation Bar (Gojek style)
│
├── 2. Domain Feature Packages (frontend/app/features/)/
│   ├── items/
│   │   └── items-module.tsx            --> Master Catalog, Dual-UOM & Product Capabilities
│   ├── inventory/
│   │   └── inventory-module.tsx        --> Realtime Balances (Dus + Pcs), Unpack & Stock Movements
│   ├── pos/
│   │   └── pos-module.tsx              --> Barcode Scanner Retail & Touch Fast Grid 1-Tap
│   ├── transfers/
│   │   └── transfers-module.tsx        --> Logistics Outbound, Handshake Receive & Thawing
│   ├── production/
│   │   └── production-module.tsx       --> Central Kitchen Batch Runs & EOD Material Usages
│   ├── settlement/
│   │   └── settlement-module.tsx       --> Cashier Sessions, Cash Variance & Wholesale Sales
│   ├── purchases/
│   │   └── purchases-module.tsx        --> Supplier Invoices & Accounts Payable Due Dates
│   ├── opname/
│   │   └── opname-module.tsx           --> Blind Count Audit & Discrepancy Approval
│   └── sales-report/
│       └── sales-report-module.tsx     --> Consolidated Financial Analytics
│
├── 3. Shared Presentation Components (frontend/app/components/)/
│   ├── ErpDataTable.tsx                --> Floating Capsule Header, Column Toggle, Circular Pagination
│   ├── ErpSearchBar.tsx                --> Global '/' Shortcut Focus & <kbd>/</kbd> Visual Hint
│   ├── WorkspaceSwitcher.tsx           --> Instant Multi-Tenant Switcher Modal
│   └── SessionCloseModal.tsx           --> Cashier Session Reconciliation Dialog
│
└── 4. Atomic UI Primitives (Shadcn UI @ frontend/app/components/ui/)/
    ├── <Select>                        --> 100% Dropdown UI (0% Native HTML Select)
    ├── <Dialog>                        --> Modal Popups & Action Forms
    ├── <Drawer>                        --> Bottom Sheets & Slide-Over Panels
    ├── <Checkbox>                      --> Table Column Selection & Checklists
    ├── <RadioGroup>                    --> Filter Groups
    └── <Sonner/Toast>                  --> Real-time Action Feedback Notifications
```

---

## 2. Design Tokens & Theme Tree

### 🌳 Tree Visual Tokens

```
Design-Tokens/
├── Colors/
│   ├── Primary Accent       --> #CCF657 / #E2FF66 (CTA Buttons, Active Pagination, Highlight)
│   ├── Secondary Brand      --> #3F73F7 (Module Icons, Secondary Action Links, Badges)
│   ├── Dark Mode Surfaces/
│   │   ├── Base Background  --> #202024
│   │   ├── Card Surfaces    --> #232326 / #2E2E34
│   │   └── Borders          --> #38383C
│   └── Light Mode Surfaces/
│       ├── Base Background  --> #F8FAFC
│       ├── Card Surfaces    --> #FFFFFF
│       └── Capsule Header   --> #E7E9ED
│
├── Corner Radius/
│   ├── --radius-card        --> 28px (Main Container Cards, Modals)
│   ├── --radius-button      --> 16px to rounded-full (Action Buttons, Search Bar)
│   └── --radius-pill        --> 9999px (Status Badges, Circular Pagination, Segmented Control)
│
├── Typography/
│   ├── Header               --> 24px - 32px (font-bold / font-semibold)
│   ├── Body                 --> 14px - 16px (font-normal)
│   └── Metric / Highlight   --> 18px - 24px (font-bold)
│
└── Interactive Protocols/
    ├── Keyboard Navigation  --> '/' key focuses search bar with <kbd>/</kbd> badge
    ├── Format Titik Ribuan  --> Real-time thousands separator (e.g. 10.000, 1.500.000)
    └── Feedback System      --> Clean Sonner toast notifications (toast.success / toast.error)
```

---

## 3. Dynamic Rendering Berbasis Capability Flags

Komponen antarmuka mengatur tampilannya secara dinamis berdasarkan data profil:

1. **POS Adaptive Mode**:
   - Jika `business.has_pos = true` dan konteks Retail: Tampilkan panel Barcode Scanner & Multi-UOM Selector (Dus vs Pcs).
   - Jika konteks Fast Food / Gerobak: Tampilkan Fast Grid Touch Buttons (1-Tap Add to Cart).
2. **Tombol Konversi Stok (Inventory)**:
   - Jika item memiliki `requires_thaw = true`: Render tombol **`[ Thaw / Cairkan ]`** dan status QC.
   - Jika item memiliki `box_unit` biasa: Render tombol **`[ Buka Kardus / Unpack ]`**.
3. **Tab Dapur & Fabrikasi (Production)**:
   - Jika `business.has_manufacturing = true`: Menu Dapur & Batch Run diaktifkan.
   - Jika `business.has_eod_usage = true`: Lembar konsumsi bahan harian (*End-of-Day Material Usage*) ditampilkan pada menu penutupan sesi.

---

## 4. Standar Master Table (ErpDataTable)

1. **Floating Capsule Header**: Header baris `th` menggunakan latar belakang `bg-[#E7E9ED] dark:bg-[#2E2E34]`. Kolom paling kiri wajib memiliki class `rounded-l-full` dan kolom paling kanan memiliki class `rounded-r-full`.
2. **Tanpa Border Luar**: Menggunakan class `w-full text-left border-separate` dengan `borderSpacing: 0` pada elemen `<table>`.
3. **Row Bottom Border**: Menggunakan class `px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C]` pada elemen `<td>`.
4. **Tombol Pagination Bulat**: Tombol nomor halaman bulat sempurna (`w-9 h-9 rounded-full`). Halaman aktif menggunakan warna neon lime (`bg-[#E2FF66] text-[#1a1a1a] font-bold border-none`).
