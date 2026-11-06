import { useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  RoleTingkat,
  type HakAksesObject,
  type HakAksesRaw,
  type UserData,
} from '../types/auth';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export interface PermissionCheckOptions {
  /**
   * Filter opsional berdasarkan departemen (misal: "SMA").
   * Entri hakakses dengan departemen "ALL" atau kosong dianggap berlaku lintas departemen.
   */
  departemen?: string;
}

/**
 * Pemetaan ID modul internal ERP ke kode modul utama JIBAS pada user.hakakses
 */
const ERP_MODULE_CANONICAL_CODE: Record<string, string> = {
  JBSAKAD: 'SIMAKA',
  JBSFINA: 'KEUANGAN',
  JBSSDM: 'PERSONALIA',
  JBSUMUM: 'UMUM',
  JBSPERPUS: 'SIMTAKA',
  JBSUSER: 'JBSUSER',
};

/**
 * Kelompok alias modul yang setara untuk operasi penuh (CRUD sesuai tingkat_akses)
 * maupun alias pemantauan khusus baca (Read-Only).
 */
interface ModuleAliasRule {
  fullEquivalents: string[];
  readOnlyExtras?: string[];
}

const DOMAIN_ALIAS_RULES: ModuleAliasRule[] = [
  {
    fullEquivalents: ['SIMAKA', 'AKADEMIK', 'JBSAKAD'],
    readOnlyExtras: ['INFOGURU', 'CBE', 'EMA'],
  },
  {
    fullEquivalents: ['KEUANGAN', 'JBSFINA', 'FINA', 'FINANCE'],
    readOnlyExtras: ['EMA'],
  },
  {
    fullEquivalents: ['PERSONALIA', 'SIMPEG', 'KEPEGAWAIAN', 'SDM', 'JBSSDM'],
    readOnlyExtras: ['EMA'],
  },
  {
    fullEquivalents: ['UMUM', 'JBSUMUM', 'CARDMAKER', 'SMSG', 'TGRAM', 'EGW'],
    readOnlyExtras: ['EMA'],
  },
  {
    fullEquivalents: ['SIMTAKA', 'PERPUSTAKAAN', 'PERPUS', 'JBSPERPUS'],
    readOnlyExtras: ['EMA'],
  },
];

export function resolveModulePermissionCode(moduleIdOrCode: string): string {
  const clean = String(moduleIdOrCode || '').trim().toUpperCase();
  return ERP_MODULE_CANONICAL_CODE[clean] || clean;
}

export function resolveMutationActionType(
  method: 'POST' | 'PUT' | 'DELETE'
): PermissionAction {
  if (method === 'POST') return 'create';
  if (method === 'PUT') return 'update';
  return 'delete';
}

interface ParsedHakAksesEntry {
  modul: string;
  tingkatAkses: number; // 1 = Full Access (CRUD), 2 = Read Only
  departemen: string;
}

function parseHakAksesEntry(raw: HakAksesRaw | null | undefined): ParsedHakAksesEntry | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const modul = raw.trim().toUpperCase();
    if (!modul) return null;
    return {
      modul,
      // EMA adalah modul eksekutif pemantauan (Read-Only)
      tingkatAkses: modul === 'EMA' ? 2 : 1,
      departemen: 'ALL',
    };
  }

  if (typeof raw === 'object') {
    const obj = raw as HakAksesObject;
    const rawModul = obj.modul ?? obj.nama;
    const modul = rawModul ? String(rawModul).trim().toUpperCase() : '';
    if (!modul) return null;

    const rawLevel = obj.tingkat_akses ?? obj.tingkat;
    const parsedLevel =
      rawLevel !== undefined && rawLevel !== null && String(rawLevel).trim() !== ''
        ? Number(rawLevel)
        : modul === 'EMA'
          ? 2
          : 2; // Fail-safe ke Read-Only (2) bila tingkat_akses tidak terdefinisi

    if (Number.isNaN(parsedLevel)) {
      return null;
    }

    const rawDept = obj.departemen ? String(obj.departemen).trim().toUpperCase() : 'ALL';

    return {
      modul,
      tingkatAkses: modul === 'EMA' ? 2 : parsedLevel,
      departemen: rawDept || 'ALL',
    };
  }

  return null;
}

function resolveMatchingRule(
  targetUpper: string,
  action: PermissionAction
): { allowedCodes: Set<string>; readOnlyCodes: Set<string> } {
  const allowedCodes = new Set<string>([targetUpper, 'SUPERADMIN']);
  const readOnlyCodes = new Set<string>();

  for (const rule of DOMAIN_ALIAS_RULES) {
    if (rule.fullEquivalents.includes(targetUpper)) {
      for (const eq of rule.fullEquivalents) {
        allowedCodes.add(eq);
      }
      if (action === 'read' && rule.readOnlyExtras) {
        for (const extra of rule.readOnlyExtras) {
          readOnlyCodes.add(extra);
        }
      }
    }
  }

  return { allowedCodes, readOnlyCodes };
}

/**
 * Fungsi murni (pure function) evaluasi RBAC Multi-Role & Tingkat Wewenang Modul:
 * - Tingkat 1 (Super Admin / Landlord): Bypass semua aturan -> selalu true.
 * - Tingkat 2 (Pegawai / Guru): Bergantung pada user.hakakses:
 *   - tingkat_akses === 1 -> Full Access ('create', 'read', 'update', 'delete' = true)
 *   - tingkat_akses === 2 -> Read Only ('read' = true; 'create', 'update', 'delete' = false)
 * - Tingkat 3 & 4 (Siswa & Calon Siswa): Tidak pernah memiliki akses CRUD master data -> false.
 */
export function checkUserPermission(
  user: UserData | null | undefined,
  modul: string,
  action: PermissionAction,
  options?: PermissionCheckOptions
): boolean {
  if (!user) return false;

  const targetUpper = resolveModulePermissionCode(modul);
  if (!targetUpper) return false;

  const userTingkat = Number(user.tingkat);
  const uname = String(user.username || '').trim().toLowerCase();
  const hasExplicitZeroTingkat =
    user.tingkat !== undefined &&
    user.tingkat !== null &&
    String(user.tingkat).trim() !== '' &&
    userTingkat === 0;
  const isSuperAdminAccount =
    userTingkat === RoleTingkat.LANDLORD ||
    hasExplicitZeroTingkat ||
    uname === 'jibas' ||
    uname === 'landlord';

  // 1. Tingkat 1 = Super Admin / Landlord (Bypass seluruh aturan & modul)
  if (isSuperAdminAccount) {
    return true;
  }

  // Modul Manajemen Pengguna & Hak Akses (JBSUSER) dikunci eksklusif untuk Super Admin / Landlord
  if (targetUpper === 'JBSUSER' || targetUpper === 'JBSUSER (LANDLORD)') {
    return false;
  }

  // 2. Tingkat 3 & 4 = Siswa & Calon Siswa (Tidak boleh CRUD master data)
  if (
    userTingkat === RoleTingkat.SISWA ||
    userTingkat === RoleTingkat.CALON_SISWA
  ) {
    return false;
  }

  // 3. Tingkat 2 = Pegawai / Guru (Evaluasi ketat terhadap array user.hakakses)
  if (userTingkat !== RoleTingkat.PEGAWAI) {
    return false;
  }

  if (!Array.isArray(user.hakakses) || user.hakakses.length === 0) {
    return false;
  }

  const targetDept = options?.departemen
    ? options.departemen.trim().toUpperCase()
    : null;

  const { allowedCodes, readOnlyCodes } = resolveMatchingRule(
    targetUpper,
    action
  );

  for (const rawItem of user.hakakses) {
    const entry = parseHakAksesEntry(rawItem);
    if (!entry) continue;

    // Filter departemen bila parameter departemen dispesifikasikan
    if (
      targetDept &&
      targetDept !== 'ALL' &&
      entry.departemen !== 'ALL' &&
      entry.departemen !== '-' &&
      entry.departemen !== targetDept
    ) {
      continue;
    }

    // Jika pegawai memiliki entri SUPERADMIN eksplisit
    if (entry.modul === 'SUPERADMIN') {
      if (action === 'read') {
        return entry.tingkatAkses === 1 || entry.tingkatAkses === 2;
      }
      return entry.tingkatAkses === 1;
    }

    // Kecocokan pada modul utama / setara
    if (allowedCodes.has(entry.modul)) {
      if (action === 'read') {
        if (entry.tingkatAkses === 1 || entry.tingkatAkses === 2) {
          return true;
        }
      } else {
        // action === 'create' | 'update' | 'delete' WAJIB tingkat_akses === 1
        if (entry.tingkatAkses === 1) {
          return true;
        }
      }
    }

    // Kecocokan pada alias pemantauan khusus baca (misal INFOGURU / CBE / EMA saat membuka jbsakad)
    if (action === 'read' && readOnlyCodes.has(entry.modul)) {
      if (entry.tingkatAkses === 1 || entry.tingkatAkses === 2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Custom Hook RBAC untuk mengecek izin pengguna saat ini terhadap modul & aksi tertentu.
 *
 * @example
 * const canCreateSiswa = usePermission('SIMAKA', 'create');
 * const canEditKeuanganSma = usePermission('KEUANGAN', 'update', { departemen: 'SMA' });
 */
export function usePermission(
  modul: string,
  action: PermissionAction,
  options?: PermissionCheckOptions
): boolean {
  const user = useAuthStore((state) => state.user);
  const departemen = options?.departemen;

  return useMemo(
    () =>
      checkUserPermission(
        user,
        modul,
        action,
        departemen ? { departemen } : undefined
      ),
    [user, modul, action, departemen]
  );
}
