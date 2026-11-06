import { RoleTingkat } from '../types/auth';

export interface EndpointParamConfig {
  name: string;
  label: string;
  in: 'path' | 'query';
  placeholder: string;
  required?: boolean;
  defaultValue?: string;
}

export interface MutationFieldConfig {
  name: string;
  label: string;
  in: 'path' | 'body';
  type: 'text' | 'password' | 'number' | 'date' | 'textarea' | 'select';
  valueType?: 'string' | 'number';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  options?: { label: string; value: string }[];
}

export interface ErpMutationAction {
  id: string;
  label: string;
  method: 'POST' | 'PUT' | 'DELETE';
  pathTemplate: string; // relative to /api, e.g. "/jbsuser/pegawai" or "/jbsperpus/kembali/:id"
  description: string;
  fields: MutationFieldConfig[];
  destructive?: boolean;
}

export interface ErpSubView {
  id: string;
  label: string;
  pathTemplate: string; // relative to /api, e.g. "/jbsakad/siswa" or "/jbsakad/siswa/detail/:nis"
  description: string;
  renderMode?: 'table' | 'identity-cards';
  entityType?:
    | 'siswa'
    | 'pegawai'
    | 'jabatan'
    | 'hakakses'
    | 'kelas'
    | 'pinjam'
    | 'eksemplar'
    | 'pustaka'
    | 'pustaka-digital'
    | 'generic';
  params?: EndpointParamConfig[];
}

export interface ErpModuleDefinition {
  id: string;
  code: string;
  name: string;
  shortName: string;
  prefix: string;
  summary: string;
  allowedTingkat: RoleTingkat[];
  /** Daftar kode modul di user.hakakses yang memetakan akses ke menu ini (khusus Tingkat 2 Pegawai) */
  hakAksesAliases: string[];
  /** Terisi otomatis saat runtime untuk menampilkan kode hakakses yang cocok */
  matchedHakAkses?: string[];
  views: ErpSubView[];
  mutations: ErpMutationAction[];
}

export const ERP_MODULES: ErpModuleDefinition[] = [
  {
    id: 'jbsuser',
    code: '01',
    name: 'Manajemen Pengguna & Hak Akses',
    shortName: 'Pengguna & Akses',
    prefix: '/api/jbsuser',
    summary:
      'Pengelolaan akun login pegawai lintas basis data, distribusi hak akses modul per departemen, serta pengaturan kredensial Super Admin (Landlord).',
    allowedTingkat: [RoleTingkat.LANDLORD],
    hakAksesAliases: [],
    views: [
      {
        id: 'pegawai-akun',
        label: 'Akun Login Pegawai',
        pathTemplate: '/jbsuser/pegawai',
        description: 'Daftar seluruh akun login pegawai beserta status aktif dan keterangan otorisasi.',
        entityType: 'pegawai',
      },
      {
        id: 'hakakses-nip',
        label: 'Hak Akses per NIP',
        pathTemplate: '/jbsuser/hakakses/:nip',
        description: 'Daftar hak akses modul spesifik yang dimiliki oleh seorang pegawai berdasarkan NIP.',
        entityType: 'hakakses',
        params: [
          {
            name: 'nip',
            label: 'NIP Pegawai',
            in: 'path',
            placeholder: 'Contoh: 2016072022',
            required: true,
            defaultValue: '2016072022',
          },
        ],
      },
    ],
    mutations: [
      {
        id: 'upsert-pegawai-login',
        label: 'Kelola Akun Pegawai',
        method: 'POST',
        pathTemplate: '/jbsuser/pegawai',
        description: 'Buat akun login baru atau perbarui password dan status aktif pegawai.',
        fields: [
          { name: 'nip', label: 'NIP Pegawai', in: 'body', type: 'text', placeholder: 'Masukkan NIP', required: true },
          { name: 'password', label: 'Password Baru', in: 'body', type: 'password', placeholder: 'Masukkan password', required: true },
          {
            name: 'aktif',
            label: 'Status Akun',
            in: 'body',
            type: 'select',
            valueType: 'number',
            defaultValue: 1,
            options: [
              { label: 'Aktif (1)', value: '1' },
              { label: 'Nonaktif (0)', value: '0' },
            ],
          },
          { name: 'keterangan', label: 'Keterangan', in: 'body', type: 'text', placeholder: 'Catatan perubahan akun' },
        ],
      },
      {
        id: 'add-hakakses',
        label: 'Tambah Hak Akses',
        method: 'POST',
        pathTemplate: '/jbsuser/hakakses',
        description: 'Tambah hak akses baru untuk pegawai (nip, modul, tingkat).',
        fields: [
          {
            name: 'nip',
            label: 'NIP Pegawai',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: 2016072022',
            required: true,
          },
          {
            name: 'modul',
            label: 'Kode Modul',
            in: 'body',
            type: 'select',
            required: true,
            defaultValue: 'CBE',
            options: [
              { label: 'CBE — Ujian Berbasis Komputer', value: 'CBE' },
              { label: 'INFOGURU — Portal Guru & Pengajaran', value: 'INFOGURU' },
              { label: 'SIMAKA — Manajemen Akademik', value: 'SIMAKA' },
              { label: 'KEUANGAN — Keuangan & Tagihan', value: 'KEUANGAN' },
              { label: 'PERSONALIA — Kepegawaian (SDM)', value: 'PERSONALIA' },
              { label: 'SIMPEG — Kepegawaian (SDM)', value: 'SIMPEG' },
              { label: 'SIMTAKA — Perpustakaan', value: 'SIMTAKA' },
              { label: 'CARDMAKER — Sistem Kartu Pintar', value: 'CARDMAKER' },
              { label: 'EMA — Eksekutif Manajemen', value: 'EMA' },
              { label: 'JSA — Administrasi Pengguna', value: 'JSA' },
              { label: 'SMSG — Layanan Pesan & Nota', value: 'SMSG' },
            ],
          },
          {
            name: 'tingkat',
            label: 'Tingkat Akses',
            in: 'body',
            type: 'select',
            valueType: 'number',
            required: true,
            defaultValue: 2,
            options: [
              { label: '1 — Tingkat 1 (Semua Departemen)', value: '1' },
              { label: '2 — Tingkat 2 (Pegawai)', value: '2' },
            ],
          },
        ],
      },
      {
        id: 'delete-hakakses',
        label: 'Cabut Hak Akses',
        method: 'DELETE',
        pathTemplate: '/jbsuser/hakakses/:replid',
        description: 'Hapus entri hak akses modul berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Hak Akses (replid)', in: 'path', type: 'number', placeholder: 'Masukkan replid', required: true },
        ],
      },
      {
        id: 'update-landlord-pass',
        label: 'Ubah Password Landlord',
        method: 'PUT',
        pathTemplate: '/jbsuser/landlord/password',
        description: 'Perbarui password khusus akun Super Admin (Landlord / Jibas).',
        fields: [
          { name: 'password_baru', label: 'Password Baru Landlord', in: 'body', type: 'password', placeholder: 'Masukkan password baru', required: true },
        ],
      },
    ],
  },
  {
    id: 'jbsakad',
    code: '02',
    name: 'Akademik & Kesiswaan',
    shortName: 'Akademik',
    prefix: '/api/jbsakad',
    summary: '',
    allowedTingkat: [
      RoleTingkat.LANDLORD,
      RoleTingkat.PEGAWAI,
      RoleTingkat.SISWA,
      RoleTingkat.CALON_SISWA,
    ],
    hakAksesAliases: ['SIMAKA', 'INFOGURU', 'CBE', 'AKADEMIK', 'JBSAKAD', 'EMA'],
    views: [
      {
        id: 'siswa-aktif',
        label: 'Siswa Aktif',
        pathTemplate: '/jbsakad/siswa',
        description: 'Daftar siswa aktif beserta informasi kelas dan kontak orang tua. Klik baris untuk membuka biodata lengkap & foto.',
        entityType: 'siswa',
        params: [
          { name: 'nama', label: 'Filter Nama Siswa', in: 'query', placeholder: 'Ketik sebagian nama siswa...' },
        ],
      },
      {
        id: 'alumni',
        label: 'Data Alumni',
        pathTemplate: '/jbsakad/alumni',
        description:
          'Daftar alumni lulusan sekolah beserta kelas terakhir, tahun ajaran kelulusan, tanggal lulus, dan departemen. Kosongkan filter Tahun Ajaran untuk menampilkan seluruh alumni.',
        entityType: 'siswa',
        params: [
          {
            name: 'tahunajaran',
            label: 'Tahun Ajaran',
            in: 'query',
            placeholder: 'Contoh: 2025/2026 atau kosongkan semua',
          },
        ],
      },
      {
        id: 'siswa-detail',
        label: 'Detail Biodata Siswa',
        pathTemplate: '/jbsakad/siswa/detail/:nis',
        description: 'Detail biodata lengkap siswa beserta foto profil berdasarkan Nomor Induk Siswa (NIS).',
        params: [
          { name: 'nis', label: 'NIS Siswa', in: 'path', placeholder: 'Contoh: 1454', required: true, defaultValue: '1454' },
        ],
      },
      {
        id: 'siswa-search-hp',
        label: 'Cari via HP Ortu',
        pathTemplate: '/jbsakad/siswa/search',
        description: 'Pencarian cepat data siswa berdasarkan nomor handphone orang tua/wali.',
        entityType: 'siswa',
        params: [
          { name: 'hportu', label: 'No. HP Orang Tua', in: 'query', placeholder: 'Contoh: 0812', required: true, defaultValue: '08' },
        ],
      },
      {
        id: 'kelas',
        label: 'Kelas & Wali Kelas',
        pathTemplate: '/jbsakad/kelas',
        description: 'Daftar rombongan belajar (kelas) beserta informasi Wali Kelas. Klik baris untuk melihat anggota kelas dan jadwal pelajaran.',
        entityType: 'kelas',
        params: [
          { name: 'idtahunajaran', label: 'ID Tahun Ajaran', in: 'query', placeholder: 'Opsional (mis. 16)' },
        ],
      },
      {
        id: 'siswa-per-kelas',
        label: 'Siswa per Kelas',
        pathTemplate: '/jbsakad/siswa/kelas/:idkelas',
        description: 'Daftar anggota siswa yang terdaftar dalam satu kelas tertentu.',
        entityType: 'siswa',
        params: [
          { name: 'idkelas', label: 'ID Kelas', in: 'path', placeholder: 'Contoh: 201', required: true, defaultValue: '201' },
        ],
      },
      {
        id: 'jadwal-kelas',
        label: 'Jadwal Kelas',
        pathTemplate: '/jbsakad/jadwal/kelas/:idkelas',
        description: 'Susunan jadwal mata pelajaran mingguan berdasarkan ID Kelas.',
        params: [
          { name: 'idkelas', label: 'ID Kelas', in: 'path', placeholder: 'Contoh: 201', required: true, defaultValue: '201' },
        ],
      },
      {
        id: 'guru',
        label: 'Guru Pengampu',
        pathTemplate: '/jbsakad/guru',
        description: 'Daftar tenaga pendidik (guru) aktif beserta status penugasan mengajar.',
        entityType: 'pegawai',
        params: [
          {
            name: 'statusguru',
            label: 'Status Guru',
            in: 'query',
            placeholder: 'Semua Status Guru',
          },
        ],
      },
      {
        id: 'pelajaran',
        label: 'Mata Pelajaran',
        pathTemplate: '/jbsakad/pelajaran',
        description: 'Master data mata pelajaran per departemen pendidikan.',
      },
      {
        id: 'tahunajaran',
        label: 'Tahun Ajaran',
        pathTemplate: '/jbsakad/tahunajaran',
        description: 'Master periode tahun ajaran akademik beserta rentang tanggal pelaksanaan.',
      },
      {
        id: 'semester',
        label: 'Semester',
        pathTemplate: '/jbsakad/semester',
        description: 'Master data periode semester aktif dan riwayat semester per departemen.',
      },
      {
        id: 'presensi-pelajaran-nis',
        label: 'Presensi Mapel Siswa (NIS)',
        pathTemplate: '/jbsakad/presensi-pelajaran/:nis',
        description:
          'Profil riwayat kehadiran siswa per mata pelajaran berdasarkan NIS, lengkap dengan Stat Cards Auto-Rekap server dan ekspor CSV (?format=csv).',
        entityType: 'siswa',
        params: [
          {
            name: 'nis',
            label: 'NIS Siswa',
            in: 'path',
            placeholder: 'Contoh: 1779',
            required: true,
            defaultValue: '1779',
          },
        ],
      },
      {
        id: 'presensi-pelajaran',
        label: 'Presensi Mapel & Rekap Kelas',
        pathTemplate: '/jbsakad/presensi-pelajaran',
        description:
          'Presensi tatap muka mata pelajaran dengan filter kelas (?idkelas=), Auto-Rekap kehadiran dari server, dan ekspor CSV (?format=csv).',
        entityType: 'siswa',
      },
      {
        id: 'presensiharian-nis',
        label: 'Presensi Harian Siswa (NIS)',
        pathTemplate: '/jbsakad/presensiharian/:nis',
        description:
          'Profil rekapitulasi kehadiran harian siswa (Total Hadir, Sakit, Izin, Alpa, Cuti) langsung dari Auto-Rekap server berdasarkan NIS beserta ekspor CSV.',
        entityType: 'siswa',
        params: [
          {
            name: 'nis',
            label: 'NIS Siswa',
            in: 'path',
            placeholder: 'Contoh: 1779',
            required: true,
            defaultValue: '1779',
          },
        ],
      },
      {
        id: 'presensiharian',
        label: 'Presensi Harian & Rekap Kelas',
        pathTemplate: '/jbsakad/presensiharian',
        description:
          'Presensi harian per kelas (?idkelas=) atau log umum, lengkap dengan Auto-Rekap (Hadir, Izin, Sakit, Alpa, Cuti) dan ekspor CSV (?format=csv).',
        entityType: 'siswa',
      },
      {
        id: 'kalender-akademik',
        label: 'Kalender Akademik',
        pathTemplate: '/jbsakad/kalender-akademik',
        description: 'Daftar agenda kegiatan dan kalender akademik resmi sekolah.',
      },
      {
        id: 'rapor',
        label: 'Rapor & Evaluasi Kelas',
        pathTemplate: '/jbsakad/rapor',
        description:
          'Direktori seluruh siswa untuk penerbitan rapor akademik (dapat difilter per kelas ?idkelas=xxx) beserta akses langsung ke Rapor Lengkap dan CRUD Nilai Ujian.',
        entityType: 'siswa',
      },
      {
        id: 'rapor-detail',
        label: 'Rapor Lengkap Siswa (NIS)',
        pathTemplate: '/jbsakad/rapor/:nis',
        description:
          'Rapor lengkap satu siswa mencakup Identitas, Auto-Rekap Absensi, serta Agregasi Rata-rata Tertimbang dan Predikat Huruf dinamis.',
        entityType: 'siswa',
      },
      {
        id: 'rapor-nilaiujian',
        label: 'CRUD Nilai Ujian Siswa',
        pathTemplate: '/jbsakad/rapor/nilaiujian/:nis',
        description:
          'Manajemen riwayat dan input skor nilai ujian spesifik milik satu siswa (GET, POST, PUT, DELETE /api/jbsakad/rapor/nilaiujian).',
        entityType: 'siswa',
      },
      {
        id: 'calonsiswa-search',
        label: 'Calon Siswa (PPDB)',
        pathTemplate: '/jbsakad/calonsiswa/search',
        description: 'Pencarian data pendaftar Penerimaan Peserta Didik Baru (PPDB) berdasarkan nomor HP orang tua.',
        params: [
          {
            name: 'hportu',
            label: 'No. HP Orang Tua',
            in: 'query',
            placeholder: 'Contoh: 082335621999',
            required: true,
            defaultValue: '082335621999',
          },
        ],
      },
    ],
    mutations: [
      {
        id: 'tambah-siswa',
        label: 'Tambah Siswa',
        method: 'POST',
        pathTemplate: '/jbsakad/siswa/tambah',
        description: 'Registrasi data induk siswa baru ke dalam sistem akademik.',
        fields: [
          { name: 'nis', label: 'NIS', in: 'body', type: 'text', placeholder: 'Nomor Induk Siswa', required: true },
          { name: 'nama', label: 'Nama Lengkap Siswa', in: 'body', type: 'text', placeholder: 'Nama lengkap sesuai ijazah', required: true },
          { name: 'kelamin', label: 'Jenis Kelamin', in: 'body', type: 'select', defaultValue: 'l', options: [{ label: 'Laki-laki (l)', value: 'l' }, { label: 'Perempuan (p)', value: 'p' }] },
          { name: 'idkelas', label: 'ID Kelas', in: 'body', type: 'number', placeholder: 'Contoh: 201', required: true },
          { name: 'tahunmasuk', label: 'Tahun Masuk', in: 'body', type: 'number', defaultValue: 2026, required: true },
          { name: 'hportu', label: 'No. HP Orang Tua', in: 'body', type: 'text', placeholder: '0812xxxxxxxx' },
        ],
      },
      {
        id: 'edit-siswa',
        label: 'Edit Siswa',
        method: 'PUT',
        pathTemplate: '/jbsakad/siswa/edit/:nis',
        description: 'Perbarui informasi biodata siswa berdasarkan NIS.',
        fields: [
          { name: 'nis', label: 'NIS Target', in: 'path', type: 'text', placeholder: 'Contoh: 1454', required: true },
          { name: 'nama', label: 'Nama Lengkap', in: 'body', type: 'text', placeholder: 'Nama lengkap siswa', required: true },
          { name: 'hportu', label: 'No. HP Orang Tua', in: 'body', type: 'text', placeholder: '0812xxxxxxxx' },
          { name: 'emailsiswa', label: 'Email Siswa', in: 'body', type: 'text', placeholder: 'email@sekolah.sch.id' },
        ],
      },
      {
        id: 'hapus-siswa',
        label: 'Hapus Siswa',
        method: 'DELETE',
        pathTemplate: '/jbsakad/siswa/:nis',
        description: 'Hapus rekaman data induk siswa berdasarkan Nomor Induk Siswa (NIS).',
        destructive: true,
        fields: [
          { name: 'nis', label: 'NIS Siswa', in: 'path', type: 'text', placeholder: 'Contoh: 1454', required: true },
        ],
      },
      {
        id: 'tambah-guru',
        label: 'Set Guru Mapel',
        method: 'POST',
        pathTemplate: '/jbsakad/guru',
        description: 'Tetapkan pegawai sebagai guru pengampu mata pelajaran tertentu.',
        fields: [
          {
            name: 'nip',
            label: 'Nama Guru',
            in: 'body',
            type: 'select',
            placeholder: 'Pilih nama guru',
            required: true,
          },
          {
            name: 'idpelajaran',
            label: 'Mata Pelajaran',
            in: 'body',
            type: 'select',
            valueType: 'number',
            placeholder: 'Pilih mata pelajaran',
            required: true,
          },
          {
            name: 'statusguru',
            label: 'Status Guru',
            in: 'body',
            type: 'select',
            placeholder: 'Pilih status guru',
            required: true,
          },
        ],
      },
      {
        id: 'tambah-nilaiujian',
        label: 'Input Nilai Ujian',
        method: 'POST',
        pathTemplate: '/jbsakad/rapor/nilaiujian',
        description:
          'Tambah/input data nilai ujian baru ke sistem rapor (membutuhkan idujian, nis, nilaiujian, keterangan).',
        fields: [
          {
            name: 'idujian',
            label: 'ID Ujian (idujian)',
            in: 'body',
            type: 'number',
            valueType: 'number',
            placeholder: 'Contoh: 46',
            required: true,
          },
          {
            name: 'nis',
            label: 'NIS Siswa',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: 1629',
            required: true,
          },
          {
            name: 'nilaiujian',
            label: 'Skor Nilai Ujian (0 - 100)',
            in: 'body',
            type: 'number',
            valueType: 'number',
            placeholder: 'Contoh: 88.5',
            required: true,
          },
          {
            name: 'keterangan',
            label: 'Keterangan',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: Tuntas KKM',
          },
        ],
      },
      {
        id: 'edit-nilaiujian',
        label: 'Edit Nilai Ujian',
        method: 'PUT',
        pathTemplate: '/jbsakad/rapor/nilaiujian/:replid',
        description:
          'Ubah skor dan keterangan nilai ujian siswa yang sudah tercatat berdasarkan ID (replid).',
        fields: [
          {
            name: 'replid',
            label: 'ID Nilai Ujian (replid)',
            in: 'path',
            type: 'number',
            valueType: 'number',
            placeholder: 'Contoh: 386',
            required: true,
          },
          {
            name: 'nilaiujian',
            label: 'Skor Nilai Baru (0 - 100)',
            in: 'body',
            type: 'number',
            valueType: 'number',
            placeholder: 'Contoh: 90',
            required: true,
          },
          {
            name: 'keterangan',
            label: 'Keterangan',
            in: 'body',
            type: 'text',
            placeholder: 'Catatan perubahan skor',
          },
        ],
      },
      {
        id: 'hapus-nilaiujian',
        label: 'Hapus Nilai Ujian',
        method: 'DELETE',
        pathTemplate: '/jbsakad/rapor/nilaiujian/:replid',
        description:
          'Hapus rekaman data nilai ujian siswa jika terjadi kesalahan input berdasarkan ID (replid).',
        destructive: true,
        fields: [
          {
            name: 'replid',
            label: 'ID Nilai Ujian (replid)',
            in: 'path',
            type: 'number',
            valueType: 'number',
            placeholder: 'Contoh: 386',
            required: true,
          },
        ],
      },
      {
        id: 'tambah-calonsiswa',
        label: 'Daftar Calon Siswa',
        method: 'POST',
        pathTemplate: '/jbsakad/calonsiswa',
        description: 'Tambahkan data pendaftar baru pada gelombang PPDB.',
        fields: [
          { name: 'nopendaftaran', label: 'No. Pendaftaran', in: 'body', type: 'text', placeholder: 'PPDB-2026-001', required: true },
          { name: 'nama', label: 'Nama Calon Siswa', in: 'body', type: 'text', placeholder: 'Nama lengkap calon siswa', required: true },
          { name: 'kelamin', label: 'Jenis Kelamin', in: 'body', type: 'select', defaultValue: 'l', options: [{ label: 'Laki-laki (l)', value: 'l' }, { label: 'Perempuan (p)', value: 'p' }] },
          { name: 'hportu', label: 'No. HP Orang Tua', in: 'body', type: 'text', placeholder: '0812xxxxxxxx' },
        ],
      },
    ],
  },
  {
    id: 'jbsfina',
    code: '03',
    name: 'Keuangan & Pembayaran',
    shortName: 'Keuangan',
    prefix: '/api/jbsfina',
    summary:
      'Pemantauan piutang dan tagihan siswa maupun calon siswa PPDB, konfirmasi pembayaran manual, verifikasi transaksi otomatis berjurnal, serta antrian payment gateway.',
    allowedTingkat: [
      RoleTingkat.LANDLORD,
      RoleTingkat.PEGAWAI,
      RoleTingkat.SISWA,
      RoleTingkat.CALON_SISWA,
    ],
    hakAksesAliases: ['KEUANGAN', 'JBSFINA', 'FINA', 'FINANCE', 'EMA'],
    views: [
      {
        id: 'tagihan-belum-lunas',
        label: 'Tagihan Belum Lunas',
        pathTemplate: '/jbsfina/tagihan',
        description: 'Daftar rincian kewajiban pembayaran siswa yang masih memiliki sisa tagihan aktif.',
        entityType: 'siswa',
        params: [
          { name: 'nama', label: 'Filter Nama Siswa', in: 'query', placeholder: 'Cari nama siswa...' },
        ],
      },
      {
        id: 'tagihan-all',
        label: 'Seluruh Tagihan (Bulk)',
        pathTemplate: '/jbsfina/tagihan-all',
        description: 'Rekapitulasi menyeluruh seluruh tagihan aktif beserta nominal terbayar dan sisa kewajiban.',
      },
      {
        id: 'tagihan-per-nis',
        label: 'Tagihan per Siswa (NIS)',
        pathTemplate: '/jbsfina/tagihan/:nis',
        description: 'Rincian tunggakan tagihan spesifik berdasarkan Nomor Induk Siswa (NIS).',
        params: [
          { name: 'nis', label: 'NIS Siswa', in: 'path', placeholder: 'Contoh: 1454', required: true, defaultValue: '1454' },
        ],
      },
      {
        id: 'tagihan-calon',
        label: 'Tagihan Calon Siswa',
        pathTemplate: '/jbsfina/tagihan-calon/:nopes',
        description: 'Rincian tagihan biaya masuk PPDB berdasarkan Nomor Pendaftaran calon siswa.',
        params: [
          { name: 'nopes', label: 'No. Peserta / Pendaftaran', in: 'path', placeholder: 'Contoh: ppdb230070', required: true, defaultValue: 'ppdb230070' },
        ],
      },
      {
        id: 'antrian-pg',
        label: 'Antrian Payment Gateway',
        pathTemplate: '/jbsfina/antrian',
        description: 'Pemantauan antrian sinkronisasi pembayaran daring (Payment Gateway).',
      },
    ],
    mutations: [
      {
        id: 'konfirmasi-bayar',
        label: 'Konfirmasi Pembayaran',
        method: 'POST',
        pathTemplate: '/jbsfina/konfirmasi/:nis',
        description: 'Catat konfirmasi penerimaan pembayaran manual untuk siswa tertentu.',
        fields: [
          { name: 'nis', label: 'NIS Siswa', in: 'path', type: 'text', placeholder: 'Contoh: 1454', required: true },
          { name: 'id_tagihan', label: 'ID Tagihan (replid)', in: 'body', type: 'number', placeholder: 'Masukkan replid tagihan', required: true },
          { name: 'jumlah_bayar', label: 'Nominal Pembayaran (Rp)', in: 'body', type: 'number', placeholder: 'Contoh: 500000', required: true },
          { name: 'keterangan', label: 'Keterangan Pembayaran', in: 'body', type: 'text', placeholder: 'Setoran tunai loket keuangan' },
        ],
      },
      {
        id: 'verifikasi-bayar',
        label: 'Verifikasi & Jurnal',
        method: 'POST',
        pathTemplate: '/jbsfina/verifikasi/:id',
        description: 'Verifikasi pembayaran inti: otomatis memotong sisa tagihan, mencatat histori, dan membentuk jurnal akuntansi.',
        fields: [
          { name: 'id', label: 'ID Konfirmasi Pembayaran', in: 'path', type: 'number', placeholder: 'Masukkan ID transaksi', required: true },
        ],
      },
      {
        id: 'hapus-tagihan',
        label: 'Hapus Tagihan',
        method: 'DELETE',
        pathTemplate: '/jbsfina/tagihan/:id/:nis',
        description: 'Hapus data tagihan utama beserta seluruh riwayat pembayarannya.',
        destructive: true,
        fields: [
          { name: 'id', label: 'ID Tagihan (replid)', in: 'path', type: 'number', placeholder: 'ID tagihan', required: true },
          { name: 'nis', label: 'NIS Siswa', in: 'path', type: 'text', placeholder: 'NIS pemilik tagihan', required: true },
        ],
      },
    ],
  },
  {
    id: 'jbssdm',
    code: '04',
    name: 'Kepegawaian (SDM)',
    shortName: 'Kepegawaian SDM',
    prefix: '/api/jbssdm',
    summary:
      'Direktori induk pendidik & tenaga kependidikan, log presensi harian pegawai, struktur bagian, jabatan, golongan, satuan kerja, eselon, serta riwayat kepegawaian.',
    allowedTingkat: [RoleTingkat.LANDLORD, RoleTingkat.PEGAWAI],
    hakAksesAliases: ['PERSONALIA', 'SIMPEG', 'KEPEGAWAIAN', 'SDM', 'JBSSDM', 'EMA'],
    views: [
      {
        id: 'pegawai-daftar',
        label: 'Direktori Pegawai',
        pathTemplate: '/jbssdm/pegawai',
        description:
          'Daftar SDM sekolah berstatus aktif (aktif=1) beserta informasi jabatan aktif. Gunakan filter NIP, Nama, atau Bagian.',
        entityType: 'pegawai',
        params: [
          {
            name: 'nip',
            label: 'Filter NIP',
            in: 'query',
            placeholder: 'Contoh: 2001072003',
          },
          {
            name: 'nama',
            label: 'Filter Nama',
            in: 'query',
            placeholder: 'Cari nama pegawai aktif...',
          },
          {
            name: 'bagian',
            label: 'Bagian',
            in: 'query',
            placeholder: 'Contoh: Akademik / Non Akademik',
          },
        ],
      },
      {
        id: 'riwayat-jabatan',
        label: 'Kelola Jabatan Pegawai',
        pathTemplate: '/jbssdm/pegawai/:nip/jabatan',
        description:
          'Dashboard CRUD riwayat & SK penugasan jabatan pegawai berdasarkan NIP dengan dialog popup (GET, POST, PUT, DELETE /api/jbssdm/pegawai/:nip/jabatan).',
        params: [
          {
            name: 'nip',
            label: 'NIP Pegawai',
            in: 'path',
            placeholder: 'Contoh: 2001072003',
            required: true,
            defaultValue: '2001072003',
          },
        ],
      },
      {
        id: 'pegawai-jabatan-nip',
        label: 'Jabatan Pegawai (NIP)',
        pathTemplate: '/jbssdm/pegawai',
        description:
          'Menampilkan data pegawai beserta atribut jabatan aktif berdasarkan parameter query NIP (GET /api/jbssdm/pegawai?nip=...).',
        entityType: 'pegawai',
        params: [
          {
            name: 'nip',
            label: 'NIP Pegawai',
            in: 'query',
            placeholder: 'Contoh: 2001072003',
            required: true,
            defaultValue: '2001072003',
          },
        ],
      },
      {
        id: 'pegawai-detail',
        label: 'Biodata Pegawai (NIP)',
        pathTemplate: '/jbssdm/pegawai/detail/:nip',
        description: 'Profil biodata terperinci pegawai berdasarkan Nomor Induk Pegawai (NIP).',
        params: [
          { name: 'nip', label: 'NIP Pegawai', in: 'path', placeholder: 'Contoh: 2001072003', required: true, defaultValue: '2001072003' },
        ],
      },
      {
        id: 'pegawai-search-hp',
        label: 'Cari Pegawai via HP',
        pathTemplate: '/jbssdm/pegawai/search',
        description: 'Pencarian cepat pegawai berdasarkan nomor telepon seluler.',
        entityType: 'pegawai',
        params: [
          { name: 'hp', label: 'Nomor Handphone', in: 'query', placeholder: 'Contoh: 08', required: true, defaultValue: '08' },
        ],
      },
      {
        id: 'presensi-sdm',
        label: 'Log Presensi Pegawai',
        pathTemplate: '/jbssdm/presensi',
        description: 'Rekaman kehadiran masuk/pulang harian pegawai beserta kalkulasi durasi jam kerja.',
        entityType: 'pegawai',
        params: [
          { name: 'tanggal', label: 'Tanggal (YYYY-MM-DD)', in: 'query', placeholder: 'Contoh: 2026-10-30' },
          { name: 'nip', label: 'Filter NIP', in: 'query', placeholder: 'Masukkan NIP pegawai' },
        ],
      },
      {
        id: 'bagian-sdm',
        label: 'Master Bagian',
        pathTemplate: '/jbssdm/bagian',
        description: 'Klasifikasi bagian kepegawaian (Akademik / Non Akademik).',
      },
      {
        id: 'jabatan-sdm',
        label: 'Master Jabatan',
        pathTemplate: '/jbssdm/jabatan',
        description:
          'Struktur jabatan struktural dan fungsional sekolah. Klik baris untuk melihat detail jabatan, atau gunakan tombol Ubah dan Hapus.',
        entityType: 'jabatan',
      },
      {
        id: 'jabatan-detail-sdm',
        label: 'Detail Jabatan (ID)',
        pathTemplate: '/jbssdm/jabatan/:replid',
        description:
          'Melihat detail lengkap satu jabatan berdasarkan ID jabatan (GET /api/jbssdm/jabatan/:replid).',
        entityType: 'jabatan',
        params: [
          {
            name: 'replid',
            label: 'ID Jabatan (replid)',
            in: 'path',
            placeholder: 'Contoh: 28',
            required: true,
            defaultValue: '28',
          },
        ],
      },
      {
        id: 'golongan-sdm',
        label: 'Master Golongan',
        pathTemplate: '/jbssdm/golongan',
        description: 'Daftar kepangkatan dan golongan ruang kepegawaian.',
      },
      {
        id: 'satker-sdm',
        label: 'Satuan Kerja',
        pathTemplate: '/jbssdm/satker',
        description: 'Master unit / satuan kerja organisasi lembaga.',
      },
      {
        id: 'eselon-sdm',
        label: 'Master Eselon',
        pathTemplate: '/jbssdm/eselon',
        description: 'Tingkatan eselon jabatan struktural.',
      },
      {
        id: 'riwayat-keluarga',
        label: 'Riwayat Keluarga',
        pathTemplate: '/jbssdm/pegawai/:nip/keluarga',
        description: 'Data anggota keluarga pegawai berdasarkan NIP.',
        params: [
          { name: 'nip', label: 'NIP Pegawai', in: 'path', placeholder: 'Contoh: 2016072022', required: true, defaultValue: '2016072022' },
        ],
      },
      {
        id: 'riwayat-sekolah',
        label: 'Riwayat Pendidikan',
        pathTemplate: '/jbssdm/pegawai/:nip/sekolah',
        description: 'Riwayat jenjang pendidikan formal pegawai berdasarkan NIP.',
        params: [
          { name: 'nip', label: 'NIP Pegawai', in: 'path', placeholder: 'Contoh: 2016072022', required: true, defaultValue: '2016072022' },
        ],
      },
    ],
    mutations: [
      {
        id: 'tambah-pegawai',
        label: 'Tambah Pegawai',
        method: 'POST',
        pathTemplate: '/jbssdm/pegawai',
        description: 'Tambahkan biodata pegawai atau pendidik baru ke dalam basis data SDM.',
        fields: [
          { name: 'nip', label: 'NIP Pegawai', in: 'body', type: 'text', placeholder: 'Nomor Induk Pegawai', required: true },
          { name: 'nama', label: 'Nama Lengkap', in: 'body', type: 'text', placeholder: 'Nama lengkap beserta gelar', required: true },
          {
            name: 'bagian',
            label: 'Bagian',
            in: 'body',
            type: 'select',
            defaultValue: 'Akademik',
            options: [
              { label: 'Akademik', value: 'Akademik' },
              { label: 'Non Akademik', value: 'Non Akademik' },
            ],
          },
          {
            name: 'kelamin',
            label: 'Jenis Kelamin',
            in: 'body',
            type: 'select',
            defaultValue: 'l',
            options: [
              { label: 'Laki-laki (l)', value: 'l' },
              { label: 'Perempuan (p)', value: 'p' },
            ],
          },
          {
            name: 'nikah',
            label: 'Status Pernikahan',
            in: 'body',
            type: 'select',
            defaultValue: 'menikah',
            options: [
              { label: 'Menikah', value: 'menikah' },
              { label: 'Belum Menikah', value: 'belum' },
            ],
          },
        ],
      },
      {
        id: 'catat-presensi-sdm',
        label: 'Input Presensi Manual',
        method: 'POST',
        pathTemplate: '/jbssdm/presensi',
        description: 'Catat kehadiran masuk dan pulang pegawai secara manual.',
        fields: [
          { name: 'nip', label: 'NIP Pegawai', in: 'body', type: 'text', placeholder: 'Contoh: 2024051041', required: true },
          {
            name: 'status',
            label: 'Status Kehadiran',
            in: 'body',
            type: 'select',
            defaultValue: '1',
            options: [
              { label: '1 - Hadir', value: '1' },
              { label: '2 - Izin', value: '2' },
              { label: '3 - Sakit', value: '3' },
              { label: '4 - Dinas Luar', value: '4' },
            ],
          },
          { name: 'jammasuk', label: 'Jam Masuk (HH:MM:SS)', in: 'body', type: 'text', defaultValue: '07:15:00', required: true },
          { name: 'jampulang', label: 'Jam Pulang (HH:MM:SS)', in: 'body', type: 'text', defaultValue: '15:30:00', required: true },
          { name: 'keterangan', label: 'Keterangan', in: 'body', type: 'text', placeholder: 'Catatan kehadiran' },
        ],
      },
      {
        id: 'update-pegawai',
        label: 'Update Pegawai',
        method: 'PUT',
        pathTemplate: '/jbssdm/pegawai/:nip',
        description: 'Perbarui data biodata kepegawaian berdasarkan NIP.',
        fields: [
          { name: 'nip', label: 'NIP Target', in: 'path', type: 'text', placeholder: 'Contoh: 2024051041', required: true },
          { name: 'nama', label: 'Nama Lengkap', in: 'body', type: 'text', placeholder: 'Nama lengkap pegawai', required: true },
          { name: 'handphone', label: 'No. Handphone', in: 'body', type: 'text', placeholder: '0812xxxxxxxx' },
          { name: 'email', label: 'Alamat Email', in: 'body', type: 'text', placeholder: 'nama@sekolah.sch.id' },
        ],
      },
      {
        id: 'nonaktif-pegawai',
        label: 'Nonaktifkan Pegawai',
        method: 'DELETE',
        pathTemplate: '/jbssdm/pegawai/:nip',
        description: 'Nonaktifkan (soft-delete) status pegawai dari daftar aktif.',
        destructive: true,
        fields: [
          { name: 'nip', label: 'NIP Pegawai', in: 'path', type: 'text', placeholder: 'Masukkan NIP', required: true },
        ],
      },
      {
        id: 'tambah-jabatan',
        label: 'Tambah Jabatan',
        method: 'POST',
        pathTemplate: '/jbssdm/jabatan',
        description: 'Tambahkan struktur master jabatan baru ke dalam sistem kepegawaian.',
        fields: [
          {
            name: 'jabatan',
            label: 'Nama Jabatan',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: Koordinator Laboratorium',
            required: true,
          },
          {
            name: 'singkatan',
            label: 'Singkatan Jabatan',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: KOOR.LAB',
            required: true,
          },
          {
            name: 'satker',
            label: 'Satuan Kerja (Satker)',
            in: 'body',
            type: 'select',
            defaultValue: 'MANAJEMEN',
            options: [
              { label: 'MANAJEMEN — Manajemen Sekolah', value: 'MANAJEMEN' },
              { label: 'GURU — Pengajar', value: 'GURU' },
              { label: 'TATA USAHA — Tata Usaha Sekolah', value: 'TATA USAHA' },
              { label: 'YAYASAN — Pengurus Yayasan', value: 'YAYASAN' },
              { label: 'KOPERASI — Koperasi', value: 'KOPERASI' },
              { label: '(Tidak Ada)', value: '(Tidak Ada)' },
            ],
          },
          {
            name: 'eselon',
            label: 'Eselon',
            in: 'body',
            type: 'select',
            defaultValue: '(Tidak Ada)',
            options: [
              { label: '(Tidak Ada)', value: '(Tidak Ada)' },
              { label: 'Eselon I', value: 'Eselon I' },
              { label: 'Eselon II', value: 'Eselon II' },
              { label: 'Eselon III', value: 'Eselon III' },
              { label: 'Eselon IV', value: 'Eselon IV' },
            ],
          },
          {
            name: 'rootid',
            label: 'ID Jabatan Induk (rootid)',
            in: 'body',
            type: 'number',
            defaultValue: 27,
            placeholder: 'Contoh: 27 (Pengurus Sekolah)',
          },
        ],
      },
      {
        id: 'update-jabatan',
        label: 'Ubah Jabatan',
        method: 'PUT',
        pathTemplate: '/jbssdm/jabatan/:replid',
        description:
          'Perbarui nama jabatan, singkatan, satuan kerja, eselon, atau induk organisasi berdasarkan ID jabatan (replid).',
        fields: [
          {
            name: 'replid',
            label: 'ID Jabatan (replid)',
            in: 'path',
            type: 'number',
            placeholder: 'Contoh: 28',
            required: true,
          },
          {
            name: 'jabatan',
            label: 'Nama Jabatan',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: Kepala Sekolah',
            required: true,
          },
          {
            name: 'singkatan',
            label: 'Singkatan Jabatan',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: KEPSEK',
            required: true,
          },
          {
            name: 'satker',
            label: 'Satuan Kerja (Satker)',
            in: 'body',
            type: 'select',
            defaultValue: 'MANAJEMEN',
            options: [
              { label: 'MANAJEMEN — Manajemen Sekolah', value: 'MANAJEMEN' },
              { label: 'GURU — Pengajar', value: 'GURU' },
              { label: 'TATA USAHA — Tata Usaha Sekolah', value: 'TATA USAHA' },
              { label: 'YAYASAN — Pengurus Yayasan', value: 'YAYASAN' },
              { label: 'KOPERASI — Koperasi', value: 'KOPERASI' },
              { label: '(Tidak Ada)', value: '(Tidak Ada)' },
            ],
          },
          {
            name: 'eselon',
            label: 'Eselon',
            in: 'body',
            type: 'select',
            defaultValue: '(Tidak Ada)',
            options: [
              { label: '(Tidak Ada)', value: '(Tidak Ada)' },
              { label: 'Eselon I', value: 'Eselon I' },
              { label: 'Eselon II', value: 'Eselon II' },
              { label: 'Eselon III', value: 'Eselon III' },
              { label: 'Eselon IV', value: 'Eselon IV' },
            ],
          },
          {
            name: 'rootid',
            label: 'ID Jabatan Induk (rootid)',
            in: 'body',
            type: 'number',
            placeholder: 'Opsional (contoh: 27)',
          },
        ],
      },
      {
        id: 'hapus-jabatan',
        label: 'Hapus Jabatan',
        method: 'DELETE',
        pathTemplate: '/jbssdm/jabatan/:replid',
        description:
          'Hapus data master jabatan berdasarkan ID (replid). Apabila jabatan masih dipakai oleh pegawai, penghapusan akan ditolak dengan pesan peringatan.',
        destructive: true,
        fields: [
          {
            name: 'replid',
            label: 'ID Jabatan (replid)',
            in: 'path',
            type: 'number',
            placeholder: 'Contoh: 35',
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: 'jbsumum',
    code: '05',
    name: 'Administrasi Umum & Kartu',
    shortName: 'Administrasi Umum',
    prefix: '/api/jbsumum',
    summary:
      'Pengelolaan profil identitas lembaga/sekolah, referensi master data umum (agama, suku, pekerjaan, pendidikan), sistem nota digital, pengarsipan surat, pemetaan wilayah & sekolah, serta sistem kartu pintar & tap scan.',
    allowedTingkat: [RoleTingkat.LANDLORD, RoleTingkat.PEGAWAI, RoleTingkat.SISWA],
    hakAksesAliases: ['CARDMAKER', 'SMSG', 'TGRAM', 'EGW', 'UMUM', 'JBSUMUM', 'EMA'],
    views: [
      // 1. Identitas Sekolah / Lembaga
      {
        id: 'identitas',
        label: 'Identitas Sekolah',
        pathTemplate: '/jbsumum/identitas',
        description:
          'Ambil daftar seluruh profil identitas resmi yayasan dan masing-masing unit sekolah beserta logo lembaga.',
        renderMode: 'identity-cards',
      },
      {
        id: 'identitas-detail',
        label: 'Detail Identitas (:replid)',
        pathTemplate: '/jbsumum/identitas/:replid',
        description:
          'Ambil rincian detail satu profil identitas sekolah atau lembaga berdasarkan ID (replid).',
        params: [
          {
            name: 'replid',
            label: 'ID Identitas (replid)',
            in: 'path',
            placeholder: 'Contoh: 9',
            required: true,
            defaultValue: '9',
          },
        ],
      },
      // 2. Master Data Umum
      {
        id: 'master-agama',
        label: 'Master Agama',
        pathTemplate: '/jbsumum/agama',
        description: 'Daftar referensi data pokok agama beserta nomor urutan tampil.',
      },
      {
        id: 'master-suku',
        label: 'Master Suku',
        pathTemplate: '/jbsumum/suku',
        description: 'Daftar referensi data pokok suku bangsa.',
      },
      {
        id: 'master-pekerjaan',
        label: 'Jenis Pekerjaan',
        pathTemplate: '/jbsumum/jenispekerjaan',
        description: 'Daftar referensi data pokok jenis pekerjaan orang tua / wali.',
      },
      {
        id: 'master-pendidikan',
        label: 'Tingkat Pendidikan',
        pathTemplate: '/jbsumum/tingkatpendidikan',
        description: 'Daftar referensi data pokok jenjang / tingkat pendidikan.',
      },
      // 3. Sistem Nota Digital
      {
        id: 'bagian-nota',
        label: 'Bagian Nota',
        pathTemplate: '/jbsumum/bagiannota',
        description: 'Daftar master kategori / bagian tujuan pada sistem nota digital.',
      },
      {
        id: 'nota-digital',
        label: 'Data Nota',
        pathTemplate: '/jbsumum/nota',
        description:
          'Daftar pencatatan nota digital internal (mendukung filter NIS, NIP, Bagian, dan Tanggal).',
        params: [
          { name: 'bagian', label: 'Filter Bagian', in: 'query', placeholder: 'Semua Bagian' },
          { name: 'nis', label: 'Filter NIS', in: 'query', placeholder: 'Opsional (mis. 1779)' },
          { name: 'nip', label: 'Filter NIP', in: 'query', placeholder: 'Opsional (mis. 2016072022)' },
          { name: 'tanggal', label: 'Filter Tanggal', in: 'query', placeholder: 'YYYY-MM-DD' },
        ],
      },
      // 4. Pengarsipan Surat
      {
        id: 'lampiran-surat',
        label: 'Lampiran Surat',
        pathTemplate: '/jbsumum/lampiransurat',
        description: 'Daftar arsip dokumen lampiran surat resmi per departemen.',
      },
      // 5. Pemetaan Wilayah & Sekolah
      {
        id: 'pemetaan-wilayah',
        label: 'Data Wilayah',
        pathTemplate: '/jbsumum/wilayah',
        description: 'Daftar pemetaan wilayah lokasi domisili dan sebaran sekolah.',
      },
      {
        id: 'pemetaan-sekolah',
        label: 'Data Sekolah',
        pathTemplate: '/jbsumum/sekolah',
        description: 'Daftar referensi sekolah asal / jejaring sekolah beserta wilayahnya.',
      },
      // 6. Sistem Kartu (Card & Tap Scan)
      {
        id: 'sistem-kartu',
        label: 'Master Kartu',
        pathTemplate: '/jbsumum/card',
        description: 'Daftar master templat dan konfigurasi kartu identitas siswa / pegawai.',
      },
      {
        id: 'aktifitas-kartu',
        label: 'Aktifitas Kartu',
        pathTemplate: '/jbsumum/cardaktifitas',
        description: 'Daftar kegiatan / aktifitas yang terhubung pada sistem kartu.',
      },
      {
        id: 'riwayat-scan-kartu',
        label: 'Riwayat Scan / Tap',
        pathTemplate: '/jbsumum/cardscandata',
        description:
          'Histori pembacaan / tap kartu siswa maupun pegawai (Read Only — dapat difilter menggunakan NIS atau NIP).',
        params: [
          { name: 'nis', label: 'Filter NIS', in: 'query', placeholder: 'Opsional' },
          { name: 'nip', label: 'Filter NIP', in: 'query', placeholder: 'Opsional' },
        ],
      },
      // 7. File Sharing & Cloud Storage
      {
        id: 'files-cloud-list',
        label: 'File Sharing Cloud (/api/files/list)',
        pathTemplate: '/files/list',
        description:
          'Daftar berkas bersama, dokumen, dan direktori pada Cloud Storage Hidis (/api/files/list).',
        params: [
          {
            name: 'path',
            label: 'Path Folder Target',
            in: 'query',
            placeholder: 'Contoh: / atau /Tugas atau /GURU DIKNAS',
            defaultValue: '/',
          },
        ],
      },
    ],
    mutations: [
      // 1. Identitas Sekolah / Lembaga
      {
        id: 'tambah-identitas',
        label: 'Tambah Identitas',
        method: 'POST',
        pathTemplate: '/jbsumum/identitas',
        description: 'Tambahkan profil identitas sekolah, unit departemen, atau yayasan baru.',
        fields: [
          { name: 'nama', label: 'Nama Sekolah / Lembaga', in: 'body', type: 'text', placeholder: 'Contoh: SDI Hidayatul Islamiyah', required: true },
          { name: 'departemen', label: 'Kode Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah / yayasan' },
          { name: 'situs', label: 'Situs Web', in: 'body', type: 'text', placeholder: 'www.sekolah.sch.id' },
          { name: 'email', label: 'Alamat Email', in: 'body', type: 'text', placeholder: 'info@sekolah.sch.id' },
          { name: 'alamat1', label: 'Alamat Utama (Baris 1)', in: 'body', type: 'textarea', placeholder: 'Jalan, RT/RW, Kelurahan, Kecamatan, Kota' },
          { name: 'alamat2', label: 'Alamat Tambahan (Baris 2)', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'telp1', label: 'Telepon 1', in: 'body', type: 'text', placeholder: '(021) 8440279' },
          { name: 'telp2', label: 'Telepon 2', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'fax1', label: 'Nomor Fax', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'keterangan', label: 'Keterangan', in: 'body', type: 'text', placeholder: 'Catatan unit lembaga' },
        ],
      },
      {
        id: 'ubah-identitas',
        label: 'Update Identitas',
        method: 'PUT',
        pathTemplate: '/jbsumum/identitas/:replid',
        description: 'Perbarui data profil identitas sekolah atau lembaga berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Identitas (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 9', required: true },
          { name: 'nama', label: 'Nama Sekolah / Lembaga', in: 'body', type: 'text', placeholder: 'Nama resmi lembaga', required: true },
          { name: 'departemen', label: 'Kode Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah' },
          { name: 'situs', label: 'Situs Web', in: 'body', type: 'text', placeholder: 'www.sekolah.sch.id' },
          { name: 'email', label: 'Alamat Email', in: 'body', type: 'text', placeholder: 'info@sekolah.sch.id' },
          { name: 'alamat1', label: 'Alamat Utama (Baris 1)', in: 'body', type: 'textarea', placeholder: 'Alamat lengkap lembaga' },
          { name: 'alamat2', label: 'Alamat Tambahan (Baris 2)', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'telp1', label: 'Telepon 1', in: 'body', type: 'text', placeholder: '(021) 8440279' },
          { name: 'telp2', label: 'Telepon 2', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'fax1', label: 'Nomor Fax', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'keterangan', label: 'Keterangan', in: 'body', type: 'text', placeholder: 'Opsional' },
        ],
      },
      {
        id: 'hapus-identitas',
        label: 'Hapus Identitas',
        method: 'DELETE',
        pathTemplate: '/jbsumum/identitas/:replid',
        description: 'Hapus data identitas sekolah atau lembaga berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Identitas (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 10', required: true },
        ],
      },

      // 2A. Master Data Umum — Agama
      {
        id: 'tambah-agama',
        label: 'Tambah Agama',
        method: 'POST',
        pathTemplate: '/jbsumum/agama',
        description: 'Tambahkan referensi master agama baru.',
        fields: [
          { name: 'agama', label: 'Nama Agama', in: 'body', type: 'text', placeholder: 'Contoh: Konghucu', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', defaultValue: 6, placeholder: 'Contoh: 6' },
        ],
      },
      {
        id: 'ubah-agama',
        label: 'Update Agama',
        method: 'PUT',
        pathTemplate: '/jbsumum/agama/:nama',
        description: 'Perbarui data referensi agama (parameter path berupa nama agama lama).',
        fields: [
          { name: 'nama', label: 'Nama Agama Lama (Target URL)', in: 'path', type: 'text', placeholder: 'Contoh: Budha', required: true },
          { name: 'agama', label: 'Nama Agama Baru', in: 'body', type: 'text', placeholder: 'Contoh: Buddha', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', placeholder: 'Contoh: 5' },
        ],
      },
      {
        id: 'hapus-agama',
        label: 'Hapus Agama',
        method: 'DELETE',
        pathTemplate: '/jbsumum/agama/:nama',
        description: 'Hapus referensi master agama berdasarkan nama agama.',
        destructive: true,
        fields: [
          { name: 'nama', label: 'Nama Agama', in: 'path', type: 'text', placeholder: 'Masukkan nama agama', required: true },
        ],
      },

      // 2B. Master Data Umum — Suku
      {
        id: 'tambah-suku',
        label: 'Tambah Suku',
        method: 'POST',
        pathTemplate: '/jbsumum/suku',
        description: 'Tambahkan referensi master suku baru.',
        fields: [
          { name: 'suku', label: 'Nama Suku', in: 'body', type: 'text', placeholder: 'Contoh: Betawi', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', defaultValue: 1, placeholder: 'Contoh: 1' },
        ],
      },
      {
        id: 'ubah-suku',
        label: 'Update Suku',
        method: 'PUT',
        pathTemplate: '/jbsumum/suku/:nama',
        description: 'Perbarui data referensi suku berdasarkan nama suku lama.',
        fields: [
          { name: 'nama', label: 'Nama Suku Lama (Target URL)', in: 'path', type: 'text', placeholder: 'Contoh: LAMPUNG', required: true },
          { name: 'suku', label: 'Nama Suku Baru', in: 'body', type: 'text', placeholder: 'Contoh: Lampung', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', placeholder: 'Opsional' },
        ],
      },
      {
        id: 'hapus-suku',
        label: 'Hapus Suku',
        method: 'DELETE',
        pathTemplate: '/jbsumum/suku/:nama',
        description: 'Hapus referensi master suku berdasarkan nama suku.',
        destructive: true,
        fields: [
          { name: 'nama', label: 'Nama Suku', in: 'path', type: 'text', placeholder: 'Masukkan nama suku', required: true },
        ],
      },

      // 2C. Master Data Umum — Jenis Pekerjaan
      {
        id: 'tambah-pekerjaan',
        label: 'Tambah Pekerjaan',
        method: 'POST',
        pathTemplate: '/jbsumum/jenispekerjaan',
        description: 'Tambahkan referensi jenis pekerjaan baru.',
        fields: [
          { name: 'pekerjaan', label: 'Nama Jenis Pekerjaan', in: 'body', type: 'text', placeholder: 'Contoh: Dokter / Tenaga Medis', required: true },
        ],
      },
      {
        id: 'ubah-pekerjaan',
        label: 'Update Pekerjaan',
        method: 'PUT',
        pathTemplate: '/jbsumum/jenispekerjaan/:pekerjaan_lama',
        description: 'Perbarui nama jenis pekerjaan berdasarkan nama pekerjaan lama.',
        fields: [
          { name: 'pekerjaan_lama', label: 'Nama Pekerjaan Lama (Target URL)', in: 'path', type: 'text', placeholder: 'Contoh: Wiraswasta', required: true },
          { name: 'pekerjaan', label: 'Nama Pekerjaan Baru', in: 'body', type: 'text', placeholder: 'Masukkan nama pekerjaan baru', required: true },
        ],
      },
      {
        id: 'hapus-pekerjaan',
        label: 'Hapus Pekerjaan',
        method: 'DELETE',
        pathTemplate: '/jbsumum/jenispekerjaan/:pekerjaan',
        description: 'Hapus referensi jenis pekerjaan berdasarkan nama pekerjaan.',
        destructive: true,
        fields: [
          { name: 'pekerjaan', label: 'Nama Pekerjaan', in: 'path', type: 'text', placeholder: 'Masukkan nama pekerjaan', required: true },
        ],
      },

      // 2D. Master Data Umum — Tingkat Pendidikan
      {
        id: 'tambah-pendidikan',
        label: 'Tambah Pendidikan',
        method: 'POST',
        pathTemplate: '/jbsumum/tingkatpendidikan',
        description: 'Tambahkan referensi jenjang / tingkat pendidikan baru.',
        fields: [
          { name: 'pendidikan', label: 'Tingkat Pendidikan', in: 'body', type: 'text', placeholder: 'Contoh: D4', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', defaultValue: 0, placeholder: 'Contoh: 1' },
        ],
      },
      {
        id: 'ubah-pendidikan',
        label: 'Update Pendidikan',
        method: 'PUT',
        pathTemplate: '/jbsumum/tingkatpendidikan/:pendidikan_lama',
        description: 'Perbarui referensi tingkat pendidikan berdasarkan nama jenjang lama.',
        fields: [
          { name: 'pendidikan_lama', label: 'Tingkat Pendidikan Lama (Target URL)', in: 'path', type: 'text', placeholder: 'Contoh: SMA', required: true },
          { name: 'pendidikan', label: 'Tingkat Pendidikan Baru', in: 'body', type: 'text', placeholder: 'Contoh: SMA / MA', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', placeholder: 'Opsional' },
        ],
      },
      {
        id: 'hapus-pendidikan',
        label: 'Hapus Pendidikan',
        method: 'DELETE',
        pathTemplate: '/jbsumum/tingkatpendidikan/:pendidikan',
        description: 'Hapus referensi tingkat pendidikan berdasarkan nama jenjang.',
        destructive: true,
        fields: [
          { name: 'pendidikan', label: 'Tingkat Pendidikan', in: 'path', type: 'text', placeholder: 'Masukkan tingkat pendidikan', required: true },
        ],
      },

      // 3A. Sistem Nota Digital — Bagian Nota
      {
        id: 'tambah-bagiannota',
        label: 'Tambah Bagian Nota',
        method: 'POST',
        pathTemplate: '/jbsumum/bagiannota',
        description: 'Tambahkan kategori / bagian nota digital baru.',
        fields: [
          { name: 'bagian', label: 'Nama Bagian Nota', in: 'body', type: 'text', placeholder: 'Contoh: Kesiswaan', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', defaultValue: 5, placeholder: 'Contoh: 5' },
        ],
      },
      {
        id: 'ubah-bagiannota',
        label: 'Update Bagian Nota',
        method: 'PUT',
        pathTemplate: '/jbsumum/bagiannota/:bagian_lama',
        description: 'Perbarui nama atau urutan bagian nota berdasarkan nama bagian lama.',
        fields: [
          { name: 'bagian_lama', label: 'Nama Bagian Lama (Target URL)', in: 'path', type: 'text', placeholder: 'Contoh: Umum', required: true },
          { name: 'bagian', label: 'Nama Bagian Baru', in: 'body', type: 'text', placeholder: 'Masukkan nama bagian baru', required: true },
          { name: 'urutan', label: 'Urutan Tampil', in: 'body', type: 'number', placeholder: 'Contoh: 1' },
        ],
      },
      {
        id: 'hapus-bagiannota',
        label: 'Hapus Bagian Nota',
        method: 'DELETE',
        pathTemplate: '/jbsumum/bagiannota/:bagian',
        description: 'Hapus kategori bagian nota berdasarkan nama bagian.',
        destructive: true,
        fields: [
          { name: 'bagian', label: 'Nama Bagian Nota', in: 'path', type: 'text', placeholder: 'Masukkan nama bagian', required: true },
        ],
      },

      // 3B. Sistem Nota Digital — Data Nota
      {
        id: 'buat-nota',
        label: 'Buat Nota Digital',
        method: 'POST',
        pathTemplate: '/jbsumum/nota',
        description: 'Kirim atau arsipkan catatan nota digital baru.',
        fields: [
          { name: 'bagian', label: 'Bagian Nota', in: 'body', type: 'text', placeholder: 'Contoh: Akademik / Keuangan', required: true },
          { name: 'judul', label: 'Judul Nota', in: 'body', type: 'text', placeholder: 'Ringkasan perihal nota', required: true },
          { name: 'nota', label: 'Isi Pesan Nota', in: 'body', type: 'textarea', placeholder: 'Tulis rincian isi nota...', required: true },
          { name: 'nip', label: 'NIP Pembuat / Terkait', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'nis', label: 'NIS Terkait', in: 'body', type: 'text', placeholder: 'Opsional' },
        ],
      },
      {
        id: 'ubah-nota',
        label: 'Update Data Nota',
        method: 'PUT',
        pathTemplate: '/jbsumum/nota/:id',
        description: 'Perbarui isi atau atribut data nota digital berdasarkan ID nota.',
        fields: [
          { name: 'id', label: 'ID Nota', in: 'path', type: 'number', placeholder: 'Masukkan ID nota', required: true },
          { name: 'bagian', label: 'Bagian Nota', in: 'body', type: 'text', placeholder: 'Contoh: Akademik' },
          { name: 'judul', label: 'Judul Nota', in: 'body', type: 'text', placeholder: 'Judul perihal nota', required: true },
          { name: 'nota', label: 'Isi Nota', in: 'body', type: 'textarea', placeholder: 'Rincian isi pesan nota', required: true },
          { name: 'tanggal', label: 'Tanggal Nota', in: 'body', type: 'date' },
          { name: 'nip', label: 'NIP Terkait', in: 'body', type: 'text', placeholder: 'Opsional' },
          { name: 'nis', label: 'NIS Terkait', in: 'body', type: 'text', placeholder: 'Opsional' },
        ],
      },
      {
        id: 'hapus-nota',
        label: 'Hapus Data Nota',
        method: 'DELETE',
        pathTemplate: '/jbsumum/nota/:id',
        description: 'Hapus rekaman data nota digital berdasarkan ID nota.',
        destructive: true,
        fields: [
          { name: 'id', label: 'ID Nota', in: 'path', type: 'number', placeholder: 'Masukkan ID nota', required: true },
        ],
      },

      // 4A. Pengarsipan Surat — Pengantar Surat (PUT & DELETE /:replid)
      {
        id: 'ubah-pengantar-surat',
        label: 'Update Pengantar Surat',
        method: 'PUT',
        pathTemplate: '/jbsumum/pengantarsurat/:replid',
        description: 'Perbarui arsip pengantar surat berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Pengantar Surat (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah', required: true },
          { name: 'judul', label: 'Judul Pengantar Surat', in: 'body', type: 'text', placeholder: 'Perihal pengantar surat', required: true },
          { name: 'pengantar', label: 'Isi Pengantar Surat', in: 'body', type: 'textarea', placeholder: 'Uraian isi pengantar surat', required: true },
          {
            name: 'aktif',
            label: 'Status Aktif',
            in: 'body',
            type: 'select',
            valueType: 'number',
            defaultValue: 1,
            options: [
              { label: '1 — Aktif', value: '1' },
              { label: '0 — Nonaktif', value: '0' },
            ],
          },
        ],
      },
      {
        id: 'hapus-pengantar-surat',
        label: 'Hapus Pengantar Surat',
        method: 'DELETE',
        pathTemplate: '/jbsumum/pengantarsurat/:replid',
        description: 'Hapus dokumen pengantar surat berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Pengantar Surat (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
        ],
      },

      // 4B. Pengarsipan Surat — Lampiran Surat
      {
        id: 'tambah-lampiran-surat',
        label: 'Tambah Lampiran Surat',
        method: 'POST',
        pathTemplate: '/jbsumum/lampiransurat',
        description: 'Tambahkan arsip lampiran surat baru pada departemen terkait.',
        fields: [
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah', required: true },
          { name: 'judul', label: 'Judul Lampiran', in: 'body', type: 'text', placeholder: 'Judul dokumen lampiran', required: true },
          { name: 'lampiran', label: 'Isi Lampiran', in: 'body', type: 'textarea', placeholder: 'Tulis isi atau keterangan lampiran surat...', required: true },
        ],
      },
      {
        id: 'ubah-lampiran-surat',
        label: 'Update Lampiran Surat',
        method: 'PUT',
        pathTemplate: '/jbsumum/lampiransurat/:replid',
        description: 'Perbarui dokumen lampiran surat berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Lampiran Surat (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah', required: true },
          { name: 'judul', label: 'Judul Lampiran', in: 'body', type: 'text', placeholder: 'Judul lampiran surat', required: true },
          { name: 'pengantar', label: 'Isi / Uraian Lampiran', in: 'body', type: 'textarea', placeholder: 'Uraian lampiran surat', required: true },
          {
            name: 'aktif',
            label: 'Status Aktif',
            in: 'body',
            type: 'select',
            valueType: 'number',
            defaultValue: 1,
            options: [
              { label: '1 — Aktif', value: '1' },
              { label: '0 — Nonaktif', value: '0' },
            ],
          },
        ],
      },
      {
        id: 'hapus-lampiran-surat',
        label: 'Hapus Lampiran Surat',
        method: 'DELETE',
        pathTemplate: '/jbsumum/lampiransurat/:replid',
        description: 'Hapus dokumen lampiran surat berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Lampiran Surat (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
        ],
      },

      // 5A. Pemetaan Wilayah & Sekolah — Wilayah
      {
        id: 'tambah-wilayah',
        label: 'Tambah Wilayah',
        method: 'POST',
        pathTemplate: '/jbsumum/wilayah',
        description: 'Tambahkan data referensi wilayah domisili / lokasi baru.',
        fields: [
          { name: 'namawilayah', label: 'Nama Wilayah', in: 'body', type: 'text', placeholder: 'Contoh: Jakarta Timur', required: true },
        ],
      },
      {
        id: 'ubah-wilayah',
        label: 'Update Wilayah',
        method: 'PUT',
        pathTemplate: '/jbsumum/wilayah/:replid',
        description: 'Perbarui nama wilayah berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Wilayah (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
          { name: 'namawilayah', label: 'Nama Wilayah', in: 'body', type: 'text', placeholder: 'Contoh: Jakarta Timur', required: true },
        ],
      },
      {
        id: 'hapus-wilayah',
        label: 'Hapus Wilayah',
        method: 'DELETE',
        pathTemplate: '/jbsumum/wilayah/:replid',
        description: 'Hapus referensi data wilayah berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Wilayah (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
        ],
      },

      // 5B. Pemetaan Wilayah & Sekolah — Sekolah
      {
        id: 'tambah-sekolah',
        label: 'Tambah Sekolah',
        method: 'POST',
        pathTemplate: '/jbsumum/sekolah',
        description: 'Tambahkan data referensi sekolah asal / jejaring sekolah baru.',
        fields: [
          { name: 'namasekolah', label: 'Nama Sekolah', in: 'body', type: 'text', placeholder: 'Contoh: SDN Pondok Ranggon 01', required: true },
          { name: 'wilayah', label: 'Wilayah', in: 'body', type: 'text', placeholder: 'Contoh: Jakarta Timur' },
        ],
      },
      {
        id: 'ubah-sekolah',
        label: 'Update Sekolah',
        method: 'PUT',
        pathTemplate: '/jbsumum/sekolah/:replid',
        description: 'Perbarui data sekolah berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Sekolah (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
          { name: 'namasekolah', label: 'Nama Sekolah', in: 'body', type: 'text', placeholder: 'Contoh: SDN Pondok Ranggon 01', required: true },
          { name: 'wilayah', label: 'Wilayah', in: 'body', type: 'text', placeholder: 'Contoh: Jakarta Timur' },
        ],
      },
      {
        id: 'hapus-sekolah',
        label: 'Hapus Sekolah',
        method: 'DELETE',
        pathTemplate: '/jbsumum/sekolah/:replid',
        description: 'Hapus data referensi sekolah berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Sekolah (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
        ],
      },

      // 6A. Sistem Kartu — Master Kartu
      {
        id: 'tambah-card',
        label: 'Tambah Master Kartu',
        method: 'POST',
        pathTemplate: '/jbsumum/card',
        description: 'Tambahkan master templat kartu siswa / pegawai baru.',
        fields: [
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah', required: true },
          { name: 'judul', label: 'Judul Kartu', in: 'body', type: 'text', placeholder: 'Contoh: KARTU SISWA 2026', required: true },
          { name: 'deskripsi', label: 'Deskripsi Kartu', in: 'body', type: 'textarea', placeholder: 'Keterangan peruntukan kartu' },
          {
            name: 'aktif',
            label: 'Status Aktif',
            in: 'body',
            type: 'select',
            valueType: 'number',
            defaultValue: 1,
            options: [
              { label: '1 — Aktif', value: '1' },
              { label: '0 — Nonaktif', value: '0' },
            ],
          },
        ],
      },
      {
        id: 'ubah-card',
        label: 'Update Master Kartu',
        method: 'PUT',
        pathTemplate: '/jbsumum/card/:replid',
        description: 'Perbarui konfigurasi master kartu berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Kartu (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah', required: true },
          { name: 'judul', label: 'Judul Kartu', in: 'body', type: 'text', placeholder: 'Judul kartu', required: true },
          { name: 'deskripsi', label: 'Deskripsi Kartu', in: 'body', type: 'textarea', placeholder: 'Keterangan kartu' },
          {
            name: 'aktif',
            label: 'Status Aktif',
            in: 'body',
            type: 'select',
            valueType: 'number',
            defaultValue: 1,
            options: [
              { label: '1 — Aktif', value: '1' },
              { label: '0 — Nonaktif', value: '0' },
            ],
          },
        ],
      },
      {
        id: 'hapus-card',
        label: 'Hapus Master Kartu',
        method: 'DELETE',
        pathTemplate: '/jbsumum/card/:replid',
        description: 'Hapus master templat kartu berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Kartu (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
        ],
      },

      // 6B. Sistem Kartu — Aktifitas Kartu
      {
        id: 'tambah-cardaktifitas',
        label: 'Tambah Aktifitas Kartu',
        method: 'POST',
        pathTemplate: '/jbsumum/cardaktifitas',
        description: 'Tambahkan aktifitas kartu baru yang terhubung dengan Master Kartu.',
        fields: [
          { name: 'idcard', label: 'Master Kartu (ID Card)', in: 'body', type: 'select', valueType: 'number', placeholder: 'Pilih master kartu', required: true },
          { name: 'aktifitas', label: 'Nama Aktifitas', in: 'body', type: 'text', placeholder: 'Contoh: Presensi Masuk Pagi', required: true },
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah' },
          { name: 'keterangan', label: 'Keterangan', in: 'body', type: 'text', placeholder: 'Opsional' },
        ],
      },
      {
        id: 'ubah-cardaktifitas',
        label: 'Update Aktifitas Kartu',
        method: 'PUT',
        pathTemplate: '/jbsumum/cardaktifitas/:replid',
        description: 'Perbarui data aktifitas kartu berdasarkan ID (replid).',
        fields: [
          { name: 'replid', label: 'ID Aktifitas (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
          { name: 'departemen', label: 'Departemen', in: 'body', type: 'text', placeholder: 'Contoh: SDI-H Islamiyah' },
          { name: 'judul', label: 'Nama / Judul Aktifitas', in: 'body', type: 'text', placeholder: 'Nama aktifitas kartu', required: true },
          { name: 'keterangan', label: 'Keterangan', in: 'body', type: 'text', placeholder: 'Opsional' },
          {
            name: 'aktif',
            label: 'Status Aktif',
            in: 'body',
            type: 'select',
            valueType: 'number',
            defaultValue: 1,
            options: [
              { label: '1 — Aktif', value: '1' },
              { label: '0 — Nonaktif', value: '0' },
            ],
          },
        ],
      },
      {
        id: 'hapus-cardaktifitas',
        label: 'Hapus Aktifitas Kartu',
        method: 'DELETE',
        pathTemplate: '/jbsumum/cardaktifitas/:replid',
        description: 'Hapus data aktifitas kartu berdasarkan ID (replid).',
        destructive: true,
        fields: [
          { name: 'replid', label: 'ID Aktifitas (replid)', in: 'path', type: 'number', placeholder: 'Contoh: 1', required: true },
        ],
      },

      // 7. File Sharing & Cloud Storage
      {
        id: 'upload-file-cloud',
        label: 'Upload Berkas Cloud (/api/files/upload)',
        method: 'POST',
        pathTemplate: '/files/upload',
        description: 'Upload berkas baru ke folder Cloud Storage Hidis (/api/files/upload).',
        fields: [
          { name: 'folder', label: 'Folder Target', in: 'body', type: 'text', placeholder: 'Contoh: /Tugas atau /GURU DIKNAS', defaultValue: '/Tugas' },
          { name: 'file', label: 'Pilih Berkas File', in: 'body', type: 'text', placeholder: 'Pilih atau tentukan nama berkas', required: true },
        ],
      },
      {
        id: 'delete-file-cloud',
        label: 'Hapus Berkas Cloud (/api/files/delete)',
        method: 'DELETE',
        pathTemplate: '/files/delete',
        description: 'Hapus file atau folder dari Cloud Storage Hidis berdasarkan path.',
        destructive: true,
        fields: [
          { name: 'path', label: 'Path Berkas / Folder', in: 'path', type: 'text', placeholder: 'Contoh: /Tugas/dokumen.pdf', required: true },
        ],
      },
    ],
  },
  {
    id: 'jbsperpus',
    code: '06',
    name: 'Perpustakaan',
    shortName: 'Perpustakaan',
    prefix: '/api/jbsperpus',
    summary: '',
    allowedTingkat: [RoleTingkat.LANDLORD, RoleTingkat.PEGAWAI, RoleTingkat.SISWA],
    hakAksesAliases: ['SIMTAKA', 'PERPUSTAKAAN', 'PERPUS', 'JBSPERPUS', 'EMA'],
    views: [
      {
        id: 'koleksi-pustaka',
        label: 'Koleksi Judul Buku',
        pathTemplate: '/jbsperpus/pustaka',
        description:
          'Ambil daftar judul / koleksi buku perpustakaan beserta penulis, penerbit, katalog, tahun terbit, dan status buku digital.',
        entityType: 'pustaka',
        params: [
          {
            name: 'judul',
            label: 'Cari Judul Buku',
            in: 'query',
            placeholder: 'Ketik kata kunci judul buku...',
          },
        ],
      },
      {
        id: 'pustaka-digital',
        label: 'Daftar Buku Digital',
        pathTemplate: '/jbsperpus/pustaka/digital',
        description:
          'Ambil daftar semua buku digital (e-book PDF/EPUB) yang telah ditautkan ke koleksi perpustakaan.',
        entityType: 'pustaka-digital',
      },
      {
        id: 'pustaka-digital-detail',
        label: 'Detail Tautan Digital',
        pathTemplate: '/jbsperpus/pustaka/digital/:idpustaka',
        description:
          'Lihat tautan berkas buku digital spesifik berdasarkan ID Pustaka.',
        entityType: 'pustaka-digital',
        params: [
          {
            name: 'idpustaka',
            label: 'ID Pustaka',
            in: 'path',
            placeholder: 'Contoh: 1',
            required: true,
            defaultValue: '1',
          },
        ],
      },
      {
        id: 'riwayat-baca-digital',
        label: 'Log Baca Digital',
        pathTemplate: '/jbsperpus/baca-digital',
        description:
          'Lihat log riwayat aktivitas siswa membaca buku digital beserta judul pustaka dan waktu baca.',
        entityType: 'siswa',
        params: [
          {
            name: 'nis',
            label: 'Filter NIS Siswa',
            in: 'query',
            placeholder: 'Opsional (contoh: 1779)',
          },
        ],
      },
      {
        id: 'eksemplar-fisik',
        label: 'Eksemplar & Status Buku',
        pathTemplate: '/jbsperpus/daftarpustaka',
        description:
          'Ambil daftar eksemplar fisik buku beserta status ketersediaannya (Tersedia / Dipinjam).',
        entityType: 'eksemplar',
        params: [
          {
            name: 'kodepustaka',
            label: 'Kode Eksemplar',
            in: 'query',
            placeholder: 'Cari kode barcode eksemplar...',
          },
          {
            name: 'idpustaka',
            label: 'ID Pustaka',
            in: 'query',
            placeholder: 'Filter ID judul buku...',
          },
        ],
      },
      {
        id: 'sirkulasi-pinjam',
        label: 'Sirkulasi Peminjaman',
        pathTemplate: '/jbsperpus/pinjam',
        description:
          'Ambil riwayat dan status sirkulasi / peminjaman buku perpustakaan.',
        entityType: 'pinjam',
        params: [
          {
            name: 'status',
            label: 'Status Pinjam (1=Dipinjam, 2=Kembali)',
            in: 'query',
            placeholder: 'Contoh: 1 atau kosongkan semua',
          },
          {
            name: 'nis',
            label: 'Filter NIS Peminjam',
            in: 'query',
            placeholder: 'Masukkan NIS siswa...',
          },
        ],
      },
      {
        id: 'master-katalog',
        label: 'Katalog & Rak',
        pathTemplate: '/jbsperpus/katalog',
        description: 'Ambil daftar master katalog dan rak penyimpanan buku.',
      },
      {
        id: 'master-penulis',
        label: 'Master Penulis',
        pathTemplate: '/jbsperpus/penulis',
        description: 'Ambil daftar master penulis buku perpustakaan.',
      },
      {
        id: 'master-penerbit',
        label: 'Master Penerbit',
        pathTemplate: '/jbsperpus/penerbit',
        description: 'Ambil daftar master penerbit buku perpustakaan.',
      },
    ],
    mutations: [
      {
        id: 'catat-pinjam-buku',
        label: 'Pinjam Buku Baru',
        method: 'POST',
        pathTemplate: '/jbsperpus/pinjam',
        description: 'Catat transaksi peminjaman eksemplar buku baru.',
        fields: [
          {
            name: 'kodepustaka',
            label: 'Kode Eksemplar Buku',
            in: 'body',
            type: 'text',
            placeholder: 'Masukkan kode eksemplar',
            required: true,
          },
          {
            name: 'nis',
            label: 'NIS Siswa (Jika Siswa)',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: 1779',
          },
          {
            name: 'nip',
            label: 'NIP Pegawai (Jika Pegawai)',
            in: 'body',
            type: 'text',
            placeholder: 'Opsional',
          },
          {
            name: 'idmember',
            label: 'ID Anggota Non-Siswa/Pegawai',
            in: 'body',
            type: 'text',
            placeholder: 'Opsional',
          },
          {
            name: 'tglpinjam',
            label: 'Tanggal Pinjam',
            in: 'body',
            type: 'date',
            defaultValue: '2026-11-01',
            required: true,
          },
          {
            name: 'tglkembali',
            label: 'Jadwal Kembali',
            in: 'body',
            type: 'date',
            defaultValue: '2026-11-08',
            required: true,
          },
          {
            name: 'keterangan',
            label: 'Keterangan',
            in: 'body',
            type: 'text',
            placeholder: 'Kondisi buku baik',
          },
        ],
      },
      {
        id: 'proses-kembali-buku',
        label: 'Kembalikan Buku',
        method: 'PUT',
        pathTemplate: '/jbsperpus/kembali/:id',
        description:
          'Proses pengembalian buku dan perbarui status eksemplar kembali tersedia.',
        fields: [
          {
            name: 'id',
            label: 'ID Transaksi Pinjam (replid)',
            in: 'path',
            type: 'number',
            placeholder: 'Masukkan ID peminjaman',
            required: true,
          },
        ],
      },
      {
        id: 'tautkan-pustaka-digital',
        label: 'Tautkan E-Book Digital',
        method: 'POST',
        pathTemplate: '/jbsperpus/pustaka/digital',
        description:
          'Tautkan file e-book / buku digital (Google Drive atau Cloudflare R2) ke Data Pustaka.',
        fields: [
          {
            name: 'idpustaka',
            label: 'ID Pustaka (replid / id_pustaka)',
            in: 'body',
            type: 'number',
            placeholder: 'Contoh: 1',
            required: true,
          },
          {
            name: 'file_url',
            label: 'URL File E-Book (Google Drive / Cloudflare R2)',
            in: 'body',
            type: 'text',
            placeholder: 'https://drive.google.com/file/d/.../preview',
            required: true,
          },
          {
            name: 'tipe',
            label: 'Tipe Format Berkas',
            in: 'body',
            type: 'select',
            defaultValue: 'PDF',
            required: true,
            options: [
              { label: 'PDF (Dokumen Buku Digital)', value: 'PDF' },
              { label: 'EPUB (Buku Elektronik)', value: 'EPUB' },
            ],
          },
        ],
      },
      {
        id: 'catat-baca-digital',
        label: 'Catat Log Baca Digital',
        method: 'POST',
        pathTemplate: '/jbsperpus/baca-digital',
        description:
          'Catat log aktivitas baca buku digital berdasarkan ID Pustaka dan NIS siswa.',
        fields: [
          {
            name: 'idpustaka',
            label: 'ID Pustaka (idpustaka)',
            in: 'body',
            type: 'number',
            placeholder: 'Contoh: 1',
            required: true,
          },
          {
            name: 'nis',
            label: 'NIS Siswa Pembaca',
            in: 'body',
            type: 'text',
            placeholder: 'Contoh: 1779',
            required: true,
          },
        ],
      },
      {
        id: 'hapus-pustaka-digital',
        label: 'Hapus Tautan E-Book',
        method: 'DELETE',
        pathTemplate: '/jbsperpus/pustaka/digital/:idpustaka',
        description:
          'Hapus tautan berkas e-book / buku digital dari Data Pustaka berdasarkan ID Pustaka.',
        destructive: true,
        fields: [
          {
            name: 'idpustaka',
            label: 'ID Pustaka (idpustaka)',
            in: 'path',
            type: 'number',
            placeholder: 'Contoh: 1',
            required: true,
          },
        ],
      },
    ],
  },
];
