import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Download,
  FileSpreadsheet,
  HeartPulse,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
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
  formatNumberId,
} from '../../lib/formatters';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { PresensiRekap } from './PresensiKelasTable';
import type { InspectedEntity } from './SmartDataTable';

export type PresensiIndividuEndpointType = 'harian' | 'pelajaran';

interface SiswaMasterOption {
  nis: string;
  nama: string;
  kelas: string;
}

interface PresensiIndividuRow {
  tanggal: string;
  nis: string;
  nama_siswa: string;
  nama_kelas: string;
  pelajaran: string;
  guru: string;
  jam: string;
  status_absen: string;
  keterangan: string;
  raw: Record<string, unknown>;
}

interface PresensiIndividuPayload {
  status?: string;
  total?: number;
  rekap?: Partial<PresensiRekap> | null;
  data?: unknown;
  [key: string]: unknown;
}

export interface ProfilPresensiSiswaProps {
  /** Jenis endpoint presensi individu: 'harian' -> /jbsakad/presensiharian/:nis, 'pelajaran' -> /jbsakad/presensi-pelajaran/:nis */
  endpointType: PresensiIndividuEndpointType;
  /** NIS awal ketika digunakan pada mode eksplorasi Guru/Admin */
  initialNis?: string;
  /** Apabila diisi (misal login Siswa/Wali Murid atau panel profil siswa), NIS dikunci ke identitas ini */
  lockedNis?: string;
  studentName?: string;
  studentClass?: string;
  title?: string;
  description?: string;
  /** Mode ringkas tanpa bingkai luar untuk disematkan di dalam panel/drawer */
  embedded?: boolean;
  refreshSignal?: number;
  onInspectEntity?: (entity: InspectedEntity) => void;
  onRawPayloadLoaded?: (raw: unknown) => void;
}

interface StatCardMeta {
  key: keyof PresensiRekap;
  label: string;
  sublabel: string;
  barClass: string;
  textClass: string;
  activeBgClass: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

/**
 * Konfigurasi Stat Cards Auto-Rekap Individu (Total Hadir, Sakit, Izin, Alpa, Cuti)
 * Urutan mengutamakan metrik yang paling relevan bagi Siswa & Wali Murid: Hadir, Sakit, Izin, Alpa, Cuti.
 */
const INDIVIDU_STAT_CARDS: StatCardMeta[] = [
  {
    key: 'hadir',
    label: 'Total Hadir',
    sublabel: 'Kehadiran tercatat',
    barClass: 'bg-emerald-600',
    textClass: 'text-emerald-700',
    activeBgClass: 'bg-emerald-50/70',
    Icon: CheckCircle2,
  },
  {
    key: 'sakit',
    label: 'Sakit',
    sublabel: 'Keterangan sakit',
    barClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    activeBgClass: 'bg-amber-50/70',
    Icon: HeartPulse,
  },
  {
    key: 'izin',
    label: 'Izin',
    sublabel: 'Izin resmi wali/sekolah',
    barClass: 'bg-sky-600',
    textClass: 'text-sky-700',
    activeBgClass: 'bg-sky-50/70',
    Icon: Clock,
  },
  {
    key: 'alpa',
    label: 'Alpa',
    sublabel: 'Tanpa keterangan',
    barClass: 'bg-red-600',
    textClass: 'text-red-700',
    activeBgClass: 'bg-red-50/70',
    Icon: XCircle,
  },
  {
    key: 'cuti',
    label: 'Cuti',
    sublabel: 'Dispensasi / cuti',
    barClass: 'bg-slate-500',
    textClass: 'text-slate-600',
    activeBgClass: 'bg-slate-100/80',
    Icon: CalendarOff,
  },
];

function parseServerRekap(rawRekap: unknown): PresensiRekap | null {
  if (!rawRekap || typeof rawRekap !== 'object' || Array.isArray(rawRekap)) {
    return null;
  }
  const obj = rawRekap as Record<string, unknown>;
  const hasAnyKey =
    'hadir' in obj ||
    'izin' in obj ||
    'sakit' in obj ||
    'alpa' in obj ||
    'cuti' in obj;

  if (!hasAnyKey) {
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

function normalizeIndividuRow(
  row: Record<string, unknown>,
  fallbackNis: string
): PresensiIndividuRow {
  const clean = (val: unknown, fb = '') => {
    if (val === null || val === undefined) return fb;
    const s = String(val).trim();
    return s === 'null' || s === 'undefined' ? fb : s;
  };

  const tglAwal = clean(row.tgl1 ?? row.tanggal_awal);
  const tglAkhir = clean(row.tgl2 ?? row.tanggal_akhir);
  const fallbackPeriod =
    tglAwal && tglAkhir && tglAwal !== tglAkhir
      ? `${tglAwal} – ${tglAkhir}`
      : tglAwal;

  return {
    tanggal: clean(
      row.tanggal ??
        row.tgl ??
        row.tanggal_presensi ??
        row.tglpresensi ??
        fallbackPeriod,
      '-'
    ),
    nis: clean(row.nis, fallbackNis || '-'),
    nama_siswa: clean(row.nama_siswa ?? row.nama ?? row.namasiswa, ''),
    nama_kelas: clean(
      row.nama_kelas ?? row.kelas ?? (row.idkelas ? `Kelas #${row.idkelas}` : ''),
      '-'
    ),
    pelajaran: clean(
      row.nama_pelajaran ?? row.pelajaran ?? row.mapel ?? row.namapelajaran,
      ''
    ),
    guru: clean(row.nama_guru ?? row.guru ?? row.nipguru, ''),
    jam: clean(row.jam ?? row.jampelajaran ?? row.waktu, ''),
    status_absen: clean(
      row.status_absen ??
        row.status ??
        row.kehadiran ??
        row.statushadir ??
        row.ket_status,
      '-'
    ),
    keterangan: clean(row.keterangan ?? row.catatan ?? row.ket ?? row.materi, ''),
    raw: row,
  };
}

function getStatusIndicator(statusRaw: string): {
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
  if (lower === 'sakit' || lower === 's' || lower === '3') {
    return {
      label: statusRaw || 'Sakit',
      textClass: 'text-amber-700',
      Icon: HeartPulse,
    };
  }
  if (lower === 'izin' || lower === 'i' || lower === '2') {
    return {
      label: statusRaw || 'Izin',
      textClass: 'text-sky-700',
      Icon: Clock,
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
 * Komponen Dasbor Presensi Siswa Individu (Per NIS)
 * Mengonsumsi endpoint terbaru:
 * - GET /api/jbsakad/presensiharian/:nis
 * - GET /api/jbsakad/presensi-pelajaran/:nis
 * Memanfaatkan objek `rekap` langsung dari server (Single Source of Truth)
 * serta mendukung ekspor CSV (?format=csv) tanpa response.json().
 */
export const ProfilPresensiSiswa: React.FC<ProfilPresensiSiswaProps> = ({
  endpointType,
  initialNis = '1779',
  lockedNis,
  studentName,
  studentClass,
  title,
  description,
  embedded = false,
  refreshSignal = 0,
  onInspectEntity,
  onRawPayloadLoaded,
}) => {
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>(() =>
    getActiveApiBaseUrl()
  );

  const effectiveInitialNis = (lockedNis ?? initialNis).trim();
  const [nisInput, setNisInput] = useState<string>(effectiveInitialNis);
  const [appliedNis, setAppliedNis] = useState<string>(effectiveInitialNis);
  const [siswaOptions, setSiswaOptions] = useState<SiswaMasterOption[]>([]);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rekap, setRekap] = useState<PresensiRekap | null>(null);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [rawResponse, setRawResponse] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isDownloadingCsv, setIsDownloadingCsv] = useState<boolean>(false);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = embedded ? 10 : 15;

  const onRawPayloadLoadedRef = useRef(onRawPayloadLoaded);
  useEffect(() => {
    onRawPayloadLoadedRef.current = onRawPayloadLoaded;
  }, [onRawPayloadLoaded]);

  // Sinkronisasi apabila lockedNis atau initialNis berubah dari parent
  useEffect(() => {
    if (lockedNis !== undefined) {
      const cleanLocked = lockedNis.trim();
      if (cleanLocked && cleanLocked !== ':nis') {
        setNisInput(cleanLocked);
        setAppliedNis(cleanLocked);
      }
    } else if (initialNis) {
      const cleanInit = initialNis.trim();
      if (cleanInit && cleanInit !== ':nis') {
        setNisInput(cleanInit);
        setAppliedNis(cleanInit);
      }
    }
  }, [lockedNis, initialNis]);

  useEffect(() => {
    const syncBaseUrl = () => setActiveBaseUrl(getActiveApiBaseUrl());
    window.addEventListener(API_URL_CHANGED_EVENT, syncBaseUrl);
    return () => window.removeEventListener(API_URL_CHANGED_EVENT, syncBaseUrl);
  }, []);

  // Muat daftar siswa untuk dropdown pemilihan cepat pada mode Guru/Admin (saat lockedNis tidak dikunci)
  useEffect(() => {
    if (lockedNis !== undefined) return;
    let cancelled = false;

    apiClient
      .get('/jbsakad/siswa')
      .then((res) => {
        if (cancelled) return;
        const parsed = extractResponsePayload(res.data);
        const list: SiswaMasterOption[] = [];
        const seen = new Set<string>();

        for (const r of parsed.rows) {
          const nis = String(r.nis ?? '').trim();
          if (!nis || nis === 'null' || seen.has(nis)) continue;
          seen.add(nis);

          const nama = String(r.nama ?? r.nama_siswa ?? '-').trim();
          const kelas = String(
            r.nama_kelas ?? r.kelas ?? (r.idkelas ? `Kelas #${r.idkelas}` : '')
          ).trim();
          list.push({ nis, nama, kelas });
        }

        setSiswaOptions(list);
      })
      .catch(() => {
        // Tetap berfungsi penuh dengan input manual NIS
      });

    return () => {
      cancelled = true;
    };
  }, [lockedNis, activeBaseUrl]);

  useEffect(() => {
    setCurrentPage(1);
    setStatusFilter('ALL');
    setCsvErrorMsg(null);
  }, [endpointType, appliedNis]);

  const basePathPrefix =
    endpointType === 'harian'
      ? '/jbsakad/presensiharian'
      : '/jbsakad/presensi-pelajaran';

  const fetchProfilPresensi = useCallback(
    async (targetNis: string) => {
      const cleanNis = targetNis.trim();
      const trimmedNis =
        cleanNis === ':nis' || cleanNis === 'null' || cleanNis === 'undefined'
          ? ''
          : cleanNis;

      if (!trimmedNis) {
        setRows([]);
        setRekap(null);
        setServerTotal(0);
        setErrorMsg('Silakan pilih atau masukkan Nomor Induk Siswa (NIS) yang valid terlebih dahulu.');
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const path = `${basePathPrefix}/${encodeURIComponent(trimmedNis)}`;
        const response = await apiClient.get<PresensiIndividuPayload>(path);
        const body = response.data;
        const normalized = extractResponsePayload(body);

        // Ambil objek `rekap` & `total` langsung dari respons server (Single Source of Truth)
        const serverRekap =
          body && typeof body === 'object' && !Array.isArray(body)
            ? parseServerRekap((body as PresensiIndividuPayload).rekap)
            : null;

        const explicitTotal =
          body &&
          typeof body === 'object' &&
          !Array.isArray(body) &&
          typeof (body as PresensiIndividuPayload).total === 'number'
            ? (body as PresensiIndividuPayload).total!
            : normalized.totalCount;

        const rawObj =
          body && typeof body === 'object' && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : { data: body };

        setRows(normalized.rows);
        setRekap(serverRekap);
        setServerTotal(explicitTotal);
        setRawResponse(rawObj);
        onRawPayloadLoadedRef.current?.(body);
      } catch (err) {
        setRows([]);
        setRekap(null);
        setServerTotal(0);
        setErrorMsg(extractApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [basePathPrefix]
  );

  useEffect(() => {
    const clean = appliedNis.trim();
    if (!clean || clean === ':nis') return;
    fetchProfilPresensi(clean);
  }, [appliedNis, refreshSignal, activeBaseUrl, fetchProfilPresensi]);

  const normalizedRows = useMemo(
    () => rows.map((r) => normalizeIndividuRow(r, appliedNis)),
    [rows, appliedNis]
  );

  // Deteksi identitas siswa dari props atau baris pertama data
  const detectedStudentName = useMemo(() => {
    if (studentName && studentName.trim()) return studentName.trim();
    const fromOption = siswaOptions.find((o) => o.nis === appliedNis);
    if (fromOption?.nama) return fromOption.nama;
    const fromRow = normalizedRows.find((r) => Boolean(r.nama_siswa));
    return fromRow?.nama_siswa || '';
  }, [studentName, siswaOptions, appliedNis, normalizedRows]);

  const detectedStudentClass = useMemo(() => {
    if (studentClass && studentClass.trim() && studentClass !== '-') {
      return studentClass.trim();
    }
    const fromOption = siswaOptions.find((o) => o.nis === appliedNis);
    if (fromOption?.kelas) return fromOption.kelas;
    const fromRow = normalizedRows.find(
      (r) => r.nama_kelas && r.nama_kelas !== '-'
    );
    return fromRow?.nama_kelas || '';
  }, [studentClass, siswaOptions, appliedNis, normalizedRows]);

  const hasSubjectColumn = useMemo(
    () =>
      endpointType === 'pelajaran' ||
      normalizedRows.some((r) => Boolean(r.pelajaran)),
    [endpointType, normalizedRows]
  );

  const resolvedApiDisplayPath = useMemo(() => {
    const clean = appliedNis.trim() || ':nis';
    return `/api${basePathPrefix}/${encodeURIComponent(clean)}`;
  }, [basePathPrefix, appliedNis]);

  const csvDownloadUrl = useMemo(() => {
    const base = activeBaseUrl.replace(/\/+$/, '');
    const clean = encodeURIComponent(appliedNis.trim());
    return `${base}${basePathPrefix}/${clean}?format=csv`;
  }, [activeBaseUrl, basePathPrefix, appliedNis]);

  const csvFileName = useMemo(() => {
    const prefix =
      endpointType === 'harian'
        ? 'presensi-harian-siswa'
        : 'presensi-pelajaran-siswa';
    return `${prefix}-${appliedNis.trim() || 'nis'}.csv`;
  }, [endpointType, appliedNis]);

  /**
   * Handler Download CSV (?format=csv):
   * Mengunduh raw text/csv stream via Blob tanpa memanggil response.json()
   */
  const handleDownloadCsv = async (
    e: React.MouseEvent<HTMLAnchorElement>
  ) => {
    e.preventDefault();
    if (isDownloadingCsv || !appliedNis.trim()) return;

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
        const errText = await response.text();
        throw new Error(
          errText.trim() ||
            `Gagal mengunduh CSV riwayat presensi (HTTP ${response.status}).`
        );
      }

      // PENTING: Jangan gunakan response.json() karena payload berupa raw text/csv
      const rawCsv = await response.text();
      const blob = new Blob([rawCsv], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = window.URL.createObjectURL(blob);

      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.setAttribute('download', csvFileName);
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setCsvErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kendala saat mengunduh file CSV.'
      );
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  // Perhitungan O(1) langsung dari 5 properti skalar pada objek `rekap` server (tanpa looping array data)
  const rekapSum = rekap
    ? (Number(rekap.hadir) || 0) +
      (Number(rekap.izin) || 0) +
      (Number(rekap.sakit) || 0) +
      (Number(rekap.alpa) || 0) +
      (Number(rekap.cuti) || 0)
    : 0;
  const safeHadir = rekap ? Number(rekap.hadir) || 0 : 0;
  const attendanceRatePct =
    rekap && rekapSum > 0
      ? ((safeHadir / rekapSum) * 100).toFixed(1)
      : '0.0';

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return normalizedRows.filter((item) => {
      if (statusFilter !== 'ALL') {
        if (item.status_absen.trim().toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.tanggal.toLowerCase().includes(q) ||
        item.status_absen.toLowerCase().includes(q) ||
        item.nama_kelas.toLowerCase().includes(q) ||
        item.pelajaran.toLowerCase().includes(q) ||
        item.guru.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q)
      );
    });
  }, [normalizedRows, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  const handleApplyNis = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedNis(nisInput.trim());
  };

  const defaultHeading =
    title ||
    (endpointType === 'harian'
      ? 'Profil & Rekap Presensi Harian Siswa'
      : 'Profil & Rekap Presensi Mata Pelajaran Siswa');

  const defaultSubheading =
    description ||
    (endpointType === 'harian'
      ? 'Ringkasan kehadiran harian individu (Hadir, Sakit, Izin, Alpa, Cuti) langsung dari Auto-Rekap server beserta riwayat lengkap per tanggal.'
      : 'Ringkasan kehadiran tatap muka mata pelajaran individu langsung dari Auto-Rekap server beserta riwayat sesi pelajaran.');

  const containerClass = embedded
    ? 'bg-white divide-y divide-slate-200'
    : 'rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden';

  return (
    <section className={containerClass}>
      {/* Header Identitas Endpoint / Profil Siswa & Tombol Aksi */}
      <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-800">
              GET {resolvedApiDisplayPath}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-medium text-slate-700">
              Total: {formatNumberId(serverTotal)} rekaman
            </span>
            {rekap && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium">
                  Auto-Rekap Individu
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <h2 className="text-base font-bold text-slate-900">
              {defaultHeading}
            </h2>
            {appliedNis && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 font-mono tabular-nums">
                <UserCheck
                  className="h-3.5 w-3.5 text-emerald-700 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  NIS {appliedNis}
                  {detectedStudentName ? ` · ${detectedStudentName}` : ''}
                  {detectedStudentClass ? ` (${detectedStudentClass})` : ''}
                </span>
              </span>
            )}
          </div>

          {!embedded && (
            <p className="text-xs text-slate-500 leading-relaxed">
              {defaultSubheading}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || !appliedNis.trim()}
            onClick={() => fetchProfilPresensi(appliedNis)}
            className="whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Muat Ulang</span>
          </Button>

          {appliedNis.trim() !== '' && (
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
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {isDownloadingCsv ? 'Mengunduh CSV...' : 'Download CSV'}
              </span>
            </a>
          )}

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

      {/* Pemilih Siswa / Input NIS (Hanya tampil apabila NIS tidak dikunci oleh sesi login Siswa/Drawer) */}
      {lockedNis === undefined && (
        <form
          onSubmit={handleApplyNis}
          className="px-6 py-4 bg-slate-50/70 flex flex-wrap items-end gap-4"
        >
          {siswaOptions.length > 0 && (
            <div className="w-full sm:w-72 space-y-1">
              <label
                htmlFor={`select-siswa-${endpointType}`}
                className="block text-xs font-medium text-slate-600"
              >
                Pilih Cepat Siswa
              </label>
              <select
                id={`select-siswa-${endpointType}`}
                value={
                  siswaOptions.some((s) => s.nis === nisInput.trim())
                    ? nisInput.trim()
                    : ''
                }
                onChange={(e) => {
                  const selectedNis = e.target.value;
                  if (!selectedNis) return;
                  setNisInput(selectedNis);
                  setAppliedNis(selectedNis);
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              >
                <option value="">-- Pilih Siswa Terdaftar --</option>
                {siswaOptions.map((opt, idx) => (
                  <option key={`${opt.nis}-${idx}`} value={opt.nis}>
                    {opt.nis} — {opt.nama}
                    {opt.kelas ? ` (${opt.kelas})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full sm:w-48 space-y-1">
            <label
              htmlFor={`input-nis-${endpointType}`}
              className="block text-xs font-medium text-slate-600"
            >
              Nomor Induk Siswa (<code className="font-mono">:nis</code>)
            </label>
            <Input
              id={`input-nis-${endpointType}`}
              value={nisInput}
              onChange={(e) => setNisInput(e.target.value)}
              placeholder="Contoh: 1779"
              className="h-9 text-xs font-mono tabular-nums"
              required
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isLoading}
            className="whitespace-nowrap shrink-0"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tampilkan Profil</span>
          </Button>

          <div className="w-full lg:w-auto lg:ml-auto flex items-center gap-1.5 text-[11px] text-slate-500 pb-1.5">
            <FileSpreadsheet
              className="h-3.5 w-3.5 text-emerald-700 shrink-0"
              aria-hidden="true"
            />
            <span className="font-mono truncate max-w-xs sm:max-w-md">
              CSV: {resolvedApiDisplayPath}?format=csv
            </span>
          </div>
        </form>
      )}

      {/* Pesan Error CSV Apabila Gagal */}
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

      {/* Stat Cards Auto-Rekap Individu (Total Hadir, Sakit, Izin, Alpa, Cuti) — Langsung dari `rekap` Server */}
      {rekap && !errorMsg && (
        <div className="divide-y divide-slate-200">
          {/* Bar Rasio Kehadiran & Proporsi Visual */}
          <div className="px-6 py-4 bg-slate-50/50 space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Tingkat Kehadiran Siswa
                </span>
                <span className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                  {attendanceRatePct}%
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="font-mono tabular-nums">
                  {formatNumberId(rekap.hadir)} hadir dari{' '}
                  {formatNumberId(rekapSum)} catatan rekap
                </span>
                {statusFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="font-semibold text-slate-800 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Reset Filter ({ statusFilter })
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Proportional Bar langsung dari nilai `rekap` */}
            <div
              className="h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden flex"
              role="img"
              aria-label={`Proporsi kehadiran: Hadir ${rekap.hadir}, Sakit ${rekap.sakit}, Izin ${rekap.izin}, Alpa ${rekap.alpa}, Cuti ${rekap.cuti}`}
            >
              {rekapSum > 0 &&
                INDIVIDU_STAT_CARDS.map((card) => {
                  const val = rekap[card.key];
                  if (val <= 0) return null;
                  const widthPct = (val / rekapSum) * 100;
                  return (
                    <div
                      key={card.key}
                      style={{ width: `${widthPct}%` }}
                      title={`${card.label}: ${val} (${widthPct.toFixed(1)}%)`}
                      className={`h-full ${card.barClass} transition-all duration-300`}
                    />
                  );
                })}
            </div>
          </div>

          {/* Grid Stat Cards Eye-Catching (Hadir, Sakit, Izin, Alpa, Cuti) */}
          <div
            className={`grid grid-cols-2 ${
              embedded ? 'sm:grid-cols-3' : 'sm:grid-cols-5'
            } divide-x divide-y divide-slate-200`}
          >
            {INDIVIDU_STAT_CARDS.map((card) => {
              const count = Number(rekap[card.key]) || 0;
              const pct =
                rekapSum > 0 ? ((count / rekapSum) * 100).toFixed(0) : '0';
              const filterName =
                card.key === 'hadir'
                  ? 'Hadir'
                  : card.key === 'sakit'
                  ? 'Sakit'
                  : card.key === 'izin'
                  ? 'Izin'
                  : card.key === 'alpa'
                  ? 'Alpa'
                  : 'Cuti';
              const isSelected =
                statusFilter.toLowerCase() === filterName.toLowerCase();
              const CardIcon = card.Icon;

              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev.toLowerCase() === filterName.toLowerCase()
                        ? 'ALL'
                        : filterName
                    );
                    setCurrentPage(1);
                  }}
                  className={`p-5 text-left transition-colors cursor-pointer ${
                    isSelected ? card.activeBgClass : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {card.label}
                    </span>
                    <CardIcon
                      className={`h-4 w-4 shrink-0 ${card.textClass}`}
                      aria-hidden={true}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span
                      className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${card.textClass}`}
                    >
                      {formatNumberId(count)}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      {pct}%
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-slate-500 truncate">
                    {card.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pencarian Cepat Riwayat Absensi */}
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
              hasSubjectColumn
                ? 'Cari tanggal, mata pelajaran, status, catatan...'
                : 'Cari tanggal, kelas, status, keterangan...'
            }
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Menampilkan {formatNumberId(filteredRows.length)} dari{' '}
          {formatNumberId(normalizedRows.length)} riwayat
        </div>
      </div>

      {/* Tabel Riwayat Kehadiran Siswa */}
      {errorMsg ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle
              className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <AlertTitle>Kendala Memuat Riwayat Presensi Siswa</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </div>
          </Alert>
        </div>
      ) : isLoading ? (
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="px-6 py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="h-3.5 w-28 rounded bg-slate-200" />
              <div className="h-3.5 w-36 rounded bg-slate-200" />
              <div className="h-3.5 w-20 rounded bg-slate-200" />
              <div className="h-3.5 flex-1 max-w-xs rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="px-6 py-12 text-center space-y-2.5">
          <p className="text-sm font-semibold text-slate-800">
            Belum ada riwayat presensi yang cocok
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {statusFilter !== 'ALL' || searchQuery.trim() !== ''
              ? 'Tidak ditemukan baris riwayat dengan filter status atau kata kunci tersebut.'
              : `Belum terdapat rekaman presensi tercatat pada server untuk NIS ${appliedNis}.`}
          </p>
          {(statusFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Tampilkan Seluruh Riwayat
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-6 whitespace-nowrap">Tanggal</th>
                {hasSubjectColumn && (
                  <th className="py-3 px-4 whitespace-nowrap">
                    Mata Pelajaran
                  </th>
                )}
                <th className="py-3 px-4 whitespace-nowrap">Kelas</th>
                <th className="py-3 px-4 whitespace-nowrap">Status Absen</th>
                <th className="py-3 px-6 whitespace-nowrap">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {paginatedRows.map((item, idx) => {
                const statusMeta = getStatusIndicator(item.status_absen);
                const StatusIcon = statusMeta.Icon;

                return (
                  <tr
                    key={`${item.tanggal}-${idx}`}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-6 whitespace-nowrap font-mono tabular-nums text-slate-700">
                      <div>{item.tanggal}</div>
                      {item.jam && (
                        <div className="text-[11px] text-slate-400">
                          {item.jam}
                        </div>
                      )}
                    </td>

                    {hasSubjectColumn && (
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">
                          {item.pelajaran || '-'}
                        </div>
                        {item.guru && (
                          <div className="text-[11px] text-slate-500">
                            {item.guru}
                          </div>
                        )}
                      </td>
                    )}

                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-700">
                      {item.nama_kelas}
                    </td>

                    {/* Zero-pill status indicator: ikon semantik + teks tegas */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${statusMeta.textClass}`}
                      >
                        <StatusIcon
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden={true}
                        />
                        <span>{statusMeta.label}</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-6 text-slate-600 max-w-sm truncate">
                      {item.keterangan || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginasi Tabel Riwayat */}
      {filteredRows.length > pageSize && (
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
