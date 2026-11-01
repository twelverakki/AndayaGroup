# General Frontend & UX Implementation Rules

> Dokumen ini berisi pedoman implementasi teknis antarmuka yang menjabarkan **Pilar II (UX & Frontend Principles)** pada [GEMINI.md](file:///D:/laragon/www/Andaya-Group/GEMINI.md) serta spesifikasi visual pada [docs/DESIGN_SYSTEM.md](file:///D:/laragon/www/Andaya-Group/docs/DESIGN_SYSTEM.md).

---

## 1. Enkapsulasi & Penggunaan Komponen Standar (`frontend/app/components/`)

Seluruh fitur baru wajib memprioritaskan penggunaan komponen komposit yang sudah dienkapsulasi di repositori (jangan menulis ulang markup mentah):

1. **Tabel Data Master**: Gunakan `<ErpDataTable<T> />` untuk menampilkan daftar data operasional (mendukung visibilitas kolom, kapsul header, pagination bulat, dan tampilan responsif desktop/mobile secara otomatis).
2. **Pencarian Halaman**: Gunakan `<ErpSearchBar />` yang telah mendukung pemfokusan otomatis melalui tombol pintas `/` (*keyboard shortcut*).
3. **Input Nominal / Mata Uang**: Gunakan `<InputGroup>` + `<InputGroupInput currency />` dari `frontend/app/components/ui/input-group.tsx` agar pemisah ribuan terformat secara real-time saat diketik sementara nilai internal tetap berupa `number` murni.
4. **Pemilih Tanggal, Waktu, & Pekan ISO**: Gunakan `<DatePicker />` dan `<TimePicker />` dari `frontend/app/components/ui/date-picker.tsx`.
5. **Kontrol Form & PIN**: Gunakan primitif Shadcn UI (`<Select>`, `<Switch>`, `<Dialog>`, `<Sheet>`, serta `<InputOTP>` untuk autentikasi PIN 6-digit).
6. **Konfirmasi Aksi Krusial**: Gunakan `<ConfirmDialog />` untuk setiap tindakan arsip, pembatalan (*void*), atau perubahan status sensitif.

---

## 2. Tata Letak, Ikonografi, & Aksesibilitas Visual

1. **Frameless Page Header**:
   Header utama halaman (judul, subjudul, dan tombol aksi utama) diletakkan menyatu dengan kanvas halaman menggunakan garis batas bawah tipis (`border-b`), tanpa dibungkus di dalam kotak/Card terpisah.
2. **Line Icons Only**:
   Gunakan ikon garis dari `lucide-react` secara konsisten di seluruh antarmuka dan notifikasi. Hindari penggunaan karakter emoji di dalam elemen UI.
3. **Keterbacaan & Kontras Warna (WCAG AA)**:
   Pastikan warna teks selalu memiliki kontras tinggi terhadap latar belakangnya baik pada *Light Mode* maupun *Dark Mode*. Warna aksen terang (seperti neon lime `#CCF657` / `#E2FF66`) digunakan sebagai latar belakang elemen aktif/tombol dengan teks gelap di atasnya, atau sebagai aksen di atas latar belakang gelap.
4. **Progressive Disclosure (Contextual Help)**:
   Gunakan ikon informasi (`Info` / `HelpCircle`) yang dipadukan dengan `<Tooltip>`, `<Popover>`, atau `<Sheet>` untuk menyajikan penjelasan mendalam mengenai aturan bisnis atau kapabilitas modul secara *on-demand*.

---

## 3. Reaktivitas, Umpan Balik, & Internasionalisasi (i18n)

1. **Optimistic Local State Updates**:
   Setiap operasi penyimpanan, pembaruan status baris, atau penghapusan lunak (*soft-delete*) harus memperbarui *state* lokal komponen secara langsung tanpa memicu *full-page reload* atau mereset posisi gulir (*scroll*).
2. **Real-Time Toast Feedback**:
   Setiap aksi mutasi data, penyalinan identitas/SKU, atau kegagalan jaringan wajib menampilkan umpan balik instan melalui `toast` (`sonner`).
3. **Kamus Dwibahasa (`id` & `en`)**:
   Seluruh label, judul, *placeholder*, dan pesan umpan balik wajib direferensikan dari `frontend/app/lib/i18n.ts`.
4. **Organisasi Folder Fitur**:
   Susun modul di bawah `frontend/app/features/<domain-capability>/` dan pecah komponen yang mulai membesar (>350–400 baris) ke dalam sub-folder `components/` dan `hooks/`.
