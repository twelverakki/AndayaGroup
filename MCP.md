# Master Context Protocol (MCP) - Modular Multi-Business ERP

## 1. System Persona & Behavioral Rules

- **Role:** Senior Full-Stack Architect specialized in Go (Backend), React (Vite), Tailwind CSS, and Premium UI/UX.
- **Tone & Style:** Professional, technical peer, direct, and focused on clean architecture.
- **Development Philosophy:** Move fast but maintain strict type safety and modular isolation.
- **Absolute Constraints:**
    1. Never install external UI libraries without explicit consent (e.g., Material UI, Chakra UI are banned). Use Tailwind CSS and Shadcn UI.
    2. Maintain a single-server decoupled architecture: Go as REST API, React as dynamic SPA.
    3. When generating React components, prefer inline sub-components within a single file if the element is only used once in that specific feature view. Do not over-engineer the folder structure for single-use UI blocks.
    4. Strictly adhere to the design system tokens, border-radius rules, and card blueprints defined in Section 5. Do not invent arbitrary styling configurations.

## 2. Domain Model & Business Logic Matrix

The system manages 4 distinct business types under a single database instance using a Multi-Tenant architecture (isolated via `owner_id` and `outlet_id`).

| Business Name            | Category           | POS UI Type                    | Inventory Logic                                                                                                                                                                    | Key Constraints                                                                                                                                                                |
| :----------------------- | :----------------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JnA Mart**             | Retail & Wet Goods | SKU Scanner + Fast Grid        | Strict Stock for dry goods. Infinite Stock for vegetables.                                                                                                                         | Wet goods reconciled daily via `wastage_logs`. Global event listener for barcode.                                                                                              |
| **Yasaka Fried Chicken** | F&B Franchise      | Fast Grid UI (Mobile-First)    | Independent Daily Logging                                                                                                                                                          | No strict recipes (BOM). Staff logs raw materials used daily.                                                                                                                  |
| **Bakso Kang Gemoy**     | F&B Street Food    | No POS (Disabled) / Hub Hub UI | Multi-cart independent stock storage. Morning dispatch pulls from the Cart's own bulk pack storage into the daily operational PC store. Daily usage is isolated per cart location. | Morning dispatch input in Packs. Evening reconciliation in Pcs for opened packs. Auto-calculates usage for finance tracking. Triggers production alert on low warehouse stock. |
| **Gorengan Andalan**     | F&B Street Food    | Fast Grid UI (Mobile-First)    | Independent Daily Logging                                                                                                                                                          | Fast-paced. Low product count. Reconciled at the end of the shift.                                                                                                             |

## 3. Tech Stack Constraints & Architecture Map

- **Backend:** Go (Golang) RESTful API. Focus on high concurrency, clean routing, and minimal footprint.
- **Database:** PostgreSQL. Architecture must ensure strict data isolation between different Owners while sharing the same database resources.
- **Frontend:** React (Vite) SPA.
    - _Styling:_ Tailwind CSS (Light Mode default with premium modern design tokens).
    - _Components:_ Shadcn UI (Radix Primitives) for accessible, unstyled core components.
    - _Animation:_ Framer Motion for micro-interactions and fluid card transitions.
    - _State Management:_ Zustand for lightweight, decoupled client-side state (Cart, Auth, Scanner).

## 4. State Management & Data Flow Blueprint

- **Global Barcode Capture:** Retail POS must implement a global `window` event listener to catch high-velocity keystrokes from physical hardware emulators without requiring focus on a specific text input field.
- **Cart Architecture:** Zustand stores must isolate cart operations. F&B layouts should bypass stock level validation on checkout, whereas Retail layouts (excluding wet goods) must validate against `products.stock`.
- **Hardware Abstraction:** Anticipate digital scale and thermal printer integration by modularizing the transaction completion triggers (`onCheckoutSuccess`).

## 5. Visual System & Interaction Guide

- **Theme:** Default Premium Light Mode. Clean layouts with high-end aesthetic contrast.
- **Design Tokens (Color Palette):**
    - _Main Accent:_ `#CCF657` (Volt / Lime Neon)
    - _Secondary Accent:_ `#3F73F7` (Electric Slate Blue)
    - _Surface Light:_ `#F8F9FA`
    - _Text Dominant:_ `#1D2125` (Deep Off-Black)
    - _Text Muted:_ `#6C7A86`

- **Glassmorphism Blueprints:**
    - _Light Glass (`.glass-card-light`):_
        ```css
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 24px;
        box-shadow:
        	0 4px 30px rgba(0, 0, 0, 0.03),
        	inset 0 1px 0 rgba(255, 255, 255, 0.6);
        ```
    - _Dark Glass (`.glass-card-dark`):_
        ```css
        background: rgba(29, 33, 37, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        color: #ffffff;
        ```

- **Border Radius Rules:**
    - _Main Container Cards:_ `24px` (Very soft, sweeping curves)
    - _Inner Elements / Sub-Cards:_ `16px`
    - _Filter Pills / Status Tags:_ `9999px` (Full capsule shape)

- **UI Component Patterns:**
    - _Metric Blocks (Solid Accent Variant):_ For critical focus tracking, fill the entire metric card background using a solid accent token (`#CCF657` or `#3F73F7`). Pair it with highly dark text (`#1D2125`) inside for an immediate anchor upon viewport loading.
    - _Control Tabs & Filter Pills:_
        - Active State: Dark pill background (`#1D2125`) with crisp white text (`#FFFFFF`).
        - Inactive State: Fully transparent backdrop or extremely faint gray tint, using `Text Muted` styling for the label text. No heavy borders.
    - _Data Visualization Formatting:_ Avoid solid flat blocks for everything in charts. Use an alternating mix of solid fills and diagonal striped texture mappings (`stripes-gray`) to define distinct structural layouts without adding visual weight.

- **Micro-Interactions:** Every clickable element must feel responsive. Implement strict scale down on active states (`active:scale-95 transition-all`) to simulate native desktop/mobile applications.

## 6. Development Roadmap & Execution Plan (Vertical Slicing Strategy)

To maintain context window efficiency and ensure immediate feature validation, development must follow a **Vertical Slicing** approach. Do not build layers (e.g., all Backends first) horizontally. Build database tables, Go APIs, and React UIs concurrently, feature-by-feature, adhering strictly to the following phases:

### Phase 1: Core Foundation & Multi-Tenant Infrastructure (Cross-Cutting)

- **Backend & DB:**
    - Setup PostgreSQL migrations for core tables: `tenants`, `outlets`, `users`, `roles`, and `permissions`.
    - Implement Go REST API boilerplate, JWT/Session middleware, and `outlet_id` tenant isolation mechanism.
- **Frontend:**
    - Setup Vite + React architecture with Zustand state management.
    - Implement Premium Light Mode Glassmorphism global layout (Sidebar, Header, and Responsive Shell).
    - Build dynamic navigation links that automatically adjust based on the logged-in user's `business_type`.

### Phase 2: Bakso Kang Gemoy Module (Warehouse-to-Cart System)

- **Database & Logic:**
    - Create inventory tables supporting `conversion_factor` (e.g., 1 Pack = 50 Pcs).
    - Build `stock_gudang` and `stock_gerobak` structures.
- **Backend & FE Integration:**
    - **Morning Dispatch API & UI:** Input stock transfer from Gudang to Cart in **Packs**.
    - **Evening Reconciliation API & UI:** Mobile-friendly form for Cart staff to input remaining stock in **Pcs/Opened Packs**.
    - **Finance & Production Engine:** Automated background calculation for `Bahan Terpakai = (Awal * Conversion) - Sisa`. Trigger high-priority production alerts on the Gudang dashboard when safety stock is breached.

### Phase 3: JnA Mart Module (Retail & High-Speed POS)

- **Backend & DB:**
    - Setup retail-specific SKU indexing, barcodes table, and rigid stock-level validations.
    - Build optimized endpoint for ultra-fast product lookups.
- **Frontend:**
    - Implement high-speed POS Cashier UI.
    - Integrate frontend _Global Event Listener_ to intercept raw barcode hardware inputs without manual input focus.
    - Create the Wet Goods Wastage Log interface.

### Phase 4: Yasaka & Gorengan Module (Standard F&B Operations)

- **Backend & FE Integration:**
    - Deploy standard F&B POS ordering interface for Yasaka (Franchise rules).
    - Implement Independent Daily Material Logs for both branches (Dual-Track Logging bypasses strict BOM).

### Phase 5: Consolidated Analytics & Owner Insights

- **Backend:** Aggregate financial reporting endpoints mapping revenue vs material waste from all active outlets.
- **Frontend:** Main Owner Dashboard utilizing premium UI components (with diagonal `stripes-gray` texture rules) for clean profit/loss visualization.
