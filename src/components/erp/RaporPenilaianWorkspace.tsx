import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Edit3,
  FileSpreadsheet,
  HeartPulse,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatNumberId,
} from '../../lib/formatters';
import { usePermission } from '../../hooks/usePermission';
import { Can } from '../auth/Can';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { InspectedEntity } from './SmartDataTable';

export type RaporWorkspaceMode = 'direktori' | 'rapor-siswa' | 'nilai-ujian';

interface KelasOption {
  idkelas: string;
  nama_kelas: string;
  wali_kelas: string;
}

interface RaporDirectoryStudent {
  nis: string;
  nisn: string;
  nama_siswa: string;
  nama_kelas: string;
  tahunajaran: string;
  raw: Record<string, unknown>;
}

interface RaporIdentitas {
  nis: string;
  nisn: string;
  nama: string;
  kelas: string;
  tahunajaran: string;
  departemen: string;
  semester: string;
  waliKelas: string;
}

interface RaporAbsensiRekap {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  cuti: number;
}

interface RaporSubjectRow {
  kode: string;
  mataPelajaran: string;
  rataTertimbang: number | null;
  predikat: string;
  jumlahUjian: number | null;
  bobotInfo: string;
  keterangan: string;
  isFallbackComputed?: boolean;
}

interface ParsedRaporDetail {
  identitas: Partial<RaporIdentitas>;
  rekapAbsensi: RaporAbsensiRekap | null;
  subjects: RaporSubjectRow[];
  rataRataUmum: number | null;
  predikatUmum: string;
}

export interface NilaiUjianItem {
  replid: number;
  idujian: number | null;
  nis: string;
  nilaiujian: number;
  nilaiText: string;
  keterangan: string;
  waktuInput: string;
  kodePelajaran: string;
  mataPelajaran: string;
  raw: Record<string, unknown>;
}

export interface RaporPenilaianWorkspaceProps {
  /** Sub-mode awal ('direktori' = GET /rapor, 'rapor-siswa' = GET /rapor/:nis, 'nilai-ujian' = GET /rapor/nilaiujian/:nis) */
  initialMode?: RaporWorkspaceMode;
  initialIdKelas?: string;
  initialNis?: string;
  /** Kunci NIS ketika dirender di Portal Mandiri Siswa atau Panel Slide-Over Detail Siswa */
  lockedNis?: string;
  studentName?: string;
  studentClass?: string;
  title?: string;
  description?: string;
  /** Mode ringkas tanpa bingkai luar untuk disematkan di dalam drawer */
  embedded?: boolean;
  refreshSignal?: number;
  onInspectEntity?: (entity: InspectedEntity) => void;
  onMutated?: () => void;
  onRawPayloadLoaded?: (raw: unknown) => void;
}

const ABSENSI_STAT_ITEMS: Array<{
  key: keyof RaporAbsensiRekap;
  label: string;
  sublabel: string;
  valueClass: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  {
    key: 'hadir',
    label: 'Hadir',
    sublabel: 'Tatap muka tercatat',
    valueClass: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  {
    key: 'sakit',
    label: 'Sakit',
    sublabel: 'Keterangan sakit',
    valueClass: 'text-amber-700',
    Icon: HeartPulse,
  },
  {
    key: 'izin',
    label: 'Izin',
    sublabel: 'Izin resmi wali',
    valueClass: 'text-sky-700',
    Icon: Clock,
  },
  {
    key: 'alpa',
    label: 'Alpa',
    sublabel: 'Tanpa keterangan',
    valueClass: 'text-red-700',
    Icon: XCircle,
  },
  {
    key: 'cuti',
    label: 'Cuti',
    sublabel: 'Dispensasi / cuti',
    valueClass: 'text-slate-700',
    Icon: CalendarOff,
  },
];

function toSafeNumber(val: unknown): number | null {
  if (val === null || val === undefined || String(val).trim() === '') {
    return null;
  }
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function formatScoreId(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '-';
  }
  return val.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function deriveDynamicPredikat(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '-';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'E';
}

function getPredicateTextClass(predikat: string): string {
  const clean = predikat.trim().toUpperCase();
  if (clean.startsWith('A')) return 'text-emerald-700';
  if (clean.startsWith('B')) return 'text-sky-700';
  if (clean.startsWith('C')) return 'text-amber-700';
  if (clean.startsWith('D') || clean.startsWith('E')) return 'text-red-700';
  return 'text-slate-700';
}

function getScoreTextClass(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return 'text-slate-500';
  if (score >= 85) return 'text-emerald-700';
  if (score >= 75) return 'text-sky-700';
  if (score >= 65) return 'text-amber-700';
  return 'text-red-700';
}

function parseRekapObject(rawObj: unknown): RaporAbsensiRekap | null {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return null;
  }
  const rec = rawObj as Record<string, unknown>;
  const nested =
    rec.rekap && typeof rec.rekap === 'object' && !Array.isArray(rec.rekap)
      ? (rec.rekap as Record<string, unknown>)
      : rec;

  const hasAnyKey =
    'hadir' in nested ||
    'sakit' in nested ||
    'izin' in nested ||
    'alpa' in nested ||
    'alpha' in nested ||
    'cuti' in nested;

  if (!hasAnyKey) {
    return null;
  }

  return {
    hadir: toSafeNumber(nested.hadir) ?? 0,
    sakit: toSafeNumber(nested.sakit) ?? 0,
    izin: toSafeNumber(nested.izin) ?? 0,
    alpa: toSafeNumber(nested.alpa ?? nested.alpha) ?? 0,
    cuti: toSafeNumber(nested.cuti) ?? 0,
  };
}

/**
 * Normalisasi struktur respons GET /api/jbsakad/rapor/:nis secara defensif
 * agar mendukung variasi penamaan properti Identitas, Auto-Rekap Absensi, dan Agregasi Rapor dari server.
 */
function parseRaporDetailResponse(raw: unknown): ParsedRaporDetail {
  const empty: ParsedRaporDetail = {
    identitas: {},
    rekapAbsensi: null,
    subjects: [],
    rataRataUmum: null,
    predikatUmum: '-',
  };

  if (!raw || typeof raw !== 'object') {
    return empty;
  }

  const envelope = raw as Record<string, unknown>;
  const root =
    envelope.data &&
    typeof envelope.data === 'object' &&
    !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : envelope;

  // 1. Ekstrak Identitas Siswa
  const idSource =
    (root.identitas as Record<string, unknown> | undefined) ||
    (root.siswa as Record<string, unknown> | undefined) ||
    (root.profil as Record<string, unknown> | undefined) ||
    (root.biodata as Record<string, unknown> | undefined) ||
    root;

  const identitas: Partial<RaporIdentitas> = {
    nis: String(idSource.nis ?? root.nis ?? '').trim(),
    nisn: String(idSource.nisn ?? root.nisn ?? '').trim(),
    nama: String(
      idSource.nama_siswa ?? idSource.nama ?? root.nama_siswa ?? root.nama ?? ''
    ).trim(),
    kelas: String(
      idSource.nama_kelas ?? idSource.kelas ?? root.nama_kelas ?? root.kelas ?? ''
    ).trim(),
    tahunajaran: String(
      idSource.tahunajaran ??
        idSource.nama_tahunajaran ??
        root.tahunajaran ??
        ''
    ).trim(),
    departemen: String(
      idSource.departemen ?? root.departemen ?? ''
    ).trim(),
    semester: String(
      idSource.semester ?? idSource.nama_semester ?? root.semester ?? ''
    ).trim(),
    waliKelas: String(
      idSource.wali_kelas ?? idSource.walikelas ?? root.wali_kelas ?? ''
    ).trim(),
  };

  // 2. Ekstrak Auto-Rekap Absensi
  const rekapCandidate =
    root.rekap_absensi ??
    root.auto_rekap_absensi ??
    root.absensi ??
    root.presensi ??
    root.kehadiran ??
    root.rekap ??
    envelope.rekap;
  const rekapAbsensi = parseRekapObject(rekapCandidate);

  // 3. Ekstrak Daftar Agregasi Rata-rata Tertimbang & Predikat per Mata Pelajaran
  const arrayCandidates = [
    root.rapor,
    root.nilai_rapor,
    root.agregasi,
    root.agregasi_nilai,
    root.akademik,
    root.nilai,
    root.mata_pelajaran,
    root.pelajaran,
    root.daftar_nilai,
    Array.isArray(envelope.data) ? envelope.data : null,
  ];

  let rawSubjectList: unknown[] = [];
  for (const candidate of arrayCandidates) {
    if (Array.isArray(candidate)) {
      rawSubjectList = candidate;
      break;
    }
  }

  const subjects: RaporSubjectRow[] = rawSubjectList
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object'
    )
    .map((item) => {
      const score = toSafeNumber(
        item.rata_tertimbang ??
          item.rata_rata_tertimbang ??
          item.nilai_akhir ??
          item.nilai_rapor ??
          item.rata_rata ??
          item.rerata ??
          item.skor ??
          item.nilai
      );
      const rawPredikat = String(
        item.predikat ??
          item.predikat_huruf ??
          item.nilai_huruf ??
          item.huruf ??
          item.grade ??
          ''
      ).trim();

      return {
        kode: String(
          item.kode_pelajaran ?? item.kode ?? item.kode_mapel ?? '-'
        ).trim(),
        mataPelajaran: String(
          item.mata_pelajaran ??
            item.nama_pelajaran ??
            item.pelajaran ??
            item.mapel ??
            item.nama ??
            '-'
        ).trim(),
        rataTertimbang: score,
        predikat: rawPredikat || deriveDynamicPredikat(score),
        jumlahUjian: toSafeNumber(
          item.jumlah_ujian ?? item.total_ujian ?? item.jml_ujian
        ),
        bobotInfo: String(
          item.bobot ?? item.detail_bobot ?? item.rumus ?? ''
        ).trim(),
        keterangan: String(
          item.deskripsi ??
            item.keterangan ??
            item.catatan ??
            item.deskripsi_predikat ??
            ''
        ).trim(),
      };
    });

  // 4. Ekstrak Ringkasan Rata-rata & Predikat Umum
  const ringkasanObj =
    root.ringkasan && typeof root.ringkasan === 'object'
      ? (root.ringkasan as Record<string, unknown>)
      : null;

  let rataRataUmum = toSafeNumber(
    root.rata_rata_tertimbang ??
      root.rata_rata_umum ??
      root.rata_rata_total ??
      root.rata_rata ??
      ringkasanObj?.rata_rata_tertimbang ??
      ringkasanObj?.rata_rata
  );

  if (rataRataUmum === null && subjects.length > 0) {
    const scored = subjects.filter((s) => s.rataTertimbang !== null);
    if (scored.length > 0) {
      const sum = scored.reduce((acc, s) => acc + (s.rataTertimbang || 0), 0);
      rataRataUmum = sum / scored.length;
    }
  }

  const rawPredikatUmum = String(
    root.predikat_umum ??
      root.predikat_akhir ??
      root.predikat ??
      ringkasanObj?.predikat ??
      ''
  ).trim();

  return {
    identitas,
    rekapAbsensi,
    subjects,
    rataRataUmum,
    predikatUmum: rawPredikatUmum || deriveDynamicPredikat(rataRataUmum),
  };
}

export function RaporPenilaianWorkspace({
  initialMode = 'direktori',
  initialIdKelas = '',
  initialNis = '1629',
  lockedNis,
  studentName,
  studentClass,
  title,
  description,
  embedded = false,
  refreshSignal = 0,
  onInspectEntity,
  onMutated,
  onRawPayloadLoaded,
}: RaporPenilaianWorkspaceProps) {
  const isNisLocked = Boolean(lockedNis && lockedNis.trim() !== '');

  // Evaluasi izin CRUD pada modul Akademik (SIMAKA / jbsakad)
  const canCreateNilai = usePermission('SIMAKA', 'create');
  const canUpdateNilai = usePermission('SIMAKA', 'update');
  const canDeleteNilai = usePermission('SIMAKA', 'delete');
  const hasAnyWriteAccess = canCreateNilai || canUpdateNilai || canDeleteNilai;

  const [mode, setMode] = useState<RaporWorkspaceMode>(() => {
    if (isNisLocked && initialMode === 'direktori') {
      return 'rapor-siswa';
    }
    return initialMode;
  });

  useEffect(() => {
    if (isNisLocked && initialMode === 'direktori') {
      setMode('rapor-siswa');
    } else {
      setMode(initialMode);
    }
  }, [initialMode, isNisLocked]);

  // Master Kelas & Direktori Siswa (/jbsakad/rapor)
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([]);
  const [selectedIdKelas, setSelectedIdKelas] = useState<string>(initialIdKelas);
  const [directoryStudents, setDirectoryStudents] = useState<
    RaporDirectoryStudent[]
  >([]);
  const [allKnownStudents, setAllKnownStudents] = useState<
    RaporDirectoryStudent[]
  >([]);
  const [directoryLoading, setDirectoryLoading] = useState<boolean>(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryRaw, setDirectoryRaw] = useState<unknown>(null);
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [directoryPage, setDirectoryPage] = useState<number>(1);
  const directoryPageSize = 15;

  const onRawPayloadLoadedRef = useRef(onRawPayloadLoaded);
  useEffect(() => {
    onRawPayloadLoadedRef.current = onRawPayloadLoaded;
  }, [onRawPayloadLoaded]);

  // Target NIS Aktif untuk Rapor Siswa & Nilai Ujian
  const [activeNis, setActiveNis] = useState<string>(() =>
    isNisLocked ? String(lockedNis).trim() : initialNis || '1629'
  );
  const [nisInputDraft, setNisInputDraft] = useState<string>(() =>
    isNisLocked ? String(lockedNis).trim() : initialNis || '1629'
  );

  useEffect(() => {
    if (isNisLocked && lockedNis) {
      const clean = lockedNis.trim();
      setActiveNis(clean);
      setNisInputDraft(clean);
    }
  }, [isNisLocked, lockedNis]);

  useEffect(() => {
    if (!isNisLocked && initialNis && initialNis.trim() !== '') {
      const clean = initialNis.trim();
      setActiveNis(clean);
      setNisInputDraft(clean);
    }
  }, [initialNis, isNisLocked]);

  // State Rapor Lengkap Siswa (GET /jbsakad/rapor/:nis)
  const [raporLoading, setRaporLoading] = useState<boolean>(false);
  const [raporParsed, setRaporParsed] = useState<ParsedRaporDetail | null>(
    null
  );
  const [raporServerIssue, setRaporServerIssue] = useState<string | null>(null);
  const [raporRaw, setRaporRaw] = useState<unknown>(null);
  const [fallbackIdentity, setFallbackIdentity] = useState<
    Partial<RaporIdentitas>
  >({});
  const [fallbackAbsensi, setFallbackAbsensi] =
    useState<RaporAbsensiRekap | null>(null);

  // State Daftar Nilai Ujian (GET /jbsakad/rapor/nilaiujian/:nis)
  const [nilaiLoading, setNilaiLoading] = useState<boolean>(false);
  const [nilaiError, setNilaiError] = useState<string | null>(null);
  const [nilaiItems, setNilaiItems] = useState<NilaiUjianItem[]>([]);
  const [nilaiRaw, setNilaiRaw] = useState<unknown>(null);
  const [nilaiSearch, setNilaiSearch] = useState<string>('');
  const [selectedMapelFilter, setSelectedMapelFilter] = useState<string>('ALL');

  // State Notifikasi & Modal CRUD Nilai Ujian (POST / PUT / DELETE)
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createIdUjian, setCreateIdUjian] = useState<string>('');
  const [createNis, setCreateNis] = useState<string>('');
  const [createNilaiScore, setCreateNilaiScore] = useState<string>('');
  const [createKeterangan, setCreateKeterangan] = useState<string>('');
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<NilaiUjianItem | null>(null);
  const [editNilaiScore, setEditNilaiScore] = useState<string>('');
  const [editKeterangan, setEditKeterangan] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingItem, setDeletingItem] = useState<NilaiUjianItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [localRefreshTick, setLocalRefreshTick] = useState<number>(0);

  // 1. Muat Master Kelas & Daftar Induk Siswa Rapor (untuk dropdown pemilih kelas & siswa)
  useEffect(() => {
    if (isNisLocked) return;
    let cancelled = false;

    Promise.allSettled([
      apiClient.get('/jbsakad/kelas'),
      apiClient.get('/jbsakad/rapor'),
    ]).then(([kelasRes, raporAllRes]) => {
      if (cancelled) return;

      if (kelasRes.status === 'fulfilled') {
        const rows = extractResponsePayload(kelasRes.value.data).rows;
        const parsedKelas: KelasOption[] = rows
          .map((r) => ({
            idkelas: String(r.idkelas ?? r.replid ?? '').trim(),
            nama_kelas: String(r.nama_kelas ?? r.kelas ?? '').trim(),
            wali_kelas: String(r.wali_kelas ?? '').trim(),
          }))
          .filter((k) => k.idkelas !== '');
        setKelasOptions(parsedKelas);
      }

      if (raporAllRes.status === 'fulfilled') {
        const rows = extractResponsePayload(raporAllRes.value.data).rows;
        const mapped: RaporDirectoryStudent[] = rows
          .map((r) => ({
            nis: String(r.nis ?? '').trim(),
            nisn: String(r.nisn ?? '').trim(),
            nama_siswa: String(r.nama_siswa ?? r.nama ?? '').trim(),
            nama_kelas: String(r.nama_kelas ?? r.kelas ?? '').trim(),
            tahunajaran: String(
              r.tahunajaran ?? r.nama_tahunajaran ?? ''
            ).trim(),
            raw: r,
          }))
          .filter((s) => s.nis !== '');
        setAllKnownStudents(mapped);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isNisLocked]);

  // 2. Muat Direktori Siswa Rapor (GET /api/jbsakad/rapor atau ?idkelas=xxx)
  const fetchRaporDirectory = useCallback(async (idKelasFilter: string) => {
    setDirectoryLoading(true);
    setDirectoryError(null);

    try {
      const cleanKelas = idKelasFilter.trim();
      const response = await apiClient.get('/jbsakad/rapor', {
        params: cleanKelas ? { idkelas: cleanKelas } : undefined,
      });
      setDirectoryRaw(response.data);

      const body = response.data as Record<string, unknown> | undefined;
      if (body && body.success === false) {
        setDirectoryStudents([]);
        setDirectoryError(
          String(body.message || 'Gagal memuat daftar siswa rapor.')
        );
        return;
      }

      const normalized = extractResponsePayload(response.data);
      const mapped: RaporDirectoryStudent[] = normalized.rows
        .map((r) => ({
          nis: String(r.nis ?? '').trim(),
          nisn: String(r.nisn ?? '').trim(),
          nama_siswa: String(r.nama_siswa ?? r.nama ?? '').trim(),
          nama_kelas: String(r.nama_kelas ?? r.kelas ?? '').trim(),
          tahunajaran: String(r.tahunajaran ?? r.nama_tahunajaran ?? '').trim(),
          raw: r,
        }))
        .filter((s) => s.nis !== '');

      setDirectoryStudents(mapped);
      setDirectoryPage(1);
    } catch (err) {
      setDirectoryStudents([]);
      setDirectoryError(extractApiErrorMessage(err));
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isNisLocked) return;
    fetchRaporDirectory(selectedIdKelas);
  }, [isNisLocked, selectedIdKelas, refreshSignal, fetchRaporDirectory]);

  // 3. Muat Rapor Lengkap 1 Siswa (GET /api/jbsakad/rapor/:nis) + Riwayat Nilai Ujian (GET /api/jbsakad/rapor/nilaiujian/:nis)
  const fetchStudentRaporAndNilai = useCallback(
    async (targetNis: string) => {
      const cleanNis = targetNis.trim();
      if (!cleanNis) return;

      const encodedNis = encodeURIComponent(cleanNis);
      setRaporLoading(true);
      setNilaiLoading(true);
      setRaporServerIssue(null);
      setNilaiError(null);

      const [raporRes, nilaiRaporRes, legacyNilaiRes] =
        await Promise.allSettled([
          apiClient.get(`/jbsakad/rapor/${encodedNis}`),
          apiClient.get(`/jbsakad/rapor/nilaiujian/${encodedNis}`),
          apiClient.get(`/jbsakad/nilaiujian/${encodedNis}`),
        ]);

      // Petakan idujian dari endpoint pendukung apabila tersedia (memudahkan referensi ID Ujian saat Edit/Input)
      const idUjianByReplid = new Map<number, number>();
      if (legacyNilaiRes.status === 'fulfilled') {
        const legacyRows = extractResponsePayload(legacyNilaiRes.value.data).rows;
        for (const row of legacyRows) {
          const rep = toSafeNumber(row.replid);
          const idu = toSafeNumber(row.idujian);
          if (rep !== null && idu !== null) {
            idUjianByReplid.set(rep, idu);
          }
        }
      }

      // Proses GET /api/jbsakad/rapor/nilaiujian/:nis
      if (nilaiRaporRes.status === 'fulfilled') {
        const rawData = nilaiRaporRes.value.data;
        setNilaiRaw(rawData);
        const bodyObj = rawData as Record<string, unknown> | undefined;

        if (bodyObj && bodyObj.success === false && !Array.isArray(bodyObj.data)) {
          setNilaiItems([]);
          setNilaiError(
            String(bodyObj.message || 'Belum ada riwayat nilai ujian.')
          );
        } else {
          const parsedRows = extractResponsePayload(rawData).rows;
          const items: NilaiUjianItem[] = parsedRows
            .map((r) => {
              const replid = toSafeNumber(r.replid) ?? 0;
              const directIdUjian = toSafeNumber(r.idujian);
              const scoreNum = toSafeNumber(r.nilaiujian ?? r.nilai) ?? 0;
              return {
                replid,
                idujian:
                  directIdUjian !== null
                    ? directIdUjian
                    : idUjianByReplid.get(replid) ?? null,
                nis: String(r.nis ?? cleanNis).trim(),
                nilaiujian: scoreNum,
                nilaiText: formatScoreId(scoreNum),
                keterangan: String(
                  r.ket_nilai ?? r.keterangan ?? ''
                ).trim(),
                waktuInput: String(
                  r.waktu_input ?? r.tanggal ?? '-'
                ).trim(),
                kodePelajaran: String(
                  r.kode_pelajaran ?? r.kode ?? '-'
                ).trim(),
                mataPelajaran: String(
                  r.mata_pelajaran ?? r.nama_pelajaran ?? r.pelajaran ?? '-'
                ).trim(),
                raw: r,
              };
            })
            .filter((item) => item.replid > 0);
          setNilaiItems(items);
        }
      } else {
        setNilaiItems([]);
        setNilaiError(extractApiErrorMessage(nilaiRaporRes.reason));
      }
      setNilaiLoading(false);

      // Proses GET /api/jbsakad/rapor/:nis
      let needFallbackEnrichment = false;
      if (raporRes.status === 'fulfilled') {
        const rawData = raporRes.value.data;
        setRaporRaw(rawData);
        const bodyObj = rawData as Record<string, unknown> | undefined;

        if (
          bodyObj &&
          (bodyObj.success === false || bodyObj.status === 'gagal')
        ) {
          setRaporParsed(null);
          setRaporServerIssue(
            String(
              bodyObj.message ||
                bodyObj.error ||
                'Endpoint rapor mengembalikan kendala saat merender agregasi.'
            )
          );
          needFallbackEnrichment = true;
        } else {
          const parsed = parseRaporDetailResponse(rawData);
          setRaporParsed(parsed);
          if (!parsed.identitas.nama || !parsed.rekapAbsensi) {
            needFallbackEnrichment = true;
          }
        }
      } else {
        setRaporParsed(null);
        setRaporServerIssue(extractApiErrorMessage(raporRes.reason));
        needFallbackEnrichment = true;
      }

      // Pengayaan identitas & rekap absensi cadangan jika /rapor/:nis belum mengembalikan blok lengkap
      if (needFallbackEnrichment) {
        const [siswaDetailRes, presensiRes] = await Promise.allSettled([
          apiClient.get(`/jbsakad/siswa/detail/${encodedNis}`),
          apiClient.get(`/jbsakad/presensiharian/${encodedNis}`),
        ]);

        if (siswaDetailRes.status === 'fulfilled') {
          const single = extractResponsePayload(
            siswaDetailRes.value.data
          ).singleObject;
          if (single) {
            setFallbackIdentity({
              nis: String(single.nis ?? cleanNis).trim(),
              nisn: String(single.nisn ?? '').trim(),
              nama: String(single.nama ?? single.nama_siswa ?? '').trim(),
              kelas: String(single.kelas ?? single.nama_kelas ?? '').trim(),
              tahunajaran: String(single.tahunajaran ?? '').trim(),
              departemen: String(single.departemen ?? '').trim(),
            });
          } else {
            setFallbackIdentity({});
          }
        } else {
          setFallbackIdentity({});
        }

        if (presensiRes.status === 'fulfilled') {
          const rekap = parseRekapObject(presensiRes.value.data);
          setFallbackAbsensi(rekap);
        } else {
          setFallbackAbsensi(null);
        }
      } else {
        setFallbackIdentity({});
        setFallbackAbsensi(null);
      }

      setRaporLoading(false);
    },
    []
  );

  useEffect(() => {
    if (!activeNis) return;
    fetchStudentRaporAndNilai(activeNis);
  }, [
    activeNis,
    refreshSignal,
    localRefreshTick,
    fetchStudentRaporAndNilai,
  ]);

  // Kirim muatan JSON aktif ke parent drawer bila disematkan
  useEffect(() => {
    if (!onRawPayloadLoadedRef.current) return;
    if (mode === 'nilai-ujian' && nilaiRaw) {
      onRawPayloadLoadedRef.current(nilaiRaw);
    } else if (mode === 'rapor-siswa' && raporRaw) {
      onRawPayloadLoadedRef.current(raporRaw);
    } else if (directoryRaw) {
      onRawPayloadLoadedRef.current(directoryRaw);
    }
  }, [mode, raporRaw, nilaiRaw, directoryRaw]);

  // Pencarian & Paginasi Direktori Siswa
  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directoryStudents;
    return directoryStudents.filter(
      (s) =>
        s.nis.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.nama_siswa.toLowerCase().includes(q) ||
        s.nama_kelas.toLowerCase().includes(q)
    );
  }, [directoryStudents, directorySearch]);

  const totalDirectoryPages = Math.max(
    1,
    Math.ceil(filteredDirectory.length / directoryPageSize)
  );
  const pagedDirectory = useMemo(() => {
    const start = (directoryPage - 1) * directoryPageSize;
    return filteredDirectory.slice(start, start + directoryPageSize);
  }, [filteredDirectory, directoryPage]);

  // Identitas Siswa Terpadu (mengutamakan respons /rapor/:nis lalu direktori / detail)
  const matchedKnownStudent = useMemo(
    () =>
      allKnownStudents.find((s) => s.nis === activeNis) ||
      directoryStudents.find((s) => s.nis === activeNis) ||
      null,
    [allKnownStudents, directoryStudents, activeNis]
  );

  const effectiveIdentity: RaporIdentitas = useMemo(
    () => ({
      nis:
        raporParsed?.identitas.nis ||
        fallbackIdentity.nis ||
        matchedKnownStudent?.nis ||
        activeNis,
      nisn:
        raporParsed?.identitas.nisn ||
        fallbackIdentity.nisn ||
        matchedKnownStudent?.nisn ||
        '-',
      nama:
        raporParsed?.identitas.nama ||
        fallbackIdentity.nama ||
        matchedKnownStudent?.nama_siswa ||
        studentName ||
        `Siswa NIS ${activeNis}`,
      kelas:
        raporParsed?.identitas.kelas ||
        fallbackIdentity.kelas ||
        matchedKnownStudent?.nama_kelas ||
        studentClass ||
        '-',
      tahunajaran:
        raporParsed?.identitas.tahunajaran ||
        fallbackIdentity.tahunajaran ||
        matchedKnownStudent?.tahunajaran ||
        '-',
      departemen:
        raporParsed?.identitas.departemen ||
        fallbackIdentity.departemen ||
        '',
      semester: raporParsed?.identitas.semester || '',
      waliKelas: raporParsed?.identitas.waliKelas || '',
    }),
    [
      raporParsed,
      fallbackIdentity,
      matchedKnownStudent,
      activeNis,
      studentName,
      studentClass,
    ]
  );

  const effectiveAbsensi: RaporAbsensiRekap | null =
    raporParsed?.rekapAbsensi ?? fallbackAbsensi;

  // Ringkasan Mata Pelajaran: utamakan agregasi server /rapor/:nis; bila server terkendala, kelompokkan dari nilaiujian/:nis
  const fallbackSubjectsFromNilai = useMemo<RaporSubjectRow[]>(() => {
    if (nilaiItems.length === 0) return [];
    const grouped = new Map<
      string,
      { kode: string; mapel: string; scores: number[] }
    >();

    for (const item of nilaiItems) {
      const key = `${item.kodePelajaran}::${item.mataPelajaran}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.scores.push(item.nilaiujian);
      } else {
        grouped.set(key, {
          kode: item.kodePelajaran,
          mapel: item.mataPelajaran,
          scores: [item.nilaiujian],
        });
      }
    }

    return Array.from(grouped.values()).map((entry) => {
      const avg =
        entry.scores.reduce((sum, v) => sum + v, 0) / entry.scores.length;
      return {
        kode: entry.kode,
        mataPelajaran: entry.mapel,
        rataTertimbang: avg,
        predikat: deriveDynamicPredikat(avg),
        jumlahUjian: entry.scores.length,
        bobotInfo: `${entry.scores.length} komponen ujian`,
        keterangan: 'Dihitung dari daftar nilai ujian tersimpan',
        isFallbackComputed: true,
      };
    });
  }, [nilaiItems]);

  const effectiveSubjects: RaporSubjectRow[] =
    raporParsed && raporParsed.subjects.length > 0
      ? raporParsed.subjects
      : fallbackSubjectsFromNilai;

  const effectiveOverallAverage: number | null = useMemo(() => {
    if (raporParsed?.rataRataUmum !== null && raporParsed?.rataRataUmum !== undefined) {
      return raporParsed.rataRataUmum;
    }
    const valid = effectiveSubjects.filter((s) => s.rataTertimbang !== null);
    if (valid.length === 0) return null;
    return (
      valid.reduce((acc, s) => acc + (s.rataTertimbang || 0), 0) / valid.length
    );
  }, [raporParsed, effectiveSubjects]);

  const effectiveOverallPredicate: string =
    raporParsed && raporParsed.predikatUmum !== '-'
      ? raporParsed.predikatUmum
      : deriveDynamicPredikat(effectiveOverallAverage);

  // Filter Daftar Nilai Ujian
  const mapelOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of nilaiItems) {
      if (item.mataPelajaran && item.mataPelajaran !== '-') {
        unique.set(
          item.mataPelajaran,
          item.kodePelajaran && item.kodePelajaran !== '-'
            ? `${item.kodePelajaran} — ${item.mataPelajaran}`
            : item.mataPelajaran
        );
      }
    }
    return Array.from(unique.entries());
  }, [nilaiItems]);

  const filteredNilaiItems = useMemo(() => {
    const q = nilaiSearch.trim().toLowerCase();
    return nilaiItems.filter((item) => {
      if (
        selectedMapelFilter !== 'ALL' &&
        item.mataPelajaran !== selectedMapelFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(item.replid).includes(q) ||
        (item.idujian !== null && String(item.idujian).includes(q)) ||
        item.kodePelajaran.toLowerCase().includes(q) ||
        item.mataPelajaran.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q) ||
        item.waktuInput.toLowerCase().includes(q)
      );
    });
  }, [nilaiItems, selectedMapelFilter, nilaiSearch]);

  // Daftar referensi cepat ID Ujian yang pernah tercatat pada siswa ini
  const knownIdUjianHints = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of nilaiItems) {
      if (item.idujian !== null && !map.has(item.idujian)) {
        map.set(item.idujian, item.mataPelajaran);
      }
    }
    return Array.from(map.entries());
  }, [nilaiItems]);

  const handleApplyNis = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nisInputDraft.trim();
    if (!clean) return;
    setActiveNis(clean);
    setFeedbackBanner(null);
  };

  const handleSelectStudentFromDirectory = (
    student: RaporDirectoryStudent,
    targetMode: 'rapor-siswa' | 'nilai-ujian'
  ) => {
    setActiveNis(student.nis);
    setNisInputDraft(student.nis);
    setFeedbackBanner(null);
    setMode(targetMode);
  };

  // Handler Buka Modal POST /api/jbsakad/rapor/nilaiujian
  const openCreateModal = () => {
    setCreateNis(activeNis);
    setCreateIdUjian(
      knownIdUjianHints.length > 0 ? String(knownIdUjianHints[0][0]) : ''
    );
    setCreateNilaiScore('');
    setCreateKeterangan('');
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const handleSubmitCreateNilai = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIdUjian = Number(createIdUjian.trim());
    const cleanNis = createNis.trim();
    const parsedScore = Number(createNilaiScore.trim());

    if (!createIdUjian.trim() || !Number.isFinite(parsedIdUjian) || parsedIdUjian <= 0) {
      setCreateError('ID Ujian (idujian) wajib berupa angka positif yang valid.');
      return;
    }
    if (!cleanNis) {
      setCreateError('Nomor Induk Siswa (NIS) wajib diisi.');
      return;
    }
    if (
      createNilaiScore.trim() === '' ||
      !Number.isFinite(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100
    ) {
      setCreateError('Skor Nilai Ujian wajib berupa angka dalam rentang 0 hingga 100.');
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const res = await apiClient.post('/jbsakad/rapor/nilaiujian', {
        idujian: parsedIdUjian,
        nis: cleanNis,
        nilaiujian: parsedScore,
        keterangan: createKeterangan.trim(),
      });

      const body = res.data as Record<string, unknown> | undefined;
      if (body && (body.success === false || body.status === 'gagal')) {
        throw new Error(
          String(body.message || body.error || 'Gagal menyimpan nilai ujian baru.')
        );
      }

      setCreateModalOpen(false);
      if (!isNisLocked && cleanNis !== activeNis) {
        setActiveNis(cleanNis);
        setNisInputDraft(cleanNis);
      }
      setFeedbackBanner({
        type: 'success',
        message: `Nilai ujian baru (${formatScoreId(parsedScore)}) untuk NIS ${cleanNis} berhasil ditambahkan.`,
      });
      setLocalRefreshTick((t) => t + 1);
      onMutated?.();
    } catch (err) {
      setCreateError(extractApiErrorMessage(err));
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handler Buka Modal PUT /api/jbsakad/rapor/nilaiujian/:replid
  const openEditModal = (item: NilaiUjianItem) => {
    setEditingItem(item);
    setEditNilaiScore(String(item.nilaiujian));
    setEditKeterangan(item.keterangan);
    setEditError(null);
  };

  const handleSubmitEditNilai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedScore = Number(editNilaiScore.trim());
    if (
      editNilaiScore.trim() === '' ||
      !Number.isFinite(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100
    ) {
      setEditError('Skor Nilai Ujian wajib berupa angka dalam rentang 0 hingga 100.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const payload: Record<string, unknown> = {
        nilaiujian: parsedScore,
        keterangan: editKeterangan.trim(),
      };
      if (editingItem.idujian !== null) {
        payload.idujian = editingItem.idujian;
      }
      if (editingItem.nis) {
        payload.nis = editingItem.nis;
      }

      const res = await apiClient.put(
        `/jbsakad/rapor/nilaiujian/${encodeURIComponent(String(editingItem.replid))}`,
        payload
      );

      const body = res.data as Record<string, unknown> | undefined;
      if (body && (body.success === false || body.status === 'gagal')) {
        throw new Error(
          String(body.message || body.error || 'Gagal memperbarui skor nilai ujian.')
        );
      }

      const targetReplid = editingItem.replid;
      setEditingItem(null);
      setFeedbackBanner({
        type: 'success',
        message: `Skor nilai ujian #${targetReplid} berhasil diperbarui menjadi ${formatScoreId(parsedScore)}.`,
      });
      setLocalRefreshTick((t) => t + 1);
      onMutated?.();
    } catch (err) {
      setEditError(extractApiErrorMessage(err));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handler Konfirmasi DELETE /api/jbsakad/rapor/nilaiujian/:replid
  const openDeleteModal = (item: NilaiUjianItem) => {
    setDeletingItem(item);
    setDeleteError(null);
  };

  const handleConfirmDeleteNilai = async () => {
    if (!deletingItem) return;

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const res = await apiClient.delete(
        `/jbsakad/rapor/nilaiujian/${encodeURIComponent(String(deletingItem.replid))}`
      );

      const body = res.data as Record<string, unknown> | undefined;
      if (body && (body.success === false || body.status === 'gagal')) {
        throw new Error(
          String(body.message || body.error || 'Gagal menghapus data nilai ujian.')
        );
      }

      const removedReplid = deletingItem.replid;
      setDeletingItem(null);
      setFeedbackBanner({
        type: 'success',
        message: `Data nilai ujian #${removedReplid} berhasil dihapus dari riwayat siswa.`,
      });
      setLocalRefreshTick((t) => t + 1);
      onMutated?.();
    } catch (err) {
      setDeleteError(extractApiErrorMessage(err));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const activeEndpointSignature = useMemo(() => {
    if (mode === 'direktori') {
      const qs = selectedIdKelas.trim()
        ? `?idkelas=${encodeURIComponent(selectedIdKelas.trim())}`
        : '';
      return `GET /api/jbsakad/rapor${qs}`;
    }
    if (mode === 'rapor-siswa') {
      return `GET /api/jbsakad/rapor/${encodeURIComponent(activeNis)}`;
    }
    return `GET /api/jbsakad/rapor/nilaiujian/${encodeURIComponent(activeNis)}`;
  }, [mode, selectedIdKelas, activeNis]);

  const activeRawForInspector =
    mode === 'direktori'
      ? directoryRaw
      : mode === 'rapor-siswa'
      ? raporRaw
      : nilaiRaw;

  const isCurrentModeLoading =
    mode === 'direktori'
      ? directoryLoading
      : mode === 'rapor-siswa'
      ? raporLoading
      : nilaiLoading;

  const handleManualReload = () => {
    setFeedbackBanner(null);
    if (mode === 'direktori') {
      fetchRaporDirectory(selectedIdKelas);
    } else {
      fetchStudentRaporAndNilai(activeNis);
    }
  };

  const wrapperClass = embedded
    ? 'divide-y divide-slate-200 bg-white'
    : 'rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden';

  return (
    <section className={wrapperClass}>
      {/* Header Kontrol & Mode Switcher */}
      <div className="p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {activeEndpointSignature}
              </span>
              {hasAnyWriteAccess && mode !== 'direktori' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-600">
                    POST · PUT · DELETE Nilai Ujian Aktif
                  </span>
                </>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {title ||
                (mode === 'direktori'
                  ? 'Direktori Rapor & Evaluasi Akademik Siswa'
                  : mode === 'rapor-siswa'
                  ? `Rapor Lengkap & Agregasi Nilai — ${effectiveIdentity.nama}`
                  : `Manajemen Nilai Ujian Siswa — ${effectiveIdentity.nama}`)}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              {description ||
                (mode === 'direktori'
                  ? 'Daftar seluruh siswa lintas kelas untuk penerbitan rapor akademik. Filter berdasarkan kelas (?idkelas=) lalu pilih siswa untuk membuka Rapor Lengkap atau mengelola Nilai Ujian.'
                  : mode === 'rapor-siswa'
                  ? 'Laporan hasil belajar siswa mencakup identitas resmi, Auto-Rekap Absensi dari server, serta agregasi rata-rata tertimbang dan predikat huruf dinamis per mata pelajaran.'
                  : 'Kelola riwayat skor ujian spesifik milik satu siswa: tambah nilai ujian baru (POST), ubah skor (PUT), atau hapus salah input (DELETE).')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Can modul="SIMAKA" action="create">
              <Button
                type="button"
                size="sm"
                onClick={openCreateModal}
                className="whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Input Nilai Ujian</span>
              </Button>
            </Can>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCurrentModeLoading}
              onClick={handleManualReload}
              className="whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isCurrentModeLoading ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span>Muat Ulang</span>
            </Button>

            {onInspectEntity && Boolean(activeRawForInspector) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onInspectEntity({
                    mode: 'raw-response',
                    title: activeEndpointSignature,
                    row:
                      activeRawForInspector &&
                      typeof activeRawForInspector === 'object'
                        ? (activeRawForInspector as Record<string, unknown>)
                        : { payload: activeRawForInspector },
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

        {/* Segmented Tab Navigasi Modul Rapor & Penilaian */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-full">
            {!isNisLocked && (
              <button
                type="button"
                onClick={() => setMode('direktori')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'direktori'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Direktori Siswa</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode('rapor-siswa')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'rapor-siswa'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Rapor & Agregasi</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('nilai-ujian')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'nilai-ujian'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Riwayat Nilai Ujian ({formatNumberId(nilaiItems.length)})
              </span>
            </button>
          </div>

          {/* Pemilih Siswa Cepat saat berada di tab Rapor / Nilai Ujian (sembunyikan bila NIS dikunci) */}
          {!isNisLocked && mode !== 'direktori' && (
            <form
              onSubmit={handleApplyNis}
              className="flex flex-wrap items-center gap-2"
            >
              {allKnownStudents.length > 0 && (
                <select
                  aria-label="Pilih siswa dari direktori rapor"
                  value={
                    allKnownStudents.some((s) => s.nis === activeNis)
                      ? activeNis
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setNisInputDraft(val);
                    setActiveNis(val);
                    setFeedbackBanner(null);
                  }}
                  className="h-9 max-w-[260px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                >
                  <option value="">-- Pilih Cepat Siswa --</option>
                  {allKnownStudents.map((s, idx) => (
                    <option key={`${s.nis}-${s.nama_kelas}-${idx}`} value={s.nis}>
                      {s.nis} — {s.nama_siswa} ({s.nama_kelas})
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-1.5">
                <Input
                  value={nisInputDraft}
                  onChange={(e) => setNisInputDraft(e.target.value)}
                  placeholder="Ketik NIS (cth: 1629)"
                  className="h-9 w-36 text-xs font-mono"
                  aria-label="Nomor Induk Siswa (NIS)"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap shrink-0"
                >
                  <span>Buka NIS</span>
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Notifikasi Hasil Operasi CRUD */}
        {feedbackBanner && (
          <Alert
            variant={feedbackBanner.type === 'error' ? 'destructive' : 'default'}
            className={
              feedbackBanner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                : ''
            }
          >
            {feedbackBanner.type === 'error' ? (
              <AlertCircle
                className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700"
                aria-hidden="true"
              />
            )}
            <div className="flex-1 flex items-start justify-between gap-3">
              <div>
                <AlertTitle>
                  {feedbackBanner.type === 'error'
                    ? 'Kendala Pemrosesan'
                    : 'Perubahan Tersimpan'}
                </AlertTitle>
                <AlertDescription>{feedbackBanner.message}</AlertDescription>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer shrink-0"
                aria-label="Tutup pesan"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </Alert>
        )}
      </div>

      {/* =====================================================================
          MODE 1: DIREKTORI RAPOR SISWA & FILTER KELAS (GET /api/jbsakad/rapor)
         ===================================================================== */}
      {mode === 'direktori' && !isNisLocked && (
        <div className="divide-y divide-slate-200">
          {/* Toolbar Filter Kelas (?idkelas=) & Pencarian */}
          <div className="px-6 py-4 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                htmlFor="rapor-filter-kelas"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                Filter Kelas:
              </label>
              <select
                id="rapor-filter-kelas"
                value={selectedIdKelas}
                onChange={(e) => setSelectedIdKelas(e.target.value)}
                className="h-9 min-w-[210px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              >
                <option value="">Semua Kelas (Seluruh Siswa)</option>
                {kelasOptions.map((k, idx) => (
                  <option key={`${k.idkelas}-${idx}`} value={k.idkelas}>
                    Kelas {k.nama_kelas} (ID: {k.idkelas})
                    {k.wali_kelas ? ` — ${k.wali_kelas}` : ''}
                  </option>
                ))}
              </select>

              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Menampilkan {formatNumberId(filteredDirectory.length)} siswa
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <Input
                value={directorySearch}
                onChange={(e) => {
                  setDirectorySearch(e.target.value);
                  setDirectoryPage(1);
                }}
                placeholder="Cari NIS, NISN, atau nama siswa..."
                className="h-9 pl-9 text-xs bg-white"
              />
            </div>
          </div>

          {directoryError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <AlertTitle>Gagal Memuat Direktori Rapor</AlertTitle>
                  <AlertDescription>{directoryError}</AlertDescription>
                </div>
              </Alert>
            </div>
          ) : directoryLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500">
              <Loader2
                className="h-5 w-5 animate-spin text-slate-700"
                aria-hidden="true"
              />
              <span>Mengambil daftar siswa rapor dari server...</span>
            </div>
          ) : filteredDirectory.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-1.5">
              <p className="text-sm font-semibold text-slate-800">
                Tidak ada data siswa yang cocok
              </p>
              <p className="text-xs text-slate-500">
                Ubah filter kelas atau kata kunci pencarian untuk menampilkan siswa.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-6 w-14">No</th>
                      <th className="py-3 px-4">NIS</th>
                      <th className="py-3 px-4">NISN</th>
                      <th className="py-3 px-4">Nama Lengkap Siswa</th>
                      <th className="py-3 px-4">Kelas</th>
                      <th className="py-3 px-4">Tahun Ajaran</th>
                      <th className="py-3 px-6 text-right">Aksi Evaluasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {pagedDirectory.map((student, idx) => {
                      const rowNum =
                        (directoryPage - 1) * directoryPageSize + idx + 1;
                      const isCurrentSelected = student.nis === activeNis;

                      return (
                        <tr
                          key={`${student.nis}-${idx}`}
                          className={`transition-colors hover:bg-slate-50/80 ${
                            isCurrentSelected ? 'bg-slate-50/60' : ''
                          }`}
                        >
                          <td className="py-3 px-6 font-mono text-slate-400 tabular-nums">
                            {String(rowNum).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {student.nis}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {student.nisn || '-'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {student.nama_siswa}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                            {student.nama_kelas || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {student.tahunajaran || '-'}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleSelectStudentFromDirectory(
                                    student,
                                    'rapor-siswa'
                                  )
                                }
                                className="h-8 text-xs whitespace-nowrap shrink-0"
                              >
                                <Award
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Lihat Rapor</span>
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleSelectStudentFromDirectory(
                                    student,
                                    'nilai-ujian'
                                  )
                                }
                                className="h-8 text-xs whitespace-nowrap shrink-0"
                              >
                                <BookOpen
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Nilai Ujian</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalDirectoryPages > 1 && (
                <div className="px-6 py-3.5 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <span className="font-mono tabular-nums">
                    Halaman {directoryPage} dari {totalDirectoryPages} · Total{' '}
                    {formatNumberId(filteredDirectory.length)} siswa
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={directoryPage <= 1}
                      onClick={() =>
                        setDirectoryPage((p) => Math.max(1, p - 1))
                      }
                      className="h-8 px-2.5 whitespace-nowrap shrink-0"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sebelumnya</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={directoryPage >= totalDirectoryPages}
                      onClick={() =>
                        setDirectoryPage((p) =>
                          Math.min(totalDirectoryPages, p + 1)
                        )
                      }
                      className="h-8 px-2.5 whitespace-nowrap shrink-0"
                    >
                      <span>Berikutnya</span>
                      <ChevronRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 2: RAPOR LENGKAP 1 SISWA (GET /api/jbsakad/rapor/:nis)
          (Identitas + Auto-Rekap Absensi + Agregasi Rata-rata Tertimbang & Predikat)
         ===================================================================== */}
      {mode === 'rapor-siswa' && (
        <div className="divide-y divide-slate-200">
          {raporLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500">
              <Loader2
                className="h-5 w-5 animate-spin text-slate-700"
                aria-hidden="true"
              />
              <span>
                Menyusun Rapor Akademik & Auto-Rekap Absensi untuk NIS{' '}
                {activeNis}...
              </span>
            </div>
          ) : (
            <>
              {/* Peringatan transparan jika endpoint agregasi rapor mengembalikan pesan kendala */}
              {raporServerIssue && (
                <div className="px-6 py-4 bg-amber-50/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 text-xs text-amber-950">
                      <AlertCircle
                        className="h-4 w-4 text-amber-700 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <div className="font-semibold">
                          Catatan Server pada GET /api/jbsakad/rapor/{activeNis}
                        </div>
                        <p className="text-amber-900/90 leading-relaxed">
                          {raporServerIssue}. Identitas siswa, rekap kehadiran, dan
                          ringkasan nilai di bawah tetap ditampilkan menggunakan sinkronisasi
                          data ujian tersimpan agar evaluasi tetap berjalan lancar.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMode('nilai-ujian')}
                      className="whitespace-nowrap shrink-0 bg-white"
                    >
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buka Daftar Nilai Ujian</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Blok 1: Identitas Siswa & Indeks Prestasi / Predikat Umum */}
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                <div className="lg:col-span-8 p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <UserCheck className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                    <span>Identitas Peserta Didik</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Nama Lengkap
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        {effectiveIdentity.nama}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        NIS / NISN
                      </div>
                      <div className="mt-0.5 text-sm font-mono font-semibold text-slate-800 tabular-nums">
                        {effectiveIdentity.nis}
                        {effectiveIdentity.nisn && effectiveIdentity.nisn !== '-'
                          ? ` · ${effectiveIdentity.nisn}`
                          : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Kelas & Tahun Ajaran
                      </div>
                      <div className="mt-0.5 text-sm font-mono font-semibold text-slate-800 tabular-nums">
                        {effectiveIdentity.kelas}
                        {effectiveIdentity.tahunajaran &&
                        effectiveIdentity.tahunajaran !== '-'
                          ? ` · ${effectiveIdentity.tahunajaran}`
                          : ''}
                      </div>
                    </div>
                    {effectiveIdentity.departemen && (
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Departemen
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-800">
                          {effectiveIdentity.departemen}
                        </div>
                      </div>
                    )}
                    {effectiveIdentity.semester && (
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Semester
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-800">
                          {effectiveIdentity.semester}
                        </div>
                      </div>
                    )}
                    {effectiveIdentity.waliKelas && (
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Wali Kelas
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-800">
                          {effectiveIdentity.waliKelas}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ringkasan Rata-rata Tertimbang & Predikat Huruf Dinamis */}
                <div className="lg:col-span-4 grid grid-cols-2 divide-x divide-slate-200 bg-slate-50/40">
                  <div className="p-6 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Rata-rata Tertimbang
                    </span>
                    <div
                      className={`mt-3 text-3xl font-bold font-mono tabular-nums tracking-tight ${getScoreTextClass(
                        effectiveOverallAverage
                      )}`}
                    >
                      {formatScoreId(effectiveOverallAverage)}
                    </div>
                    <span className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                      {formatNumberId(effectiveSubjects.length)} mata pelajaran
                    </span>
                  </div>

                  <div className="p-6 flex flex-col justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Predikat Dinamis
                    </span>
                    <div
                      className={`mt-3 text-3xl font-bold font-mono tabular-nums tracking-tight ${getPredicateTextClass(
                        effectiveOverallPredicate
                      )}`}
                    >
                      {effectiveOverallPredicate}
                    </div>
                    <span className="mt-1 text-[11px] text-slate-500">
                      Skala huruf otomatis
                    </span>
                  </div>
                </div>
              </div>

              {/* Blok 2: Auto-Rekap Absensi Siswa */}
              <div>
                <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Auto-Rekap Absensi Siswa
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {raporParsed?.rekapAbsensi
                      ? `Sumber: GET /api/jbsakad/rapor/${activeNis}`
                      : fallbackAbsensi
                      ? `Sumber: GET /api/jbsakad/presensiharian/${activeNis}`
                      : 'Menunggu pencatatan presensi'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                  {ABSENSI_STAT_ITEMS.map((stat) => {
                    const count = effectiveAbsensi
                      ? effectiveAbsensi[stat.key]
                      : 0;
                    const StatIcon = stat.Icon;
                    return (
                      <div key={stat.key} className="p-5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {stat.label}
                          </span>
                          <StatIcon
                            className={`h-4 w-4 ${stat.valueClass}`}
                            aria-hidden={true}
                          />
                        </div>
                        <div
                          className={`text-2xl font-bold font-mono tabular-nums ${stat.valueClass}`}
                        >
                          {effectiveAbsensi ? formatNumberId(count) : '-'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {stat.sublabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blok 3: Tabel Agregasi Rata-rata Tertimbang & Predikat per Mata Pelajaran */}
              <div>
                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Agregasi Nilai Rapor & Predikat Mata Pelajaran
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perhitungan rata-rata tertimbang dan predikat huruf untuk setiap mata pelajaran yang ditempuh siswa.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('nilai-ujian')}
                    className="whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Rincian Nilai Ujian ({formatNumberId(nilaiItems.length)})
                    </span>
                  </Button>
                </div>

                {effectiveSubjects.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-800">
                      Belum ada komponen nilai rapor untuk NIS {activeNis}
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Tambahkan nilai ujian melalui menu Input Nilai Ujian agar agregasi rata-rata tertimbang dan predikat mata pelajaran terhitung otomatis.
                    </p>
                    <Can modul="SIMAKA" action="create">
                      <div className="pt-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={openCreateModal}
                          className="whitespace-nowrap shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Input Nilai Ujian Pertama</span>
                        </Button>
                      </div>
                    </Can>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-6 w-14">No</th>
                          <th className="py-3 px-4">Kode</th>
                          <th className="py-3 px-4">Mata Pelajaran</th>
                          <th className="py-3 px-4 text-right">
                            Komponen Ujian
                          </th>
                          <th className="py-3 px-4 text-right">
                            Rata-rata Tertimbang
                          </th>
                          <th className="py-3 px-4 text-center">
                            Predikat Huruf
                          </th>
                          <th className="py-3 px-6">Deskripsi / Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {effectiveSubjects.map((subj, idx) => (
                          <tr
                            key={`${subj.kode}-${subj.mataPelajaran}-${idx}`}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-3.5 px-6 font-mono text-slate-400 tabular-nums">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                              {subj.kode}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {subj.mataPelajaran}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                              {subj.jumlahUjian !== null
                                ? `${formatNumberId(subj.jumlahUjian)} ujian`
                                : subj.bobotInfo || '-'}
                            </td>
                            <td
                              className={`py-3.5 px-4 text-right font-mono font-bold text-sm tabular-nums whitespace-nowrap ${getScoreTextClass(
                                subj.rataTertimbang
                              )}`}
                            >
                              {formatScoreId(subj.rataTertimbang)}
                            </td>
                            <td
                              className={`py-3.5 px-4 text-center font-mono font-bold text-sm tabular-nums whitespace-nowrap ${getPredicateTextClass(
                                subj.predikat
                              )}`}
                            >
                              {subj.predikat}
                            </td>
                            <td className="py-3.5 px-6 text-slate-600">
                              {subj.keterangan || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 3: CRUD NILAI UJIAN SISWA (GET / POST / PUT / DELETE)
          Endpoint: /api/jbsakad/rapor/nilaiujian/:nis & /api/jbsakad/rapor/nilaiujian
         ===================================================================== */}
      {mode === 'nilai-ujian' && (
        <div className="divide-y divide-slate-200">
          {/* Bar Ringkasan Siswa & Filter Mata Pelajaran */}
          <div className="px-6 py-4 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {effectiveIdentity.nama}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                NIS {effectiveIdentity.nis}
              </span>
              {effectiveIdentity.kelas && effectiveIdentity.kelas !== '-' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    Kelas {effectiveIdentity.kelas}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono font-medium text-slate-800 tabular-nums">
                {formatNumberId(filteredNilaiItems.length)} nilai tercatat
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {mapelOptions.length > 0 && (
                <select
                  aria-label="Filter mata pelajaran"
                  value={selectedMapelFilter}
                  onChange={(e) => setSelectedMapelFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                >
                  <option value="ALL">Semua Mata Pelajaran</option>
                  {mapelOptions.map(([mapelName, label], idx) => (
                    <option key={`${mapelName}-${idx}`} value={mapelName}>
                      {label}
                    </option>
                  ))}
                </select>
              )}

              <div className="relative w-full sm:w-64">
                <Search
                  className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  value={nilaiSearch}
                  onChange={(e) => setNilaiSearch(e.target.value)}
                  placeholder="Cari mapel, replid, tanggal..."
                  className="h-9 pl-9 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {nilaiLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-xs text-slate-500">
              <Loader2
                className="h-5 w-5 animate-spin text-slate-700"
                aria-hidden="true"
              />
              <span>
                Memuat daftar nilai ujian siswa NIS {activeNis}...
              </span>
            </div>
          ) : nilaiError ? (
            <div className="p-6">
              <Alert variant="default">
                <AlertCircle
                  className="h-4 w-4 shrink-0 mt-0.5 text-slate-600"
                  aria-hidden="true"
                />
                <div>
                  <AlertTitle>Informasi Riwayat Nilai Ujian</AlertTitle>
                  <AlertDescription>{nilaiError}</AlertDescription>
                </div>
              </Alert>
            </div>
          ) : filteredNilaiItems.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                Belum terdapat data nilai ujian untuk NIS {activeNis}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {nilaiItems.length > 0
                  ? 'Tidak ada baris nilai yang sesuai dengan filter pencarian saat ini.'
                  : 'Gunakan tombol Input Nilai Ujian untuk menambahkan skor ujian baru ke basis data akademik.'}
              </p>
              {nilaiItems.length === 0 && (
                <Can modul="SIMAKA" action="create">
                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={openCreateModal}
                      className="whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tambah Nilai Ujian Baru</span>
                    </Button>
                  </div>
                </Can>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-6 w-20">ID (replid)</th>
                    <th className="py-3 px-4">Kode & Mata Pelajaran</th>
                    <th className="py-3 px-4">ID Ujian</th>
                    <th className="py-3 px-4">Tanggal Input</th>
                    <th className="py-3 px-4 text-right">Skor Nilai</th>
                    <th className="py-3 px-4 text-center">Predikat</th>
                    <th className="py-3 px-4">Keterangan</th>
                    {(canUpdateNilai || canDeleteNilai) && (
                      <th className="py-3 px-6 text-right">Aksi CRUD</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredNilaiItems.map((item, idx) => {
                    const pred = deriveDynamicPredikat(item.nilaiujian);
                    return (
                      <tr
                        key={`${item.replid ?? 'nilai'}-${idx}`}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-6 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                          #{item.replid}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {item.mataPelajaran}
                          </div>
                          {item.kodePelajaran && item.kodePelajaran !== '-' && (
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              Kode: {item.kodePelajaran}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {item.idujian !== null ? `#${item.idujian}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {item.waktuInput}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono font-bold text-sm tabular-nums whitespace-nowrap ${getScoreTextClass(
                            item.nilaiujian
                          )}`}
                        >
                          {item.nilaiText}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-center font-mono font-bold text-sm tabular-nums whitespace-nowrap ${getPredicateTextClass(
                            pred
                          )}`}
                        >
                          {pred}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                          {item.keterangan || '-'}
                        </td>
                        {(canUpdateNilai || canDeleteNilai) && (
                          <td className="py-3.5 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <Can modul="SIMAKA" action="update">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditModal(item)}
                                  className="h-8 px-2.5 text-xs whitespace-nowrap shrink-0"
                                >
                                  <Edit3
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Edit</span>
                                </Button>
                              </Can>
                              <Can modul="SIMAKA" action="delete">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDeleteModal(item)}
                                  className="h-8 px-2.5 text-xs text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200 whitespace-nowrap shrink-0"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Hapus</span>
                                </Button>
                              </Can>
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
        </div>
      )}

      {/* =====================================================================
          MODAL 1: TAMBAH / INPUT NILAI UJIAN BARU (POST /api/jbsakad/rapor/nilaiujian)
         ===================================================================== */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-nilai-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-200 overflow-hidden">
            <div className="px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono text-slate-500">
                  POST /api/jbsakad/rapor/nilaiujian
                </div>
                <h3
                  id="modal-create-nilai-title"
                  className="text-base font-bold text-slate-900 mt-0.5"
                >
                  Input Data Nilai Ujian Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                disabled={createSubmitting}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateNilai} className="p-6 space-y-4">
              {createError && (
                <Alert variant="destructive">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <AlertTitle>Gagal Menyimpan</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="create-nilai-nis">
                  Nomor Induk Siswa (NIS) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="create-nilai-nis"
                  value={createNis}
                  onChange={(e) => setCreateNis(e.target.value)}
                  disabled={createSubmitting || isNisLocked}
                  placeholder="Contoh: 1629"
                  className="font-mono"
                  required
                />
                {effectiveIdentity.nama && createNis.trim() === activeNis && (
                  <p className="text-[11px] text-slate-500">
                    Target siswa: <strong className="text-slate-800">{effectiveIdentity.nama}</strong> ({effectiveIdentity.kelas})
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-nilai-idujian">
                  ID Ujian (idujian) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="create-nilai-idujian"
                  type="number"
                  min="1"
                  step="1"
                  value={createIdUjian}
                  onChange={(e) => setCreateIdUjian(e.target.value)}
                  disabled={createSubmitting}
                  placeholder="Contoh: 46"
                  className="font-mono"
                  required
                />
                {knownIdUjianHints.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500">
                      ID Ujian tersedia:
                    </span>
                    {knownIdUjianHints.slice(0, 5).map(([idUjian, mapel], idx) => (
                      <button
                        key={`${idUjian}-${idx}`}
                        type="button"
                        onClick={() => setCreateIdUjian(String(idUjian))}
                        className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-mono text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        #{idUjian} ({mapel})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-nilai-skor">
                  Skor Nilai Ujian (0 - 100){' '}
                  <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="create-nilai-skor"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={createNilaiScore}
                  onChange={(e) => setCreateNilaiScore(e.target.value)}
                  disabled={createSubmitting}
                  placeholder="Contoh: 88.50"
                  className="font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-nilai-keterangan">
                  Keterangan / Catatan Evaluasi
                </Label>
                <Input
                  id="create-nilai-keterangan"
                  value={createKeterangan}
                  onChange={(e) => setCreateKeterangan(e.target.value)}
                  disabled={createSubmitting}
                  placeholder="Contoh: Tuntas KKM / Ujian Harian Bab 2"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={createSubmitting}
                  className="whitespace-nowrap shrink-0"
                >
                  <span>Batal</span>
                </Button>
                <Button
                  type="submit"
                  disabled={createSubmitting}
                  className="whitespace-nowrap shrink-0"
                >
                  {createSubmitting ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Nilai Ujian</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: EDIT SKOR NILAI UJIAN (PUT /api/jbsakad/rapor/nilaiujian/:replid)
         ===================================================================== */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-nilai-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-200 overflow-hidden">
            <div className="px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                  PUT /api/jbsakad/rapor/nilaiujian/{editingItem.replid}
                </div>
                <h3
                  id="modal-edit-nilai-title"
                  className="text-base font-bold text-slate-900 mt-0.5"
                >
                  Ubah Skor Nilai Ujian #{editingItem.replid}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                disabled={editSubmitting}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditNilai} className="p-6 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  {editingItem.mataPelajaran}
                  {editingItem.kodePelajaran && editingItem.kodePelajaran !== '-'
                    ? ` (${editingItem.kodePelajaran})`
                    : ''}
                </div>
                <div className="font-mono text-slate-600 tabular-nums">
                  NIS {editingItem.nis} · Tanggal {editingItem.waktuInput}
                  {editingItem.idujian !== null
                    ? ` · ID Ujian #${editingItem.idujian}`
                    : ''}
                </div>
              </div>

              {editError && (
                <Alert variant="destructive">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <AlertTitle>Gagal Memperbarui</AlertTitle>
                    <AlertDescription>{editError}</AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="edit-nilai-skor">
                  Skor Nilai Ujian Baru (0 - 100){' '}
                  <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="edit-nilai-skor"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editNilaiScore}
                  onChange={(e) => setEditNilaiScore(e.target.value)}
                  disabled={editSubmitting}
                  className="font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-nilai-keterangan">
                  Keterangan / Catatan Nilai
                </Label>
                <Input
                  id="edit-nilai-keterangan"
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  disabled={editSubmitting}
                  placeholder="Catatan perbaikan atau evaluasi"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  disabled={editSubmitting}
                  className="whitespace-nowrap shrink-0"
                >
                  <span>Batal</span>
                </Button>
                <Button
                  type="submit"
                  disabled={editSubmitting}
                  className="whitespace-nowrap shrink-0"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: KONFIRMASI HAPUS NILAI UJIAN (DELETE /api/jbsakad/rapor/nilaiujian/:replid)
         ===================================================================== */}
      {deletingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-nilai-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-200 overflow-hidden">
            <div className="px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono text-red-700 tabular-nums">
                  DELETE /api/jbsakad/rapor/nilaiujian/{deletingItem.replid}
                </div>
                <h3
                  id="modal-delete-nilai-title"
                  className="text-base font-bold text-slate-900 mt-0.5"
                >
                  Hapus Data Nilai Ujian #{deletingItem.replid}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={deleteSubmitting}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Tindakan ini akan menghapus catatan nilai ujian yang salah input
                secara permanen dari perhitungan rapor siswa:
              </p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  {deletingItem.mataPelajaran} — Skor{' '}
                  <span className="font-mono">{deletingItem.nilaiText}</span>
                </div>
                <div className="font-mono text-slate-600 tabular-nums">
                  replid #{deletingItem.replid} · NIS {deletingItem.nis} ·{' '}
                  {deletingItem.waktuInput}
                </div>
              </div>

              {deleteError && (
                <Alert variant="destructive">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <AlertTitle>Gagal Menghapus</AlertTitle>
                    <AlertDescription>{deleteError}</AlertDescription>
                  </div>
                </Alert>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeletingItem(null)}
                  disabled={deleteSubmitting}
                  className="whitespace-nowrap shrink-0"
                >
                  <span>Batal</span>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmDeleteNilai}
                  disabled={deleteSubmitting}
                  className="whitespace-nowrap shrink-0"
                >
                  {deleteSubmitting ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ya, Hapus Nilai</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
