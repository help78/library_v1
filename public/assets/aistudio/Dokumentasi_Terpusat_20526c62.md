# Dokumentasi API Jibas (Cloudflare Workers + Hyperdrive)

Berikut adalah daftar lengkap endpoint REST API untuk sistem informasi sekolah yang telah terintegrasi dalam Cloudflare Workers. Seluruh endpoint menggunakan prefix `/api`.

---

## 1. Modul JBS USER (Autentikasi & Hak Akses)
**Prefix:** `/api/jbsuser`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `POST` | `/login` | Login Multi-Role (Tingkat 1=Landlord, 2=Pegawai, 3=Siswa, 4=Calon). Cek auth ke berbagai DB. |
| `GET` | `/pegawai` | Ambil daftar akun login pegawai beserta status aktifnya. |
| `POST` | `/pegawai` | Buat akun login baru atau update password/status pegawai. |
| `GET` | `/hakakses/:nip` | Lihat daftar hak akses modul yang dimiliki oleh seorang pegawai. |
| `POST` | `/hakakses` | Tambah hak akses modul baru untuk pegawai tertentu. |
| `DELETE` | `/hakakses/:replid` | Cabut/Hapus hak akses berdasarkan ID (replid). |
| `PUT` | `/landlord/password` | Ganti password khusus akun Landlord/Superadmin (Jibas). |

---

## 2. Modul JBS AKAD (Akademik)
**Prefix:** `/api/jbsakad`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/siswa` | Daftar semua siswa aktif (Bisa filter `?nama=`). |
| `GET` | `/siswa/search` | Cari siswa berdasarkan No HP (Filter `?hportu=`). |
| `GET` | `/siswa/detail/:nis` | Detail lengkap siswa beserta foto Base64. |
| `POST` | `/siswa/tambah` | Tambah data siswa baru. |
| `PUT` | `/siswa/edit/:nis` | Update data siswa berdasarkan NIS. |
| `GET` | `/siswa/kelas/:idkelas`| Ambil daftar siswa dalam satu kelas tertentu. |
| `GET` | `/calonsiswa/search` | Cari calon siswa (PPDB) berdasarkan No HP. |
| `POST` | `/calonsiswa` | Tambah data calon siswa baru. |
| `PUT` | `/calonsiswa/:replid` | Update data calon siswa. |
| `DELETE` | `/calonsiswa/:replid` | Hapus/Nonaktifkan data calon siswa. |
| `GET` | `/kelas` | Daftar Kelas beserta info Wali Kelas. |
| `GET` | `/guru` | Daftar Guru aktif. |
| `POST` | `/guru` | Tambah / Set pegawai menjadi Guru Mata Pelajaran. |
| `GET` | `/jadwal/kelas/:idkelas`| Ambil jadwal pelajaran berdasarkan ID Kelas. |
| `GET` | `/pelajaran` | Master Data Mata Pelajaran (CRUD tersedia: GET, POST, PUT, DELETE). |
| `GET` | `/tahunajaran` | Master Data Tahun Ajaran (CRUD tersedia). |
| `GET` | `/semester` | Master Data Semester (CRUD tersedia). |
| `GET` | `/presensiharian` | Data presensi kehadiran harian siswa. |
| `GET` | `/presensi-pelajaran` | Data presensi siswa per mata pelajaran. |
| `GET` | `/kalender-akademik` | Info event dan kalender akademik sekolah. |
| `GET` | `/nilaiujian/:nis` | Rekapitulasi nilai ujian per siswa (NIS). |

---

## 3. Modul JBS FINA (Keuangan)
**Prefix:** `/api/jbsfina`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/tagihan/:nis` | Detail tagihan belum lunas per siswa (NIS). |
| `GET` | `/tagihan` | Cari tagihan berdasarkan nama (Filter `?nama=`). |
| `GET` | `/tagihan-all` | Ambil semua tagihan aktif secara bulk (keseluruhan). |
| `GET` | `/tagihan-calon/:nopes`| Detail tagihan calon siswa (PPDB) belum lunas. |
| `POST` | `/konfirmasi/:nis` | Konfirmasi pembayaran manual (tanpa jurnal). |
| `POST` | `/verifikasi/:id` | Verifikasi bayar inti (Otomatis potong tagihan, buat histori, & jurnal akuntansi). |
| `DELETE` | `/tagihan/:id/:nis` | Hapus tagihan utama beserta seluruh histori pembayarannya. |
| `GET` | `/antrian` | Monitoring antrian Payment Gateway. |

---

## 4. Modul JBS SDM (Kepegawaian)
**Prefix:** `/api/jbssdm`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/pegawai` | Daftar pegawai (Bisa filter `?nama=` atau `?bagian=`). |
| `GET` | `/pegawai/search` | Cari pegawai berdasarkan No HP (`?hp=`). |
| `GET` | `/pegawai/detail/:nip` | Detail lengkap biodata pegawai (termasuk foto). |
| `POST` | `/pegawai` | Tambah pegawai baru. |
| `PUT` | `/pegawai/:nip` | Update data pegawai. |
| `DELETE` | `/pegawai/:nip` | Soft-delete / nonaktifkan pegawai. |
| `GET` | `/presensi` | Log presensi pegawai (Bisa filter `?tanggal=` & `?nip=`). |
| `POST` | `/presensi` | Input manual / catat presensi pegawai. |
| `GET` | `/bagian` | Master Data Bagian Pegawai (Tersedia POST). |
| `GET` | `/jabatan` | Master Data Jabatan (Tersedia POST). |
| `GET` | `/golongan` | Master Data Golongan. |
| `GET` | `/satker` | Master Data Satuan Kerja. |
| `GET` | `/eselon` | Master Data Eselon. |
| `GET` | `/pegawai/:nip/keluarga`| Riwayat Keluarga Pegawai (Tersedia POST). |
| `GET` | `/pegawai/:nip/sekolah`| Riwayat Pendidikan Pegawai. |
| `GET` | `/pegawai/:nip/jabatan`| Riwayat Jabatan Pegawai. |

---

## 5. Modul JBS UMUM
**Prefix:** `/api/jbsumum`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/identitas` | Profil Identitas Sekolah dan Yayasan. |
| `POST` | `/identitas` | Tambah Identitas Lembaga (Tersedia PUT update). |
| `GET` | `/agama` | Master Agama (Tersedia POST, DELETE). |
| `GET` | `/suku` | Master Suku (Tersedia POST, DELETE). |
| `GET` | `/jenispekerjaan` | Master Pekerjaan (Tersedia POST, DELETE). |
| `GET` | `/tingkatpendidikan` | Master Pendidikan (Tersedia POST). |
| `GET` | `/nota` | Sistem pencarian Nota Digital (Filter NIS/NIP/Bagian/Tgl). |
| `POST` | `/nota` | Buat Nota Digital baru (Tersedia DELETE). |
| `GET` | `/bagiannota` | Master Bagian Nota. |
| `GET` | `/pengantarsurat` | Arsip Pengantar Surat (Tersedia POST). |
| `GET` | `/wilayah` | Data Pemetaan Wilayah (Tersedia POST). |
| `GET` | `/sekolah` | Data Pemetaan Sekolah. |
| `GET` | `/card` | Data Kartu (Card System). |
| `GET` | `/cardscandata` | Riwayat Scan/Tap Card (Bisa filter `?nis=` atau `?nip=`). |

---

## 6. Modul JBS PERPUS (Perpustakaan)
**Prefix:** `/api/jbsperpus`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/penulis` | Daftar Master Penulis Buku. |
| `GET` | `/penerbit` | Daftar Master Penerbit Buku. |
| `GET` | `/katalog` | Daftar Master Katalog & Rak. |
| `GET` | `/pustaka` | Daftar Data Judul Buku (Bisa filter `?judul=`). |
| `GET` | `/daftarpustaka` | Daftar Eksemplar Fisik Buku & Status Tersedia/Dipinjam. |
| `GET` | `/pinjam` | Histori & Data Peminjaman Aktif (Filter: `?status=1`, `?nis=xxx`). |
| `POST` | `/pinjam` | Input transaksi Peminjaman Buku baru. |
| `PUT` | `/kembali/:id` | Proses Pengembalian Buku (Update status peminjaman jadi Lunas/Tersedia). |

---

## 7. Modul File Sharing & Cloud Storage
**Prefix:** `/api/files`

| Method | Endpoint | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/list` | Ambil daftar berkas dan folder (Query: `?path=/` atau `?path=/Tugas`). Menampilkan nama, ukuran, modifikasi, resolusi, tipe file. |
| `POST` | `/upload` | Unggah file (multipart/form-data: `file`, `folder`). Menghasilkan `url_publik` dan `url_internal`. |
| `DELETE` | `/delete` | Hapus file atau folder dari storage (Query: `?path=/Tugas/namafile.ext`). |

---

### Catatan Penting
* Untuk melihat request/response Payload, mencoba (Try it Out), dan mengekspor ke Postman, silakan buka UI interaktif **Swagger** yang tersedia pada endpoint:
  👉 **`GET /api/docs`**