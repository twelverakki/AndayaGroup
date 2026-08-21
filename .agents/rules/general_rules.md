# Andaya Group - Frontend & UI/UX General Rules

Dokumen ini berisi standar dan aturan baku arsitektur UI/UX serta interaksi untuk seluruh modul di Andaya ERP. Setiap agent yang bekerja pada codebase ini WAJIB membaca dan mematuhi aturan berikut:

---

## 1. Keyboard Shortcuts & Interaksi
- **Shortcut Fokus Pencarian (`/`)**:
  - Pada setiap halaman yang memiliki search bar utama (seperti POS, Inventory Master, Opname, Procurement), tekan tombol `/` harus langsung memfokuskan kursor ke input pencarian (`searchInputRef.current?.focus()`).
  - Shortcut ini harus mengabaikan event saat pengguna sedang aktif mengetik di input/textarea lain (`target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'`).
  - Tambahkan hint visual keyboard `<kbd className="px-1.5 py-0.5 rounded border text-[10px]">/</kbd>` di sisi kanan search bar.

---

## 2. Standar Icon: Line Icons Saja (Lucide React)
- **HANYA gunakan Line Icons** dari library `lucide-react` (misalnya `Package`, `AlertCircle`, `CheckCircle2`, `Archive`, `LogOut`, `SlidersHorizontal`, `Search`, `Eye`, `Edit3`, dll).
- **DILARANG menggunakan emoji atau icon karakter gambar** (seperti ⚠️, ✅, 🟢, 🗄️, 🛠️, 🚪, 👁️, ✏️, 📋) di dalam UI, notifikasi alert, badge, atau tombol.

---

## 3. Pengaturan Terpusat (Gear Settings Popover)
- Semua pengaturan sistem, preferensi tampilan, dan konfigurasi lingkungan:
  - **Pilihan Bahasa (`ID` / `EN`)**
  - **Show/Hide Virtual Numpad**
  - **Jumlah Kolom Grid Produk POS**
  - **Status & Tombol Tutup Shift Kasir**
- **HARUS dimuat secara terpusat di menu Pop-up Gear (`Settings`) pada footer sidebar (`DesktopShell.tsx`)**.
- **DILARANG menduplikasi tombol setting/bahasa di dalam header halaman modul masing-masing** agar ruang kerja tetap bersih dan fokus pada alur operasional.

---

## 4. Header Halaman yang Bersih (Tanpa ID Tenant / Metadata Clutter)
- Header setiap modul harus bersih dan elegan: hanya memuat **Judul Halaman** dan **Deskripsi Fungsional Singkat**.
- **DILARANG menampilkan teks atau badge ID Tenant mentah** seperti `"JnA Mart - Toko Utama | ID Tenant: b0eebc99-..."` di header halaman modul manapun.

---

## 5. Standar Multi-Bahasa (Bilingual: Indonesia `id` & English `en`)
- Seluruh teks UI harus dideklarasikan di [`frontend/app/lib/i18n.ts`](file:///D:/laragon/www/Andaya-Group/frontend/app/lib/i18n.ts).
- Tidak boleh mencampur bahasa secara acak di dalam satu halaman (misalnya sebagian Indonesia, sebagian Inggris).
- Ambil teks terjemahan secara konsisten menggunakan:
  ```tsx
  const { language } = useLanguageStore();
  const t = translations[language];
  ```

---

## 6. Desain Visual & Komponen UI (ShadCN & Depth-Gray Palette)
- **Field & Input Style**: Menggunakan bentuk pill yang elegan dengan border tipis dan transisi fokus halus.
- **Filter Groups**:
  - Untuk desktop, gunakan layout **Horizontal Multi-Column**.
  - Opsi radio menggunakan **ShadCN Radio pattern** dengan icon checkmark di sebelah kiri tanpa kotak pembungkus.
- **Table Column Management**:
  - Gunakan komponen **ShadCN Checkbox** (`<Checkbox checked={...} onCheckedChange={...} />`) di header tabel dan klik-kanan context menu.
- **Palet Warna Gelap**: Menggunakan lapisan abu-abu gelap berlapis (`#202024`, `#232326`, `#2E2E34`, `#38383C`) dengan aksen neon lime/kuning lemon (`#E2FF66` / `#c5ff00`).

---

## 7. Format Input Angka & Mata Uang (Pemisah Ribuan / Thousands Separator)
- **Format Titik Ribuan pada Input Harga**:
  - Setiap field input yang berkaitan dengan nilai mata uang/harga (seperti Harga Beli/HPP, Harga Jual, Nominal Kas, dsb.) **WAJIB memformat angka secara real-time dengan tanda pemisah ribuan (titik `.` untuk format Indonesia)** saat pengguna mengetik (contoh: `10.000`, `1.500.000`).
  - Nilai yang dikirimkan ke backend/state kalkulasi harus tetap berupa angka murni (`number`).
  - Gunakan helper pemformatan standar:
    ```tsx
    export const formatNumberInput = (val: string | number) => {
      const cleanNum = String(val).replace(/\D/g, "");
      if (!cleanNum) return "";
      return new Intl.NumberFormat("id-ID").format(Number(cleanNum));
    };
    export const parseNumberInput = (val: string | number) => {
      const cleanNum = String(val).replace(/\D/g, "");
      return cleanNum ? Number(cleanNum) : 0;
    };
    ```

---

## 8. Menu Aksi Cepat pada Tabel Data (Quick Status & Actions)
- Pada menu aksi baris tabel (tombol titik tiga maupun klik-kanan baris), sediakan aksi langsung untuk **Ubah Status Cepat** (Aktif, Non-aktif, Dihentikan) sehingga pengguna tidak perlu masuk ke halaman edit hanya untuk mengubah status operasional produk.

---

## 9. Sistem Notifikasi & Info (ShadCN Toast / Sonner - Wajib)
- **Info & Feedback -> Toast ShadCN (Sonner)**:
  - Setiap aksi penting (menyimpan data, mengubah status operasional, menyalin ID/SKU/Invoice, mengarsipkan produk, atau kegagalan sistem/API error) **WAJIB** menampilkan status aksinya dengan memanggil `toast.success()`, `toast.error()`, `toast.info()`, atau `toast.warning()` dari `frontend/app/components/ui/sonner.tsx`.
  - **Aturan Warna & Tampilan**:
    - Background toast **wajib bernuansa netral/clean** (`bg-white dark:bg-[#202024]` dengan border halus), tidak menggunakan warna background yang terlalu mencolok.
    - **Ekspresi status (sukses/gagal/info/peringatan) diwakili sepenuhnya oleh icon line** di dalam toast (`CheckCircle2` hijau untuk sukses, `AlertCircle` merah untuk error, `Info` biru/lime untuk info, `AlertTriangle` kuning untuk warning).
    - Hindari penggunaan banner alert statis yang memakan ruang halaman jika notifikasi tersebut bersifat feedback aksi sementara.

---

## 10. Standar Styling Tabel Data (Master Table Rules)
Seluruh tabel data di modul apapun (Inventory, Procurement, Opname, dsb.) **WAJIB** mengikuti styling standar dari **Master Product Table**:

1. **Table Header: Pill-Shaped Floating Header**:
   - Header menggunakan latar belakang abu-abu netral: `bg-[#E7E9ED] dark:bg-[#2E2E34]`.
   - Kolom `th` paling kiri WAJIB diberi `rounded-l-full`, dan kolom `th` paling kanan WAJIB diberi `rounded-r-full` sehingga membentuk satu kesatuan kapsul (pill) yang seamless.
   - Tipografi header: `py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap text-slate-600 dark:text-slate-300`.
   - Kolom `th` paling kanan memuat icon trigger konfigurasi kolom `<SlidersHorizontal />` dengan dropdown checkbox visibilitas.

2. **Tanpa Border Keliling Tabel (No Outer Table Box Border)**:
   - Gunakan `<table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>`.
   - **DILARANG** memberi border box mengelilingi `<table />` itu sendiri (seperti `border border-slate-200 rounded-2xl overflow-hidden` di sekeliling tabel).
   - Tabel diletakkan di dalam Table Card container utama (`bg-white dark:bg-[#232326] border border-slate-200/80 dark:border-[#38383C] rounded-[28px] shadow-sm p-4 sm:p-6`) dengan `overflow-x-auto`.

3. **Subtle Bottom Border pada Setiap Baris (Row Bottom Border)**:
   - Setiap elemen cell `<td />` di dalam baris `<tbody>` **WAJIB** memiliki class:
     `px-5 py-3.5 border-b border-slate-200/80 dark:border-[#38383C]`
   - Hindari penggunaan `divide-y` pada `tbody` yang rawan glitch saat tabel menggunakan `border-separate`.

4. **Interaksi Baris**:
   - Transisi hover baris halus (`hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors cursor-pointer`).
   - Klik kiri pada baris membuka modal/dialog detail (*Detail Dialog*).
   - Klik kanan pada baris memunculkan menu konteks (*Custom Context Menu*).

5. **Standar Pagination Tabel**:
   - Kontrol pagination diletakkan di bawah card tabel dengan tombol nomor halaman melingkar (`w-9 h-9 rounded-full flex items-center justify-center border text-sm font-semibold`).
   - Halaman aktif menggunakan warna neon lime (`bg-[#E2FF66] text-[#1a1a1a] font-bold border-none`).
   - Halaman inaktif dan tombol navigasi prev/next (`‹` dan `›`) menggunakan `bg-white dark:bg-[#232326] border-slate-200 dark:border-[#38383C] text-slate-600 dark:text-[#94a3b8]`.
   - Di sebelah tombol nomor halaman, tampilkan teks info rentang data: `X–Y dari Z item`.


