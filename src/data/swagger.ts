/**
 * Single Source of Truth — OpenAPI / Swagger 3.0.3 Specification
 * API Jibas Cloudflare Workers (Frontend AI Ready)
 */

export interface CreateHakAksesPayload {
  nip: string;
  modul: string;
  tingkat: number;
  departemen: string;
  keterangan: string;
}

export interface UpdateHakAksesPayload {
  modul?: string;
  tingkat: number;
  departemen?: string;
  aktif: number;
  keterangan?: string;
}

export interface UpsertPegawaiLoginPayload {
  nip: string;
  password: string;
  aktif: number;
}

export interface VerifikasiPembayaranPayload {
  totalakhir: number;
  nipAdmin: string;
}

export const openAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'API Jibas Cloudflare Workers (Frontend AI Ready)',
    version: '1.0.0',
    description:
      'Dokumentasi REST API terpusat untuk modul JBSAKAD, JBSFINA, JBSSDM, JBSUMUM, JBSUSER, dan JBSPERPUS. Gunakan schema dan example payload di sini sebagai acuan utama (Single Source of Truth) saat membuat form input dan interface TypeScript.',
  },
  servers: [
    {
      url: 'https://api.wahab.my.id',
      description: 'Production Server',
    },
    {
      url: 'http://localhost:8787',
      description: 'Local Development Server',
    },
  ],
  tags: [
    {
      name: 'JBS User (Cross DB)',
      description: 'Otentikasi (Login Multi-Role) dan Manajemen Hak Akses',
    },
    {
      name: 'JBS Akad',
      description: 'Modul Akademik: Siswa, Kelas, Jadwal, Nilai, Presensi',
    },
    {
      name: 'JBS Fina',
      description: 'Modul Keuangan: Pembayaran, Tagihan, Verifikasi',
    },
    {
      name: 'JBS SDM',
      description: 'Modul Kepegawaian: Biodata, Presensi, Riwayat',
    },
    {
      name: 'JBS Umum',
      description: 'Modul Umum: Identitas, Master Data, Nota Digital',
    },
    {
      name: 'JBS Perpus',
      description: 'Modul Perpustakaan: E-Book, Buku Fisik, Sirkulasi',
    },
    {
      name: 'Files & Cloud Storage',
      description: 'Penyimpanan Berkas Digital, Upload Dokumen, dan CRUD File Sharing Hidis',
    },
  ],
  paths: {
    // =====================================
    // JBS USER (CROSS DB)
    // =====================================
    '/api/jbsuser/login': {
      post: {
        tags: ['JBS User (Cross DB)'],
        summary:
          'Login untuk Multi-Role (Sistem akan membersihkan input otomatis)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    description: 'Pilihan: pegawai, landlord, siswa, calon',
                  },
                  nip: { type: 'string' },
                  password: { type: 'string' },
                  nis: { type: 'string' },
                  pin: { type: 'string' },
                  nopendaftaran: { type: 'string' },
                  pinsiswa: { type: 'string' },
                },
              },
              examples: {
                LoginPegawai: {
                  summary: 'Login Pegawai / Guru',
                  value: {
                    status: 'pegawai',
                    nip: '123',
                    password: 'password123',
                  },
                },
                LoginSiswa: {
                  summary: 'Login Siswa',
                  value: { status: 'siswa', nis: '1779', pin: '123456' },
                },
                LoginLandlord: {
                  summary: 'Login Superadmin (Jibas)',
                  value: {
                    status: 'landlord',
                    nip: 'jibas',
                    password: 'password123',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login Berhasil' },
          '401': { description: 'Username / Password Salah' },
        },
      },
    },
    '/api/jbsuser/pegawai': {
      get: {
        tags: ['JBS User (Cross DB)'],
        summary: 'Ambil daftar akun login pegawai',
        responses: { '200': { description: 'Berhasil' } },
      },
      post: {
        tags: ['JBS User (Cross DB)'],
        summary: 'Buat atau update password akun pegawai',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nip: { type: 'string' },
                  password: { type: 'string' },
                  aktif: { type: 'integer' },
                },
              },
              examples: {
                BuatAkun: {
                  value: { nip: '123', password: '123', aktif: 1 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Berhasil' },
          '400': {
            description: 'Gagal karena Biodata di Master SDM belum dibuat',
          },
        },
      },
    },
    '/api/jbsuser/hakakses/{nip}': {
      get: {
        tags: ['JBS User (Cross DB)'],
        summary: 'Lihat daftar hak akses pegawai by NIP',
        parameters: [
          { in: 'path', name: 'nip', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsuser/hakakses': {
      post: {
        tags: ['JBS User (Cross DB)'],
        summary:
          'Tambah hak akses baru untuk pegawai (SOP: Akun Login harus ada dulu)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nip: { type: 'string' },
                  modul: { type: 'string' },
                  tingkat: { type: 'integer' },
                  departemen: { type: 'string' },
                  keterangan: { type: 'string' },
                },
              },
              examples: {
                AksesAkademik: {
                  summary: 'Akses Admin Akademik (All Dept)',
                  value: {
                    nip: '123',
                    modul: 'SIMAKA',
                    tingkat: 1,
                    departemen: 'ALL',
                    keterangan: 'Admin Akademik',
                  } satisfies CreateHakAksesPayload,
                },
                AksesKeuangan: {
                  summary: 'Akses Kasir Keuangan (SMA)',
                  value: {
                    nip: '123',
                    modul: 'KEUANGAN',
                    tingkat: 2,
                    departemen: 'SMA',
                    keterangan: 'Kasir SMA',
                  } satisfies CreateHakAksesPayload,
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Berhasil ditambahkan' },
          '400': {
            description: 'Modul/Departemen salah, ATAU akun login belum dibuat',
          },
        },
      },
    },
    '/api/jbsuser/hakakses/{replid}': {
      put: {
        tags: ['JBS User (Cross DB)'],
        summary: 'Update hak akses (berdasarkan ID replid, BUKAN NIP)',
        parameters: [
          {
            in: 'path',
            name: 'replid',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  modul: { type: 'string' },
                  tingkat: { type: 'integer' },
                  departemen: { type: 'string' },
                  aktif: { type: 'integer' },
                },
              },
              examples: {
                UbahTingkat: {
                  value: {
                    tingkat: 2,
                    aktif: 1,
                    keterangan: 'Diturunkan ke Operator',
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Berhasil diupdate' } },
      },
      delete: {
        tags: ['JBS User (Cross DB)'],
        summary: 'Hapus hak akses berdasarkan ID',
        parameters: [
          {
            in: 'path',
            name: 'replid',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: { '200': { description: 'Berhasil dicabut' } },
      },
    },

    // =====================================
    // JBS AKAD
    // =====================================
    '/api/jbsakad/siswa': {
      get: {
        tags: ['JBS Akad'],
        summary: 'Ambil daftar siswa aktif',
        parameters: [{ in: 'query', name: 'nama', schema: { type: 'string' } }],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsakad/siswa/tambah': {
      post: {
        tags: ['JBS Akad'],
        summary: 'Tambah data siswa baru',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nis: { type: 'string' },
                  nama: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Siswa ditambahkan' } },
      },
    },
    '/api/jbsakad/siswa/edit/{nis}': {
      put: {
        tags: ['JBS Akad'],
        summary: 'Edit data siswa by NIS',
        parameters: [
          { in: 'path', name: 'nis', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nama: { type: 'string' },
                  hportu: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsakad/siswa/detail/{nis}': {
      get: {
        tags: ['JBS Akad'],
        summary: 'Detail lengkap siswa (termasuk foto, text kelas, dll)',
        parameters: [
          { in: 'path', name: 'nis', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsakad/kelas': {
      get: {
        tags: ['JBS Akad'],
        summary: 'Daftar kelas dan wali kelas',
        parameters: [
          { in: 'query', name: 'idtahunajaran', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsakad/pelajaran': {
      get: {
        tags: ['JBS Akad'],
        summary: 'Daftar Mata Pelajaran',
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsakad/presensiharian/{nis}': {
      get: {
        tags: ['JBS Akad'],
        summary: 'Riwayat Presensi Harian Siswa',
        parameters: [
          { in: 'path', name: 'nis', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },

    // =====================================
    // JBS FINA
    // =====================================
    '/api/jbsfina/tagihan': {
      get: {
        tags: ['JBS Fina'],
        summary: 'Ambil daftar tagihan belum lunas',
        parameters: [{ in: 'query', name: 'nama', schema: { type: 'string' } }],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsfina/tagihan/{nis}': {
      get: {
        tags: ['JBS Fina'],
        summary: 'Detail tagihan per siswa (NIS)',
        parameters: [
          { in: 'path', name: 'nis', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsfina/verifikasi/{id}': {
      post: {
        tags: ['JBS Fina'],
        summary:
          'Verifikasi Pembayaran Inti (Potong Tagihan + Jurnal Akuntansi)',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'integer' },
            description: 'ID Tagihan Utama',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  totalakhir: { type: 'number' },
                  nipAdmin: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Berhasil Verifikasi' } },
      },
    },
    '/api/jbsfina/antrian': {
      get: {
        tags: ['JBS Fina'],
        summary: 'Monitoring antrian Payment Gateway (Midtrans, dll)',
        responses: { '200': { description: 'Berhasil' } },
      },
    },

    // =====================================
    // JBS SDM
    // =====================================
    '/api/jbssdm/pegawai': {
      get: {
        tags: ['JBS SDM'],
        summary: 'Daftar Pegawai (Bisa Filter Aktif/NIP)',
        parameters: [
          { in: 'query', name: 'nip', schema: { type: 'string' } },
          {
            in: 'query',
            name: 'aktif',
            schema: { type: 'integer' },
            description: '1=Aktif, 0=Nonaktif',
          },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
      post: {
        tags: ['JBS SDM'],
        summary: 'Tambah Biodata Pegawai (Syarat sebelum buat Akun Login)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nip: { type: 'string' },
                  nama: { type: 'string' },
                  bagian: { type: 'string' },
                  kelamin: { type: 'string' },
                  nikah: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Pegawai ditambah' } },
      },
    },
    '/api/jbssdm/pegawai/detail/{nip}': {
      get: {
        tags: ['JBS SDM'],
        summary: 'Detail Lengkap Pegawai',
        parameters: [
          { in: 'path', name: 'nip', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbssdm/presensi': {
      get: {
        tags: ['JBS SDM'],
        summary: 'Histori Presensi Pegawai',
        parameters: [
          { in: 'query', name: 'tanggal', schema: { type: 'string' } },
          { in: 'query', name: 'nip', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },

    // =====================================
    // JBS PERPUS
    // =====================================
    '/api/jbsperpus/pustaka': {
      get: {
        tags: ['JBS Perpus'],
        summary: 'Katalog Induk (Cek buku fisik & digital)',
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsperpus/pustaka/digital': {
      get: {
        tags: ['JBS Perpus'],
        summary: 'Ambil daftar semua buku digital (E-book)',
        responses: { '200': { description: 'Berhasil' } },
      },
      post: {
        tags: ['JBS Perpus'],
        summary: 'Tautkan file e-book ke Data Pustaka',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  idpustaka: { type: 'integer' },
                  file_url: { type: 'string' },
                  tipe: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Berhasil ditautkan' } },
      },
    },
    '/api/jbsperpus/baca-digital': {
      get: {
        tags: ['JBS Perpus'],
        summary: 'Log Riwayat Siswa Membaca Buku Digital',
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    '/api/jbsperpus/pinjam': {
      get: {
        tags: ['JBS Perpus'],
        summary: 'Sirkulasi: Data Peminjaman Buku Fisik Aktif',
        parameters: [{ in: 'query', name: 'status', schema: { type: 'integer' } }],
        responses: { '200': { description: 'Berhasil' } },
      },
      post: {
        tags: ['JBS Perpus'],
        summary: 'Catat Peminjaman Buku Fisik',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  kodepustaka: { type: 'string' },
                  nis: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Berhasil dipinjam' } },
      },
    },
    '/api/jbsperpus/kembali/{id}': {
      put: {
        tags: ['JBS Perpus'],
        summary: 'Sirkulasi: Pengembalian Buku',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Berhasil' } },
      },
    },
    // =====================================
    // FILES & CLOUD STORAGE (FILE SHARING)
    // =====================================
    '/api/files/list': {
      get: {
        tags: ['Files & Cloud Storage'],
        summary: 'Daftar Berkas & Folder Cloud Storage (File Sharing)',
        description: 'Memuat isi folder (berkas, direktori, ukuran, tanggal modifikasi, tipe, dan resolusi) dari server Cloud Storage Hidis.',
        parameters: [
          {
            in: 'query',
            name: 'path',
            required: false,
            schema: { type: 'string', default: '/' },
            description: 'Path folder target (contoh: / atau /Tugas atau /GURU DIKNAS)',
          },
        ],
        responses: {
          '200': {
            description: 'Berhasil memuat berkas dan folder',
          },
        },
      },
    },
    '/api/files/upload': {
      post: {
        tags: ['Files & Cloud Storage'],
        summary: 'Upload Berkas Baru ke Cloud Storage Hidis',
        description: 'Mengunggah berkas via form-data (file & folder) ke Filebrowser Hidis dan menghasilkan link publik serta link internal.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'File yang diunggah' },
                  folder: { type: 'string', description: 'Folder target (contoh: /Tugas)' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'File berhasil diupload ke Filebrowser Hidis',
          },
        },
      },
    },
    '/api/files/delete': {
      delete: {
        tags: ['Files & Cloud Storage'],
        summary: 'Hapus Berkas atau Folder dari Cloud Storage',
        description: 'Menghapus berkas atau direktori secara permanen berdasarkan parameter path.',
        parameters: [
          {
            in: 'query',
            name: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Path absolut berkas/folder yang akan dihapus (contoh: /Tugas/dokumen.pdf)',
          },
        ],
        responses: {
          '200': {
            description: 'File atau folder berhasil dihapus',
          },
        },
      },
    },
  },
} as const;

export const HAK_AKSES_POST_SPEC =
  openAPISpec.paths['/api/jbsuser/hakakses'].post;

export const HAK_AKSES_EXAMPLES =
  HAK_AKSES_POST_SPEC.requestBody.content['application/json'].examples;
