import type { ReactNode } from 'react';
import {
  usePermission,
  type PermissionAction,
} from '../../hooks/usePermission';

export interface CanProps {
  /**
   * Nama kode modul pada user.hakakses (misal: "SIMAKA", "KEUANGAN", "PERSONALIA", "UMUM", "SIMTAKA")
   * atau ID modul ERP internal.
   */
  modul: string;
  /**
   * Jenis operasi yang ingin divalidasi: 'create' | 'read' | 'update' | 'delete'.
   */
  action: PermissionAction;
  /**
   * Opsional: batasi pengecekan ke departemen spesifik (misal: "SMA").
   */
  departemen?: string;
  /**
   * Opsional: elemen pengganti apabila pengguna tidak memiliki izin (default: null).
   */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Komponen Declarative Guard RBAC (<Can>).
 * Merender children HANYA apabila usePermission(modul, action) bernilai true.
 *
 * @example
 * <Can modul="SIMAKA" action="update">
 *   <button onClick={() => handleEdit(siswa)}>Edit</button>
 * </Can>
 */
export function Can({
  modul,
  action,
  departemen,
  fallback = null,
  children,
}: CanProps) {
  const isAllowed = usePermission(
    modul,
    action,
    departemen ? { departemen } : undefined
  );

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
