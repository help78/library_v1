export interface NormalizedApiPayload {
  rows: Record<string, unknown>[];
  singleObject: Record<string, unknown> | null;
  totalCount: number;
  source?: string;
  message?: string;
  raw: unknown;
}

const HIDDEN_SYNC_KEYS = new Set([
  'ts',
  'token',
  'issync',
  'info1',
  'info2',
  'info3',
  'pinsiswa',
  'pinortu',
  'pinortuibu',
  'pinpegawai',
  'doaudit',
]);

export function isHiddenSyncKey(key: string): boolean {
  return HIDDEN_SYNC_KEYS.has(key.toLowerCase());
}

const COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  replid: 'ID',
  nip: 'NIP',
  nrp: 'NRP',
  nuptk: 'NUPTK',
  nis: 'NIS',
  nisn: 'NISN',
  nik: 'NIK',
  nopendaftaran: 'No. Pendaftaran',
  nama: 'Nama Lengkap',
  nama_siswa: 'Nama Siswa',
  nama_pegawai: 'Nama Pegawai',
  nama_kelas: 'Kelas',
  nama_kelasakhir: 'Kelas Terakhir',
  nama_tahunajaran: 'Tahun Ajaran',
  nama_mapel: 'Mata Pelajaran',
  mapel: 'Mata Pelajaran',
  nama_tagihan: 'Jenis Tagihan',
  nama_kalender: 'Nama Kalender',
  nama_rak: 'Nama Rak',
  nama_status: 'Status Kehadiran',
  panggilan: 'Panggilan',
  kelamin: 'L/P',
  tmplahir: 'Tempat Lahir',
  tgllahir: 'Tanggal Lahir',
  tglmulai: 'Tgl Mulai',
  tglakhir: 'Tgl Berakhir',
  tglpinjam: 'Tgl Pinjam',
  tglkembali: 'Tgl Kembali',
  tgllulus: 'Tanggal Lulus',
  klsakhir: 'ID Kelas Akhir',
  tktakhir: 'ID Tingkat Akhir',
  tanggal: 'Tanggal',
  tanggal1: 'Tgl Awal',
  tanggal2: 'Tgl Akhir',
  tanggalawal: 'Tgl Mulai',
  tanggalakhir: 'Tgl Selesai',
  jam: 'Jam',
  jammasuk: 'Jam Masuk',
  jampulang: 'Jam Pulang',
  jamwaktukerja: 'Jam Kerja',
  menitwaktukerja: 'Menit Kerja',
  hariaktif: 'Hari Aktif',
  idpp: 'ID Sesi',
  id_phsiswa: 'ID Presensi',
  catatan: 'Catatan',
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpa: 'Alpa',
  cuti: 'Cuti',
  hportu: 'No. HP Ortu',
  hp_wali: 'No. HP Wali',
  handphone: 'No. Handphone',
  telpon: 'Telepon',
  emailsiswa: 'Email Siswa',
  email: 'Email',
  wali_kelas: 'Wali Kelas',
  idkelas: 'ID Kelas',
  idtahunajaran: 'ID Thn Ajaran',
  idsemester: 'ID Semester',
  idpelajaran: 'ID Mapel',
  id_pustaka: 'ID Pustaka',
  idpustaka: 'ID Pustaka',
  id_kalender: 'ID Kalender',
  kode: 'Kode',
  kodepustaka: 'Kode Eksemplar',
  judul: 'Judul Pustaka',
  penulis: 'Penulis',
  penerbit: 'Penerbit',
  katalog: 'Katalog',
  rak: 'ID Rak',
  counter: 'Jml Koleksi',
  biografi: 'Biografi',
  gelardepan: 'Gelar Depan',
  gelarbelakang: 'Gelar Belakang',
  gelarawal: 'Gelar Depan',
  gelarakhir: 'Gelar Belakang',
  mulaikerja: 'Mulai Kerja',
  kontak: 'Kontak',
  website: 'Situs Web',
  fax: 'Faks',
  alamat: 'Alamat',
  keterangan: 'Keterangan',
  tahun: 'Tahun',
  format: 'Format',
  tipe: 'Tipe Berkas',
  file_url: 'Tautan E-Book',
  is_digital: 'Koleksi Digital',
  waktu: 'Waktu Aktivitas',
  kewajiban: 'Kewajiban',
  terbayar: 'Terbayar',
  sisa_asli: 'Sisa Tagihan',
  harga: 'Harga Buku',
  jumlah_bayar: 'Jumlah Bayar',
  statusguru: 'Status Guru',
  status_absen: 'Kehadiran',
  status_buku: 'Status Eksemplar',
  status_pinjam: 'Status Pinjam',
  status_aktif: 'Status Aktif',
  tingkat_akses: 'Tingkat Akses',
  tahunajaran: 'Tahun Ajaran',
  tahunmasuk: 'Tahun Masuk',
  departemen: 'Departemen',
  bagian: 'Bagian',
  jabatan: 'Jabatan',
  singkatan: 'Singkatan',
  rootid: 'ID Induk',
  idjabatan: 'ID Jabatan',
  namajab: 'Nama Jabatan',
  nama_jabatan_master: 'Master Jabatan',
  sk: 'Nomor SK',
  tmt: 'TMT Jabatan',
  terakhir: 'Jabatan Aktif',
  golongan: 'Golongan',
  satker: 'Satuan Kerja',
  eselon: 'Eselon',
  pekerjaan: 'Jenis Pekerjaan',
  pendidikan: 'Tingkat Pendidikan',
  aktif: 'Status',
  isdefault: 'Default',
  foto: 'Foto',
};

const CURRENCY_KEYS = new Set([
  'kewajiban',
  'terbayar',
  'sisa_asli',
  'sisa',
  'harga',
  'jumlah_bayar',
  'besar',
  'cicilan',
  'denda',
]);

const DATE_KEYS = new Set([
  'tanggal',
  'tanggal1',
  'tanggal2',
  'tanggalawal',
  'tanggalakhir',
  'tglmulai',
  'tglakhir',
  'tgllahir',
  'tglpinjam',
  'tglkembali',
  'lastlogin',
]);

const DATETIME_KEYS = new Set([
  'waktu',
  'waktu_baca',
  'waktu_scan',
  'created_at',
  'updated_at',
  'lastlogin',
]);

export function formatColumnLabel(key: string): string {
  const lower = key.toLowerCase();
  if (COLUMN_LABELS[lower]) {
    return COLUMN_LABELS[lower];
  }
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function isCurrencyColumn(key: string): boolean {
  return CURRENCY_KEYS.has(key.toLowerCase());
}

export function isDateTimeColumn(key: string): boolean {
  return DATETIME_KEYS.has(key.toLowerCase());
}

export function isDateColumn(key: string): boolean {
  const lower = key.toLowerCase();
  return DATE_KEYS.has(lower) && !DATETIME_KEYS.has(lower);
}

export function isStatusColumn(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === 'aktif' ||
    lower === 'status_aktif' ||
    lower === 'isdefault' ||
    lower === 'status_buku' ||
    lower === 'status_pinjam' ||
    lower === 'status_absen' ||
    lower === 'nama_status' ||
    lower === 'is_digital'
  );
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatRupiah(value: unknown): string {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return String(value ?? '-');
  }
  return idrFormatter.format(num);
}

export function formatNumberId(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatDateId(value: unknown): string {
  if (!value || typeof value !== 'string') {
    return String(value ?? '-');
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === '0000-00-00' || trimmed.startsWith('0000-00-00')) {
    return '-';
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 1900) {
    return trimmed.startsWith('1899-') ? '-' : Number.isNaN(parsed.getTime()) ? trimmed : '-';
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

const MONTH_NAME_MAP: Record<string, string> = {
  januari: '01',
  jan: '01',
  january: '01',
  februari: '02',
  feb: '02',
  february: '02',
  maret: '03',
  mar: '03',
  march: '03',
  april: '04',
  apr: '04',
  mei: '05',
  may: '05',
  juni: '06',
  jun: '06',
  june: '06',
  juli: '07',
  jul: '07',
  july: '07',
  agustus: '08',
  agu: '08',
  ags: '08',
  aug: '08',
  august: '08',
  september: '09',
  sep: '09',
  sept: '09',
  oktober: '10',
  okt: '10',
  oct: '10',
  october: '10',
  november: '11',
  nov: '11',
  desember: '12',
  des: '12',
  dec: '12',
  december: '12',
};

export function parseDateToIsoInput(value: unknown): string {
  if (!value) {
    return '';
  }
  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00') || str.startsWith('1899-')) {
    return '';
  }

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const namedMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const day = namedMatch[1].padStart(2, '0');
    const monthKey = namedMatch[2].toLowerCase();
    const year = namedMatch[3];
    const mm = MONTH_NAME_MAP[monthKey];
    if (mm) {
      return `${year}-${mm}-${day}`;
    }
  }

  const slashMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const mm = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${mm}-${day}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() > 1900) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

export function formatDateTimeId(value: unknown): string {
  if (!value || typeof value !== 'string') {
    return String(value ?? '-');
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('0000-00-00')) {
    return '-';
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 1900) {
    return trimmed.startsWith('1899-') ? '-' : Number.isNaN(parsed.getTime()) ? trimmed : '-';
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function resolveImageSrc(raw: unknown): string | null {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    const clean = raw.trim();
    if (!clean || clean === 'null' || clean === 'undefined') {
      return null;
    }
    if (
      clean.startsWith('data:image/') ||
      clean.startsWith('http://') ||
      clean.startsWith('https://')
    ) {
      return clean;
    }
    if (clean.length > 60 && /^[A-Za-z0-9+/=\r\n]+$/.test(clean)) {
      const mime = clean.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${clean}`;
    }
    return null;
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'type' in raw &&
    (raw as { type?: unknown }).type === 'Buffer' &&
    'data' in raw &&
    Array.isArray((raw as { data?: unknown[] }).data)
  ) {
    const bytes = (raw as { data: number[] }).data;
    if (bytes.length < 16) {
      return null;
    }
    try {
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      const b64 = btoa(binary);
      const mime = b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    } catch {
      return null;
    }
  }

  return null;
}

export function selectTableColumns(
  rows: Record<string, unknown>[],
  maxCols = 8
): string[] {
  if (!rows.length) {
    return [];
  }

  const allKeys = Object.keys(rows[0]);
  const lowerSet = new Set(allKeys.map((k) => k.toLowerCase()));
  const hasDescriptiveStatus =
    lowerSet.has('status_buku') ||
    lowerSet.has('status_pinjam') ||
    lowerSet.has('status_absen') ||
    lowerSet.has('nama_status');
  const hasDescriptiveKelasAkhir = lowerSet.has('nama_kelasakhir');

  const filtered = allKeys.filter((k) => {
    const lower = k.toLowerCase();
    if (HIDDEN_SYNC_KEYS.has(lower)) {
      return false;
    }
    if (lower === 'status' && hasDescriptiveStatus) {
      return false;
    }
    if (
      hasDescriptiveKelasAkhir &&
      (lower === 'klsakhir' || lower === 'tktakhir')
    ) {
      return false;
    }
    return true;
  });
  const base = filtered.length > 0 ? filtered : allKeys;

  // Prioritaskan kolom penting termasuk "jabatan" pada tabel Direktori / Pencarian Pegawai SDM
  const isPegawaiDirectory =
    lowerSet.has('nip') && lowerSet.has('bagian') && lowerSet.has('jabatan');
  if (isPegawaiDirectory) {
    const preferredOrder = [
      'foto',
      'nip',
      'nama',
      'jabatan',
      'bagian',
      'gelarakhir',
      'kelamin',
      'handphone',
      'email',
      'aktif',
    ];
    const keyByLower = new Map(base.map((k) => [k.toLowerCase(), k]));
    const prioritized: string[] = [];
    for (const p of preferredOrder) {
      const actual = keyByLower.get(p);
      if (actual) {
        prioritized.push(actual);
      }
    }
    for (const k of base) {
      if (!prioritized.includes(k)) {
        prioritized.push(k);
      }
    }
    return prioritized.slice(0, maxCols);
  }

  return base.slice(0, maxCols);
}

export function extractResponsePayload(raw: unknown): NormalizedApiPayload {
  if (Array.isArray(raw)) {
    const rows = raw.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object'
    );
    return {
      rows,
      singleObject: null,
      totalCount: rows.length,
      raw,
    };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const message =
      typeof obj.message === 'string'
        ? obj.message
        : typeof obj.pesan === 'string'
        ? obj.pesan
        : undefined;
    const source = typeof obj.source === 'string' ? obj.source : undefined;
    const innerData = obj.data;

    if (Array.isArray(innerData)) {
      const rows = innerData.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object'
      );
      const explicitTotal =
        typeof obj.total === 'number'
          ? obj.total
          : typeof obj.total_data === 'number'
          ? obj.total_data
          : rows.length;
      return {
        rows,
        singleObject: null,
        totalCount: explicitTotal,
        source,
        message,
        raw,
      };
    }

    if (innerData && typeof innerData === 'object') {
      const dataObj = innerData as Record<string, unknown>;
      const keys = Object.keys(dataObj);
      if (keys.length === 0) {
        return {
          rows: [],
          singleObject: null,
          totalCount: 0,
          source,
          message,
          raw,
        };
      }
      return {
        rows: [],
        singleObject: dataObj,
        totalCount: 1,
        source,
        message,
        raw,
      };
    }

    return {
      rows: [],
      singleObject: obj,
      totalCount: 1,
      source,
      message,
      raw,
    };
  }

  return {
    rows: [],
    singleObject: null,
    totalCount: 0,
    raw,
  };
}
