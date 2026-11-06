import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Coffee,
  Download,
  Filter,
  GraduationCap,
  LayoutGrid,
  List,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  User,
  Users,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import { extractResponsePayload, formatNumberId } from '../../lib/formatters';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { InspectedEntity } from './SmartDataTable';

export interface JadwalSesiItem {
  replid: number;
  hari: number;
  jamke: number;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  kode_pelajaran: string;
  nama_guru: string;
  keterangan: string;
}

export type JadwalHariMap = Record<string, JadwalSesiItem[]>;

export interface JadwalKelasResponse {
  success?: boolean;
  message?: string;
  total_sesi?: number;
  data?: JadwalHariMap | Record<string, unknown>;
  [key: string]: unknown;
}

interface KelasOption {
  idkelas: string;
  nama_kelas: string;
  wali_kelas?: string;
}

export interface JadwalKelasWorkspaceProps {
  initialIdKelas?: string;
  lockedIdKelas?: string;
  classNameTitle?: string;
  title?: string;
  description?: string;
  embedded?: boolean;
  refreshSignal?: number;
  onInspectEntity?: (entity: InspectedEntity) => void;
  onRawPayloadLoaded?: (raw: unknown) => void;
}

const HARI_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad', 'Minggu'];

function formatJamShort(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return timeStr;
}

function isIstirahat(item: JadwalSesiItem): boolean {
  const code = (item.kode_pelajaran || '').trim().toUpperCase();
  const name = (item.mata_pelajaran || '').trim().toUpperCase();
  return (
    code === 'IST' ||
    name.includes('ISTIRAHAT') ||
    name.includes('BREAK') ||
    name.includes('SNACK')
  );
}

function getSubjectAccent(item: JadwalSesiItem) {
  if (isIstirahat(item)) {
    return {
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
      borderLeft: 'border-l-amber-500',
      bgMuted: 'bg-amber-50/70',
      tagText: 'text-amber-700',
      icon: Coffee,
      isBreak: true,
    };
  }

  const code = (item.kode_pelajaran || '').trim().toUpperCase();
  if (code === 'PAI' || code === 'BTQ' || code === 'IA' || code === 'TH' || code === 'PS') {
    return {
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      borderLeft: 'border-l-emerald-600',
      bgMuted: 'bg-emerald-50/50',
      tagText: 'text-emerald-700',
      icon: BookOpen,
      isBreak: false,
    };
  }
  if (code === 'MTK' || code === 'IPA' || code === 'FIS' || code === 'BIO') {
    return {
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
      borderLeft: 'border-l-sky-600',
      bgMuted: 'bg-sky-50/50',
      tagText: 'text-sky-700',
      icon: GraduationCap,
      isBreak: false,
    };
  }
  if (code === 'BI' || code === 'BING' || code === 'BA' || code === 'LTR') {
    return {
      badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      borderLeft: 'border-l-indigo-600',
      bgMuted: 'bg-indigo-50/50',
      tagText: 'text-indigo-700',
      icon: BookOpen,
      isBreak: false,
    };
  }
  if (code === 'PJOK') {
    return {
      badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
      borderLeft: 'border-l-teal-600',
      bgMuted: 'bg-teal-50/50',
      tagText: 'text-teal-700',
      icon: GraduationCap,
      isBreak: false,
    };
  }
  if (code === 'PP' || code === 'PKN' || code === 'IPS' || code === 'PLBJ' || code === 'SR') {
    return {
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
      borderLeft: 'border-l-purple-600',
      bgMuted: 'bg-purple-50/50',
      tagText: 'text-purple-700',
      icon: BookOpen,
      isBreak: false,
    };
  }

  return {
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    borderLeft: 'border-l-slate-600',
    bgMuted: 'bg-slate-50/70',
    tagText: 'text-slate-700',
    icon: BookOpen,
    isBreak: false,
  };
}

export function JadwalKelasWorkspace({
  initialIdKelas = '201',
  lockedIdKelas,
  classNameTitle,
  title,
  description,
  embedded = false,
  refreshSignal = 0,
  onInspectEntity,
  onRawPayloadLoaded,
}: JadwalKelasWorkspaceProps) {
  const isKelasLocked = Boolean(lockedIdKelas && lockedIdKelas.trim() !== '');

  const [activeIdKelas, setActiveIdKelas] = useState<string>(() =>
    isKelasLocked ? String(lockedIdKelas).trim() : initialIdKelas || '201'
  );
  const [kelasInputDraft, setKelasInputDraft] = useState<string>(() =>
    isKelasLocked ? String(lockedIdKelas).trim() : initialIdKelas || '201'
  );

  useEffect(() => {
    if (isKelasLocked && lockedIdKelas) {
      const clean = lockedIdKelas.trim();
      setActiveIdKelas(clean);
      setKelasInputDraft(clean);
    }
  }, [isKelasLocked, lockedIdKelas]);

  // Master Kelas untuk dropdown pemilih
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);

  // Data Jadwal per hari
  const [jadwalByHari, setJadwalByHari] = useState<JadwalHariMap>({});
  const [totalSesi, setTotalSesi] = useState<number>(0);

  // Tampilan & Filter
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'day'>('grid');
  const [selectedDayTab, setSelectedDayTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMapel, setFilterMapel] = useState<string>('ALL');
  const [filterGuru, setFilterGuru] = useState<string>('ALL');

  // Muat daftar kelas
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/jbsakad/kelas')
      .then((res) => {
        if (cancelled) return;
        const normalized = extractResponsePayload(res.data);
        const mapped: KelasOption[] = normalized.rows
          .map((r) => ({
            idkelas: String(r.idkelas ?? r.replid ?? '').trim(),
            nama_kelas: String(r.nama_kelas ?? r.kelas ?? '').trim(),
            wali_kelas: String(r.wali_kelas ?? '').trim(),
          }))
          .filter((k) => k.idkelas !== '');
        setKelasList(mapped);
      })
      .catch(() => {
        // Abaikan kegagalan daftar kelas minor
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onRawPayloadLoadedRef = useRef(onRawPayloadLoaded);
  useEffect(() => {
    onRawPayloadLoadedRef.current = onRawPayloadLoaded;
  }, [onRawPayloadLoaded]);

  // Muat jadwal kelas dari endpoint GET /api/jbsakad/jadwal/kelas/:idkelas
  const fetchJadwalKelas = useCallback(async (idKelasTarget: string) => {
    const cleanId = idKelasTarget.trim();
    if (!cleanId) return;

    setIsLoading(true);
    setErrorMsg(null);
    setServerMessage(null);

    try {
      const encoded = encodeURIComponent(cleanId);
      const res = await apiClient.get<JadwalKelasResponse>(`/jbsakad/jadwal/kelas/${encoded}`);
      const body = res.data;
      setRawPayload(body);
      onRawPayloadLoadedRef.current?.(body);

      if (body && body.success === false) {
        setJadwalByHari({});
        setTotalSesi(0);
        setErrorMsg(body.message || 'Gagal memuat jadwal kelas.');
        return;
      }

      setServerMessage(body?.message || `Jadwal kelas ${cleanId} berhasil ditarik`);

      const rawData = body?.data;
      let parsedMap: JadwalHariMap = {};
      let calculatedTotal = 0;

      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        for (const [dayKey, sessions] of Object.entries(rawData)) {
          if (Array.isArray(sessions)) {
            const cleanList: JadwalSesiItem[] = sessions.map((s: Record<string, unknown>) => ({
              replid: Number(s.replid ?? 0),
              hari: Number(s.hari ?? 0),
              jamke: Number(s.jamke ?? 0),
              jam_mulai: String(s.jam_mulai ?? ''),
              jam_selesai: String(s.jam_selesai ?? ''),
              mata_pelajaran: String(s.mata_pelajaran ?? ''),
              kode_pelajaran: String(s.kode_pelajaran ?? ''),
              nama_guru: String(s.nama_guru ?? ''),
              keterangan: String(s.keterangan ?? ''),
            }));
            parsedMap[dayKey] = cleanList;
            calculatedTotal += cleanList.length;
          }
        }
      }

      setJadwalByHari(parsedMap);
      setTotalSesi(body?.total_sesi ?? calculatedTotal);
    } catch (err) {
      setJadwalByHari({});
      setTotalSesi(0);
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeIdKelas) {
      fetchJadwalKelas(activeIdKelas);
    }
  }, [activeIdKelas, refreshSignal, fetchJadwalKelas]);

  // Urutan hari yang ada pada respons
  const availableDays = useMemo(() => {
    const keys = Object.keys(jadwalByHari);
    return keys.sort((a, b) => {
      const idxA = HARI_ORDER.indexOf(a);
      const idxB = HARI_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [jadwalByHari]);

  // Semua sesi flat untuk pencarian dan filter
  const allSessionsFlat = useMemo(() => {
    const list: Array<JadwalSesiItem & { namaHari: string }> = [];
    for (const day of availableDays) {
      const sessions = jadwalByHari[day] || [];
      for (const s of sessions) {
        list.push({ ...s, namaHari: day });
      }
    }
    return list;
  }, [availableDays, jadwalByHari]);

  // Daftar opsi unik untuk filter Mata Pelajaran & Guru
  const uniqueMapelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSessionsFlat) {
      if (s.mata_pelajaran && !isIstirahat(s)) {
        set.add(s.mata_pelajaran);
      }
    }
    return Array.from(set).sort();
  }, [allSessionsFlat]);

  const uniqueGuruOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSessionsFlat) {
      if (s.nama_guru && !isIstirahat(s)) {
        set.add(s.nama_guru);
      }
    }
    return Array.from(set).sort();
  }, [allSessionsFlat]);

  // Statistik Ringkas Jadwal
  const statsSummary = useMemo(() => {
    const nonBreakSessions = allSessionsFlat.filter((s) => !isIstirahat(s));
    const uniqueSubjects = new Set(nonBreakSessions.map((s) => s.mata_pelajaran));
    const uniqueTeachers = new Set(nonBreakSessions.map((s) => s.nama_guru));
    return {
      totalHari: availableDays.length,
      totalSesiPelajar: nonBreakSessions.length,
      totalSesiSemua: allSessionsFlat.length,
      totalMapel: uniqueSubjects.size,
      totalGuru: uniqueTeachers.size,
    };
  }, [allSessionsFlat, availableDays]);

  // Saring sesi berdasarkan pencarian dan filter
  const filterSessionPredicate = useCallback(
    (item: JadwalSesiItem) => {
      if (filterMapel !== 'ALL' && item.mata_pelajaran !== filterMapel) return false;
      if (filterGuru !== 'ALL' && item.nama_guru !== filterGuru) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.trim().toLowerCase();
      return (
        item.mata_pelajaran.toLowerCase().includes(q) ||
        item.kode_pelajaran.toLowerCase().includes(q) ||
        item.nama_guru.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q) ||
        item.jam_mulai.includes(q) ||
        item.jam_selesai.includes(q) ||
        String(item.jamke).includes(q)
      );
    },
    [filterMapel, filterGuru, searchQuery]
  );

  // Informasi kelas aktif
  const matchedKelas = useMemo(
    () => kelasList.find((k) => k.idkelas === activeIdKelas),
    [kelasList, activeIdKelas]
  );
  const activeKelasLabel =
    classNameTitle || (matchedKelas ? `Kelas ${matchedKelas.nama_kelas}` : `Kelas #${activeIdKelas}`);

  const handleApplyKelas = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = kelasInputDraft.trim();
    if (!clean) return;
    setActiveIdKelas(clean);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (allSessionsFlat.length === 0) return;
    const headers = [
      'Hari',
      'Jam Ke',
      'Waktu Mulai',
      'Waktu Selesai',
      'Kode Pelajaran',
      'Mata Pelajaran',
      'Guru Pengampu',
      'Keterangan',
      'ID Sesi (replid)',
    ];
    const rows = allSessionsFlat.map((s) => [
      `"${s.namaHari}"`,
      s.jamke,
      `"${s.jam_mulai}"`,
      `"${s.jam_selesai}"`,
      `"${s.kode_pelajaran}"`,
      `"${s.mata_pelajaran.replace(/"/g, '""')}"`,
      `"${s.nama_guru.replace(/"/g, '""')}"`,
      `"${s.keterangan.replace(/"/g, '""')}"`,
      s.replid,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jadwal_pelajaran_kelas_${activeIdKelas}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const containerClass = embedded
    ? 'divide-y divide-slate-200 bg-white'
    : 'rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden';

  return (
    <section className={containerClass}>
      {/* 1. Header Toolbar & Pemilih Kelas */}
      <div className="p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="font-semibold text-slate-800">
                GET /api/jbsakad/jadwal/kelas/{activeIdKelas}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Total: {totalSesi || statsSummary.totalSesiSemua} sesi mingguan</span>
              {matchedKelas?.wali_kelas && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans text-slate-700">Wali Kelas: {matchedKelas.wali_kelas}</span>
                </>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-800 shrink-0" aria-hidden="true" />
              <span>{title || `Jadwal Pelajaran ${activeKelasLabel}`}</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              {description ||
                'Struktur pembagian jam pelajaran mingguan, guru pengampu, dan alokasi waktu sesi belajar mengajar.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => fetchJadwalKelas(activeIdKelas)}
              className="whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Muat Ulang</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={allSessionsFlat.length === 0}
              className="whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ekspor CSV</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={allSessionsFlat.length === 0}
              className="whitespace-nowrap shrink-0 hidden sm:inline-flex"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cetak</span>
            </Button>

            {Boolean(onInspectEntity && rawPayload) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onInspectEntity!({
                    mode: 'raw-response',
                    title: `GET /api/jbsakad/jadwal/kelas/${activeIdKelas}`,
                    row: (rawPayload as Record<string, unknown>) || {},
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

        {/* Pemilih Kelas & Switcher Mode Tampilan */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {!isKelasLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="jadwal-select-kelas" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Pilih Kelas:
              </label>
              {kelasList.length > 0 ? (
                <select
                  id="jadwal-select-kelas"
                  value={activeIdKelas}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveIdKelas(val);
                    setKelasInputDraft(val);
                  }}
                  className="h-9 min-w-[210px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                >
                  {kelasList.map((k, idx) => (
                    <option key={`${k.idkelas}-${idx}`} value={k.idkelas}>
                      Kelas {k.nama_kelas} (ID: {k.idkelas})
                      {k.wali_kelas ? ` — ${k.wali_kelas}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <form onSubmit={handleApplyKelas} className="flex items-center gap-1.5">
                  <Input
                    value={kelasInputDraft}
                    onChange={(e) => setKelasInputDraft(e.target.value)}
                    placeholder="ID Kelas (contoh: 201)"
                    className="h-9 w-36 text-xs font-mono"
                  />
                  <Button type="submit" variant="secondary" size="sm" className="h-9">
                    Pilih
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
              <span className="font-semibold text-slate-900">{activeKelasLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-500">ID: {activeIdKelas}</span>
            </div>
          )}

          {/* Segmented Switcher View Mode (Grid Mingguan / Tabel List / Tab Per Hari) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'grid'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Matriks Mingguan</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'day'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Per Hari</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Daftar Sesi</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stat Cards Ringkas (Tanpa Pill, Sesuai Design Constitution) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Sesi Mingguan
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatNumberId(totalSesi || statsSummary.totalSesiSemua)}
          </div>
          <p className="text-[11px] text-slate-500">
            {statsSummary.totalSesiPelajar} jam belajar aktif · {availableDays.length} hari
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Mata Pelajaran
          </span>
          <div className="text-2xl font-bold font-mono text-indigo-700 tabular-nums">
            {formatNumberId(statsSummary.totalMapel)}
          </div>
          <p className="text-[11px] text-slate-500">Variasi kurikulum terjadwal</p>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Guru Pengampu
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {formatNumberId(statsSummary.totalGuru)}
          </div>
          <p className="text-[11px] text-slate-500">Tenaga pendidik bertugas</p>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Hari Aktif
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {availableDays.length > 0 ? `${availableDays[0]} – ${availableDays[availableDays.length - 1]}` : '-'}
          </div>
          <p className="text-[11px] text-slate-500">Senin s/d Jumat pembelajaran</p>
        </div>
      </div>

      {/* 3. Toolbar Pencarian & Filter Cepat */}
      <div className="px-6 py-3.5 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'day' && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedDayTab('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedDayTab === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Hari
              </button>
              {availableDays.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDayTab(d)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedDayTab === d
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d} ({(jadwalByHari[d] || []).length})
                </button>
              ))}
            </div>
          )}

          {uniqueMapelOptions.length > 0 && (
            <select
              aria-label="Filter Mata Pelajaran"
              value={filterMapel}
              onChange={(e) => setFilterMapel(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <option value="ALL">Semua Mapel ({uniqueMapelOptions.length})</option>
              {uniqueMapelOptions.map((m, idx) => (
                <option key={`${m}-${idx}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {uniqueGuruOptions.length > 0 && (
            <select
              aria-label="Filter Guru Pengampu"
              value={filterGuru}
              onChange={(e) => setFilterGuru(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <option value="ALL">Semua Guru ({uniqueGuruOptions.length})</option>
              {uniqueGuruOptions.map((g, idx) => (
                <option key={`${g}-${idx}`} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari mapel, kode, atau guru..."
            className="h-8 pl-9 text-xs bg-white"
          />
        </div>
      </div>

      {/* 4. Konten Utama Jadwal */}
      <div>
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-slate-700" aria-hidden="true" />
            <span>Memuat rincian jadwal kelas dari server...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <AlertTitle>Gagal Menampilkan Jadwal</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </div>
            </Alert>
          </div>
        ) : availableDays.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2">
            <Calendar className="h-8 w-8 text-slate-400 mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-800">
              Belum ada susunan jadwal untuk {activeKelasLabel}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Periksa ID kelas atau pilih rombongan belajar lain pada menu pilihan kelas di atas.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* =========================================================
             A. MATRIKS MINGGUAN (Senin - Jumat kolom bersebelahan)
             ========================================================= */
          <div className="p-6 overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 min-w-[960px]">
              {availableDays.map((hariName) => {
                const sessions = (jadwalByHari[hariName] || []).filter(filterSessionPredicate);

                return (
                  <div
                    key={hariName}
                    className="rounded-xl border border-slate-200 bg-white flex flex-col divide-y divide-slate-100 shadow-2xs overflow-hidden"
                  >
                    {/* Header Kolom Hari */}
                    <div className="p-3.5 bg-slate-50/90 flex items-center justify-between gap-2 border-b border-slate-200">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">{hariName}</h3>
                        <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {sessions.length} sesi belajar
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        {sessions.length > 0
                          ? `${formatJamShort(sessions[0].jam_mulai)} - ${formatJamShort(
                              sessions[sessions.length - 1].jam_selesai
                            )}`
                          : '-'}
                      </span>
                    </div>

                    {/* Daftar Sesi dalam Hari Ini */}
                    <div className="p-2 space-y-2 flex-1 bg-slate-50/20">
                      {sessions.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 italic">
                          Tidak ada sesi yang cocok
                        </div>
                      ) : (
                        sessions.map((sesi, sIdx) => {
                          const accent = getSubjectAccent(sesi);
                          const isBreak = accent.isBreak;

                          return (
                            <div
                              key={`${sesi.replid ?? 'sesi'}-${sesi.jamke}-${sIdx}`}
                              className={`p-2.5 rounded-lg border transition-all text-left ${
                                isBreak
                                  ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                              }`}
                            >
                              {/* Jam & Ke */}
                              <div className="flex items-center justify-between text-[11px] gap-2 mb-1">
                                <div className="flex items-center gap-1 font-mono font-medium text-slate-600 tabular-nums">
                                  <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                                  <span>
                                    {formatJamShort(sesi.jam_mulai)} - {formatJamShort(sesi.jam_selesai)}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500 font-bold tabular-nums">
                                  Jam ke-{sesi.jamke}
                                </span>
                              </div>

                              {/* Mata Pelajaran & Kode */}
                              <div className="flex items-start justify-between gap-1.5">
                                <h4
                                  className={`text-xs font-bold leading-snug line-clamp-2 ${
                                    isBreak ? 'text-amber-900' : 'text-slate-900'
                                  }`}
                                  title={sesi.mata_pelajaran}
                                >
                                  {sesi.mata_pelajaran}
                                </h4>
                                {sesi.kode_pelajaran && (
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${accent.badgeBg}`}
                                  >
                                    {sesi.kode_pelajaran}
                                  </span>
                                )}
                              </div>

                              {/* Guru Pengampu */}
                              {!isBreak && sesi.nama_guru && (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[11px] text-slate-600 truncate">
                                  <User className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                                  <span className="truncate" title={sesi.nama_guru}>
                                    {sesi.nama_guru}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'day' ? (
          /* =========================================================
             B. TAB PER HARI (Rincian Sesi Linear Per Hari)
             ========================================================= */
          <div className="p-6 space-y-6">
            {(selectedDayTab === 'ALL' ? availableDays : [selectedDayTab]).map((day) => {
              const sessions = (jadwalByHari[day] || []).filter(filterSessionPredicate);

              return (
                <div key={day} className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                  <div className="px-5 py-3.5 bg-slate-50 flex items-center justify-between gap-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-700" aria-hidden="true" />
                      <h3 className="text-sm font-bold text-slate-900">{day}</h3>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-mono text-slate-600 tabular-nums">
                        {sessions.length} sesi
                      </span>
                    </div>
                    {sessions.length > 0 && (
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {formatJamShort(sessions[0].jam_mulai)} – {formatJamShort(sessions[sessions.length - 1].jam_selesai)}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100">
                    {sessions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Tidak ada sesi pelajaran yang sesuai dengan filter.
                      </div>
                    ) : (
                      sessions.map((sesi, sIdx) => {
                        const accent = getSubjectAccent(sesi);
                        const isBreak = accent.isBreak;

                        return (
                          <div
                            key={`${sesi.replid ?? 'sesi'}-${sesi.jamke}-${sIdx}`}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isBreak ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              {/* Jam Ke */}
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                                  isBreak
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {sesi.jamke}
                              </div>

                              {/* Waktu & Mapel */}
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-slate-900 truncate">
                                    {sesi.mata_pelajaran}
                                  </h4>
                                  {sesi.kode_pelajaran && (
                                    <span
                                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${accent.badgeBg}`}
                                    >
                                      {sesi.kode_pelajaran}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                                  <span className="font-mono tabular-nums text-slate-700 font-medium">
                                    {formatJamShort(sesi.jam_mulai)} – {formatJamShort(sesi.jam_selesai)}
                                  </span>
                                  {!isBreak && sesi.nama_guru && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="flex items-center gap-1 text-slate-600">
                                        <User className="h-3 w-3 text-slate-400" aria-hidden="true" />
                                        <span>{sesi.nama_guru}</span>
                                      </span>
                                    </>
                                  )}
                                  {sesi.keterangan && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="italic text-slate-500">{sesi.keterangan}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center font-mono text-xs text-slate-400">
                              <span>ID: #{sesi.replid}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* =========================================================
             C. TABEL DAFTAR DETAIL LENGKAP
             ========================================================= */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-6 w-16">No</th>
                  <th className="py-3 px-4">Hari</th>
                  <th className="py-3 px-4">Jam Ke</th>
                  <th className="py-3 px-4">Alokasi Waktu</th>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4">Guru Pengampu</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-6 text-right font-mono">ID Sesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {allSessionsFlat.filter(filterSessionPredicate).map((item, idx) => {
                  const accent = getSubjectAccent(item);
                  const isBreak = accent.isBreak;

                  return (
                    <tr
                      key={`${item.replid ?? 'sesi'}-${item.namaHari}-${item.jamke}-${idx}`}
                      className={`transition-colors ${
                        isBreak ? 'bg-amber-50/40 text-amber-950' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-6 font-mono text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {item.namaHari}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 tabular-nums">
                        Jam ke-{item.jamke}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {formatJamShort(item.jam_mulai)} – {formatJamShort(item.jam_selesai)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.kode_pelajaran ? (
                          <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${accent.badgeBg}`}>
                            {item.kode_pelajaran}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.mata_pelajaran}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {isBreak ? '-' : item.nama_guru || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {item.keterangan || '-'}
                      </td>
                      <td className="py-3 px-6 text-right font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        #{item.replid}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Catatan Footer */}
      {serverMessage && (
        <div className="px-6 py-3 bg-slate-50/50 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Keterangan Server: {serverMessage}</span>
          <span className="font-mono tabular-nums">
            Total Sesi: {totalSesi || statsSummary.totalSesiSemua} · Sesi Belajar: {statsSummary.totalSesiPelajar}
          </span>
        </div>
      )}
    </section>
  );
}
