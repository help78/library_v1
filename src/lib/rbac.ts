import type { ErpModuleDefinition } from '../data/erpModules';
import {
  checkUserPermission,
  resolveMutationActionType,
} from '../hooks/usePermission';
import { RoleTingkat, type UserData } from '../types/auth';

export type PortalAccessMode =
  | 'landlord-bypass'
  | 'pegawai-hakakses'
  | 'siswa-selfservice'
  | 'calon-selfservice';

export interface StudentSelfServiceMenuItem {
  id: string;
  path: string;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  endpointHint: string;
}

export type NavIconKey =
  | 'dashboard'
  | 'akademik'
  | 'keuangan'
  | 'sdm'
  | 'umum'
  | 'perpus'
  | 'pengguna'
  | 'biodata'
  | 'jadwal'
  | 'nilai'
  | 'presensi'
  | 'mobile';

export interface AppMenuConfigItem {
  id: string; // sectionId internal ('overview', 'jbsakad', 'siswa-biodata', dll.)
  label: string;
  path: string;
  iconKey: NavIconKey;
  allowed_tingkat: number[];
  req_modul?: string;
  moduleAliases?: string[];
  landlordOnly?: boolean;
}

/**
 * Menu khusus Tingkat 3 (Siswa) — hakakses kosong, otomatis terikat ke NIS (user.username)
 */
export const SISWA_MENU_ITEMS: StudentSelfServiceMenuItem[] = [
  {
    id: 'siswa-biodata',
    path: '/siswa/biodata',
    code: '01',
    label: 'Biodata & Profil Saya',
    shortLabel: 'Biodata',
    description:
      'Data induk kesiswaan, kelas aktif, dan informasi kontak wali murid.',
    endpointHint: 'GET /api/jbsakad/siswa/detail/:nis',
  },
  {
    id: 'siswa-jadwal',
    path: '/siswa/jadwal',
    code: '02',
    label: 'Jadwal Pelajaran & Kalender',
    shortLabel: 'Jadwal',
    description:
      'Jadwal mata pelajaran kelas aktif Anda serta agenda kalender akademik sekolah.',
    endpointHint: 'GET /api/jbsakad/jadwal/kelas/:idkelas',
  },
  {
    id: 'siswa-nilai',
    path: '/siswa/nilai',
    code: '03',
    label: 'Rapor & Nilai Ujian Siswa',
    shortLabel: 'Rapor & Nilai',
    description:
      'Rapor akademik lengkap (identitas, auto-rekap absensi, rata-rata tertimbang, predikat huruf dinamis) serta riwayat nilai ujian.',
    endpointHint: 'GET /api/jbsakad/rapor/:nis',
  },
  {
    id: 'siswa-presensi',
    path: '/siswa/presensi',
    code: '04',
    label: 'Presensi & Riwayat Kartu',
    shortLabel: 'Presensi',
    description:
      'Catatan kehadiran tatap muka pelajaran, presensi harian, dan riwayat kartu pintar.',
    endpointHint: 'GET /api/jbsakad/presensi-pelajaran/:nis',
  },
  {
    id: 'siswa-tagihan',
    path: '/siswa/tagihan',
    code: '05',
    label: 'Rincian Tagihan Keuangan',
    shortLabel: 'Tagihan',
    description:
      'Daftar kewajiban biaya pendidikan, nominal terbayar, sisa tagihan, dan konfirmasi bayar.',
    endpointHint: 'GET /api/jbsfina/tagihan/:nis',
  },
  {
    id: 'siswa-pustaka',
    path: '/siswa/pustaka',
    code: '06',
    label: 'Pinjaman, Katalog & E-Book Digital',
    shortLabel: 'Pustaka',
    description:
      'Status buku pinjaman aktif, pencarian katalog perpustakaan, serta akses baca e-book digital.',
    endpointHint: 'GET /api/jbsperpus/pinjam?nis=:nis',
  },
];

/**
 * Menu khusus Tingkat 4 (Calon Siswa PPDB) — hakakses kosong, otomatis terikat ke No. Pendaftaran (user.username)
 */
export const CALON_SISWA_MENU_ITEMS: StudentSelfServiceMenuItem[] = [
  {
    id: 'calon-tagihan',
    path: '/calon/tagihan',
    code: '01',
    label: 'Rincian Tagihan PPDB Saya',
    shortLabel: 'Tagihan PPDB',
    description:
      'Daftar rincian biaya pendaftaran dan administrasi awal calon peserta didik baru.',
    endpointHint: 'GET /api/jbsfina/tagihan-calon/:nopes',
  },
  {
    id: 'calon-kalender',
    path: '/calon/kalender',
    code: '02',
    label: 'Kalender Akademik Sekolah',
    shortLabel: 'Kalender Akademik',
    description:
      'Informasi jadwal kegiatan tahun ajaran dan agenda resmi sekolah.',
    endpointHint: 'GET /api/jbsakad/kalender-akademik',
  },
  {
    id: 'calon-identitas',
    path: '/calon/identitas',
    code: '03',
    label: 'Profil & Kontak Sekolah',
    shortLabel: 'Profil Sekolah',
    description:
      'Informasi alamat resmi, telepon, email, dan unit departemen lembaga.',
    endpointHint: 'GET /api/jbsumum/identitas',
  },
];

/**
 * Konfigurasi rute navigasi terpusat (Header & Route Guard)
 */
export const MENU_CONFIG: AppMenuConfigItem[] = [
  {
    id: 'overview',
    label: 'Dashboard',
    path: '/dashboard',
    iconKey: 'dashboard',
    allowed_tingkat: [1, 2, 3, 4],
  },
  // Rute Modul Operasional ERP (Landlord & Pegawai sesuai hakakses)
  {
    id: 'jbsakad',
    label: 'Akademik',
    path: '/akademik',
    iconKey: 'akademik',
    allowed_tingkat: [1, 2],
    req_modul: 'SIMAKA',
    moduleAliases: ['SIMAKA', 'INFOGURU', 'CBE', 'AKADEMIK', 'JBSAKAD', 'EMA'],
  },
  {
    id: 'jbsfina',
    label: 'Keuangan',
    path: '/keuangan',
    iconKey: 'keuangan',
    allowed_tingkat: [1, 2],
    req_modul: 'KEUANGAN',
    moduleAliases: ['KEUANGAN', 'JBSFINA', 'FINA', 'FINANCE', 'EMA'],
  },
  {
    id: 'jbssdm',
    label: 'Kepegawaian',
    path: '/sdm',
    iconKey: 'sdm',
    allowed_tingkat: [1, 2],
    req_modul: 'PERSONALIA',
    moduleAliases: [
      'PERSONALIA',
      'SIMPEG',
      'KEPEGAWAIAN',
      'SDM',
      'JBSSDM',
      'EMA',
    ],
  },
  {
    id: 'jbsumum',
    label: 'Umum',
    path: '/umum',
    iconKey: 'umum',
    allowed_tingkat: [1, 2],
    req_modul: 'UMUM',
    moduleAliases: [
      'CARDMAKER',
      'SMSG',
      'TGRAM',
      'EGW',
      'UMUM',
      'JBSUMUM',
      'EMA',
    ],
  },
  {
    id: 'jbsperpus',
    label: 'Perpustakaan',
    path: '/perpustakaan',
    iconKey: 'perpus',
    allowed_tingkat: [1, 2],
    req_modul: 'SIMTAKA',
    moduleAliases: ['SIMTAKA', 'PERPUSTAKAAN', 'PERPUS', 'JBSPERPUS', 'EMA'],
  },
  // Khusus Landlord / Jibas (Tingkat 1)
  {
    id: 'jbsuser',
    label: 'Hak Akses',
    path: '/pengguna',
    iconKey: 'pengguna',
    allowed_tingkat: [1],
    req_modul: 'JBSUSER (LANDLORD)',
    landlordOnly: true,
  },
  // Rute Mandiri Siswa (Tingkat 3)
  {
    id: 'siswa-biodata',
    label: 'Biodata',
    path: '/siswa/biodata',
    iconKey: 'biodata',
    allowed_tingkat: [3],
  },
  {
    id: 'siswa-jadwal',
    label: 'Jadwal',
    path: '/siswa/jadwal',
    iconKey: 'jadwal',
    allowed_tingkat: [3],
  },
  {
    id: 'siswa-nilai',
    label: 'Nilai',
    path: '/siswa/nilai',
    iconKey: 'nilai',
    allowed_tingkat: [3],
  },
  {
    id: 'siswa-presensi',
    label: 'Presensi',
    path: '/siswa/presensi',
    iconKey: 'presensi',
    allowed_tingkat: [3],
  },
  {
    id: 'siswa-tagihan',
    label: 'Tagihan',
    path: '/siswa/tagihan',
    iconKey: 'keuangan',
    allowed_tingkat: [3],
  },
  {
    id: 'siswa-pustaka',
    label: 'Pustaka',
    path: '/siswa/pustaka',
    iconKey: 'perpus',
    allowed_tingkat: [3],
  },
  // Rute Mandiri Calon Siswa PPDB (Tingkat 4)
  {
    id: 'calon-tagihan',
    label: 'Tagihan PPDB',
    path: '/calon/tagihan',
    iconKey: 'keuangan',
    allowed_tingkat: [4],
  },
  {
    id: 'calon-kalender',
    label: 'Kalender',
    path: '/calon/kalender',
    iconKey: 'jadwal',
    allowed_tingkat: [4],
  },
  {
    id: 'calon-identitas',
    label: 'Profil Sekolah',
    path: '/calon/identitas',
    iconKey: 'umum',
    allowed_tingkat: [4],
  },
  // Tampilan Mobile App Terpadu
  {
    id: 'mobile-view',
    label: 'Mobile View',
    path: '/mobile',
    iconKey: 'mobile',
    allowed_tingkat: [1, 2, 3, 4],
  },
];

export function isLandlordUser(user: UserData | null | undefined): boolean {
  if (!user) {
    return false;
  }
  const tingkat = Number(user.tingkat);
  if (tingkat === RoleTingkat.LANDLORD) {
    return true;
  }
  const uname = String(user.username || '').trim().toLowerCase();
  if (uname === 'jibas' || uname === 'landlord') {
    return true;
  }
  if (
    user.tingkat !== undefined &&
    user.tingkat !== null &&
    String(user.tingkat).trim() !== '' &&
    tingkat === 0
  ) {
    return true;
  }
  return false;
}

export function resolvePortalMode(user: UserData | null): PortalAccessMode {
  if (isLandlordUser(user)) {
    return 'landlord-bypass';
  }
  const tingkat = Number(user?.tingkat ?? 0);
  if (tingkat === RoleTingkat.SISWA) {
    return 'siswa-selfservice';
  }
  if (tingkat === RoleTingkat.CALON_SISWA) {
    return 'calon-selfservice';
  }
  return 'pegawai-hakakses';
}

/**
 * Mengekstrak himpunan kode modul unik (uppercase) dari array user.hakakses
 */
export function extractUserModuleCodes(user: UserData | null): Set<string> {
  const codes = new Set<string>();
  if (!user || !Array.isArray(user.hakakses)) {
    return codes;
  }

  for (const entry of user.hakakses) {
    if (typeof entry === 'string') {
      const clean = entry.trim().toUpperCase();
      if (clean) codes.add(clean);
    } else if (entry && typeof entry === 'object') {
      const rawName = entry.modul ?? entry.nama;
      if (rawName) {
        const clean = String(rawName).trim().toUpperCase();
        if (clean) codes.add(clean);
      }
    }
  }

  return codes;
}

/**
 * Pengecekan hak akses rute / menu (selaras dengan MENU_CONFIG & RequireAuth)
 */
export function hasAccess(
  user: UserData | null,
  menu: Pick<
    AppMenuConfigItem,
    'allowed_tingkat' | 'req_modul' | 'moduleAliases' | 'landlordOnly'
  >
): boolean {
  if (!user) return false;

  // Bypass penuh untuk Super Admin / Landlord (jibas) pada seluruh menu operasional & Hak Akses
  if (isLandlordUser(user)) {
    const isSelfServiceOnly =
      menu.allowed_tingkat.length > 0 &&
      menu.allowed_tingkat.every(
        (t) => t === RoleTingkat.SISWA || t === RoleTingkat.CALON_SISWA
      );
    return !isSelfServiceOnly;
  }

  const tingkat = Number(user.tingkat);

  if (menu.landlordOnly) {
    return false;
  }

  if (!menu.allowed_tingkat.includes(tingkat)) {
    return false;
  }

  if (menu.req_modul) {
    // Superadmin (Tingkat 1 Landlord / Jibas) bypass
    if (tingkat === RoleTingkat.LANDLORD) {
      return true;
    }

    const ownedCodes = extractUserModuleCodes(user);
    if (ownedCodes.size === 0) {
      return false;
    }
    if (ownedCodes.has('SUPERADMIN')) {
      return true;
    }

    const accepted = [
      menu.req_modul,
      ...(menu.moduleAliases || []),
    ].map((code) => code.trim().toUpperCase());

    return accepted.some((code) => ownedCodes.has(code));
  }

  return true;
}

export function resolveSectionPath(sectionId: string): string {
  const found = MENU_CONFIG.find((item) => item.id === sectionId);
  return found ? found.path : '/dashboard';
}

export function resolveMenuByPath(pathname: string): AppMenuConfigItem | null {
  const cleanPath =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;
  return (
    MENU_CONFIG.find(
      (item) =>
        cleanPath === item.path || cleanPath.startsWith(`${item.path}/`)
    ) ?? null
  );
}

/**
 * Menentukan daftar modul ERP untuk Tingkat 1 (Landlord) & Tingkat 2 (Pegawai):
 * - Tingkat 1 (Landlord / Jibas): Bypass penuh ke seluruh modul ERP termasuk Manajemen Pengguna & Hak Akses (jbsuser).
 * - Tingkat 2 (Pegawai): Hanya menampilkan modul operasional yang diizinkan di user.hakakses; modul jbsuser selalu disembunyikan.
 */
export function resolvePermittedErpModules(
  user: UserData | null,
  allModules: ErpModuleDefinition[]
): ErpModuleDefinition[] {
  if (!user) {
    return [];
  }

  // 1. Tingkat 1 (Landlord / Jibas): Satu-satunya peran yang dapat melihat & mengelola jbsuser + seluruh modul lainnya
  if (isLandlordUser(user)) {
    return allModules.map((mod) => ({
      ...mod,
      matchedHakAkses: ['BYPASS SUPERADMIN'],
    }));
  }

  const tingkat = Number(user.tingkat);

  // 2. Tingkat 2 (Pegawai): Filter ketat berdasarkan user.hakakses & sembunyikan jbsuser sepenuhnya
  if (tingkat === RoleTingkat.PEGAWAI) {
    const pegawaiEligibleModules = allModules.filter(
      (mod) =>
        mod.id !== 'jbsuser' && mod.allowedTingkat.includes(RoleTingkat.PEGAWAI)
    );

    const ownedCodes = extractUserModuleCodes(user);
    if (ownedCodes.size === 0) {
      return [];
    }

    // Jika ada SUPERADMIN eksplisit pada hakakses pegawai, berikan modul operasional selain jbsuser sesuai tingkat_akses
    if (ownedCodes.has('SUPERADMIN')) {
      return pegawaiEligibleModules
        .filter((mod) => checkUserPermission(user, mod.id, 'read'))
        .map((mod) => ({
          ...mod,
          matchedHakAkses: ['SUPERADMIN'],
          mutations: mod.mutations.filter((mut) =>
            checkUserPermission(
              user,
              mod.id,
              resolveMutationActionType(mut.method)
            )
          ),
        }));
    }

    const result: ErpModuleDefinition[] = [];

    for (const mod of pegawaiEligibleModules) {
      if (!checkUserPermission(user, mod.id, 'read')) {
        continue;
      }

      const matched = mod.hakAksesAliases.filter((alias) =>
        ownedCodes.has(alias.toUpperCase())
      );

      if (matched.length === 0) {
        continue;
      }

      // Filter mutasi (POST/PUT/DELETE) berdasarkan tingkat_akses modul (1 = Full CRUD, 2 = Read-Only)
      const filteredMutations = mod.mutations.filter((mut) =>
        checkUserPermission(
          user,
          mod.id,
          resolveMutationActionType(mut.method)
        )
      );

      result.push({
        ...mod,
        matchedHakAkses: matched,
        mutations: filteredMutations,
      });
    }

    return result;
  }

  // Tingkat 3 & 4 menggunakan menu khusus Siswa / Calon Siswa (bukan menu admin ERP)
  return [];
}
