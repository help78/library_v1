import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  MinusCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  formatColumnLabel,
  formatDateId,
  formatDateTimeId,
  formatNumberId,
  formatRupiah,
  isCurrencyColumn,
  isDateColumn,
  isDateTimeColumn,
  isHiddenSyncKey,
  isStatusColumn,
  selectTableColumns,
} from '../../lib/formatters';
import { AvatarImage } from './AvatarImage';
import { Button } from '../ui/button';

export interface InspectedEntity {
  mode: 'siswa' | 'pegawai' | 'kelas' | 'jabatan' | 'generic' | 'raw-response';
  title: string;
  identifier?: string;
  row: Record<string, unknown>;
}

interface SmartDataTableProps {
  rows: Record<string, unknown>[];
  singleObject: Record<string, unknown> | null;
  isLoading: boolean;
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
  emptyMessage?: string;
  onInspect: (entity: InspectedEntity) => void;
  onQuickReturnBook?: (replid: string) => void;
  onQuickBorrowBook?: (kodepustaka: string) => void;
  onOpenDigitalBook?: (row: Record<string, unknown>) => void;
  onLinkDigitalBook?: (row: Record<string, unknown>) => void;
  onUnlinkDigitalBook?: (row: Record<string, unknown>) => void;
  onGrantHakAkses?: (nip: string) => void;
  onRevokeHakAkses?: (replid: string) => void;
  onEditJabatan?: (row: Record<string, unknown>) => void;
  onDeleteJabatan?: (row: Record<string, unknown>) => void;
  onManagePegawaiJabatan?: (row: Record<string, unknown>) => void;
  onSetGuruMapel?: (row: Record<string, unknown>) => void;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (row: Record<string, unknown>) => void;
}

function renderStatusValue(key: string, val: unknown) {
  const lowerKey = key.toLowerCase();
  const str = String(val ?? '').trim();
  const lowerVal = str.toLowerCase();

  if (lowerKey === 'is_digital') {
    const isDigital =
      str === '1' || lowerVal === 'true' || lowerVal === 'ya';
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
          isDigital ? 'text-emerald-700' : 'text-slate-500'
        }`}
      >
        {isDigital ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <MinusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>{isDigital ? 'Tersedia E-Book' : 'Cetak Fisik'}</span>
      </span>
    );
  }

  if (lowerKey === 'aktif' || lowerKey === 'status_aktif' || lowerKey === 'isdefault') {
    const isActive = str === '1' || lowerVal === 'aktif' || lowerVal === 'true' || lowerVal === 'ya';
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          isActive ? 'text-emerald-700' : 'text-slate-500'
        }`}
      >
        {isActive ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <MinusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
      </span>
    );
  }

  const isPositive =
    lowerVal.includes('tersedia') ||
    lowerVal.includes('hadir') ||
    lowerVal.includes('kembali') ||
    lowerVal.includes('lunas');
  const isPending =
    lowerVal.includes('pinjam') ||
    lowerVal.includes('izin') ||
    lowerVal.includes('sakit');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        isPositive
          ? 'text-emerald-700'
          : isPending
          ? 'text-amber-700'
          : 'text-slate-700'
      }`}
    >
      {isPositive ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : isPending ? (
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{str || '-'}</span>
    </span>
  );
}

export function formatCellDisplay(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">-</span>;
  }

  if (key.toLowerCase() === 'foto') {
    return <AvatarImage rawSrc={value} size="sm" />;
  }

  if (isCurrencyColumn(key)) {
    return (
      <span className="font-mono text-xs font-medium text-slate-900 tabular-nums">
        {formatRupiah(value)}
      </span>
    );
  }

  if (isStatusColumn(key)) {
    return renderStatusValue(key, value);
  }

  if (isDateTimeColumn(key)) {
    return (
      <span className="tabular-nums text-slate-700 whitespace-nowrap">
        {formatDateTimeId(value)}
      </span>
    );
  }

  if (isDateColumn(key)) {
    return (
      <span className="tabular-nums text-slate-700 whitespace-nowrap">
        {formatDateId(value)}
      </span>
    );
  }

  if (typeof value === 'object') {
    return (
      <span className="font-mono text-xs text-slate-500">
        {Array.isArray(value) ? `[${value.length} entri]` : '{Objek}'}
      </span>
    );
  }

  const text = String(value);

  if (key.toLowerCase() === 'file_url') {
    if (text === 'null' || text === 'undefined') {
      return <span className="text-slate-400">-</span>;
    }
    return (
      <span
        className="text-xs font-medium text-emerald-700 whitespace-nowrap"
        title={text}
      >
        Berkas Tertaut
      </span>
    );
  }

  const isCodeLike = /^(id|nip|nis|nisn|nik|replid|kode|idkelas|idpelajaran|id_pustaka|idpustaka|tahun|kodepustaka|idpp|id_phsiswa|jam|jammasuk|jampulang)$/i.test(
    key
  );

  if (isCodeLike) {
    return (
      <span className="font-mono text-xs font-medium text-slate-800 tabular-nums whitespace-nowrap">
        {text}
      </span>
    );
  }

  return (
    <span className="text-slate-800 line-clamp-2 max-w-xs" title={text.length > 60 ? text : undefined}>
      {text}
    </span>
  );
}

function isRowDigitalBook(row: Record<string, unknown>): boolean {
  const flag = Number(row.is_digital) === 1;
  const url = String(row.file_url ?? '').trim();
  const hasValidUrl = Boolean(url && url !== 'null' && url !== 'undefined');
  return flag || hasValidUrl;
}

export function SmartDataTable({
  rows,
  singleObject,
  isLoading,
  entityType = 'generic',
  emptyMessage = 'Tidak ada rekaman data yang ditemukan untuk parameter saat ini.',
  onInspect,
  onQuickReturnBook,
  onQuickBorrowBook,
  onOpenDigitalBook,
  onLinkDigitalBook,
  onUnlinkDigitalBook,
  onGrantHakAkses,
  onRevokeHakAkses,
  onEditJabatan,
  onDeleteJabatan,
  onManagePegawaiJabatan,
  onSetGuruMapel,
  onEditRow,
  onDeleteRow,
}: SmartDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [digitalFilter, setDigitalFilter] = useState<'all' | 'digital' | 'print'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setDigitalFilter('all');
  }, [entityType]);

  useEffect(() => {
    setPage(1);
  }, [rows, searchTerm, digitalFilter, pageSize]);

  const pustakaCounts = useMemo(() => {
    if (entityType !== 'pustaka' || !rows.length) {
      return null;
    }
    let digital = 0;
    for (const r of rows) {
      if (isRowDigitalBook(r)) {
        digital += 1;
      }
    }
    return {
      total: rows.length,
      digital,
      print: rows.length - digital,
    };
  }, [entityType, rows]);

  const filteredRows = useMemo(() => {
    let base = rows;
    if (entityType === 'pustaka' && digitalFilter !== 'all') {
      base = base.filter((r) =>
        digitalFilter === 'digital' ? isRowDigitalBook(r) : !isRowDigitalBook(r)
      );
    }

    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return base;
    }
    return base.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined || typeof val === 'object') {
          return false;
        }
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [rows, entityType, digitalFilter, searchTerm]);

  const columns = useMemo(
    () => selectTableColumns(filteredRows.length > 0 ? filteredRows : rows, 10),
    [filteredRows, rows]
  );

  // Kalkulasi otomatis ringkasan finansial apabila tabel memuat kolom kewajiban / sisa_asli
  const financialTotals = useMemo(() => {
    if (!filteredRows.length) {
      return null;
    }
    const sample = filteredRows[0];
    if (!('kewajiban' in sample) && !('sisa_asli' in sample)) {
      return null;
    }
    let kewajiban = 0;
    let terbayar = 0;
    let sisa = 0;
    for (const r of filteredRows) {
      kewajiban += Number(r.kewajiban || 0);
      terbayar += Number(r.terbayar || 0);
      sisa += Number(r.sisa_asli || 0);
    }
    return { kewajiban, terbayar, sisa };
  }, [filteredRows]);

  // Kalkulasi otomatis ringkasan kehadiran apabila tabel memuat kolom status_absen
  const attendanceTotals = useMemo(() => {
    if (!filteredRows.length) {
      return null;
    }
    const sample = filteredRows[0];
    if (!('status_absen' in sample)) {
      return null;
    }
    let hadir = 0;
    let izinSakit = 0;
    let alpaLainnya = 0;
    for (const r of filteredRows) {
      const s = String(r.status_absen || '').trim().toLowerCase();
      if (s.includes('hadir')) {
        hadir += 1;
      } else if (s.includes('izin') || s.includes('sakit') || s.includes('cuti')) {
        izinSakit += 1;
      } else {
        alpaLainnya += 1;
      }
    }
    const total = filteredRows.length;
    const persenHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;
    const distinctStudents = new Set(
      filteredRows.map((r) => String(r.nis || '')).filter(Boolean)
    );
    const singleStudentName =
      distinctStudents.size === 1 && filteredRows[0].nama_siswa
        ? `${String(filteredRows[0].nama_siswa)} (NIS ${String(filteredRows[0].nis)})`
        : null;

    return {
      total,
      hadir,
      izinSakit,
      alpaLainnya,
      persenHadir,
      singleStudentName,
    };
  }, [filteredRows]);

  // Kalkulasi otomatis ringkasan log baca buku digital apabila tabel memuat waktu + idpustaka + nis
  const readingLogTotals = useMemo(() => {
    if (!filteredRows.length) {
      return null;
    }
    const sample = filteredRows[0];
    if (!('waktu' in sample) || !('idpustaka' in sample) || !('nis' in sample)) {
      return null;
    }
    const uniqueReaders = new Set(
      filteredRows.map((r) => String(r.nis || '').trim()).filter(Boolean)
    );
    const uniqueBooks = new Set(
      filteredRows.map((r) => String(r.idpustaka || '').trim()).filter(Boolean)
    );
    return {
      totalSessions: filteredRows.length,
      uniqueReaders: uniqueReaders.size,
      uniqueBooks: uniqueBooks.size,
    };
  }, [filteredRows]);

  if (isLoading) {
    return (
      <div className="divide-y divide-slate-200">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="px-6 py-3.5 flex items-center gap-6 animate-pulse">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-100 rounded hidden sm:block" />
            <div className="h-4 w-24 bg-slate-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  // Render objek tunggal (mis. Detail Siswa / Detail Pegawai / Detail Jabatan / Detail Tautan Digital)
  if (singleObject && !rows.length) {
    const entries = Object.entries(singleObject).filter(
      ([k]) => k.toLowerCase() !== 'foto' && !isHiddenSyncKey(k)
    );
    const displayName = String(
      singleObject.nama ||
        singleObject.jabatan ||
        singleObject.judul ||
        (singleObject.idpustaka !== undefined
          ? `Tautan Pustaka Digital #${String(singleObject.idpustaka)}`
          : 'Detail Rekaman Data')
    );
    const singleHasDigitalUrl = Boolean(
      singleObject.file_url &&
        String(singleObject.file_url).trim() !== '' &&
        String(singleObject.file_url) !== 'null'
    );

    return (
      <div className="divide-y divide-slate-200">
        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {'foto' in singleObject && (
              <AvatarImage rawSrc={singleObject.foto} name={displayName} size="lg" />
            )}
            <div>
              <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Menampilkan {entries.length} atribut terstruktur dari respons endpoint.
              </p>
            </div>
          </div>

          {Boolean(singleObject.nip) && onManagePegawaiJabatan && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onManagePegawaiJabatan(singleObject)}
              >
                <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kelola Jabatan</span>
              </Button>
            </div>
          )}

          {entityType === 'jabatan' && (onEditJabatan || onDeleteJabatan) && (
            <div className="flex flex-wrap items-center gap-2">
              {onEditJabatan && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEditJabatan(singleObject)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ubah Jabatan</span>
                </Button>
              )}
              {onDeleteJabatan && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteJabatan(singleObject)}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus Jabatan</span>
                </Button>
              )}
            </div>
          )}

          {(onEditRow || onDeleteRow) && (
            <div className="flex flex-wrap items-center gap-2">
              {onEditRow && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEditRow(singleObject)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ubah Data</span>
                </Button>
              )}
              {onDeleteRow && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteRow(singleObject)}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus Data</span>
                </Button>
              )}
            </div>
          )}

          {(entityType === 'pustaka-digital' || singleHasDigitalUrl) && (
            <div className="flex flex-wrap items-center gap-2">
              {singleHasDigitalUrl && onOpenDigitalBook && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onOpenDigitalBook(singleObject)}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Baca E-Book</span>
                </Button>
              )}
              {onLinkDigitalBook && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onLinkDigitalBook(singleObject)}
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ubah Tautan</span>
                </Button>
              )}
              {singleHasDigitalUrl && onUnlinkDigitalBook && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUnlinkDigitalBook(singleObject)}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus Tautan</span>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 border-slate-200">
          {entries.map(([key, val], eIdx) => (
            <div
              key={`${key}-${eIdx}`}
              className="px-6 py-3.5 border-b border-slate-100 flex items-baseline justify-between gap-4 text-sm"
            >
              <span className="text-xs font-medium text-slate-500 shrink-0">
                {formatColumnLabel(key)}
              </span>
              <div className="text-right font-medium">
                {formatCellDisplay(key, val)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm font-medium text-slate-700">{emptyMessage}</p>
        <p className="text-xs text-slate-500 mt-1">
          Ubah filter pencarian di atas atau tambah data baru melalui tombol tindakan modul.
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

  const handleInspectRow = (row: Record<string, unknown>) => {
    if (entityType === 'siswa' || ('nis' in row && row.nis)) {
      const nis = String(row.nis);
      onInspect({
        mode: 'siswa',
        title: String(row.nama || row.nama_siswa || `Siswa NIS ${nis}`),
        identifier: nis,
        row,
      });
      return;
    }

    if (entityType === 'pegawai' || ('nip' in row && row.nip)) {
      const nip = String(row.nip);
      onInspect({
        mode: 'pegawai',
        title: String(row.nama || row.nama_pegawai || `Pegawai NIP ${nip}`),
        identifier: nip,
        row,
      });
      return;
    }

    if (entityType === 'jabatan' && row.replid !== undefined) {
      const replid = String(row.replid);
      onInspect({
        mode: 'jabatan',
        title: String(row.jabatan || `Jabatan #${replid}`),
        identifier: replid,
        row,
      });
      return;
    }

    if (entityType === 'kelas' && row.idkelas !== undefined) {
      const idkelas = String(row.idkelas);
      onInspect({
        mode: 'kelas',
        title: String(row.nama_kelas || `Kelas #${idkelas}`),
        identifier: idkelas,
        row,
      });
      return;
    }

    onInspect({
      mode: 'generic',
      title: String(
        row.nama ||
          row.jabatan ||
          row.judul ||
          row.nama_mapel ||
          row.nama_kalender ||
          `Rincian Data #${String(row.replid ?? '')}`
      ),
      row,
    });
  };

  return (
    <div className="divide-y divide-slate-200">
      {/* Ringkasan Agregasi Finansial Otomatis (Khusus Data Tagihan) */}
      {financialTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
          <div className="px-6 py-4">
            <div className="text-xs font-medium text-slate-500">Total Kewajiban Tagihan</div>
            <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
              {formatRupiah(financialTotals.kewajiban)}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs font-medium text-slate-500">Total Sudah Terbayar</div>
            <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700">
              {formatRupiah(financialTotals.terbayar)}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs font-medium text-slate-500">Total Sisa Tunggakan</div>
            <div className="mt-1 text-base font-bold font-mono tabular-nums text-amber-700">
              {formatRupiah(financialTotals.sisa)}
            </div>
          </div>
        </div>
      )}

      {/* Ringkasan Agregasi Kehadiran Otomatis (Khusus Data Presensi Pelajaran / Harian) */}
      {attendanceTotals && (
        <div className="bg-slate-50/50 divide-y divide-slate-200">
          {attendanceTotals.singleStudentName && (
            <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Rekapitulasi Kehadiran Peserta Didik:{' '}
                <strong className="font-semibold text-slate-900">
                  {attendanceTotals.singleStudentName}
                </strong>
              </span>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                Tingkat Kehadiran: {attendanceTotals.persenHadir}%
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="px-6 py-4">
              <div className="text-xs font-medium text-slate-500">Total Sesi Tercatat</div>
              <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
                {formatNumberId(attendanceTotals.total)} Sesi
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-xs font-medium text-slate-500">Hadir</div>
              <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700">
                {formatNumberId(attendanceTotals.hadir)} ({attendanceTotals.persenHadir}%)
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-xs font-medium text-slate-500">Izin / Sakit</div>
              <div className="mt-1 text-base font-bold font-mono tabular-nums text-amber-700">
                {formatNumberId(attendanceTotals.izinSakit)}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-xs font-medium text-slate-500">Alpa / Tanpa Ket.</div>
              <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-700">
                {formatNumberId(attendanceTotals.alpaLainnya)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ringkasan Log Aktivitas Baca Buku Digital */}
      {readingLogTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
          <div className="px-6 py-4">
            <div className="text-xs font-medium text-slate-500">Total Aktivitas Baca</div>
            <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
              {formatNumberId(readingLogTotals.totalSessions)} Sesi
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs font-medium text-slate-500">Siswa Pembaca Unik</div>
            <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700">
              {formatNumberId(readingLogTotals.uniqueReaders)} Siswa
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="text-xs font-medium text-slate-500">Judul E-Book Dibaca</div>
            <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900">
              {formatNumberId(readingLogTotals.uniqueBooks)} Judul
            </div>
          </div>
        </div>
      )}

      {/* Bilah Filter Koleksi Pustaka Cetak vs E-Book Digital */}
      {pustakaCounts && (
        <div className="px-6 py-3.5 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 tabular-nums">
            Ringkasan Koleksi:{' '}
            <strong className="font-semibold text-slate-900">
              {formatNumberId(pustakaCounts.total)}
            </strong>{' '}
            judul terdaftar ·{' '}
            <strong className="font-semibold text-emerald-700">
              {formatNumberId(pustakaCounts.digital)}
            </strong>{' '}
            tersedia dalam E-Book Digital
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
            role="group"
            aria-label="Filter Format Koleksi Pustaka"
          >
            <button
              type="button"
              onClick={() => setDigitalFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                digitalFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({formatNumberId(pustakaCounts.total)})
            </button>
            <button
              type="button"
              onClick={() => setDigitalFilter('digital')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                digitalFilter === 'digital'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              E-Book Digital ({formatNumberId(pustakaCounts.digital)})
            </button>
            <button
              type="button"
              onClick={() => setDigitalFilter('print')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                digitalFilter === 'print'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cetak Fisik ({formatNumberId(pustakaCounts.print)})
            </button>
          </div>
        </div>
      )}

      {/* Bilah Pencarian Cepat Tabel & Ukuran Halaman */}
      <div className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Saring cepat pada tabel ini..."
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
          <span className="tabular-nums">
            {formatNumberId(filteredRows.length)} rekaman
          </span>
          <span aria-hidden="true">·</span>
          <label className="inline-flex items-center gap-1.5">
            <span>Tampil</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
      </div>

      {/* Tabel Data Kepadatan Tinggi */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
              {columns.map((col, cIdx) => (
                <th
                  key={`${col}-${cIdx}`}
                  className={`py-3 px-5 whitespace-nowrap ${
                    isCurrencyColumn(col) ? 'text-right' : 'text-left'
                  }`}
                >
                  {formatColumnLabel(col)}
                </th>
              ))}
              <th className="py-3 px-5 text-right whitespace-nowrap">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="py-10 px-6 text-center text-sm text-slate-500"
                >
                  {searchTerm
                    ? `Tidak ada baris yang cocok dengan kata kunci "${searchTerm}".`
                    : digitalFilter === 'digital'
                    ? 'Belum ada buku pada daftar ini yang memiliki tautan berkas E-Book Digital.'
                    : 'Tidak ada rekaman yang sesuai dengan filter saat ini.'}
                </td>
              </tr>
            ) : (
              pageRows.map((row, rIdx) => {
                const rowKey = String(
                  row.replid ??
                    row.id ??
                    row.nis ??
                    row.nip ??
                    row.idkelas ??
                    row.id_pustaka ??
                    row.idpustaka ??
                    startIdx + rIdx
                );
                const canReturnBook =
                  entityType === 'pinjam' &&
                  onQuickReturnBook &&
                  row.replid !== undefined &&
                  String(row.status) === '1';

                const canBorrowCopy =
                  entityType === 'eksemplar' &&
                  onQuickBorrowBook &&
                  Boolean(row.kodepustaka) &&
                  (String(row.status) === '1' ||
                    String(row.status_buku ?? '')
                      .toLowerCase()
                      .includes('tersedia'));

                const isPustakaRow =
                  entityType === 'pustaka' || entityType === 'pustaka-digital';
                const hasDigitalUrl =
                  isPustakaRow &&
                  Boolean(
                    row.file_url &&
                      String(row.file_url).trim() !== '' &&
                      String(row.file_url) !== 'null'
                  );

                let actionLabel = 'Rincian';
                if (entityType === 'siswa' || ('nis' in row && row.nis)) {
                  actionLabel = 'Profil Siswa';
                } else if (entityType === 'pegawai' || ('nip' in row && row.nip)) {
                  actionLabel = 'Profil SDM';
                } else if (entityType === 'jabatan' && row.replid !== undefined) {
                  actionLabel = 'Detail';
                } else if (entityType === 'kelas' && row.idkelas !== undefined) {
                  actionLabel = 'Siswa & Jadwal';
                }

                return (
                  <tr
                    key={`${rowKey}-${rIdx}`}
                    onClick={() => handleInspectRow(row)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={`${col}-${cIdx}`}
                        className={`py-2.5 px-5 align-middle ${
                          isCurrencyColumn(col) ? 'text-right' : 'text-left'
                        }`}
                      >
                        {formatCellDisplay(col, row[col])}
                      </td>
                    ))}
                    <td
                      className="py-2.5 px-5 text-right whitespace-nowrap align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-2">
                        {hasDigitalUrl && onOpenDigitalBook && (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => onOpenDigitalBook(row)}
                          >
                            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Baca E-Book</span>
                          </Button>
                        )}
                        {isPustakaRow && onLinkDigitalBook && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onLinkDigitalBook(row)}
                          >
                            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{hasDigitalUrl ? 'Ubah E-Book' : 'Tautkan E-Book'}</span>
                          </Button>
                        )}
                        {entityType === 'pustaka-digital' &&
                          hasDigitalUrl &&
                          onUnlinkDigitalBook && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onUnlinkDigitalBook(row)}
                              className="text-red-700 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Hapus</span>
                            </Button>
                          )}
                        {canBorrowCopy && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              onQuickBorrowBook(String(row.kodepustaka))
                            }
                          >
                            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Pinjamkan</span>
                          </Button>
                        )}
                        {canReturnBook && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onQuickReturnBook(String(row.replid))}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Kembalikan</span>
                          </Button>
                        )}
                        {entityType === 'pegawai' &&
                          onManagePegawaiJabatan &&
                          Boolean(row.nip) && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onManagePegawaiJabatan(row)}
                            >
                              <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Kelola Jabatan</span>
                            </Button>
                          )}
                        {entityType === 'pegawai' &&
                          onGrantHakAkses &&
                          Boolean(row.nip) && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onGrantHakAkses(String(row.nip))}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Hak Akses</span>
                            </Button>
                          )}
                        {onSetGuruMapel && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onSetGuruMapel(row)}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Set Guru Mapel</span>
                          </Button>
                        )}
                        {entityType === 'jabatan' &&
                          onEditJabatan &&
                          row.replid !== undefined && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onEditJabatan(row)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Ubah</span>
                            </Button>
                          )}
                        {entityType === 'jabatan' &&
                          onDeleteJabatan &&
                          row.replid !== undefined && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onDeleteJabatan(row)}
                              className="text-red-700 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Hapus</span>
                            </Button>
                          )}
                        {entityType === 'hakakses' &&
                          onRevokeHakAkses &&
                          row.replid !== undefined && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onRevokeHakAkses(String(row.replid))}
                              className="text-red-700 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Cabut</span>
                            </Button>
                          )}
                        {onEditRow && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onEditRow(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Ubah</span>
                          </Button>
                        )}
                        {onDeleteRow && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onDeleteRow(row)}
                            className="text-red-700 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Hapus</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInspectRow(row)}
                        >
                          {actionLabel}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Paginasi */}
      {totalPages > 1 && (
        <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 bg-white text-xs text-slate-600">
          <div className="tabular-nums">
            Menampilkan{' '}
            <span className="font-semibold text-slate-900">
              {formatNumberId(startIdx + 1)}–
              {formatNumberId(Math.min(startIdx + pageSize, filteredRows.length))}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-slate-900">
              {formatNumberId(filteredRows.length)}
            </span>{' '}
            data
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Sebelumnya</span>
            </Button>
            <span className="px-2 font-mono tabular-nums text-slate-700">
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
