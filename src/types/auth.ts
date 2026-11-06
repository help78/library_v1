export enum RoleTingkat {
  LANDLORD = 1,
  PEGAWAI = 2,
  SISWA = 3,
  CALON_SISWA = 4,
}

export interface HakAksesObject {
  replid?: number | string;
  modul?: string;
  nama?: string;
  tingkat_akses?: number | string;
  tingkat?: number | string;
  departemen?: string;
  keterangan?: string;
  [key: string]: unknown;
}

export type HakAksesRaw = string | HakAksesObject;

export interface NormalizedHakAksesItem {
  modul: string;
  tingkatAkses: string;
  departemen: string;
}

export interface UserData {
  username: string;
  nama: string;
  foto?: unknown;
  tingkat: RoleTingkat | number;
  hakakses: HakAksesRaw[];
  departemen?: string;
  bagian?: string;
  kelas?: string;
}

export type LoginRoleMode = 'nip' | 'nis' | 'nopendaftaran';

export interface LoginPayload {
  roleMode: LoginRoleMode;
  identifier: string;
  secret: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: UserData;
}

export interface RoleMetadata {
  tingkat: RoleTingkat;
  shortName: string;
  fullName: string;
  description: string;
  identifierLabel: string;
}

export const ROLE_METADATA: Record<number, RoleMetadata> = {
  [RoleTingkat.LANDLORD]: {
    tingkat: RoleTingkat.LANDLORD,
    shortName: 'Landlord / Jibas',
    fullName: 'Landlord / Jibas (Super Admin)',
    description: 'Akses penuh seluruh modul sistem, manajemen hak akses pegawai, dan konfigurasi identitas lembaga.',
    identifierLabel: 'Username Super Admin',
  },
  [RoleTingkat.PEGAWAI]: {
    tingkat: RoleTingkat.PEGAWAI,
    shortName: 'Pegawai / Guru',
    fullName: 'Pegawai / Guru',
    description: 'Akses operasional akademik, penilaian, presensi, keuangan, SDM, dan perpustakaan sesuai hak akses modul.',
    identifierLabel: 'NIP Pegawai',
  },
  [RoleTingkat.SISWA]: {
    tingkat: RoleTingkat.SISWA,
    shortName: 'Siswa',
    fullName: 'Siswa',
    description: 'Akses informasi jadwal pelajaran, presensi kehadiran, rekap nilai ujian, tagihan keuangan, dan peminjaman pustaka.',
    identifierLabel: 'NIS Siswa',
  },
  [RoleTingkat.CALON_SISWA]: {
    tingkat: RoleTingkat.CALON_SISWA,
    shortName: 'Calon Siswa',
    fullName: 'Calon Siswa (PPDB)',
    description: 'Akses pemantauan data pendaftaran Penerimaan Peserta Didik Baru (PPDB) dan rincian tagihan calon siswa.',
    identifierLabel: 'No. Pendaftaran Calon Siswa',
  },
};

export function getRoleDisplayLabel(tingkat: number): string {
  const meta = ROLE_METADATA[tingkat];
  if (!meta) {
    return `Tingkat ${tingkat}`;
  }
  return `${tingkat} (${meta.fullName})`;
}

export function getRoleFullName(tingkat: number): string {
  return ROLE_METADATA[tingkat]?.fullName ?? `Role Tingkat ${tingkat}`;
}

export function normalizeHakAksesList(
  hakakses?: HakAksesRaw[]
): NormalizedHakAksesItem[] {
  if (!Array.isArray(hakakses) || hakakses.length === 0) {
    return [];
  }

  return hakakses
    .map((item): NormalizedHakAksesItem | null => {
      if (typeof item === 'string') {
        const clean = item.trim();
        return clean
          ? { modul: clean, tingkatAkses: '-', departemen: '-' }
          : null;
      }

      if (item && typeof item === 'object') {
        const modName = String(item.modul || item.nama || '').trim();
        if (!modName) {
          return null;
        }
        const rawLevel = item.tingkat_akses ?? item.tingkat;
        const tingkatAkses =
          rawLevel !== undefined && rawLevel !== null && String(rawLevel) !== ''
            ? String(rawLevel)
            : '-';
        const departemen = item.departemen
          ? String(item.departemen).trim()
          : '-';

        return {
          modul: modName,
          tingkatAkses,
          departemen,
        };
      }

      return null;
    })
    .filter((entry): entry is NormalizedHakAksesItem => entry !== null);
}
