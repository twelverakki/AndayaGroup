# Phase 1 — Foundation

> Rujuk `CLAUDE.md`, `PRD.md` §7, `DATA_MODEL.md` §1-3, `RBAC.md` §2, `DESIGN_SYSTEM.md` sebelum mulai.

## 1. Scope

Fondasi teknis yang dipakai SEMUA bisnis di fase berikutnya. Tidak ada fitur bisnis spesifik (POS, inventory) di fase ini — murni infrastruktur.

**Backend (Go + Fiber):**
- Setup project, koneksi PostgreSQL via `pgx`
- Middleware: `AuthGuard`, `TenantContext`, `CORS`
- Tabel dasar: `users`, `business_owners`, `outlet_staff`, `businesses`, `outlets`, `manager_pins`
- Auth: JWT via HTTP-Only Cookie, endpoint `/api/v1/auth/login`, `/api/v1/auth/me`
- Endpoint switch workspace: `/api/v1/auth/switch-business` (ganti konteks `business_id`/`outlet_id` aktif tanpa re-login)

**Frontend (React + Vite):**
- Setup PWA: `manifest.json`, service worker registration, precache shell
- Router dasar + `AuthGuard` route wrapper
- Axios client + interceptor 401
- Zustand store dasar (auth state, active business context)
- Shell detection (Mobile vs Desktop, breakpoint ≥1024px) — lihat `DESIGN_SYSTEM.md` §3.1
- Workspace switcher UI (dropdown/modal pilih bisnis aktif)
- Design token diterapkan sebagai CSS variables global (lihat `DESIGN_SYSTEM.md` §2)

## 2. Prasyarat
Tidak ada — ini fase pertama.

## 3. Task Breakdown
- [x] Migrasi DB: `users`, `businesses`, `outlets`, `business_owners`, `outlet_staff`, `manager_pins`
- [x] Middleware `TenantContext` — extract `business_id`/`outlet_id` dari JWT, inject ke `c.Locals`
- [x] Repository layer pattern — wajib auto-filter tenant, bukan manual per-query (lihat `CLAUDE.md` Aturan #1)
- [x] Login flow (password ATAU PIN, sesuai role — Owner/Manager pakai password, Staff bisa PIN)
- [x] Workspace switcher backend (list semua `business_owners`/`outlet_staff` milik `user_id`, ganti token aktif)
- [x] PWA shell: service worker precache, manifest, installable
- [x] IndexedDB setup dasar (struktur untuk local queue transaksi — dipakai penuh di Phase 2)
- [x] Mobile Shell & Desktop Shell — kerangka layout kosong (belum ada fitur bisnis di dalamnya)
- [x] Seed data dummy: 4 businesses, minimal 1 outlet masing-masing, 1 Owner (contoh: 1 akun jadi Owner di 2 bisnis sekaligus, untuk test workspace switcher)

## 4. Testing Checklist
- [x] **Cross-tenant isolation:** login sebagai Owner bisnis A, coba akses endpoint data bisnis B → harus gagal (403/404)
- [x] Workspace switcher: 1 akun dengan 2+ `business_owners` record bisa switch tanpa re-login, dan data yang tampil benar-benar berubah sesuai konteks aktif
- [x] PWA: buka aplikasi dalam mode airplane/offline → shell tetap tampil (belum perlu transaksi berfungsi, cukup shell-nya)
- [x] JWT expired/invalid → redirect ke login, tidak crash
- [x] Middleware TenantContext: coba query tanpa `outlet_id` di JWT → harus ditolak, bukan default ke semua data

## 5. Definition of Done
- [x] Semua item Testing Checklist lolos
- [x] Kennan sudah verifikasi manual: login, switch workspace, buka app offline sekali
- [x] Tidak ada raw query yang skip `TenantContext` middleware (code review manual)
- [x] Status di `ROADMAP.md` diubah ke ✅
