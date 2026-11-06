import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Download,
  Eye,
  FileSpreadsheet,
  HeartPulse,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import {
  API_URL_CHANGED_EVENT,
  apiClient,
  extractApiErrorMessage,
  getActiveApiBaseUrl,
} from '../../lib/api';
import {
  extractResponsePayload,
  formatColumnLabel,
  formatNumberId,
} from '../../lib/formatters';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { InspectedEntity } from './SmartDataTable';

export type PresensiEndpointPath =
  | '/jbsakad/presensiharian'
  | '/jbsakad/presensi-pelajaran';

export interface PresensiRekap {
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  cuti: number;
}

export interface PresensiSiswaItem {
  tanggal: string;
  nis: string;
  nama_siswa: string;
  nama_kelas: string;
  status_absen: string;
  keterangan: string;
  pelajaran?: string;
  guru?: string;
  raw: Record<string, unknown>;
}

interface PresensiApiPayload {
  status?: string;
  total?: number;
  rekap?: Partial<PresensiRekap> | null;
  data?: unknown;
  [key: string]: unknown;
}

interface KelasMasterOption {
  id: string;
  label: string;
}

export interface PresensiKelasTableProps {
  endpoint: PresensiEndpointPath;
  title: string;
  description: string;
  initialIdKelas?: string;
  refreshSignal?: number;
  onInspectEntity?: (entity: InspectedEntity) => void;
}

type RekapCategoryKey = keyof PresensiRekap;

interface RekapCategoryMeta {
  key: RekapCategoryKey;
  label: string;
  strokeHex: string;
  dotClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const REKAP_CATEGORIES: RekapCategoryMeta[] = [
  {
    key: 'hadir',
    label: 'Hadir',
    strokeHex: '#16A34A',
    dotClass: 'bg-emerald-600',
    textClass: 'text-emerald-700',
    icon: CheckCircle2,
  },
  {
    key: 'izin',
    label: 'Izin',
    strokeHex: '#0284C7',
    dotClass: 'bg-sky-600',
    textClass: 'text-sky-700',
    icon: Clock,
  },
  {
    key: 'sakit',
    label: 'Sakit',
    strokeHex: '#D97706',
    dotClass: 'bg-amber-600',
    textClass: 'text-amber-700',
    icon: HeartPulse,
  },
  {
    key: 'alpa',
    label: 'Alpa',
    strokeHex: '#DC2626',
    dotClass: 'bg-red-600',
    textClass: 'text-red-700',
    icon: XCircle,
  },
  {
    key: 'cuti',
    label: 'Cuti',
    strokeHex: '#64748B',
    dotClass: 'bg-slate-500',
    textClass: 'text-slate-600',
    icon: CalendarOff,
  },
];

function normalizeRekapObject(rawRekap: unknown): PresensiRekap | null {
  if (!rawRekap || typeof rawRekap !== 'object' || Array.isArray(rawRekap)) {
    return null;
  }
  const obj = rawRekap as Record<string, unknown>;
  const hasKnownKey =
    'hadir' in obj ||
    'izin' in obj ||
    'sakit' in obj ||
    'alpa' in obj ||
    'cuti' in obj;

  if (!hasKnownKey) {
    return null;
  }

  return {
    hadir: Number(obj.hadir ?? 0) || 0,
    izin: Number(obj.izin ?? 0) || 0,
    sakit: Number(obj.sakit ?? 0) || 0,
    alpa: Number(obj.alpa ?? 0) || 0,
    cuti: Number(obj.cuti ?? 0) || 0,
  };
}

function normalizePresensiStudentRow(
  row: Record<string, unknown>
): PresensiSiswaItem {
  const cleanStr = (val: unknown, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    const str = String(val).trim();
    return str === 'null' || str === 'undefined' ? fallback : str;
  };

  return {
    tanggal: cleanStr(
      row.tanggal ?? row.tgl ?? row.tanggal_presensi ?? row.tglpresensi,
      '-'
    ),
    nis: cleanStr(row.nis, '-'),
    nama_siswa: cleanStr(row.nama_siswa ?? row.nama ?? row.namasiswa, '-'),
    nama_kelas: cleanStr(
      row.nama_kelas ?? row.kelas ?? (row.idkelas ? `Kelas #${row.idkelas}` : '-'),
      '-'
    ),
    status_absen: cleanStr(
      row.status_absen ?? row.status ?? row.kehadiran ?? row.statushadir,
      '-'
    ),
    keterangan: cleanStr(row.keterangan ?? row.catatan ?? row.ket, ''),
    pelajaran: cleanStr(
      row.nama_pelajaran ?? row.pelajaran ?? row.mapel ?? row.namapelajaran,
      ''
    ),
    guru: cleanStr(row.nama_guru ?? row.guru ?? row.nipguru, ''),
    raw: row,
  };
}

function resolveStatusVisual(statusRaw: string): {
  label: string;
  textClass: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
} {
  const lower = statusRaw.trim().toLowerCase();
  if (lower === 'hadir' || lower === 'h' || lower === '1') {
    return {
      label: statusRaw || 'Hadir',
      textClass: 'text-emerald-700',
      Icon: CheckCircle2,
    };
  }
  if (lower === 'izin' || lower === 'i' || lower === '2') {
    return {
      label: statusRaw || 'Izin',
      textClass: 'text-sky-700',
      Icon: Clock,
    };
  }
  if (lower === 'sakit' || lower === 's' || lower === '3') {
    return {
      label: statusRaw || 'Sakit',
      textClass: 'text-amber-700',
      Icon: HeartPulse,
    };
  }
  if (lower === 'alpa' || lower === 'alpha' || lower === 'a' || lower === '4') {
    return {
      label: statusRaw || 'Alpa',
      textClass: 'text-red-700',
      Icon: XCircle,
    };
  }
  if (lower === 'cuti' || lower === 'c' || lower === '5') {
    return {
      label: statusRaw || 'Cuti',
      textClass: 'text-slate-600',
      Icon: CalendarOff,
    };
  }
  return {
    label: statusRaw || '-',
    textClass: 'text-slate-700',
    Icon: CheckCircle2,
  };
}

/**
 * Komponen Grafik Donut / Pie SVG berbasis objek `rekap` dari Backend API
 * (Single Source of Truth — tanpa looping array siswa di sisi frontend).
 */
const PresensiRekapChart: React.FC<{
  rekap: PresensiRekap;
  totalRecords: number;
}> = ({ rekap, totalRecords }) => {
  const [hoveredKey, setHoveredKey] = useState<RekapCategoryKey | null>(null);

  // Penjumlahan langsung 5 properti skalar pada objek `rekap` dari server (O(1), tanpa looping baris data)
  const rekapSum =
    rekap.hadir + rekap.izin + rekap.sakit + rekap.alpa + rekap.cuti;
  const denominator = rekapSum > 0 ? rekapSum : 1;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const slices = REKAP_CATEGORIES.map((cat) => {
    const value = rekap[cat.key];
    const ratio = rekapSum > 0 ? value / denominator : 0;
    const strokeLength = ratio * circumference;
    const dashOffset = -cumulativeOffset;
    cumulativeOffset += strokeLength;

    return {
      ...cat,
      value,
      percentage: rekapSum > 0 ? (value / denominator) * 100 : 0,
      strokeLength,
      dashOffset,
    };
  });

  const activeSlice = hoveredKey
    ? slices.find((s) => s.key === hoveredKey) ?? null
    : null;

  const hadirPct =
    rekapSum > 0 ? ((rekap.hadir / denominator) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0 w-40 h-40 flex items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="w-40 h-40"
          role="img"
          aria-label={`Distribusi rekap presensi: Hadir ${rekap.hadir}, Izin ${rekap.izin}, Sakit ${rekap.sakit}, Alpa ${rekap.alpa}, Cuti ${rekap.cuti}`}
        >
          {/* Lingkaran dasar netral */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="20"
          />

          {/* Segmen proporsi langsung dari objek `rekap` */}
          {rekapSum > 0 &&
            slices.map((slice) => {
              if (slice.value <= 0) return null;
              const isHovered = hoveredKey === slice.key;
              return (
                <circle
                  key={slice.key}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={slice.strokeHex}
                  strokeWidth={isHovered ? 24 : 20}
                  strokeDasharray={`${slice.strokeLength} ${Math.max(
                    0,
                    circumference - slice.strokeLength
                  )}`}
                  strokeDashoffset={slice.dashOffset}
                  transform="rotate(-90 80 80)"
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredKey(slice.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <title>
                    {slice.label}: {slice.value} ({slice.percentage.toFixed(1)}%)
                  </title>
                </circle>
              );
            })}
        </svg>

        {/* Label Tengah Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
          {activeSlice ? (
            <>
              <span className="text-[11px] font-medium text-slate-500">
                {activeSlice.label}
              </span>
              <span className="text-lg font-bold text-slate-900 font-mono tabular-nums leading-tight">
                {formatNumberId(activeSlice.value)}
              </span>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {activeSlice.percentage.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-medium text-slate-500">
                Hadir
              </span>
              <span className="text-lg font-bold text-slate-900 font-mono tabular-nums leading-tight">
                {hadirPct}%
              </span>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Total {formatNumberId(totalRecords)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legenda Proporsi Rekap */}
      <div className="flex-1 w-full space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Distribusi Auto-Rekap Server
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Total Rekap: {formatNumberId(rekapSum)}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {slices.map((slice) => (
            <div
              key={slice.key}
              onMouseEnter={() => setHoveredKey(slice.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className="py-1.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 px-1.5 rounded transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-2.5 w-2.5 rounded-sm shrink-0 ${slice.dotClass}`}
                  aria-hidden="true"
                />
                <span className="font-medium text-slate-700">
                  {slice.label}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                <span className="font-semibold text-slate-900">
                  {formatNumberId(slice.value)}
                </span>
                <span className="text-slate-500 w-12 text-right">
                  {slice.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Komponen Utama Presensi Harian & Presensi Pelajaran
 * Mengimplementasikan:
 * 1. GET /api/jbsakad/presensiharian & GET /api/jbsakad/presensi-pelajaran
 * 2. Filter Kelas (?idkelas=) + Auto-Rekap langsung dari objek `rekap` server
 * 3. Export CSV (?format=csv) via raw text/csv stream (tanpa response.json())
 */
export const PresensiKelasTable: React.FC<PresensiKelasTableProps> = ({
  endpoint,
  title,
  description,
  initialIdKelas = '201',
  refreshSignal = 0,
  onInspectEntity,
}) => {
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>(() =>
    getActiveApiBaseUrl()
  );

  // State Filter Kelas (?idkelas=)
  const [kelasOptions, setKelasOptions] = useState<KelasMasterOption[]>([]);
  const [idKelasInput, setIdKelasInput] = useState<string>(initialIdKelas);
  const [appliedIdKelas, setAppliedIdKelas] = useState<string>(initialIdKelas);

  // State Response Server (Single Source of Truth)
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rekap, setRekap] = useState<PresensiRekap | null>(null);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [rawResponse, setRawResponse] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State Download CSV
  const [isDownloadingCsv, setIsDownloadingCsv] = useState<boolean>(false);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  // State Pencarian & Filter Baris Tabel Lokal
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Sinkronisasi apabila pengguna mengganti URL Server API kustom
  useEffect(() => {
    const syncBaseUrl = () => {
      setActiveBaseUrl(getActiveApiBaseUrl());
    };
    window.addEventListener(API_URL_CHANGED_EVENT, syncBaseUrl);
    return () => window.removeEventListener(API_URL_CHANGED_EVENT, syncBaseUrl);
  }, []);

  // Muat daftar Master Kelas (/jbsakad/kelas) untuk memudahkan pemilihan ?idkelas=
  useEffect(() => {
    let cancelled = false;

    apiClient
      .get('/jbsakad/kelas')
      .then((res) => {
        if (cancelled) return;
        const normalized = extractResponsePayload(res.data);
        const mapped: KelasMasterOption[] = [];
        const seen = new Set<string>();

        for (const item of normalized.rows) {
          const id = String(item.replid ?? item.idkelas ?? '').trim();
          if (!id || id === 'null' || seen.has(id)) continue;
          seen.add(id);

          const namaKelas = String(
            item.kelas ?? item.nama_kelas ?? `Kelas #${id}`
          ).trim();
          const departemen =
            item.departemen && String(item.departemen) !== 'null'
              ? String(item.departemen).trim()
              : '';
          const tahunAjaran =
            item.tahunajaran && String(item.tahunajaran) !== 'null'
              ? String(item.tahunajaran).trim()
              : '';

          const metaParts = [departemen, tahunAjaran].filter(Boolean);
          mapped.push({
            id,
            label:
              metaParts.length > 0
                ? `${id} — ${namaKelas} (${metaParts.join(' · ')})`
                : `${id} — ${namaKelas}`,
          });
        }

        setKelasOptions(mapped);
      })
      .catch(() => {
        // Tetap berfungsi dengan input manual ID Kelas apabila endpoint kelas gagal dimuat
      });

    return () => {
      cancelled = true;
    };
  }, [activeBaseUrl]);

  // Reset paginasi dan pencarian saat filter kelas atau endpoint berubah
  useEffect(() => {
    setCurrentPage(1);
    setStatusFilter('ALL');
    setCsvErrorMsg(null);
  }, [endpoint, appliedIdKelas]);

  // Fetch Data Presensi dari Backend API
  const fetchPresensi = useCallback(
    async (targetEndpoint: PresensiEndpointPath, kelasId: string) => {
      setIsLoading(true);
      setErrorMsg(null);

      const trimmedKelas = kelasId.trim();
      const queryParams = trimmedKelas ? { idkelas: trimmedKelas } : undefined;

      try {
        const response = await apiClient.get<PresensiApiPayload>(
          targetEndpoint,
          {
            params: queryParams,
          }
        );

        const body = response.data;
        const normalized = extractResponsePayload(body);

        // Gunakan objek `rekap` dan `total` langsung dari response server tanpa perhitungan manual
        const serverRekap =
          body && typeof body === 'object' && !Array.isArray(body)
            ? normalizeRekapObject((body as PresensiApiPayload).rekap)
            : null;

        const explicitTotal =
          body &&
          typeof body === 'object' &&
          !Array.isArray(body) &&
          typeof (body as PresensiApiPayload).total === 'number'
            ? (body as PresensiApiPayload).total!
            : normalized.totalCount;

        setRows(normalized.rows);
        setRekap(serverRekap);
        setServerTotal(explicitTotal);
        setRawResponse(
          body && typeof body === 'object' && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : { data: body }
        );
      } catch (err) {
        setRows([]);
        setRekap(null);
        setServerTotal(0);
        setErrorMsg(extractApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPresensi(endpoint, appliedIdKelas);
  }, [endpoint, appliedIdKelas, refreshSignal, activeBaseUrl, fetchPresensi]);

  // URL tampilan untuk indikator endpoint aktif
  const resolvedApiDisplayPath = useMemo(() => {
    const trimmed = appliedIdKelas.trim();
    return trimmed
      ? `/api${endpoint}?idkelas=${encodeURIComponent(trimmed)}`
      : `/api${endpoint}`;
  }, [endpoint, appliedIdKelas]);

  // URL lengkap Export CSV (?format=csv / &format=csv)
  const csvDownloadUrl = useMemo(() => {
    const base = activeBaseUrl.replace(/\/+$/, '');
    const params = new URLSearchParams();
    if (appliedIdKelas.trim()) {
      params.set('idkelas', appliedIdKelas.trim());
    }
    params.set('format', 'csv');
    return `${base}${endpoint}?${params.toString()}`;
  }, [activeBaseUrl, endpoint, appliedIdKelas]);

  const csvFileName = useMemo(() => {
    const slug =
      endpoint === '/jbsakad/presensiharian'
        ? 'presensi-harian'
        : 'presensi-pelajaran';
    const kelasPart = appliedIdKelas.trim()
      ? `kelas-${appliedIdKelas.trim()}`
      : 'log-umum';
    return `${slug}-${kelasPart}.csv`;
  }, [endpoint, appliedIdKelas]);

  /**
   * Handler Download CSV sesuai spesifikasi Backend:
   * - Response HTTP adalah raw `text/csv` (BUKAN application/json).
   * - DILARANG memanggil `response.json()`.
   * - Membaca stream sebagai raw text/blob lalu memicu unduhan via anchor sementara.
   */
  const handleDownloadCsv = async (
    e: React.MouseEvent<HTMLAnchorElement>
  ) => {
    e.preventDefault();
    if (isDownloadingCsv) return;

    setIsDownloadingCsv(true);
    setCsvErrorMsg(null);

    try {
      const response = await fetch(csvDownloadUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/csv, text/plain, */*',
        },
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(
          errBody.trim() ||
            `Gagal mengunduh file CSV (HTTP ${response.status}).`
        );
      }

      // PENTING: Gunakan response.text() / Blob — JANGAN gunakan response.json()
      const rawCsvText = await response.text();
      const csvBlob = new Blob([rawCsvText], {
        type: 'text/csv;charset=utf-8;',
      });

      const blobUrl = window.URL.createObjectURL(csvBlob);
      const tempAnchor = document.createElement('a');
      tempAnchor.href = blobUrl;
      tempAnchor.setAttribute('download', csvFileName);
      document.body.appendChild(tempAnchor);
      tempAnchor.click();
      document.body.removeChild(tempAnchor);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setCsvErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengunduh file CSV.'
      );
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  // Deteksi apakah data berupa detail siswa (?idkelas= aktif atau baris mengandung nis / status_absen)
  const isStudentDetailMode = useMemo(() => {
    if (appliedIdKelas.trim() !== '') return true;
    if (rows.length === 0) return false;
    const sample = rows[0];
    return (
      'nis' in sample || 'nama_siswa' in sample || 'status_absen' in sample
    );
  }, [appliedIdKelas, rows]);

  const studentRows = useMemo(() => {
    if (!isStudentDetailMode) return [];
    return rows.map(normalizePresensiStudentRow);
  }, [isStudentDetailMode, rows]);

  const hasSubjectColumn = useMemo(
    () => studentRows.some((r) => Boolean(r.pelajaran)),
    [studentRows]
  );

  // Filter baris tabel di sisi klien (hanya untuk pencarian cepat pada tabel; Summary Cards tetap murni dari `rekap` server)
  const filteredStudentRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentRows.filter((item) => {
      if (statusFilter !== 'ALL') {
        const lowerStatus = item.status_absen.trim().toLowerCase();
        if (lowerStatus !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.nis.toLowerCase().includes(q) ||
        item.nama_siswa.toLowerCase().includes(q) ||
        item.nama_kelas.toLowerCase().includes(q) ||
        item.tanggal.toLowerCase().includes(q) ||
        item.status_absen.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q) ||
        (item.pelajaran && item.pelajaran.toLowerCase().includes(q))
      );
    });
  }, [studentRows, searchQuery, statusFilter]);

  // Filter baris ketika berada pada mode Log Umum (tanpa ?idkelas=)
  const filteredHeaderRows = useMemo(() => {
    if (isStudentDetailMode) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(q)
      )
    );
  }, [isStudentDetailMode, rows, searchQuery]);

  const headerColumns = useMemo(() => {
    if (isStudentDetailMode || rows.length === 0) return [];
    const keys = new Set<string>();
    for (const r of rows.slice(0, 15)) {
      Object.keys(r).forEach((k) => {
        if (typeof r[k] !== 'object' || r[k] === null) {
          keys.add(k);
        }
      });
    }
    return Array.from(keys).slice(0, 8);
  }, [isStudentDetailMode, rows]);

  const activeTableCount = isStudentDetailMode
    ? filteredStudentRows.length
    : filteredHeaderRows.length;

  const totalPages = Math.max(1, Math.ceil(activeTableCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedStudentRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredStudentRows.slice(start, start + pageSize);
  }, [filteredStudentRows, safePage]);

  const paginatedHeaderRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredHeaderRows.slice(start, start + pageSize);
  }, [filteredHeaderRows, safePage]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedIdKelas(idKelasInput.trim());
  };

  const handleSwitchGeneralLog = () => {
    setIdKelasInput('');
    setAppliedIdKelas('');
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
      {/* Header Endpoint, Status Total, Muat Ulang, & Tombol Download CSV */}
      <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-800">
              GET {resolvedApiDisplayPath}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-medium text-slate-700">
              Total: {formatNumberId(serverTotal)} data
            </span>
            {rekap && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium">
                  Auto-Rekap Aktif
                </span>
              </>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => fetchPresensi(endpoint, appliedIdKelas)}
            className="whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Muat Ulang</span>
          </Button>

          {/* Tombol Download CSV (?format=csv) — Raw text/csv stream */}
          <a
            href={csvDownloadUrl}
            download={csvFileName}
            onClick={handleDownloadCsv}
            title={`Unduh CSV dari ${csvDownloadUrl}`}
            className={`inline-flex items-center justify-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isDownloadingCsv
                ? 'bg-emerald-700/70 text-white cursor-wait'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isDownloadingCsv ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isDownloadingCsv ? 'Mengunduh CSV...' : 'Download CSV'}</span>
          </a>

          {onInspectEntity && Object.keys(rawResponse).length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onInspectEntity({
                  mode: 'raw-response',
                  title: `GET ${resolvedApiDisplayPath}`,
                  row: rawResponse,
                })
              }
              className="whitespace-nowrap shrink-0"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Respons JSON</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bar Kontrol Filter Kelas (?idkelas=) */}
      <form
        onSubmit={handleApplyFilter}
        className="px-6 py-4 bg-slate-50/70 flex flex-wrap items-end gap-4"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2.5 mr-1">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Filter Kelas:</span>
        </div>

        {kelasOptions.length > 0 && (
          <div className="w-full sm:w-64 space-y-1">
            <label
              htmlFor="select-master-kelas"
              className="block text-xs font-medium text-slate-600"
            >
              Pilih Rombongan Belajar
            </label>
            <select
              id="select-master-kelas"
              value={
                kelasOptions.some((opt) => opt.id === idKelasInput.trim())
                  ? idKelasInput.trim()
                  : ''
              }
              onChange={(e) => {
                const val = e.target.value;
                setIdKelasInput(val);
                setAppliedIdKelas(val);
              }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <option value="">
                {idKelasInput.trim()
                  ? `-- ID Kustom (${idKelasInput.trim()}) / Semua --`
                  : 'Semua Kelas (Log Header)'}
              </option>
              {kelasOptions.map((opt, idx) => (
                <option key={`${opt.id}-${idx}`} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="w-full sm:w-44 space-y-1">
          <label
            htmlFor="input-idkelas-presensi"
            className="block text-xs font-medium text-slate-600"
          >
            Parameter <code className="font-mono">idkelas</code>
          </label>
          <Input
            id="input-idkelas-presensi"
            value={idKelasInput}
            onChange={(e) => setIdKelasInput(e.target.value)}
            placeholder="Contoh: 201 (kosong = log)"
            className="h-9 text-xs font-mono tabular-nums"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={isLoading}
            className="whitespace-nowrap shrink-0"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Terapkan Kelas</span>
          </Button>

          {appliedIdKelas.trim() !== '' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={handleSwitchGeneralLog}
              className="whitespace-nowrap shrink-0"
            >
              Log Umum (Tanpa Filter)
            </Button>
          )}
        </div>

        <div className="w-full lg:w-auto lg:ml-auto flex items-center gap-1.5 text-[11px] text-slate-500 pb-1.5">
          <FileSpreadsheet
            className="h-3.5 w-3.5 text-emerald-700 shrink-0"
            aria-hidden="true"
          />
          <span className="font-mono truncate max-w-xs sm:max-w-md">
            CSV: {resolvedApiDisplayPath}
            {resolvedApiDisplayPath.includes('?') ? '&' : '?'}format=csv
          </span>
        </div>
      </form>

      {/* Notifikasi Error Unduh CSV (Jika Terjadi) */}
      {csvErrorMsg && (
        <div className="px-6 py-3 bg-red-50/60">
          <Alert variant="destructive">
            <AlertCircle
              className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <AlertTitle>Gagal Mengunduh CSV</AlertTitle>
              <AlertDescription>{csvErrorMsg}</AlertDescription>
            </div>
          </Alert>
        </div>
      )}

      {/* Summary Strip + Pie/Donut Chart dari Objek `rekap` Server (Tanpa Looping Manual) */}
      {rekap && !errorMsg && (
        <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
          {/* Summary Stat Strip (7 Kolom pada Layar Lebar) */}
          <div className="xl:col-span-7 flex flex-col justify-between divide-y divide-slate-200">
            <div className="px-6 py-3.5 flex items-center justify-between bg-slate-50/40">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Ringkasan Kehadiran Kelas (Auto-Rekap API)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dirender langsung dari properti <code className="font-mono">rekap</code> pada respons backend untuk{' '}
                  <span className="font-mono font-semibold text-slate-700">
                    idkelas={appliedIdKelas}
                  </span>
                  .
                </p>
              </div>
              {statusFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  Tampilkan Semua ({formatNumberId(serverTotal)})
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-slate-200 flex-1">
              {/* Kartu Total */}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`p-5 text-left transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900/[0.03]'
                    : 'hover:bg-slate-50/80'
                }`}
              >
                <span className="block text-xs font-medium text-slate-500">
                  Total Presensi
                </span>
                <span className="mt-1.5 block text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {formatNumberId(serverTotal)}
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  Seluruh rekaman siswa
                </span>
              </button>

              {/* 5 Kartu Kategori Langsung dari `rekap` */}
              {REKAP_CATEGORIES.map((cat) => {
                const count = rekap[cat.key];
                const CategoryIcon = cat.icon;
                const isSelected =
                  statusFilter.toLowerCase() === cat.label.toLowerCase();

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter((prev) =>
                        prev.toLowerCase() === cat.label.toLowerCase()
                          ? 'ALL'
                          : cat.label
                      );
                      setCurrentPage(1);
                    }}
                    className={`p-5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900/[0.04]'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">
                        {cat.label}
                      </span>
                      <CategoryIcon
                        className={`h-4 w-4 shrink-0 ${cat.textClass}`}
                        aria-hidden={true}
                      />
                    </div>
                    <span
                      className={`mt-1.5 block text-2xl font-bold font-mono tabular-nums ${cat.textClass}`}
                    >
                      {formatNumberId(count)}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      rekap.{cat.key}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grafik Donut / Pie Langsung dari `rekap` (5 Kolom pada Layar Lebar) */}
          <div className="xl:col-span-5 flex items-center">
            <PresensiRekapChart rekap={rekap} totalRecords={serverTotal} />
          </div>
        </div>
      )}

      {/* Info Mode Log Umum Apabila Tanpa ?idkelas= */}
      {!rekap && !isLoading && !errorMsg && appliedIdKelas.trim() === '' && (
        <div className="px-6 py-3 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Menampilkan <strong>Log Umum (Header)</strong> karena parameter{' '}
            <code className="font-mono text-slate-800">?idkelas=</code> tidak
            diisi. Pilih kelas di atas (mis. <code className="font-mono">201</code>) untuk memuat Auto-Rekap dan detail siswa.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const fallbackId = kelasOptions[0]?.id || '201';
              setIdKelasInput(fallbackId);
              setAppliedIdKelas(fallbackId);
            }}
            className="whitespace-nowrap shrink-0"
          >
            Muat Contoh Kelas #{kelasOptions[0]?.id || '201'}
          </Button>
        </div>
      )}

      {/* Pencarian Cepat Baris Tabel */}
      <div className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div className="relative w-full sm:w-80">
          <Search
            className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={
              isStudentDetailMode
                ? 'Cari NIS, nama siswa, kelas, status, ket...'
                : 'Cari pada log presensi...'
            }
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          <span>
            Menampilkan {formatNumberId(activeTableCount)} dari{' '}
            {formatNumberId(rows.length)} baris
          </span>
        </div>
      </div>

      {/* Area Utama Tabel Presensi */}
      {errorMsg ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle
              className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <AlertTitle>Gagal Memuat Data Presensi</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </div>
          </Alert>
        </div>
      ) : isLoading ? (
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="px-6 py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="h-3.5 w-28 rounded bg-slate-200" />
              <div className="h-3.5 w-20 rounded bg-slate-200" />
              <div className="h-3.5 w-44 rounded bg-slate-200" />
              <div className="h-3.5 w-16 rounded bg-slate-200" />
              <div className="h-3.5 w-20 rounded bg-slate-200" />
              <div className="h-3.5 flex-1 max-w-xs rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : activeTableCount === 0 ? (
        <div className="px-6 py-14 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            Tidak ada data presensi yang ditemukan
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {appliedIdKelas.trim()
              ? `Belum terdapat catatan presensi untuk kelas dengan ID "${appliedIdKelas.trim()}" atau sesuaikan kata kunci pencarian Anda.`
              : 'Belum terdapat catatan pada log umum presensi.'}
          </p>
          {(searchQuery.trim() !== '' || statusFilter !== 'ALL') && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
              >
                Reset Pencarian Tabel
              </Button>
            </div>
          )}
        </div>
      ) : isStudentDetailMode ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-6 whitespace-nowrap">Tanggal</th>
                <th className="py-3 px-4 whitespace-nowrap">NIS</th>
                <th className="py-3 px-4 whitespace-nowrap">Nama Siswa</th>
                <th className="py-3 px-4 whitespace-nowrap">Kelas</th>
                {hasSubjectColumn && (
                  <th className="py-3 px-4 whitespace-nowrap">
                    Mata Pelajaran
                  </th>
                )}
                <th className="py-3 px-4 whitespace-nowrap">Status Absen</th>
                <th className="py-3 px-4 whitespace-nowrap">Keterangan</th>
                {onInspectEntity && (
                  <th className="py-3 px-6 text-right whitespace-nowrap">
                    Detail
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {paginatedStudentRows.map((item, idx) => {
                const statusInfo = resolveStatusVisual(item.status_absen);
                const StatusIcon = statusInfo.Icon;

                return (
                  <tr
                    key={`${item.nis}-${item.tanggal}-${idx}`}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-6 whitespace-nowrap font-mono tabular-nums text-slate-600">
                      {item.tanggal}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-mono tabular-nums font-semibold text-slate-900">
                      {item.nis}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {item.nama_siswa}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-700">
                      {item.nama_kelas}
                    </td>
                    {hasSubjectColumn && (
                      <td className="py-2.5 px-4 text-slate-700">
                        {item.pelajaran || '-'}
                      </td>
                    )}
                    {/* Zero-pill status indicator: ikon semantik + teks bersih */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${statusInfo.textClass}`}
                      >
                        <StatusIcon
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden={true}
                        />
                        <span>{statusInfo.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                      {item.keterangan || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {onInspectEntity && (
                      <td className="py-2.5 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onInspectEntity({
                              mode: 'siswa',
                              identifier:
                                item.nis && item.nis !== '-'
                                  ? item.nis
                                  : undefined,
                              title: `${item.nama_siswa} (${item.nis})`,
                              row: item.raw,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Detail</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Tabel Dinamis untuk Mode Log Umum (Tanpa ?idkelas=) */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {headerColumns.map((col, cIdx) => (
                  <th key={`${col}-${cIdx}`} className="py-3 px-4 first:pl-6 whitespace-nowrap">
                    {formatColumnLabel(col)}
                  </th>
                ))}
                {onInspectEntity && (
                  <th className="py-3 px-6 text-right whitespace-nowrap">
                    Detail
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {paginatedHeaderRows.map((row, rIdx) => {
                const candidateIdKelas = String(
                  row.idkelas ?? row.replid_kelas ?? ''
                ).trim();

                return (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {headerColumns.map((col, cIdx) => {
                      const rawVal = row[col];
                      const displayVal =
                        rawVal === null ||
                        rawVal === undefined ||
                        String(rawVal) === 'null'
                          ? '—'
                          : String(rawVal);
                      const isNumeric =
                        typeof rawVal === 'number' ||
                        /^\d+$/.test(displayVal.trim());

                      return (
                        <td
                          key={`${col}-${cIdx}`}
                          className={`py-2.5 px-4 first:pl-6 max-w-xs truncate ${
                            isNumeric ? 'font-mono tabular-nums' : ''
                          }`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                    {onInspectEntity && (
                      <td className="py-2.5 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-3">
                          {candidateIdKelas && candidateIdKelas !== 'null' && (
                            <button
                              type="button"
                              onClick={() => {
                                setIdKelasInput(candidateIdKelas);
                                setAppliedIdKelas(candidateIdKelas);
                              }}
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap"
                            >
                              Rekap Kelas #{candidateIdKelas}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onInspectEntity({
                                mode: 'generic',
                                title: 'Detail Log Presensi',
                                row,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Inspeksi</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginasi Tabel */}
      {activeTableCount > pageSize && (
        <div className="px-6 py-3.5 flex items-center justify-between gap-4 bg-slate-50/40 text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            Halaman {safePage} dari {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sebelumnya</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
