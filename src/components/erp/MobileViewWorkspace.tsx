import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Home,
  IdCard,
  Layers,
  Maximize2,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatDateId,
  formatDateTimeId,
  formatNumberId,
  formatRupiah,
} from '../../lib/formatters';
import { ERP_MODULES, type ErpMutationAction } from '../../data/erpModules';
import { useSchoolIdentity } from '../../hooks/useSchoolIdentity';
import {
  RoleTingkat,
  type UserData,
  getRoleFullName,
} from '../../types/auth';
import { Button } from '../ui/button';
import { AvatarImage } from './AvatarImage';
import { DigitalBookReaderModal } from './DigitalBookReaderModal';
import type { InspectedEntity } from './SmartDataTable';
import { UserIdentityCard } from './UserIdentityCard';

type MobileTabId = 'beranda' | 'akademik' | 'keuangan' | 'pustaka' | 'kartu';

interface MobileViewWorkspaceProps {
  user: UserData;
  onInspectEntity: (entity: InspectedEntity) => void;
  onTriggerMutation: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  onOpenDesktopModule?: (sectionId: string) => void;
  refreshSignal: number;
}

interface MobileSummaryData {
  loading: boolean;
  metricA: { label: string; value: string };
  metricB: { label: string; value: string };
  metricC: { label: string; value: string };
  metricD: { label: string; value: string };
  idKelas: string;
}

export function MobileViewWorkspace({
  user,
  onInspectEntity,
  onTriggerMutation,
  onOpenDesktopModule,
  refreshSignal,
}: MobileViewWorkspaceProps) {
  const { primary: school, rawRows: identitasRows } = useSchoolIdentity();

  const tingkat = Number(user.tingkat);
  const isSiswa = tingkat === RoleTingkat.SISWA;
  const isCalon = tingkat === RoleTingkat.CALON_SISWA;
  const isStaffOrAdmin =
    tingkat === RoleTingkat.LANDLORD || tingkat === RoleTingkat.PEGAWAI;
  const identityCode = String(user.username || '').trim();
  const roleName = getRoleFullName(tingkat);

  const [activeTab, setActiveTab] = useState<MobileTabId>('beranda');
  const [akademikSub, setAkademikSub] = useState<
    'one' | 'two' | 'alumni' | 'three' | 'four'
  >('one');
  const [alumniTahunAjaran, setAlumniTahunAjaran] = useState<string>('');
  const [alumniYearOptions, setAlumniYearOptions] = useState<string[]>([]);
  const [pustakaSub, setPustakaSub] = useState<'ebook' | 'pinjam' | 'log'>('ebook');
  const [viewportMode, setViewportMode] = useState<'compact' | 'expanded'>('compact');
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState<MobileSummaryData>({
    loading: true,
    metricA: { label: 'Memuat...', value: '-' },
    metricB: { label: 'Memuat...', value: '-' },
    metricC: { label: 'Memuat...', value: '-' },
    metricD: { label: 'Memuat...', value: '-' },
    idKelas: '',
  });

  const [listRows, setListRows] = useState<Record<string, unknown>[]>([]);
  const [activeEndpointLabel, setActiveEndpointLabel] = useState<string>('');
  const [listLoading, setListLoading] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<Record<string, unknown> | null>(
    null
  );

  // Reset pencarian & sub-tab saat tab berpindah
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab, akademikSub, pustakaSub]);

  // Muat ringkasan metrik sesuai peran
  const loadSummary = useCallback(async () => {
    setSummary((prev) => ({ ...prev, loading: true }));

    if (isSiswa) {
      const [detailRes, kelasRes, tagihanRes, pinjamRes, digitalRes] =
        await Promise.allSettled([
          apiClient.get(`/jbsakad/siswa/detail/${encodeURIComponent(identityCode)}`),
          apiClient.get('/jbsakad/kelas'),
          apiClient.get(`/jbsfina/tagihan/${encodeURIComponent(identityCode)}`),
          apiClient.get('/jbsperpus/pinjam', {
            params: { nis: identityCode, status: '1' },
          }),
          apiClient.get('/jbsperpus/pustaka/digital'),
        ]);

      let idKelas = '';
      let namaKelas = '-';
      if (detailRes.status === 'fulfilled') {
        const d = extractResponsePayload(detailRes.value.data);
        if (d.singleObject?.idkelas !== undefined) {
          idKelas = String(d.singleObject.idkelas);
          namaKelas = `Kelas #${idKelas}`;
        }
      }
      if (idKelas && kelasRes.status === 'fulfilled') {
        const k = extractResponsePayload(kelasRes.value.data);
        const found = k.rows.find((r) => String(r.idkelas) === idKelas);
        if (found?.nama_kelas) namaKelas = String(found.nama_kelas);
      }

      let sisaTagihan = 0;
      if (tagihanRes.status === 'fulfilled') {
        const t = extractResponsePayload(tagihanRes.value.data);
        for (const r of t.rows) sisaTagihan += Number(r.sisa_asli || 0);
      }

      const pinjamCount =
        pinjamRes.status === 'fulfilled'
          ? extractResponsePayload(pinjamRes.value.data).rows.length
          : 0;
      const ebookCount =
        digitalRes.status === 'fulfilled'
          ? extractResponsePayload(digitalRes.value.data).totalCount
          : 0;

      setSummary({
        loading: false,
        idKelas,
        metricA: { label: 'Kelas Aktif', value: namaKelas },
        metricB: { label: 'Sisa Tagihan', value: formatRupiah(sisaTagihan) },
        metricC: { label: 'Pinjam Buku', value: `${pinjamCount} Buku` },
        metricD: { label: 'E-Book Digital', value: `${ebookCount} Judul` },
      });
    } else if (isCalon) {
      const [tagihanRes, kalenderRes] = await Promise.allSettled([
        apiClient.get(`/jbsfina/tagihan-calon/${encodeURIComponent(identityCode)}`),
        apiClient.get('/jbsakad/kalender-akademik'),
      ]);

      let sisa = 0;
      let count = 0;
      if (tagihanRes.status === 'fulfilled') {
        const t = extractResponsePayload(tagihanRes.value.data);
        count = t.rows.length;
        for (const r of t.rows) sisa += Number(r.sisa_asli || 0);
      }
      const kalCount =
        kalenderRes.status === 'fulfilled'
          ? extractResponsePayload(kalenderRes.value.data).rows.length
          : 0;

      setSummary({
        loading: false,
        idKelas: '',
        metricA: { label: 'No. Peserta', value: identityCode },
        metricB: { label: 'Tagihan PPDB', value: formatRupiah(sisa) },
        metricC: { label: 'Komponen Biaya', value: `${count} Item` },
        metricD: { label: 'Kalender Aktif', value: `${kalCount} Periode` },
      });
    } else {
      const [siswaRes, sdmRes, tagihanRes, digitalRes] = await Promise.allSettled([
        apiClient.get('/jbsakad/siswa'),
        apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } }),
        apiClient.get('/jbsfina/tagihan'),
        apiClient.get('/jbsperpus/pustaka/digital'),
      ]);

      const totalSiswa =
        siswaRes.status === 'fulfilled'
          ? extractResponsePayload(siswaRes.value.data).totalCount
          : 0;
      const totalSdm =
        sdmRes.status === 'fulfilled'
          ? extractResponsePayload(sdmRes.value.data).rows.filter(
              (r) => !('aktif' in r) || Number(r.aktif) === 1
            ).length
          : 0;
      const totalTagihan =
        tagihanRes.status === 'fulfilled'
          ? extractResponsePayload(tagihanRes.value.data).totalCount
          : 0;
      const totalDigital =
        digitalRes.status === 'fulfilled'
          ? extractResponsePayload(digitalRes.value.data).totalCount
          : 0;

      setSummary({
        loading: false,
        idKelas: '',
        metricA: { label: 'Siswa Aktif', value: formatNumberId(totalSiswa) },
        metricB: { label: 'Pegawai Aktif', value: formatNumberId(totalSdm) },
        metricC: { label: 'Piutang Aktif', value: `${formatNumberId(totalTagihan)} Data` },
        metricD: { label: 'Koleksi E-Book', value: `${formatNumberId(totalDigital)} Judul` },
      });
    }
  }, [isSiswa, isCalon, identityCode]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshSignal]);

  // Muat daftar data sesuai tab mobile yang aktif
  const loadTabContent = useCallback(async () => {
    if (activeTab === 'beranda' || activeTab === 'kartu') {
      setActiveEndpointLabel(
        activeTab === 'kartu'
          ? 'Kartu Identitas QR Digital'
          : 'Ringkasan Beranda Mobile'
      );
      return;
    }

    setListLoading(true);
    setListError(null);

    try {
      const encodedId = encodeURIComponent(identityCode);

      if (activeTab === 'akademik') {
        if (isSiswa) {
          if (akademikSub === 'one') {
            setActiveEndpointLabel(`GET /api/jbsakad/presensi-pelajaran/${encodedId}`);
            const res = await apiClient.get(`/jbsakad/presensi-pelajaran/${encodedId}`);
            setListRows(extractResponsePayload(res.data).rows);
          } else if (akademikSub === 'two') {
            let targetKelas = summary.idKelas;
            if (!targetKelas) {
              const dRes = await apiClient.get(`/jbsakad/siswa/detail/${encodedId}`);
              const obj = extractResponsePayload(dRes.data).singleObject;
              if (obj?.idkelas) targetKelas = String(obj.idkelas);
            }
            if (!targetKelas) {
              setListRows([]);
              setActiveEndpointLabel('GET /api/jbsakad/jadwal/kelas/{idkelas}');
            } else {
              const path = `/jbsakad/jadwal/kelas/${encodeURIComponent(targetKelas)}`;
              setActiveEndpointLabel(`GET /api${path}`);
              const res = await apiClient.get(path);
              setListRows(extractResponsePayload(res.data).rows);
            }
          } else {
            setActiveEndpointLabel(
              `GET /api/jbsakad/rapor/nilaiujian/${encodedId}`
            );
            const res = await apiClient.get(
              `/jbsakad/rapor/nilaiujian/${encodedId}`
            );
            setListRows(extractResponsePayload(res.data).rows);
          }
        } else if (isCalon) {
          setActiveEndpointLabel('GET /api/jbsakad/kalender-akademik');
          const res = await apiClient.get('/jbsakad/kalender-akademik');
          setListRows(extractResponsePayload(res.data).rows);
        } else {
          if (akademikSub === 'one') {
            setActiveEndpointLabel('GET /api/jbssdm/presensi');
            const res = await apiClient.get('/jbssdm/presensi');
            setListRows(extractResponsePayload(res.data).rows);
          } else if (akademikSub === 'two') {
            setActiveEndpointLabel('GET /api/jbsakad/siswa');
            const res = await apiClient.get('/jbsakad/siswa');
            setListRows(extractResponsePayload(res.data).rows);
          } else if (akademikSub === 'alumni') {
            const trimmedTa = alumniTahunAjaran.trim();
            const params = trimmedTa ? { tahunajaran: trimmedTa } : undefined;
            const qs = trimmedTa
              ? `?tahunajaran=${encodeURIComponent(trimmedTa)}`
              : '';
            setActiveEndpointLabel(`GET /api/jbsakad/alumni${qs}`);
            const res = await apiClient.get('/jbsakad/alumni', { params });
            const rows = extractResponsePayload(res.data).rows;
            setListRows(rows);
            if (!trimmedTa) {
              const years = Array.from(
                new Set(
                  rows
                    .map((r) => String(r.nama_tahunajaran || '').trim())
                    .filter(Boolean)
                )
              ).sort((a, b) => b.localeCompare(a));
              if (years.length > 0) {
                setAlumniYearOptions(years);
              }
            }
          } else if (akademikSub === 'three') {
            setActiveEndpointLabel('GET /api/jbsakad/kelas');
            const res = await apiClient.get('/jbsakad/kelas');
            setListRows(extractResponsePayload(res.data).rows);
          } else {
            setActiveEndpointLabel('GET /api/jbssdm/pegawai?aktif=1');
            const res = await apiClient.get('/jbssdm/pegawai', {
              params: { aktif: '1' },
            });
            const activeRows = extractResponsePayload(res.data).rows.filter(
              (r) => !('aktif' in r) || Number(r.aktif) === 1
            );
            setListRows(activeRows);
          }
        }
      } else if (activeTab === 'keuangan') {
        if (isSiswa) {
          setActiveEndpointLabel(`GET /api/jbsfina/tagihan/${encodedId}`);
          const res = await apiClient.get(`/jbsfina/tagihan/${encodedId}`);
          setListRows(extractResponsePayload(res.data).rows);
        } else if (isCalon) {
          setActiveEndpointLabel(`GET /api/jbsfina/tagihan-calon/${encodedId}`);
          const res = await apiClient.get(`/jbsfina/tagihan-calon/${encodedId}`);
          setListRows(extractResponsePayload(res.data).rows);
        } else {
          setActiveEndpointLabel('GET /api/jbsfina/tagihan');
          const res = await apiClient.get('/jbsfina/tagihan');
          setListRows(extractResponsePayload(res.data).rows);
        }
      } else if (activeTab === 'pustaka') {
        if (pustakaSub === 'ebook') {
          setActiveEndpointLabel('GET /api/jbsperpus/pustaka/digital');
          const res = await apiClient.get('/jbsperpus/pustaka/digital');
          setListRows(extractResponsePayload(res.data).rows);
        } else if (pustakaSub === 'pinjam') {
          const params = isSiswa ? { nis: identityCode } : undefined;
          setActiveEndpointLabel(
            isSiswa
              ? `GET /api/jbsperpus/pinjam?nis=${encodedId}`
              : 'GET /api/jbsperpus/pinjam'
          );
          const res = await apiClient.get('/jbsperpus/pinjam', { params });
          setListRows(extractResponsePayload(res.data).rows);
        } else {
          setActiveEndpointLabel('GET /api/jbsperpus/baca-digital');
          const res = await apiClient.get('/jbsperpus/baca-digital');
          const allLogs = extractResponsePayload(res.data).rows;
          setListRows(
            isSiswa
              ? allLogs.filter((r) => String(r.nis ?? '').trim() === identityCode)
              : allLogs
          );
        }
      }
    } catch (err) {
      setListError(extractApiErrorMessage(err));
      setListRows([]);
    } finally {
      setListLoading(false);
    }
  }, [
    activeTab,
    akademikSub,
    alumniTahunAjaran,
    pustakaSub,
    isSiswa,
    isCalon,
    identityCode,
    summary.idKelas,
  ]);

  useEffect(() => {
    loadTabContent();
  }, [loadTabContent, refreshSignal]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return listRows;
    return listRows.filter((row) =>
      Object.values(row).some(
        (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      )
    );
  }, [listRows, searchQuery]);

  // Helper pemicu mutasi cepat sesuai peran
  const triggerStaffMutation = (
    moduleId: string,
    mutationId: string,
    initialValues?: Record<string, string>
  ) => {
    const mod = ERP_MODULES.find((m) => m.id === moduleId);
    const act = mod?.mutations.find((m) => m.id === mutationId);
    if (act) {
      onTriggerMutation(act, initialValues);
    }
  };

  const triggerStudentPaymentConfirmation = (idTagihan?: string) => {
    const action: ErpMutationAction = {
      id: 'mobile-konfirmasi-bayar',
      label: 'Konfirmasi Pembayaran',
      method: 'POST',
      pathTemplate: '/jbsfina/konfirmasi/:nis',
      description: 'Kirim konfirmasi pembayaran tagihan sekolah.',
      fields: [
        {
          name: 'nis',
          label: 'NIS Siswa',
          in: 'path',
          type: 'text',
          defaultValue: isSiswa ? identityCode : '',
          required: true,
        },
        {
          name: 'id_tagihan',
          label: 'ID Tagihan (replid)',
          in: 'body',
          type: 'number',
          placeholder: 'Masukkan ID tagihan',
          required: true,
        },
        {
          name: 'jumlah_bayar',
          label: 'Nominal Pembayaran (Rp)',
          in: 'body',
          type: 'number',
          placeholder: 'Contoh: 350000',
          required: true,
        },
        {
          name: 'keterangan',
          label: 'Catatan Pembayaran',
          in: 'body',
          type: 'text',
          placeholder: 'Transfer bank / pembayaran mobile',
        },
      ],
    };
    onTriggerMutation(action, {
      nis: isSiswa ? identityCode : '',
      ...(idTagihan ? { id_tagihan: idTagihan } : {}),
    });
  };

  const navItems: {
    id: MobileTabId;
    label: string;
    icon: typeof Home;
  }[] = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    {
      id: 'akademik',
      label: isCalon ? 'Kalender' : isStaffOrAdmin ? 'SDM & Akad' : 'Akademik',
      icon: Calendar,
    },
    { id: 'keuangan', label: 'Tagihan', icon: CreditCard },
    { id: 'pustaka', label: 'Pustaka', icon: BookOpen },
    { id: 'kartu', label: 'Kartu ID', icon: IdCard },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar Header Modul Mobile View (Tampil di Desktop) */}
      <section className="hidden lg:flex items-center justify-between gap-6 rounded-xl border border-slate-200 bg-white px-6 py-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>Modul Antarmuka Sentuh</span>
            <span aria-hidden="true">·</span>
            <span>Peran Aktif: {roleName}</span>
            <span aria-hidden="true">·</span>
            <span>{activeEndpointLabel || 'Sinkronisasi Langsung'}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Mobile View Sekolah
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="group"
            aria-label="Mode Lebar Kanvas Mobile"
          >
            <button
              type="button"
              onClick={() => setViewportMode('compact')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewportMode === 'compact'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Layar Ponsel (412px)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewportMode('expanded')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewportMode === 'expanded'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Layar Penuh Responsif</span>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              loadSummary();
              loadTabContent();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Segarkan</span>
          </Button>
        </div>
      </section>

      {/* Grid Utama: Kanvas Aplikasi Mobile + Panel Pendamping di Desktop */}
      <div
        className={
          viewportMode === 'compact'
            ? 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'
            : 'block'
        }
      >
        {/* Kanvas Utama Mobile Touch App */}
        <div
          className={
            viewportMode === 'compact'
              ? 'lg:col-span-5 w-full max-w-[420px] mx-auto rounded-3xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[720px] shadow-2xs'
              : 'w-full rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[680px]'
          }
        >
          {/* Mobile Top App Bar (56px, <= 15% sticky budget) */}
          <div className="h-14 px-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {school.logoSrc ? (
                <img
                  src={school.logoSrc}
                  alt={school.nama}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-lg bg-white p-0.5 object-contain shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 text-xs font-bold">
                  JB
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {school.nama}
                </div>
                <div className="text-[11px] text-slate-300 truncate">
                  {roleName}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                loadSummary();
                loadTabContent();
              }}
              aria-label="Muat ulang data mobile"
              className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  summary.loading || listLoading ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Area Konten Tengah (Scrollable Stretch Zone) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {/* TAB 1: BERANDA MOBILE */}
            {activeTab === 'beranda' && (
              <div className="p-4 sm:p-5 space-y-5">
                {/* Sapaan & Identitas Singkat */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarImage
                      rawSrc={user.foto}
                      name={user.nama}
                      size="md"
                      className="h-12 w-12 rounded-2xl"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Selamat datang,</p>
                      <h2 className="text-base font-bold text-slate-900 truncate">
                        {user.nama}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono tabular-nums truncate">
                        ID {identityCode} · Tingkat {tingkat}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kartu')}
                    className="min-h-[44px] px-3 rounded-xl bg-slate-100 text-xs font-semibold text-slate-800 hover:bg-slate-200 transition-colors shrink-0 cursor-pointer"
                  >
                    Kartu QR
                  </button>
                </div>

                {/* 2x2 Kartu Metrik Ringkas */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    summary.metricA,
                    summary.metricB,
                    summary.metricC,
                    summary.metricD,
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5"
                    >
                      <div className="text-[11px] font-medium text-slate-500 truncate">
                        {m.label}
                      </div>
                      <div className="mt-1 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 truncate">
                        {summary.loading ? '...' : m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grid Peluncur Cepat (Minimum Hitbox >= 48px) */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2.5">
                    Menu Cepat Sentuh
                  </h3>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAkademikSub('one');
                        setActiveTab('akademik');
                      }}
                      className="min-h-[76px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                    >
                      <Clock className="h-5 w-5 text-slate-800" aria-hidden="true" />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        {isCalon ? 'Kalender' : 'Presensi'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('keuangan')}
                      className="min-h-[76px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                    >
                      <CreditCard className="h-5 w-5 text-slate-800" aria-hidden="true" />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        Tagihan
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPustakaSub('ebook');
                        setActiveTab('pustaka');
                      }}
                      className="min-h-[76px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                    >
                      <BookOpen className="h-5 w-5 text-slate-800" aria-hidden="true" />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        E-Book
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAkademikSub('two');
                        setActiveTab('akademik');
                      }}
                      className="min-h-[76px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                    >
                      <Users className="h-5 w-5 text-slate-800" aria-hidden="true" />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        {isSiswa
                          ? 'Jadwal'
                          : isCalon
                          ? 'Sekolah'
                          : 'Data Siswa'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPustakaSub('pinjam');
                        setActiveTab('pustaka');
                      }}
                      className="min-h-[76px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                    >
                      <Layers className="h-5 w-5 text-slate-800" aria-hidden="true" />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        Pinjaman
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('kartu')}
                      className="min-h-[76px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-3 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
                    >
                      <IdCard className="h-5 w-5 text-slate-800" aria-hidden="true" />
                      <span className="text-xs font-semibold text-slate-800 leading-tight">
                        Kartu ID
                      </span>
                    </button>
                  </div>
                </div>

                {/* Daftar Pintasan Aksi Cepat di Zona Jempol */}
                <div className="space-y-2 pt-1">
                  <h3 className="text-xs font-semibold text-slate-500">
                    Tindakan Cepat
                  </h3>

                  {isSiswa && (
                    <button
                      type="button"
                      onClick={() => triggerStudentPaymentConfirmation()}
                      className="w-full min-h-[56px] px-4 py-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          Konfirmasi Pembayaran Saya
                        </div>
                        <div className="text-xs text-slate-300">
                          Kirim bukti pembayaran tagihan sekolah
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  )}

                  {isStaffOrAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        triggerStaffMutation('jbssdm', 'catat-presensi-sdm', {
                          nip: tingkat === RoleTingkat.PEGAWAI ? identityCode : '',
                        })
                      }
                      className="w-full min-h-[56px] px-4 py-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          Input Presensi Pegawai
                        </div>
                        <div className="text-xs text-slate-300">
                          Catat jam masuk & pulang harian SDM
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPustakaSub('ebook');
                      setActiveTab('pustaka');
                    }}
                    className="w-full min-h-[56px] px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Buka Perpustakaan Digital
                      </div>
                      <div className="text-xs text-slate-500">
                        Baca koleksi e-book PDF langsung dari ponsel
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 text-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2, 3, 4: AKADEMIK / KEUANGAN / PUSTAKA */}
            {(activeTab === 'akademik' ||
              activeTab === 'keuangan' ||
              activeTab === 'pustaka') && (
              <div>
                {/* Sub-Tab Segmented Control */}
                {activeTab === 'akademik' && !isCalon && (
                  <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2.5">
                    <div
                      className={`grid ${
                        isSiswa ? 'grid-cols-3' : 'grid-cols-5'
                      } gap-1 p-1 bg-slate-200/70 rounded-xl`}
                    >
                      {(isSiswa
                        ? [
                            { id: 'one' as const, label: 'Presensi' },
                            { id: 'two' as const, label: 'Jadwal' },
                            { id: 'three' as const, label: 'Nilai' },
                          ]
                        : [
                            { id: 'one' as const, label: 'Presensi' },
                            { id: 'two' as const, label: 'Siswa' },
                            { id: 'alumni' as const, label: 'Alumni' },
                            { id: 'three' as const, label: 'Kelas' },
                            { id: 'four' as const, label: 'Pegawai' },
                          ]
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAkademikSub(t.id)}
                          className={`min-h-[40px] px-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                            akademikSub === t.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {!isSiswa && akademikSub === 'alumni' && (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="mobile-alumni-ta"
                          className="text-xs font-medium text-slate-600 shrink-0"
                        >
                          Tahun Ajaran:
                        </label>
                        <select
                          id="mobile-alumni-ta"
                          value={alumniTahunAjaran}
                          onChange={(e) => setAlumniTahunAjaran(e.target.value)}
                          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="">Semua Tahun Ajaran</option>
                          {alumniYearOptions.map((yr, idx) => (
                            <option key={`${yr}-${idx}`} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pustaka' && (
                  <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl">
                      {[
                        { id: 'ebook' as const, label: 'E-Book' },
                        { id: 'pinjam' as const, label: 'Pinjaman' },
                        { id: 'log' as const, label: 'Log Baca' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPustakaSub(t.id)}
                          className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            pustakaSub === t.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pencarian Cepat Sentuh */}
                <div className="p-3.5 border-b border-slate-100 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari pada daftar ini..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  </div>

                  {activeTab === 'keuangan' && (isSiswa || isStaffOrAdmin) && (
                    <button
                      type="button"
                      onClick={() => triggerStudentPaymentConfirmation()}
                      className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Bayar</span>
                    </button>
                  )}
                </div>

                {/* Daftar Baris Sentuh (Interactive Tap List Rows >= 60px) */}
                {listLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-14 rounded-xl bg-slate-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : listError ? (
                  <div className="p-6 text-center text-xs text-red-600">
                    {listError}
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada rekaman data pada tampilan ini.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredList.slice(0, 30).map((row, idx) => {
                      // Render khusus baris E-Book Digital
                      if (activeTab === 'pustaka' && pustakaSub === 'ebook') {
                        const judul = String(row.judul || 'Buku Digital');
                        const tipe = String(row.tipe || row.format || 'PDF');
                        const idPustaka = String(row.idpustaka ?? row.replid ?? idx);
                        return (
                          <div
                            key={`${idPustaka}-${idx}`}
                            className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {judul}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                                ID #{idPustaka} · Format {tipe}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReadingBook(row)}
                              className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shrink-0 cursor-pointer hover:bg-slate-800"
                            >
                              Baca
                            </button>
                          </div>
                        );
                      }

                      // Render khusus baris Tagihan Keuangan
                      if (activeTab === 'keuangan') {
                        const title = String(
                          row.nama_tagihan || row.besar || row.nama || 'Tagihan Sekolah'
                        );
                        const owner = row.nama_siswa || row.nama
                          ? String(row.nama_siswa || row.nama)
                          : identityCode;
                        const sisa = Number(row.sisa_asli ?? row.sisa ?? 0);
                        return (
                          <button
                            key={`${String(row.replid ?? 'tagihan')}-${idx}`}
                            type="button"
                            onClick={() =>
                              onInspectEntity({
                                mode: 'generic',
                                title,
                                row,
                              })
                            }
                            className="w-full min-h-[64px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {title}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 truncate">
                                {owner}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold font-mono tabular-nums text-slate-900">
                                {formatRupiah(sisa)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Sisa Kewajiban
                              </div>
                            </div>
                          </button>
                        );
                      }

                      // Render umum baris sentuh (Presensi, Siswa, Kelas, Pinjaman, Log Baca)
                      const primaryTitle = String(
                        row.nama_mapel ||
                          row.mapel ||
                          row.judul ||
                          row.nama ||
                          row.nama_siswa ||
                          row.nama_kelas ||
                          row.nama_kalender ||
                          `Rekaman #${idx + 1}`
                      );

                      const secondaryParts: string[] = [];
                      if (row.nis) secondaryParts.push(`NIS ${String(row.nis)}`);
                      if (row.nip) secondaryParts.push(`NIP ${String(row.nip)}`);
                      if (row.jabatan && primaryTitle !== String(row.jabatan)) {
                        secondaryParts.push(String(row.jabatan));
                      }
                      if (row.nama_kelasakhir) {
                        secondaryParts.push(`Kelas ${String(row.nama_kelasakhir)}`);
                      }
                      if (row.nama_tahunajaran) {
                        secondaryParts.push(`TA ${String(row.nama_tahunajaran)}`);
                      }
                      if (row.tgllulus) {
                        secondaryParts.push(`Lulus ${String(row.tgllulus)}`);
                      }
                      if (row.bagian) secondaryParts.push(String(row.bagian));
                      if (row.nama_siswa && primaryTitle !== String(row.nama_siswa)) {
                        secondaryParts.push(String(row.nama_siswa));
                      }
                      if (row.tanggal) secondaryParts.push(formatDateId(row.tanggal));
                      if (row.tglpinjam) secondaryParts.push(formatDateId(row.tglpinjam));
                      if (row.waktu) secondaryParts.push(formatDateTimeId(row.waktu));
                      if (row.jam) secondaryParts.push(String(row.jam));
                      if (row.hari) secondaryParts.push(String(row.hari));

                      const rightBadgeText = String(
                        row.nama_status ||
                          row.status_absen ||
                          row.status_pinjam ||
                          (row.nilai !== undefined ? `Nilai ${String(row.nilai)}` : '') ||
                          ''
                      );

                      return (
                        <button
                          key={`${String(row.replid ?? row.id ?? row.nip ?? row.nis ?? 'row')}-${idx}`}
                          type="button"
                          onClick={() =>
                            onInspectEntity({
                              mode: row.nis
                                ? 'siswa'
                                : row.nip
                                ? 'pegawai'
                                : 'generic',
                              title: primaryTitle,
                              identifier: row.nis
                                ? String(row.nis)
                                : row.nip
                                ? String(row.nip)
                                : undefined,
                              row,
                            })
                          }
                          className="w-full min-h-[62px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {primaryTitle}
                            </div>
                            {secondaryParts.length > 0 && (
                              <div className="mt-0.5 text-xs text-slate-500 truncate tabular-nums">
                                {secondaryParts.join(' · ')}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {rightBadgeText && (
                              <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{rightBadgeText}</span>
                              </span>
                            )}
                            <ChevronRight
                              className="h-4 w-4 text-slate-400"
                              aria-hidden="true"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: KARTU IDENTITAS QR DIGITAL */}
            {activeTab === 'kartu' && (
              <div className="p-4 sm:p-5">
                <UserIdentityCard user={user} identitasRows={identitasRows} />
              </div>
            )}
          </div>

          {/* Bottom Tab Navigation Bar di Zona Jempol (h-16, 5 destinasi utama) */}
          <nav
            aria-label="Navigasi Bawah Mobile View"
            className="h-16 border-t border-slate-200 bg-white/95 backdrop-blur-md grid grid-cols-5 items-center shrink-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-slate-700 font-medium'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isSelected ? 'stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] tracking-tight whitespace-nowrap truncate max-w-[68px]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Panel Pendamping Kanan pada Desktop (Hanya saat mode Layar Ponsel 412px) */}
        {viewportMode === 'compact' && (
          <div className="hidden lg:block lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Navigasi Cepat Antar Layar
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Kendali Modul Mobile View
                </h2>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Antarmuka di samping terhubung langsung ke REST API produksi sesuai
                  identitas akun <strong>{user.nama}</strong> ({roleName}). Seluruh
                  ketukan baris, pembaca e-book, konfirmasi tagihan, dan kartu QR
                  bekerja secara langsung.
                </p>
              </div>

              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {[
                  {
                    id: 'beranda' as const,
                    code: '01.',
                    title: 'Beranda & Peluncur Sentuh',
                    desc: 'Ringkasan metrik personal/lembaga dan kisi 6 tombol cepat ramah satu tangan.',
                  },
                  {
                    id: 'akademik' as const,
                    code: '02.',
                    title: isCalon
                      ? 'Kalender Akademik PPDB'
                      : isStaffOrAdmin
                      ? 'Presensi SDM, Siswa, Alumni & Kelas'
                      : 'Presensi, Jadwal Kelas & Nilai Ujian',
                    desc: 'Daftar baris interaktif dengan tinggi sentuh >= 60px dan pencarian instan.',
                  },
                  {
                    id: 'keuangan' as const,
                    code: '03.',
                    title: 'Tagihan & Konfirmasi Pembayaran',
                    desc: 'Pantau rincian sisa kewajiban biaya pendidikan dan kirim konfirmasi bayar.',
                  },
                  {
                    id: 'pustaka' as const,
                    code: '04.',
                    title: 'E-Book Digital, Peminjaman & Log Baca',
                    desc: 'Baca berkas PDF buku digital langsung di layar serta catat riwayat literasi.',
                  },
                  {
                    id: 'kartu' as const,
                    code: '05.',
                    title: 'Dompet Kartu Identitas QR Digital',
                    desc: 'Tampilkan QR Code identitas resmi untuk pemindaian cepat, unduh PNG, atau cetak.',
                  },
                ].map((screen) => {
                  const isCurrent = activeTab === screen.id;
                  return (
                    <button
                      key={screen.id}
                      type="button"
                      onClick={() => setActiveTab(screen.id)}
                      className="w-full py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 px-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                          {screen.code}
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`text-sm font-semibold ${
                              isCurrent ? 'text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {screen.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {screen.desc}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          isCurrent ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {isCurrent ? 'Aktif' : 'Buka'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {onOpenDesktopModule && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500">
                    Butuh tabel kepadatan penuh untuk analisis multi-kolom?
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenDesktopModule('overview')}
                  >
                    Kembali ke Ringkasan Desktop
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Pembaca Buku Digital Terintegrasi */}
      <DigitalBookReaderModal
        book={readingBook}
        studentNis={isSiswa ? identityCode : undefined}
        onClose={() => setReadingBook(null)}
        onReadLogged={() => {
          if (activeTab === 'pustaka' && pustakaSub === 'log') {
            loadTabContent();
          }
        }}
      />
    </div>
  );
}
