# DESIGN_SYSTEM.md — Visual Tokens & Shell Composition

> Sumber keputusan: `DECISIONS_LOG.md` D-19, D-20. Ini **revisi** dari eksplorasi awal (Glassmorphism/Neumorphic murni) — token di file ini yang final dan mengesampingkan token lama.

---

## 1. Filosofi

Sistem desain ini **terinspirasi prinsip One UI**, bukan meniru skin Samsung secara literal. Yang diambil: reachability (elemen interaktif mudah dijangkau), card besar & chunky, touch target generous, tipografi tegas. Yang **tidak** diambil: paradigma "phone besar digenggam satu tangan" secara mentah — karena sebagian besar POS di proyek ini dipakai di device yang diam di meja/gerobak, bukan digenggam sambil jalan.

**Preseden Samsung DeX** jadi acuan kunci: DeX tidak mengubah token visual saat adaptasi ke layar besar — yang berubah cuma struktur layout/window. Prinsip yang sama dipakai di sini: **1 set token, 2 aturan komposisi berbeda** (Mobile Shell vs Desktop/Tablet Shell), bukan 2 filosofi visual berbeda.

> **Aturan untuk AI Agent:** jangan pernah menerjemahkan "One UI" atau "DeX" sebagai instruksi mentah untuk ditiru dari ingatan/training data. Selalu rujuk token eksplisit di bawah ini — itu satu-satunya sumber kebenaran visual.

---

## 2. Design Tokens (Berlaku Sama di Semua Shell)

### 2.1 Warna
```
--color-primary:    #CCF657
--color-secondary:  #3F73F7
```
Tema default: **Light Mode**.

### 2.2 Tipografi
```
--font-header:   28-32px, bold
--font-body:     16px, regular
--font-caption:  13px, medium
```
Header besar & tegas — mata langsung nangkep konteks tanpa perlu mikir, penting untuk UI kasir yang dipakai cepat.

### 2.3 Radius & Shape
```
--radius-card:    28px   -- panel/card besar
--radius-button:  16px   -- tombol, input
--radius-pill:    9999px -- segmented control, badge, toggle
```

### 2.4 Touch Target
```
--touch-target-min: 56px x 56px
```
Berlaku di **semua** shell, termasuk Desktop/Tablet — toleransi target besar tidak mengganggu presisi mouse, malah lebih nyaman untuk device hybrid (tablet dengan mouse eksternal).

### 2.5 Motion
```
--motion-transition: ease-out-cubic, 250ms   -- transisi antar-state
--motion-feedback:   spring                   -- feedback tap/klik (micro-interaction wajib)
```
Motion harus **purposeful** — memberi feedback jelas kalau aksi berhasil, bukan sekadar dekorasi.

### 2.6 Komponen Reusable
- **Segmented control**: bentuk pill (`--radius-pill`), active state = filled + shadow. Dipakai untuk switch state (mis. tab Dry Goods / Wet Goods di JnA Mart).

---

## 3. Shell System

### 3.1 Prinsip Pemilihan Shell
**Shell dipilih berdasarkan device/context penggunaan saat itu, BUKAN jenis bisnis.** Kasir JnA Mart yang cek stok dari HP tetap pakai Mobile Shell; Owner Bakso Kang Gemoy yang buka laporan dari laptop tetap pakai Desktop Shell. Setiap bisnis harus bisa render ke shell manapun tergantung siapa yang akses dan dari device apa.

Deteksi shell: berbasis viewport width + touch capability, breakpoint di **≥1024px = Desktop/Tablet Shell**, di bawah itu = Mobile Shell.

### 3.2 Mobile Shell — "App-in-App" (terinspirasi Gojek)
| Aspek | Aturan |
|---|---|
| Layout | Single-column stack |
| Navigasi | Bottom nav, fokus 1 tugas per layar |
| Interaksi | Tap-first, thumb zone (elemen penting di bagian bawah layar) |
| Density | Rendah — 1 fokus jelas per layar, hindari multi-panel |
| Kapan dipakai | Kasir gerobak/jalan (Bakso Kang Gemoy titik jualan), Owner cek laporan on-the-go, siapa pun yang akses dari HP |

### 3.3 Desktop/Tablet Shell — Multi-Pane
| Aspek | Aturan |
|---|---|
| Layout | Multi-pane grid (sidebar + main content + detail panel) |
| Navigasi | Sidebar navigasi persisten di sebelah kiri/bawah (Taskbar style terinspirasi dari Samsung DeX) (D-19a) |
| Interaksi | Mouse+keyboard, atau tap di layar yang diam di meja (JnA Mart counter) |
| Density | Tinggi — tabel, grid data banyak sekaligus |
| Kapan dipakai | Kasir meja tetap (JnA Mart counter), Manager/Owner kerja di outlet atau dari laptop |
| Breakpoint tambahan | ≥1024px memicu **swap struktur komponen**, bukan cuma resize CSS — Desktop Shell adalah versi mobile yang di-reflow ke multi-pane, dengan token visual identik |

### 3.4 Kalimat Kunci untuk AI Agent
> "Desktop Shell bukan versi mobile yang di-stretch, tapi versi mobile yang di-reflow ke struktur multi-pane — dengan token visual yang identik." Yang berbeda hanya komposisi layout, bukan gaya visual (warna, radius, tipografi tetap sama).

---

## 4. Catatan UI per Brand (ringkas)

| Brand | Pola UI Utama |
|---|---|
| JnA Mart | Global barcode listener (window-level, tanpa klik search bar dulu), tampilan struk untuk print, tab Dry/Wet Goods pakai segmented control |
| Bakso Kang Gemoy | Fast Grid UI (grid tombol besar, tanpa barcode), notif alert stok di Mobile Shell (titik jualan sering akses dari HP) |
| Yasaka | Fast Grid/Retail hybrid, tampilan struk untuk print |
| Gorengan Andalan | Fast Grid UI sederhana, tampilan nota untuk print |

Detail interaksi & wireframe per-fitur didokumentasikan di file fase masing-masing (`/phases/phase-x-*.md`), bukan di sini — file ini fokus ke token & shell, bukan spesifikasi layar per-layar.

---

## 5. Open Questions

- *(Tidak ada pertanyaan terbuka terkait Design System saat ini)*
