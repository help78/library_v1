import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MinusCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Can } from '../auth/Can';
import { usePermission } from '../../hooks/usePermission';
import { formatNumberId } from '../../lib/formatters';
import { AvatarImage } from './AvatarImage';
import { Button } from '../ui/button';
import type { InspectedEntity } from './SmartDataTable';

export interface SiswaRowRecord {
  nis: string;
  nisn?: string;
  nama: string;
  kelamin?: string;
  kelas: string;
  tahunmasuk?: string;
  hportu?: string;
  emailsiswa?: string;
  aktif: boolean;
  foto?: unknown;
  raw: Record<string, unknown>;
}

interface DaftarSiswaTableProps {
  rows: Record<string, unknown>[];
  isLoading: boolean;
  onInspect: (entity: InspectedEntity) => void;
  onAddSiswa?: () => void;
  onEditSiswa?: (row: Record<string, unknown>) => void;
  onDeleteSiswa?: (row: Record<string, unknown>) => void;
}

function normalizeSiswaRow(row: Record<string, unknown>, idx: number): SiswaRowRecord {
  const nis = String(row.nis ?? row.replid ?? idx + 1).trim();
  const nisn =
    row.nisn && String(row.nisn) !== 'null' ? String(row.nisn).trim() : '';
  const nama = String(row.nama ?? row.nama_siswa ?? '-').trim();
  const kelaminRaw = String(row.kelamin ?? '').trim().toLowerCase();
  const kelamin =
    kelaminRaw === 'l'
      ? 'Laki-laki'
      : kelaminRaw === 'p'
        ? 'Perempuan'
        : kelaminRaw
          ? String(row.kelamin)
          : '';
  const kelas = String(
    row.nama_kelas ?? row.kelas ?? (row.idkelas ? `Kelas #${row.idkelas}` : '-')
  ).trim();
  const tahunmasuk =
    row.tahunmasuk && String(row.tahunmasuk) !== 'null'
      ? String(row.tahunmasuk).trim()
      : '';
  const hportu =
    row.hportu && String(row.hportu) !== 'null'
      ? String(row.hportu).trim()
      : row.handphone && String(row.handphone) !== 'null'
        ? String(row.handphone).trim()
        : '';
  const emailsiswa =
    row.emailsiswa && String(row.emailsiswa) !== 'null'
      ? String(row.emailsiswa).trim()
      : '';
  const aktif = !('aktif' in row) || Number(row.aktif) === 1;

  return {
    nis,
    nisn,
    nama,
    kelamin,
    kelas,
    tahunmasuk,
    hportu,
    emailsiswa,
    aktif,
    foto: row.foto,
    raw: row,
  };
}

/**
 * Halaman / Komponen "Tabel Daftar Siswa" (Modul SIMAKA)
 * Menggunakan <Can modul="SIMAKA" action="create" | "update" | "delete">
 * untuk menyembunyikan tombol Tambah Siswa, Edit, dan Hapus secara otomatis
 * apabila pengguna hanya memiliki tingkat_akses = 2 (Read-Only).
 */
export function DaftarSiswaTable({
  rows,
  isLoading,
  onInspect,
  onAddSiswa,
  onEditSiswa,
  onDeleteSiswa,
}: DaftarSiswaTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Cek apakah pengguna memiliki minimal satu hak modifikasi pada modul SIMAKA
  const canUpdateSiswa = usePermission('SIMAKA', 'update');
  const canDeleteSiswa = usePermission('SIMAKA', 'delete');
  const isReadOnlyMode = !canUpdateSiswa && !canDeleteSiswa;

  const normalizedStudents = useMemo(
    () => rows.map((r, idx) => normalizeSiswaRow(r, idx)),
    [rows]
  );

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return normalizedStudents;
    return normalizedStudents.filter(
      (s) =>
        s.nis.toLowerCase().includes(q) ||
        s.nama.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.hportu && s.hportu.toLowerCase().includes(q))
    );
  }, [normalizedStudents, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  return (
    <div className="divide-y divide-slate-200">
      {/* Toolbar Tabel Daftar Siswa */}
      <div className="px-6 py-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search
              className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari NIS, nama siswa, kelas, atau HP wali..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>
              Menampilkan {formatNumberId(filteredStudents.length)} siswa
            </span>
            {isReadOnlyMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-600">
                  Mode Baca Saja (Read-Only)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Guard RBAC: Tombol "Tambah Siswa" HANYA dirender jika SIMAKA punya izin 'create' */}
        {onAddSiswa && (
          <Can modul="SIMAKA" action="create">
            <Button
              type="button"
              size="sm"
              onClick={onAddSiswa}
              className="whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tambah Siswa</span>
            </Button>
          </Can>
        )}
      </div>

      {/* Konten Tabel Daftar Siswa */}
      {isLoading ? (
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="px-6 py-4 flex items-center gap-4 animate-pulse"
            >
              <div className="h-8 w-8 rounded-full bg-slate-200 shrink-0" />
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-28 bg-slate-100 rounded hidden sm:block" />
              <div className="h-4 w-24 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-14 px-6 text-center space-y-1.5">
          <p className="text-sm font-semibold text-slate-800">
            Data Siswa Tidak Ditemukan
          </p>
          <p className="text-xs text-slate-500">
            Tidak ada peserta didik yang cocok dengan kriteria pencarian saat ini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-5 whitespace-nowrap">NIS</th>
                <th className="py-3 px-5 whitespace-nowrap">Nama Siswa</th>
                <th className="py-3 px-5 whitespace-nowrap">Kelas</th>
                <th className="py-3 px-5 whitespace-nowrap">Kontak Wali</th>
                <th className="py-3 px-5 whitespace-nowrap">Status</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {paginatedStudents.map((siswa, idx) => (
                <tr
                  key={`${siswa.nis}-${idx}`}
                  onClick={() =>
                    onInspect({
                      mode: 'siswa',
                      title: siswa.nama,
                      identifier: siswa.nis,
                      row: siswa.raw,
                    })
                  }
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                    <div>{siswa.nis}</div>
                    {siswa.nisn && (
                      <div className="text-[11px] font-normal text-slate-500">
                        NISN {siswa.nisn}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <AvatarImage
                        rawSrc={siswa.foto}
                        name={siswa.nama}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {siswa.nama}
                        </div>
                        {(siswa.kelamin || siswa.tahunmasuk) && (
                          <div className="text-xs text-slate-500 tabular-nums">
                            {[
                              siswa.kelamin,
                              siswa.tahunmasuk
                                ? `Angkatan ${siswa.tahunmasuk}`
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-5 text-xs font-medium text-slate-800 whitespace-nowrap">
                    {siswa.kelas}
                  </td>

                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="font-mono text-xs text-slate-700 tabular-nums">
                      {siswa.hportu || '-'}
                    </div>
                    {siswa.emailsiswa && (
                      <div className="text-xs text-slate-500 truncate max-w-[180px]">
                        {siswa.emailsiswa}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        siswa.aktif ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {siswa.aktif ? (
                        <CheckCircle2
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <MinusCircle
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span>{siswa.aktif ? 'Aktif' : 'Nonaktif'}</span>
                    </span>
                  </td>

                  <td
                    className="py-3 px-5 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onInspect({
                            mode: 'siswa',
                            title: siswa.nama,
                            identifier: siswa.nis,
                            row: siswa.raw,
                          })
                        }
                        className="whitespace-nowrap shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Detail</span>
                      </Button>

                      {/* Guard RBAC: Tombol "Edit" HANYA muncul bila SIMAKA punya izin 'update' */}
                      {onEditSiswa && (
                        <Can modul="SIMAKA" action="update">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onEditSiswa(siswa.raw)}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </Button>
                        </Can>
                      )}

                      {/* Guard RBAC: Tombol "Hapus" HANYA muncul bila SIMAKA punya izin 'delete' */}
                      {onDeleteSiswa && (
                        <Can modul="SIMAKA" action="delete">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onDeleteSiswa(siswa.raw)}
                            className="text-red-700 border-red-200 hover:bg-red-50 whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Hapus</span>
                          </Button>
                        </Can>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Navigasi Halaman */}
      {filteredStudents.length > pageSize && (
        <div className="px-6 py-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="tabular-nums">
            Halaman <span className="font-semibold text-slate-900">{currentPage}</span>{' '}
            dari <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sebelumnya</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
