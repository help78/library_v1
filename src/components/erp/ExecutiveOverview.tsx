import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ERP_MODULES,
  type ErpModuleDefinition,
  type ErpMutationAction,
} from '../../data/erpModules';
import { apiClient } from '../../lib/api';
import {
  extractResponsePayload,
  formatDateId,
  formatNumberId,
  formatRupiah,
} from '../../lib/formatters';
import {
  RoleTingkat,
  type UserData,
  normalizeHakAksesList,
} from '../../types/auth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Can } from '../auth/Can';
import { usePermission } from '../../hooks/usePermission';
import { isLandlordUser } from '../../lib/rbac';
import { FileSharingModal } from './FileSharingModal';
import { JibasGreetingBanner } from './JibasGreetingBanner';
import type { InspectedEntity } from './SmartDataTable';

interface ExecutiveOverviewProps {
  user: UserData;
  accessibleModules: ErpModuleDefinition[];
  onSelectModule: (moduleId: string, initialViewId?: string) => void;
  onInspectEntity: (entity: InspectedEntity) => void;
  onTriggerMutation?: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  refreshSignal?: number;
}

interface GreetingLiveDataset {
  loading: boolean;
  siswaRows: Record<string, unknown>[];
  alumniRows: Record<string, unknown>[];
  kelasRows: Record<string, unknown>[];
  tahunAjaranRows: Record<string, unknown>[];
  semesterRows: Record<string, unknown>[];
  guruRows: Record<string, unknown>[];
  pelajaranRows: Record<string, unknown>[];
  nilaiRows: Record<string, unknown>[];
  presensiRows: Record<string, unknown>[];
  pegawaiAktifCount: number;
  pegawaiNonAktifCount: number;
  tagihanRows: Record<string, unknown>[];
  totalPustaka: number;
  totalPustakaDigital: number;
  identitasRows: Record<string, unknown>[];
  bagianNotaRows: Record<string, unknown>[];
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ExecutiveOverview({
  user,
  accessibleModules,
  onSelectModule,
  onInspectEntity,
  onTriggerMutation,
  refreshSignal = 0,
}: ExecutiveOverviewProps) {
  const tingkatNumber = Number(user.tingkat ?? 0);
  const isLandlord = isLandlordUser(user);

  const normalizedHakAkses = useMemo(
    () => normalizeHakAksesList(user.hakakses),
    [user.hakakses]
  );

  const allowedIds = useMemo(
    () => new Set(accessibleModules.map((m) => m.id)),
    [accessibleModules]
  );

  const canAkad = allowedIds.has('jbsakad');
  const canSdm = allowedIds.has('jbssdm');
  const canFina = allowedIds.has('jbsfina');
  const canPerpus = allowedIds.has('jbsperpus');
  const canUmum = allowedIds.has('jbsumum');
  const canCreateDigitalFiles = usePermission('SIMTAKA', 'create');
  const canUser = isLandlord && allowedIds.has('jbsuser');

  const [fileSharingOpen, setFileSharingOpen] = useState(false);
  const [fileSharingMode, setFileSharingMode] = useState<'list' | 'upload'>('list');
  const [showModulesPanel, setShowModulesPanel] = useState(false);

  // State Rekapitulasi
  const [rekapDepartemen, setRekapDepartemen] = useState<string>('ALL');
  const [dataset, setDataset] = useState<GreetingLiveDataset>({
    loading: true,
    siswaRows: [],
    alumniRows: [],
    kelasRows: [],
    tahunAjaranRows: [],
    semesterRows: [],
    guruRows: [],
    pelajaranRows: [],
    nilaiRows: [],
    presensiRows: [],
    pegawaiAktifCount: 0,
    pegawaiNonAktifCount: 0,
    tagihanRows: [],
    totalPustaka: 0,
    totalPustakaDigital: 0,
    identitasRows: [],
    bagianNotaRows: [],
  });

  // State Scrollbar Horizontal Rekapitulasi
  const cardsScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState({
    thumbWidthPct: 100,
    thumbLeftPct: 0,
    canScrollLeft: false,
    canScrollRight: false,
  });

  // State Bagian Nota
  const [notaDepartemen, setNotaDepartemen] = useState<string>('ALL');
  const [notaDepartemenInitialized, setNotaDepartemenInitialized] =
    useState(false);
  const [notaBagian, setNotaBagian] = useState<string>('ALL');
  const [showNotaExtraFilter, setShowNotaExtraFilter] = useState(false);
  const [notaFilterNip, setNotaFilterNip] = useState('');
  const [notaFilterNis, setNotaFilterNis] = useState('');
  const [notaFilterKeyword, setNotaFilterKeyword] = useState('');
  const [notaLoading, setNotaLoading] = useState(true);
  const [notaRows, setNotaRows] = useState<Record<string, unknown>[]>([]);

  const loadGreetingDataset = useCallback(async () => {
    setDataset((prev) => ({ ...prev, loading: true }));

    const [
      siswaRes,
      alumniRes,
      kelasRes,
      taRes,
      semRes,
      guruRes,
      pelajaranRes,
      nilaiRes,
      presensiRes,
      sdmAktifRes,
      sdmNonAktifRes,
      tagihanRes,
      pustakaRes,
      digitalRes,
      idenRes,
      bagianNotaRes,
    ] = await Promise.allSettled([
      canAkad ? apiClient.get('/jbsakad/siswa') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/alumni') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/kelas') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/tahunajaran') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/semester') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/guru') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/pelajaran') : Promise.resolve(null),
      canAkad ? apiClient.get('/jbsakad/nilaiujian') : Promise.resolve(null),
      canAkad
        ? apiClient.get('/jbsakad/presensi-pelajaran')
        : Promise.resolve(null),
      canSdm
        ? apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } })
        : Promise.resolve(null),
      canSdm
        ? apiClient.get('/jbssdm/pegawai', { params: { aktif: '0' } })
        : Promise.resolve(null),
      canFina ? apiClient.get('/jbsfina/tagihan') : Promise.resolve(null),
      canPerpus ? apiClient.get('/jbsperpus/pustaka') : Promise.resolve(null),
      canPerpus
        ? apiClient.get('/jbsperpus/pustaka/digital')
        : Promise.resolve(null),
      apiClient.get('/jbsumum/identitas'),
      canUmum ? apiClient.get('/jbsumum/bagiannota') : Promise.resolve(null),
    ]);

    const unpack = (res: PromiseSettledResult<{ data: unknown } | null>) =>
      res.status === 'fulfilled' && res.value
        ? extractResponsePayload(res.value.data)
        : null;

    const siswaP = unpack(siswaRes);
    const alumniP = unpack(alumniRes);
    const kelasP = unpack(kelasRes);
    const taP = unpack(taRes);
    const semP = unpack(semRes);
    const guruP = unpack(guruRes);
    const pelajaranP = unpack(pelajaranRes);
    const nilaiP = unpack(nilaiRes);
    const presensiP = unpack(presensiRes);
    const sdmAktifP = unpack(sdmAktifRes);
    const sdmNonAktifP = unpack(sdmNonAktifRes);
    const tagihanP = unpack(tagihanRes);
    const pustakaP = unpack(pustakaRes);
    const digitalP = unpack(digitalRes);
    const idenP = unpack(idenRes);
    const bagianNotaP = unpack(bagianNotaRes);

    const activePegawaiCount = sdmAktifP
      ? sdmAktifP.rows.filter(
          (r) => !('aktif' in r) || Number(r.aktif) === 1
        ).length || sdmAktifP.totalCount
      : 0;

    const nonActivePegawaiCount = sdmNonAktifP
      ? sdmNonAktifP.rows.filter((r) => Number(r.aktif) === 0).length
      : 0;

    setDataset({
      loading: false,
      siswaRows: siswaP?.rows ?? [],
      alumniRows: alumniP?.rows ?? [],
      kelasRows: kelasP?.rows ?? [],
      tahunAjaranRows: taP?.rows ?? [],
      semesterRows: semP?.rows ?? [],
      guruRows: guruP?.rows ?? [],
      pelajaranRows: pelajaranP?.rows ?? [],
      nilaiRows: nilaiP?.rows ?? [],
      presensiRows: presensiP?.rows ?? [],
      pegawaiAktifCount: activePegawaiCount,
      pegawaiNonAktifCount: nonActivePegawaiCount,
      tagihanRows: tagihanP?.rows ?? [],
      totalPustaka: pustakaP?.totalCount ?? 0,
      totalPustakaDigital: digitalP?.totalCount ?? 0,
      identitasRows: idenP?.rows ?? [],
      bagianNotaRows: bagianNotaP?.rows ?? [],
    });
  }, [canAkad, canSdm, canFina, canPerpus]);

  const loadNotas = useCallback(async () => {
    setNotaLoading(true);
    try {
      const params: Record<string, string> = {};
      if (notaFilterNip.trim()) params.nip = notaFilterNip.trim();
      if (notaFilterNis.trim()) params.nis = notaFilterNis.trim();

      const res = await apiClient.get('/jbsumum/nota', { params });
      const parsed = extractResponsePayload(res.data);
      setNotaRows(parsed.rows);
    } catch {
      setNotaRows([]);
    } finally {
      setNotaLoading(false);
    }
  }, [notaFilterNip, notaFilterNis]);

  useEffect(() => {
    loadGreetingDataset();
  }, [loadGreetingDataset, refreshSignal]);

  useEffect(() => {
    loadNotas();
  }, [loadNotas, refreshSignal]);

  // Daftar Departemen Asli dari Basis Data
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();

    const addDept = (val: unknown) => {
      const str = String(val || '').trim();
      if (!str || str.toLowerCase() === 'p_alls') return;
      set.add(str);
    };

    dataset.tahunAjaranRows.forEach((r) => addDept(r.departemen));
    dataset.semesterRows.forEach((r) => addDept(r.departemen));
    dataset.pelajaranRows.forEach((r) => addDept(r.departemen));
    dataset.alumniRows.forEach((r) => addDept(r.departemen));
    dataset.identitasRows.forEach((r) => addDept(r.departemen));

    if (user.departemen) addDept(user.departemen);

    return Array.from(set);
  }, [
    dataset.tahunAjaranRows,
    dataset.semesterRows,
    dataset.pelajaranRows,
    dataset.alumniRows,
    dataset.identitasRows,
    user.departemen,
  ]);

  // Pilih default departemen utama pada bagian Nota (misal SDI-H Islamiyah sesuai referensi jika tersedia)
  useEffect(() => {
    if (notaDepartemenInitialized || departmentOptions.length === 0) return;
    const preferred =
      departmentOptions.find(
        (d) => d.toLowerCase() === 'sdi-h islamiyah'
      ) ||
      (user.departemen && departmentOptions.includes(user.departemen)
        ? user.departemen
        : departmentOptions[0]);
    if (preferred) {
      setNotaDepartemen(preferred);
    }
    setNotaDepartemenInitialized(true);
  }, [departmentOptions, notaDepartemenInitialized, user.departemen]);

  // Kalkulasi Rekapitulasi Terfilter per Departemen secara Relasional
  const rekapMetrics = useMemo(() => {
    // 1. Peta Tahun Ajaran -> Departemen
    const taDeptMap = new Map<string, string>();
    dataset.tahunAjaranRows.forEach((r) => {
      if (r.replid !== undefined && r.departemen) {
        taDeptMap.set(String(r.replid), String(r.departemen).trim());
      }
    });

    // 2. Peta Kelas -> Departemen (melalui idtahunajaran atau langsung atribut departemen)
    const kelasDeptMap = new Map<string, string>();
    const namaKelasDeptMap = new Map<string, string>();
    dataset.kelasRows.forEach((r) => {
      const idKelas = String(r.idkelas ?? r.replid ?? '');
      const namaKelas = String(r.nama_kelas ?? r.kelas ?? '').trim();
      const directDept = String(r.departemen || '').trim();
      const viaTa = r.idtahunajaran
        ? taDeptMap.get(String(r.idtahunajaran)) || ''
        : '';
      const resolvedDept = directDept || viaTa;
      if (idKelas && resolvedDept) {
        kelasDeptMap.set(idKelas, resolvedDept);
      }
      if (namaKelas && resolvedDept) {
        namaKelasDeptMap.set(namaKelas.toLowerCase(), resolvedDept);
      }
    });

    const isAll = rekapDepartemen === 'ALL';

    // Filter Kelas
    const filteredKelas = isAll
      ? dataset.kelasRows
      : dataset.kelasRows.filter((r) => {
          const idKelas = String(r.idkelas ?? r.replid ?? '');
          return kelasDeptMap.get(idKelas) === rekapDepartemen;
        });

    // Filter Siswa
    const filteredSiswa = isAll
      ? dataset.siswaRows
      : dataset.siswaRows.filter((r) => {
          if (r.departemen) {
            return String(r.departemen).trim() === rekapDepartemen;
          }
          const idKelas = String(r.idkelas ?? '');
          if (idKelas && kelasDeptMap.has(idKelas)) {
            return kelasDeptMap.get(idKelas) === rekapDepartemen;
          }
          const namaKelas = String(r.nama_kelas || '').trim().toLowerCase();
          if (namaKelas && namaKelasDeptMap.has(namaKelas)) {
            return namaKelasDeptMap.get(namaKelas) === rekapDepartemen;
          }
          return false;
        });

    let siswaAktif = 0;
    let siswaNonAktif = 0;
    let siswaAlumniFallback = 0;

    filteredSiswa.forEach((s) => {
      if (Number(s.alumni) === 1 || String(s.status || '').toLowerCase() === 'alumni') {
        siswaAlumniFallback += 1;
      } else if ('aktif' in s && Number(s.aktif) === 0) {
        siswaNonAktif += 1;
      } else {
        siswaAktif += 1;
      }
    });

    // Filter Alumni dari endpoint GET /api/jbsakad/alumni
    const filteredAlumni = isAll
      ? dataset.alumniRows
      : dataset.alumniRows.filter((r) => {
          if (r.departemen) {
            return String(r.departemen).trim() === rekapDepartemen;
          }
          const klsAkhir = String(r.klsakhir ?? '');
          if (klsAkhir && kelasDeptMap.has(klsAkhir)) {
            return kelasDeptMap.get(klsAkhir) === rekapDepartemen;
          }
          const namaKlsAkhir = String(r.nama_kelasakhir || '')
            .trim()
            .toLowerCase();
          if (namaKlsAkhir && namaKelasDeptMap.has(namaKlsAkhir)) {
            return namaKelasDeptMap.get(namaKlsAkhir) === rekapDepartemen;
          }
          return false;
        });

    const siswaAlumni =
      dataset.alumniRows.length > 0
        ? filteredAlumni.length
        : siswaAlumniFallback;

    // Filter Pelajaran & Peta Kode Pelajaran -> Departemen
    const kodeMapelDeptMap = new Map<string, string>();
    dataset.pelajaranRows.forEach((p) => {
      if (p.kode && p.departemen) {
        kodeMapelDeptMap.set(
          String(p.kode).trim().toUpperCase(),
          String(p.departemen).trim()
        );
      }
    });

    const filteredPelajaran = isAll
      ? dataset.pelajaranRows
      : dataset.pelajaranRows.filter(
          (p) => String(p.departemen || '').trim() === rekapDepartemen
        );

    // Filter Guru
    const filteredGuru = isAll
      ? dataset.guruRows
      : dataset.guruRows.filter((g) => {
          if (g.departemen) {
            return String(g.departemen).trim() === rekapDepartemen;
          }
          return true;
        });

    // Filter Penilaian (Nilai Ujian)
    const filteredNilai = isAll
      ? dataset.nilaiRows
      : dataset.nilaiRows.filter((n) => {
          const kode = String(n.kode_pelajaran || '').trim().toUpperCase();
          if (kode && kodeMapelDeptMap.has(kode)) {
            return kodeMapelDeptMap.get(kode) === rekapDepartemen;
          }
          return false;
        });

    let latestNilaiTs = 0;
    let latestNilaiRaw: unknown = null;
    filteredNilai.forEach((n) => {
      const rawDate = n.waktu_input || n.tanggal || n.ts;
      if (rawDate) {
        const parsedTs = new Date(String(rawDate)).getTime();
        if (!Number.isNaN(parsedTs) && parsedTs > latestNilaiTs) {
          latestNilaiTs = parsedTs;
          latestNilaiRaw = rawDate;
        }
      }
    });

    // Filter Presensi Siswa Hari Ini
    const todayIso = getTodayIsoDate();
    const hadirTodayNisSet = new Set<string>();
    dataset.presensiRows.forEach((p) => {
      const rawTgl = String(p.tanggal || '').slice(0, 10);
      if (rawTgl !== todayIso) return;

      if (!isAll) {
        const namaKls = String(p.nama_kelas || '').trim().toLowerCase();
        if (namaKls && namaKelasDeptMap.has(namaKls)) {
          if (namaKelasDeptMap.get(namaKls) !== rekapDepartemen) return;
        }
      }

      const statusAbsen = String(p.status_absen || '').toLowerCase();
      if (statusAbsen.includes('hadir') || p.status === 1) {
        const nisKey = String(p.nis || p.nama_siswa || '');
        if (nisKey) hadirTodayNisSet.add(nisKey);
      }
    });

    // Keuangan
    let sisaPiutang = 0;
    dataset.tagihanRows.forEach((t) => {
      sisaPiutang += Number(t.sisa_asli || t.sisa || 0);
    });

    return {
      siswaAktif,
      siswaNonAktif,
      siswaAlumni,
      pegawaiAktif: dataset.pegawaiAktifCount,
      pegawaiNonAktif: dataset.pegawaiNonAktifCount,
      guruCount: filteredGuru.length,
      pelajaranCount: filteredPelajaran.length,
      kelasCount: filteredKelas.length,
      penilaianCount: filteredNilai.length,
      penilaianTerakhir: latestNilaiRaw ? formatDateId(latestNilaiRaw) : '',
      presensiHadirToday: hadirTodayNisSet.size,
      tagihanCount: dataset.tagihanRows.length,
      sisaPiutang,
      totalPustaka: dataset.totalPustaka,
      totalPustakaDigital: dataset.totalPustakaDigital,
    };
  }, [dataset, rekapDepartemen]);

  // Sinkronisasi Indikator Scroll Horizontal Kartu Rekapitulasi
  const syncScrollMetrics = useCallback(() => {
    const el = cardsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth || scrollWidth === 0) {
      setScrollMetrics({
        thumbWidthPct: 100,
        thumbLeftPct: 0,
        canScrollLeft: false,
        canScrollRight: false,
      });
      return;
    }

    const thumbWidthPct = Math.max(18, (clientWidth / scrollWidth) * 100);
    const maxScroll = scrollWidth - clientWidth;
    const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
    const thumbLeftPct = progress * (100 - thumbWidthPct);

    setScrollMetrics({
      thumbWidthPct,
      thumbLeftPct,
      canScrollLeft: scrollLeft > 4,
      canScrollRight: scrollLeft < maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    syncScrollMetrics();
    window.addEventListener('resize', syncScrollMetrics);
    return () => window.removeEventListener('resize', syncScrollMetrics);
  }, [syncScrollMetrics, dataset.loading, accessibleModules.length]);

  const handleScrollCardsBy = (delta: number) => {
    const el = cardsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const handleTrackClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardsScrollRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    const targetLeft =
      clickRatio * (el.scrollWidth - el.clientWidth);
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  // Filter Baris Nota di Sisi Klien untuk Bagian, Departemen & Kata Kunci
  const filteredNotaRows = useMemo(() => {
    const kw = notaFilterKeyword.trim().toLowerCase();
    return notaRows.filter((row) => {
      if (notaDepartemen !== 'ALL' && row.departemen) {
        if (String(row.departemen).trim() !== notaDepartemen) {
          return false;
        }
      }
      if (notaBagian !== 'ALL') {
        const rowBagian = String(row.bagian || row.idbagian || '').trim();
        if (
          rowBagian &&
          rowBagian.toLowerCase() !== notaBagian.toLowerCase()
        ) {
          return false;
        }
      }
      if (kw) {
        const combined = [
          row.judul,
          row.nota,
          row.bagian,
          row.nip,
          row.nis,
          row.nama,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!combined.includes(kw)) return false;
      }
      return true;
    });
  }, [notaRows, notaDepartemen, notaBagian, notaFilterKeyword]);

  const handleOpenCreateNota = () => {
    if (!onTriggerMutation) {
      if (canUmum) onSelectModule('jbsumum');
      return;
    }

    const umumMod = ERP_MODULES.find((m) => m.id === 'jbsumum');
    const baseAction = umumMod?.mutations.find((m) => m.id === 'buat-nota');
    if (!baseAction) return;

    const bagianOpts = dataset.bagianNotaRows
      .map((b) => String(b.bagian || '').trim())
      .filter(Boolean)
      .map((label) => ({ label, value: label }));

    const enrichedAction: ErpMutationAction =
      bagianOpts.length > 0
        ? {
            ...baseAction,
            fields: baseAction.fields.map((f) =>
              f.name === 'bagian'
                ? {
                    ...f,
                    type: 'select',
                    options: bagianOpts,
                    defaultValue:
                      notaBagian !== 'ALL' ? notaBagian : bagianOpts[0].value,
                  }
                : f
            ),
          }
        : baseAction;

    const initialValues: Record<string, string> = {};
    if (notaBagian !== 'ALL') {
      initialValues.bagian = notaBagian;
    } else if (bagianOpts.length > 0) {
      initialValues.bagian = bagianOpts[0].value;
    }
    if (tingkatNumber === RoleTingkat.PEGAWAI && user.username) {
      initialValues.nip = user.username;
    }

    onTriggerMutation(enrichedAction, initialValues);
  };

  const handleInspectBagianNota = () => {
    if (dataset.bagianNotaRows.length > 0) {
      onInspectEntity({
        mode: 'generic',
        title: 'Daftar Master Bagian Nota',
        row: {
          total_bagian: dataset.bagianNotaRows.length,
          daftar_bagian: dataset.bagianNotaRows
            .map((b) => `${b.urutan ?? '-'}. ${b.bagian}`)
            .join(', '),
        },
      });
      return;
    }
    if (canUmum) {
      onSelectModule('jbsumum');
    }
  };

  const hasAnyRekapCard = canAkad || canSdm || canFina || canPerpus;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 space-y-10">
      {/* 1. Greeting Hero Sesuai Desain JIBAS */}
      <JibasGreetingBanner
        user={user}
        identitasRows={dataset.identitasRows}
        onOpenFileSharing={() => {
          setFileSharingMode('list');
          setFileSharingOpen(true);
        }}
        onOpenUploadFile={() => {
          setFileSharingMode('upload');
          setFileSharingOpen(true);
        }}
        onOpenFullProfile={
          tingkatNumber === RoleTingkat.PEGAWAI
            ? () =>
                onInspectEntity({
                  mode: 'pegawai',
                  title: user.nama,
                  identifier: user.username,
                  row: {
                    nip: user.username,
                    nama: user.nama,
                    foto: user.foto,
                  },
                })
            : undefined
        }
        onOpenHakAkses={canUser ? () => onSelectModule('jbsuser') : undefined}
      />

      {/* 2. Seksi Rekapitulasi */}
      {hasAnyRekapCard && (
        <section aria-labelledby="rekapitulasi-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="rekapitulasi-heading"
              className="text-xl sm:text-2xl font-normal text-slate-600 tracking-tight"
            >
              Rekapitulasi
            </h2>

            <button
              type="button"
              onClick={loadGreetingDataset}
              disabled={dataset.loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${dataset.loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Sinkronkan Data</span>
            </button>
          </div>

          {/* Filter Departemen Rekapitulasi */}
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="rekap-departemen-select"
              className="text-xs sm:text-sm font-semibold text-slate-700 w-24 shrink-0"
            >
              Departemen:
            </label>
            <select
              id="rekap-departemen-select"
              value={rekapDepartemen}
              onChange={(e) => setRekapDepartemen(e.target.value)}
              className="h-9 min-w-[220px] sm:min-w-[250px] rounded-md border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1565d8]/30 focus:border-[#1565d8]"
            >
              <option value="ALL">Semua Departemen</option>
              {departmentOptions.map((dept, idx) => (
                <option key={`${dept}-${idx}`} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Strip Kartu Rekapitulasi Berwarna (Horizontal Scroll) */}
          <div
            ref={cardsScrollRef}
            onScroll={syncScrollMetrics}
            className="flex items-stretch gap-5 overflow-x-auto pt-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {canAkad && (
              <div className="w-[248px] sm:w-[262px] min-h-[138px] shrink-0 rounded-xl bg-[#107c10] text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-center">
                <button
                  type="button"
                  onClick={() => onSelectModule('jbsakad', 'siswa-aktif')}
                  className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight hover:underline cursor-pointer"
                >
                  Jumlah Siswa
                </button>
                <div className="grid grid-cols-3 gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => onSelectModule('jbsakad', 'siswa-aktif')}
                    title="Lihat daftar Siswa Aktif"
                    className="rounded-lg py-1 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Aktif
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.siswaAktif)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectModule('jbsakad', 'siswa-aktif')}
                    title="Lihat data Siswa"
                    className="rounded-lg py-1 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Non-Aktif
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.siswaNonAktif)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectModule('jbsakad', 'alumni')}
                    title="Lihat daftar Data Alumni (/api/jbsakad/alumni)"
                    className="rounded-lg py-1 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Alumni
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.siswaAlumni)}
                    </div>
                  </button>
                </div>
                <div aria-hidden="true" className="h-1" />
              </div>
            )}

            {canSdm && (
              <button
                type="button"
                onClick={() => onSelectModule('jbssdm')}
                className="w-[248px] sm:w-[262px] min-h-[138px] shrink-0 rounded-xl bg-[#0b4e7d] hover:opacity-95 text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                  Jumlah Pegawai
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3">
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Aktif
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.pegawaiAktif)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Non-Aktif
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.pegawaiNonAktif)}
                    </div>
                  </div>
                </div>
                <div aria-hidden="true" className="h-1" />
              </button>
            )}

            {canAkad && (
              <button
                type="button"
                onClick={() => onSelectModule('jbsakad', 'guru')}
                className="w-[248px] sm:w-[262px] min-h-[138px] shrink-0 rounded-xl bg-[#7a093b] hover:opacity-95 text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                  Guru, Pelajaran, Kelas
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3">
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Guru
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.guruCount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Pelajaran
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.pelajaranCount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Kelas
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.kelasCount)}
                    </div>
                  </div>
                </div>
                <div aria-hidden="true" className="h-1" />
              </button>
            )}

            {canAkad && (
              <button
                type="button"
                onClick={() => onSelectModule('jbsakad', 'rapor')}
                className="w-[258px] sm:w-[276px] min-h-[138px] shrink-0 rounded-xl bg-[#8a5614] hover:opacity-95 text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-left transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight text-center">
                  Penilaian
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Jumlah
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.penilaianCount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Terakhir
                    </div>
                    <div className="mt-1.5 text-xs sm:text-sm font-semibold tabular-nums text-white/95 leading-snug">
                      {dataset.loading
                        ? '...'
                        : rekapMetrics.penilaianTerakhir || '-'}
                    </div>
                  </div>
                </div>
                <div aria-hidden="true" className="h-1" />
              </button>
            )}

            {canAkad && (
              <button
                type="button"
                onClick={() => onSelectModule('jbsakad', 'presensiharian')}
                className="w-[270px] sm:w-[290px] min-h-[138px] shrink-0 rounded-xl bg-[#167d8a] hover:opacity-95 text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
              >
                <div className="text-xs font-bold text-[#ffe838] tracking-tight leading-tight">
                  Presensi Wajah dan Fingerprint<br />
                  <span className="font-normal text-[11px] text-white/90">(hari ini)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Siswa
                    </div>
                    <div className="mt-1 flex items-baseline justify-center gap-1 font-mono tabular-nums">
                      <span className="text-xl sm:text-2xl font-bold">
                        {dataset.loading
                          ? '...'
                          : formatNumberId(rekapMetrics.presensiHadirToday)}
                      </span>
                      <span className="text-sm text-white/80">|</span>
                      <span className="text-xs sm:text-sm font-semibold text-white/95">
                        {dataset.loading
                          ? '...'
                          : formatNumberId(rekapMetrics.siswaAktif)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Pegawai
                    </div>
                    <div className="mt-1 flex items-baseline justify-center gap-1 font-mono tabular-nums">
                      <span className="text-xl sm:text-2xl font-bold">
                        0
                      </span>
                      <span className="text-sm text-white/80">|</span>
                      <span className="text-xs sm:text-sm font-semibold text-white/95">
                        {dataset.loading
                          ? '...'
                          : formatNumberId(rekapMetrics.pegawaiAktif)}
                      </span>
                    </div>
                  </div>
                </div>
                <div aria-hidden="true" className="h-1" />
              </button>
            )}

            {canFina && (
              <button
                type="button"
                onClick={() => onSelectModule('jbsfina')}
                className="w-[258px] sm:w-[276px] min-h-[138px] shrink-0 rounded-xl bg-[#273c75] hover:opacity-95 text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-left transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight text-center">
                  Keuangan Siswa
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-white/90">
                    <span>Tagihan Aktif</span>
                    <span className="font-mono font-bold tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.tagihanCount)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/80">Sisa Piutang</div>
                    <div className="text-base sm:text-lg font-bold font-mono tabular-nums truncate">
                      {dataset.loading
                        ? '...'
                        : formatRupiah(rekapMetrics.sisaPiutang)}
                    </div>
                  </div>
                </div>
              </button>
            )}

            {canPerpus && (
              <button
                type="button"
                onClick={() => onSelectModule('jbsperpus')}
                className="w-[248px] sm:w-[262px] min-h-[138px] shrink-0 rounded-xl bg-[#1f5f5b] hover:opacity-95 text-white p-4 sm:p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                  Koleksi Pustaka
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      Judul Buku
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.totalPustaka)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs text-white/90 font-medium">
                      E-Book
                    </div>
                    <div className="mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums">
                      {dataset.loading
                        ? '...'
                        : formatNumberId(rekapMetrics.totalPustakaDigital)}
                    </div>
                  </div>
                </div>
                <div aria-hidden="true" className="h-1" />
              </button>
            )}
          </div>

          {/* Kontrol Track Scroll Horizontal Bergaya JIBAS */}
          <div className="flex items-center gap-2 pt-1 select-none">
            <button
              type="button"
              onClick={() => handleScrollCardsBy(-280)}
              disabled={!scrollMetrics.canScrollLeft}
              aria-label="Geser rekapitulasi ke kiri"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:text-slate-300 cursor-pointer disabled:cursor-default"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <div
              onClick={handleTrackClick}
              role="presentation"
              className="relative flex-1 h-2.5 rounded-full bg-slate-200/80 overflow-hidden cursor-pointer"
            >
              <div
                style={{
                  width: `${scrollMetrics.thumbWidthPct}%`,
                  transform: `translateX(${
                    scrollMetrics.thumbWidthPct > 0
                      ? (scrollMetrics.thumbLeftPct /
                          scrollMetrics.thumbWidthPct) *
                        100
                      : 0
                  }%)`,
                }}
                className="h-full rounded-full bg-slate-500/80 transition-transform duration-150"
              />
            </div>

            <button
              type="button"
              onClick={() => handleScrollCardsBy(280)}
              disabled={!scrollMetrics.canScrollRight}
              aria-label="Geser rekapitulasi ke kanan"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:text-slate-300 cursor-pointer disabled:cursor-default"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* 3. Seksi Nota */}
      {canUmum && (
        <section aria-labelledby="nota-heading" className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-4">
            <h2
              id="nota-heading"
              className="text-xl sm:text-2xl font-normal text-slate-600 tracking-tight"
            >
            Nota
          </h2>

          <Can modul="UMUM" action="create">
            <button
              type="button"
              onClick={handleOpenCreateNota}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-800 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle
                className="h-4 w-4 text-emerald-600 fill-emerald-50"
                aria-hidden="true"
              />
              <span>nota baru</span>
            </button>
          </Can>
        </div>

        {/* Form Filter Departemen & Bagian Nota */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="nota-departemen-select"
              className="text-xs sm:text-sm font-semibold text-slate-700 w-24 shrink-0"
            >
              Departemen:
            </label>
            <select
              id="nota-departemen-select"
              value={notaDepartemen}
              onChange={(e) => setNotaDepartemen(e.target.value)}
              className="h-9 min-w-[220px] sm:min-w-[250px] rounded-md border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1565d8]/30 focus:border-[#1565d8]"
            >
              <option value="ALL">Semua Departemen</option>
              {departmentOptions.map((dept, idx) => (
                <option key={`${dept}-${idx}`} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label
              htmlFor="nota-bagian-select"
              className="text-xs sm:text-sm font-semibold text-slate-700 w-24 shrink-0"
            >
              Bagian:
            </label>
            <select
              id="nota-bagian-select"
              value={notaBagian}
              onChange={(e) => setNotaBagian(e.target.value)}
              className="h-9 min-w-[220px] sm:min-w-[250px] rounded-md border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1565d8]/30 focus:border-[#1565d8]"
            >
              <option value="ALL">Semua Bagian</option>
              {dataset.bagianNotaRows.map((b, idx) => {
                const label = String(b.bagian || `Bagian ${idx + 1}`).trim();
                return (
                  <option key={`${label}-${idx}`} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={handleInspectBagianNota}
              title="Lihat daftar master bagian nota"
              className="h-9 px-3 rounded-md bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              ...
            </button>

            <button
              type="button"
              onClick={loadNotas}
              disabled={notaLoading}
              className="h-9 px-3.5 rounded-md bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-60"
            >
              Lihat
            </button>

            <button
              type="button"
              onClick={() => setShowNotaExtraFilter((prev) => !prev)}
              className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:underline transition-colors cursor-pointer"
            >
              filter
            </button>
          </div>

          {/* Filter Tambahan (NIP / NIS / Kata Kunci) saat tombol "filter" diklik */}
          {showNotaExtraFilter && (
            <div className="pt-2 sm:pl-[108px] grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-2xl">
              <Input
                value={notaFilterKeyword}
                onChange={(e) => setNotaFilterKeyword(e.target.value)}
                placeholder="Cari judul atau isi nota..."
                className="h-8 text-xs"
              />
              <Input
                value={notaFilterNip}
                onChange={(e) => setNotaFilterNip(e.target.value)}
                placeholder="Filter NIP Pegawai"
                className="h-8 text-xs font-mono"
              />
              <Input
                value={notaFilterNis}
                onChange={(e) => setNotaFilterNis(e.target.value)}
                placeholder="Filter NIS Siswa"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}
        </div>

        {/* Daftar Data Nota */}
        <div className="pt-2">
          {notaLoading ? (
            <div className="space-y-2 max-w-xl">
              <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
            </div>
          ) : filteredNotaRows.length === 0 ? (
            <p className="text-xs sm:text-sm font-medium text-slate-800">
              belum ada data
            </p>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Tanggal</th>
                    <th className="py-2.5 px-4">Bagian</th>
                    <th className="py-2.5 px-4">Judul & Isi Nota</th>
                    <th className="py-2.5 px-4">Terkait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {filteredNotaRows.map((row, idx) => {
                    const judul = String(row.judul || `Nota #${idx + 1}`);
                    const isi = String(row.nota || row.pesan || '-');
                    const bagian = String(row.bagian || '-');
                    const tanggal = row.tanggal
                      ? formatDateId(row.tanggal)
                      : '-';
                    const terkait = [
                      row.nip ? `NIP ${row.nip}` : '',
                      row.nis ? `NIS ${row.nis}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <tr
                        key={`${String(row.replid ?? row.id ?? 'nota')}-${idx}`}
                        onClick={() =>
                          onInspectEntity({
                            mode: 'generic',
                            title: judul,
                            row,
                          })
                        }
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {tanggal}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                          {bagian}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {judul}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {isi}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {terkait || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      )}

      {/* 4. Pintasan Modul Sesuai Hak Akses (Ringkas & Dapat Diperluas) */}
      <section className="pt-6 border-t border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {isLandlord
                ? 'Pintasan Modul Sistem Sekolah'
                : `Modul Sesuai Hak Akses (${accessibleModules.length} Modul)`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih modul untuk mengelola data operasional secara lengkap.
            </p>
          </div>

          {isLandlord && normalizedHakAkses.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowModulesPanel((prev) => !prev)}
              className="text-xs"
            >
              <span>
                {showModulesPanel ? 'Sembunyikan Rincian Hak Akses' : 'Rincian Hak Akses'}
              </span>
              {showModulesPanel ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>

        {accessibleModules.length === 0 ? (
          <p className="text-xs text-slate-500">
            Belum ada modul yang terdaftar pada atribut hakakses akun ini.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accessibleModules.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => onSelectModule(mod.id)}
                className="px-4 py-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    <span className="font-mono text-xs text-slate-400 mr-2 tabular-nums">
                      {mod.code}.
                    </span>
                    {mod.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    {mod.prefix} · {mod.views.length} menu
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        )}

        {isLandlord && showModulesPanel && normalizedHakAkses.length > 0 && (
          <div className="rounded-lg border border-slate-200 overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4 w-14">No</th>
                  <th className="py-2.5 px-4">Modul</th>
                  <th className="py-2.5 px-4">Tingkat Akses</th>
                  <th className="py-2.5 px-4">Departemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {normalizedHakAkses.map((item, idx) => (
                  <tr key={`${item.modul}-${idx}`}>
                    <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {item.modul}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">
                      {item.tingkatAkses}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {item.departemen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal File Sharing */}
      <FileSharingModal
        open={fileSharingOpen}
        onClose={() => setFileSharingOpen(false)}
        initialMode={fileSharingMode}
        canAccessUmum={canUmum}
        canManageDigitalFiles={canCreateDigitalFiles}
        onTriggerMutation={onTriggerMutation}
        onInspectEntity={onInspectEntity}
        refreshSignal={refreshSignal}
      />
    </div>
  );
}
