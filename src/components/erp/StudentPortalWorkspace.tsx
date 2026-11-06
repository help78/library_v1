import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  Code2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type { ErpMutationAction } from '../../data/erpModules';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatNumberId,
  formatRupiah,
  type NormalizedApiPayload,
} from '../../lib/formatters';
import {
  CALON_SISWA_MENU_ITEMS,
  SISWA_MENU_ITEMS,
  type StudentSelfServiceMenuItem,
} from '../../lib/rbac';
import {
  RoleTingkat,
  type UserData,
  getRoleFullName,
} from '../../types/auth';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { IdentityShowcase } from './IdentityShowcase';
import { SmartDataTable, type InspectedEntity } from './SmartDataTable';
import { DigitalBookReaderModal } from './DigitalBookReaderModal';
import { FileSharingModal } from './FileSharingModal';
import { JibasGreetingBanner } from './JibasGreetingBanner';
import { ProfilPresensiSiswa } from './ProfilPresensiSiswa';
import { RaporPenilaianWorkspace } from './RaporPenilaianWorkspace';
import { JadwalKelasWorkspace } from './JadwalKelasWorkspace';

interface StudentPortalWorkspaceProps {
  user: UserData;
  activeSection: string; // 'overview' atau salah satu id pada SISWA_MENU_ITEMS / CALON_SISWA_MENU_ITEMS
  onSelectSection: (sectionId: string) => void;
  onInspectEntity: (entity: InspectedEntity) => void;
  onTriggerMutation: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  refreshSignal: number;
}

interface StudentOverviewSummary {
  loading: boolean;
  kelasLabel: string;
  idKelas: string;
  sisaTagihan: number;
  jumlahTagihan: number;
  pinjamanAktif: number;
  koleksiDigitalTotal: number;
  presensiHadir: number;
  presensiSakit: number;
  presensiIzin: number;
  hasPresensiRekap: boolean;
}

export function StudentPortalWorkspace({
  user,
  activeSection,
  onSelectSection,
  onInspectEntity,
  onTriggerMutation,
  refreshSignal,
}: StudentPortalWorkspaceProps) {
  const tingkat = Number(user.tingkat);
  const isSiswa = tingkat === RoleTingkat.SISWA;
  const identityCode = String(user.username || '').trim();
  const roleFullName = getRoleFullName(tingkat);

  const menuItems: StudentSelfServiceMenuItem[] = isSiswa
    ? SISWA_MENU_ITEMS
    : CALON_SISWA_MENU_ITEMS;

  const [secondaryTab, setSecondaryTab] = useState<
    'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary'
  >('primary');
  const [fileSharingOpen, setFileSharingOpen] = useState(false);
  const [fileSharingMode, setFileSharingMode] = useState<'list' | 'upload'>('list');

  const [overview, setOverview] = useState<StudentOverviewSummary>({
    loading: true,
    kelasLabel: '-',
    idKelas: '',
    sisaTagihan: 0,
    jumlahTagihan: 0,
    pinjamanAktif: 0,
    koleksiDigitalTotal: 0,
    presensiHadir: 0,
    presensiSakit: 0,
    presensiIzin: 0,
    hasPresensiRekap: false,
  });

  const [payload, setPayload] = useState<NormalizedApiPayload | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<Record<string, unknown> | null>(
    null
  );

  useEffect(() => {
    setSecondaryTab('primary');
  }, [activeSection]);

  // Muat ringkasan personal Siswa / Calon Siswa
  const loadPersonalSummary = useCallback(async () => {
    if (!identityCode) return;
    setOverview((prev) => ({ ...prev, loading: true }));

    if (isSiswa) {
      const [detailRes, kelasRes, tagihanRes, pinjamRes, digitalRes, presensiRes] =
        await Promise.allSettled([
          apiClient.get(`/jbsakad/siswa/detail/${encodeURIComponent(identityCode)}`),
          apiClient.get('/jbsakad/kelas'),
          apiClient.get(`/jbsfina/tagihan/${encodeURIComponent(identityCode)}`),
          apiClient.get('/jbsperpus/pinjam', { params: { nis: identityCode, status: '1' } }),
          apiClient.get('/jbsperpus/pustaka/digital'),
          apiClient.get(`/jbsakad/presensiharian/${encodeURIComponent(identityCode)}`),
        ]);

      let idKelas = '';
      let kelasLabel = '-';
      if (detailRes.status === 'fulfilled') {
        const d = extractResponsePayload(detailRes.value.data);
        if (d.singleObject?.idkelas !== undefined) {
          idKelas = String(d.singleObject.idkelas);
          kelasLabel = `ID Kelas ${idKelas}`;
        }
      }

      if (idKelas && kelasRes.status === 'fulfilled') {
        const k = extractResponsePayload(kelasRes.value.data);
        const match = k.rows.find((r) => String(r.idkelas) === idKelas);
        if (match?.nama_kelas) {
          kelasLabel = String(match.nama_kelas);
        }
      }

      let sisaTagihan = 0;
      let jumlahTagihan = 0;
      if (tagihanRes.status === 'fulfilled') {
        const t = extractResponsePayload(tagihanRes.value.data);
        jumlahTagihan = t.rows.length;
        for (const r of t.rows) {
          sisaTagihan += Number(r.sisa_asli || 0);
        }
      }

      let pinjamanAktif = 0;
      if (pinjamRes.status === 'fulfilled') {
        const p = extractResponsePayload(pinjamRes.value.data);
        pinjamanAktif = p.rows.length;
      }

      let koleksiDigitalTotal = 0;
      if (digitalRes.status === 'fulfilled') {
        const dg = extractResponsePayload(digitalRes.value.data);
        koleksiDigitalTotal = dg.totalCount;
      }

      // Ambil objek `rekap` langsung dari GET /api/jbsakad/presensiharian/:nis
      let presensiHadir = 0;
      let presensiSakit = 0;
      let presensiIzin = 0;
      let hasPresensiRekap = false;
      if (presensiRes.status === 'fulfilled') {
        const body = presensiRes.value.data as Record<string, unknown> | undefined;
        const rekapObj = body?.rekap as Record<string, unknown> | undefined;
        if (rekapObj && typeof rekapObj === 'object' && !Array.isArray(rekapObj)) {
          presensiHadir = Number(rekapObj.hadir ?? 0) || 0;
          presensiSakit = Number(rekapObj.sakit ?? 0) || 0;
          presensiIzin = Number(rekapObj.izin ?? 0) || 0;
          hasPresensiRekap = true;
        }
      }

      setOverview({
        loading: false,
        kelasLabel,
        idKelas,
        sisaTagihan,
        jumlahTagihan,
        pinjamanAktif,
        koleksiDigitalTotal,
        presensiHadir,
        presensiSakit,
        presensiIzin,
        hasPresensiRekap,
      });
    } else {
      // Calon Siswa (Tingkat 4)
      try {
        const tagihanRes = await apiClient.get(
          `/jbsfina/tagihan-calon/${encodeURIComponent(identityCode)}`
        );
        const t = extractResponsePayload(tagihanRes.data);
        let sisaTagihan = 0;
        for (const r of t.rows) {
          sisaTagihan += Number(r.sisa_asli || r.sisa || 0);
        }
        setOverview({
          loading: false,
          kelasLabel: 'Pendaftar PPDB',
          idKelas: '',
          sisaTagihan,
          jumlahTagihan: t.rows.length,
          pinjamanAktif: 0,
          koleksiDigitalTotal: 0,
          presensiHadir: 0,
          presensiSakit: 0,
          presensiIzin: 0,
          hasPresensiRekap: false,
        });
      } catch {
        setOverview({
          loading: false,
          kelasLabel: 'Pendaftar PPDB',
          idKelas: '',
          sisaTagihan: 0,
          jumlahTagihan: 0,
          pinjamanAktif: 0,
          koleksiDigitalTotal: 0,
          presensiHadir: 0,
          presensiSakit: 0,
          presensiIzin: 0,
          hasPresensiRekap: false,
        });
      }
    }
  }, [identityCode, isSiswa]);

  useEffect(() => {
    loadPersonalSummary();
  }, [loadPersonalSummary, refreshSignal]);

  // Muat data spesifik ketika memilih menu siswa / calon siswa
  const loadActiveStudentMenu = useCallback(async () => {
    if (activeSection === 'overview' || !identityCode) {
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setPayload(null);

    try {
      const encodedId = encodeURIComponent(identityCode);

      if (activeSection === 'siswa-biodata') {
        const path = `/jbsakad/siswa/detail/${encodedId}`;
        setResolvedUrl(`/api${path}`);
        const res = await apiClient.get(path);
        setPayload(extractResponsePayload(res.data));
      } else if (activeSection === 'siswa-jadwal') {
        if (secondaryTab === 'secondary') {
          const path = '/jbsakad/kalender-akademik';
          setResolvedUrl(`/api${path}`);
          const res = await apiClient.get(path);
          setPayload(extractResponsePayload(res.data));
        } else {
          let targetKelas = overview.idKelas;
          if (!targetKelas) {
            const detailRes = await apiClient.get(`/jbsakad/siswa/detail/${encodedId}`);
            const parsedDetail = extractResponsePayload(detailRes.data);
            if (parsedDetail.singleObject?.idkelas) {
              targetKelas = String(parsedDetail.singleObject.idkelas);
            }
          }
          if (!targetKelas) {
            setErrorMsg('Data kelas aktif untuk akun siswa ini belum ditemukan.');
          } else {
            const path = `/jbsakad/jadwal/kelas/${encodeURIComponent(targetKelas)}`;
            setResolvedUrl(`/api${path}`);
            const res = await apiClient.get(path);
            setPayload(extractResponsePayload(res.data));
          }
        }
      } else if (activeSection === 'siswa-nilai') {
        // Dikelola langsung oleh <RaporPenilaianWorkspace /> (Rapor Lengkap & Riwayat Nilai Ujian)
        const path =
          secondaryTab === 'secondary'
            ? `/jbsakad/rapor/nilaiujian/${encodedId}`
            : `/jbsakad/rapor/${encodedId}`;
        setResolvedUrl(`/api${path}`);
      } else if (activeSection === 'siswa-presensi') {
        if (secondaryTab === 'tertiary') {
          const path = '/jbsumum/cardscandata';
          setResolvedUrl(`/api${path}?nis=${encodedId}`);
          const res = await apiClient.get(path, { params: { nis: identityCode } });
          setPayload(extractResponsePayload(res.data));
        } else {
          // Tab primary (Presensi Pelajaran) & secondary (Presensi Harian) dikelola langsung oleh <ProfilPresensiSiswa />
          const path =
            secondaryTab === 'secondary'
              ? `/jbsakad/presensiharian/${encodedId}`
              : `/jbsakad/presensi-pelajaran/${encodedId}`;
          setResolvedUrl(`/api${path}`);
        }
      } else if (activeSection === 'siswa-tagihan') {
        const path = `/jbsfina/tagihan/${encodedId}`;
        setResolvedUrl(`/api${path}`);
        const res = await apiClient.get(path);
        setPayload(extractResponsePayload(res.data));
      } else if (activeSection === 'siswa-pustaka') {
        if (secondaryTab === 'secondary') {
          const path = '/jbsperpus/pustaka/digital';
          setResolvedUrl(`/api${path}`);
          const res = await apiClient.get(path);
          setPayload(extractResponsePayload(res.data));
        } else if (secondaryTab === 'tertiary') {
          const path = '/jbsperpus/baca-digital';
          setResolvedUrl(`/api${path}?nis=${encodedId}`);
          const res = await apiClient.get(path, { params: { nis: identityCode } });
          const extracted = extractResponsePayload(res.data);
          const ownLogs = extracted.rows.filter(
            (r) => String(r.nis || '').trim() === identityCode
          );
          setPayload({
            ...extracted,
            rows: ownLogs,
            totalCount: ownLogs.length,
          });
        } else if (secondaryTab === 'quaternary') {
          const path = '/jbsperpus/pustaka';
          setResolvedUrl(`/api${path}`);
          const res = await apiClient.get(path);
          setPayload(extractResponsePayload(res.data));
        } else if (secondaryTab === 'quinary') {
          const path = '/jbsperpus/daftarpustaka';
          setResolvedUrl(`/api${path}`);
          const res = await apiClient.get(path);
          setPayload(extractResponsePayload(res.data));
        } else {
          const path = '/jbsperpus/pinjam';
          setResolvedUrl(`/api${path}?nis=${encodedId}`);
          const res = await apiClient.get(path, { params: { nis: identityCode } });
          setPayload(extractResponsePayload(res.data));
        }
      } else if (activeSection === 'calon-tagihan') {
        const path = `/jbsfina/tagihan-calon/${encodedId}`;
        setResolvedUrl(`/api${path}`);
        const res = await apiClient.get(path);
        setPayload(extractResponsePayload(res.data));
      } else if (activeSection === 'calon-kalender') {
        const path = '/jbsakad/kalender-akademik';
        setResolvedUrl(`/api${path}`);
        const res = await apiClient.get(path);
        setPayload(extractResponsePayload(res.data));
      } else if (activeSection === 'calon-identitas') {
        const path = '/jbsumum/identitas';
        setResolvedUrl(`/api${path}`);
        const res = await apiClient.get(path);
        setPayload(extractResponsePayload(res.data));
      }
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeSection, secondaryTab, identityCode, overview.idKelas]);

  useEffect(() => {
    loadActiveStudentMenu();
  }, [loadActiveStudentMenu, refreshSignal]);

  const handleOpenKonfirmasiBayar = () => {
    const konfirmasiAction: ErpMutationAction = {
      id: 'konfirmasi-bayar-siswa',
      label: 'Konfirmasi Pembayaran Saya',
      method: 'POST',
      pathTemplate: '/jbsfina/konfirmasi/:nis',
      description: 'Kirim konfirmasi pembayaran biaya sekolah untuk akun NIS Anda.',
      fields: [
        {
          name: 'nis',
          label: 'NIS Siswa',
          in: 'path',
          type: 'text',
          defaultValue: identityCode,
          required: true,
        },
        {
          name: 'id_tagihan',
          label: 'ID Tagihan (replid)',
          in: 'body',
          type: 'number',
          placeholder: 'Masukkan ID tagihan pada tabel',
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
          label: 'Catatan / Referensi Transfer',
          in: 'body',
          type: 'text',
          placeholder: 'Contoh: Transfer Bank BSI tgl hari ini',
        },
      ],
    };
    onTriggerMutation(konfirmasiAction, { nis: identityCode });
  };

  const handleOpenCatatBacaDigital = () => {
    const bacaAction: ErpMutationAction = {
      id: 'catat-baca-digital-siswa',
      label: 'Catat Aktivitas Baca Buku Digital',
      method: 'POST',
      pathTemplate: '/jbsperpus/baca-digital',
      description:
        'Catat log aktivitas membaca koleksi e-book / buku digital perpustakaan untuk akun NIS Anda.',
      fields: [
        {
          name: 'idpustaka',
          label: 'ID Pustaka (id_pustaka)',
          in: 'body',
          type: 'number',
          placeholder: 'Masukkan ID Pustaka dari katalog (contoh: 12)',
          required: true,
        },
        {
          name: 'nis',
          label: 'NIS Siswa',
          in: 'body',
          type: 'text',
          defaultValue: identityCode,
          required: true,
        },
      ],
    };
    onTriggerMutation(bacaAction, { nis: identityCode });
  };

  if (activeSection === 'overview') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 space-y-10">
        {/* 1. Greeting Hero Bergaya JIBAS */}
        <JibasGreetingBanner
          user={user}
          onOpenFileSharing={() => {
            setFileSharingMode('list');
            setFileSharingOpen(true);
          }}
          onOpenFullProfile={
            isSiswa ? () => onSelectSection('siswa-biodata') : undefined
          }
        />

        {/* 2. Rekapitulasi Personal Siswa / Calon Siswa */}
        <section aria-labelledby="rekap-siswa-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="rekap-siswa-heading"
              className="text-xl sm:text-2xl font-normal text-slate-600 tracking-tight"
            >
              Rekapitulasi
            </h2>

            <button
              type="button"
              onClick={loadPersonalSummary}
              disabled={overview.loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${overview.loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Muat Ulang</span>
            </button>
          </div>

          <div className="flex items-stretch gap-5 overflow-x-auto pt-1 pb-2">
            <button
              type="button"
              onClick={() =>
                onSelectSection(isSiswa ? 'siswa-biodata' : 'calon-kalender')
              }
              className="w-[248px] sm:w-[264px] min-h-[134px] shrink-0 rounded-xl bg-[#107c10] hover:opacity-95 text-white p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
            >
              <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                {isSiswa ? 'Status & Kelas Aktif' : 'Status Pendaftaran'}
              </div>
              <div className="pt-2">
                <div className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                  {overview.loading ? '...' : overview.kelasLabel}
                </div>
                <div className="mt-1 text-xs font-mono text-white/90 tabular-nums">
                  {isSiswa ? `NIS ${identityCode}` : `No. Daftar ${identityCode}`}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                onSelectSection(isSiswa ? 'siswa-tagihan' : 'calon-tagihan')
              }
              className="w-[258px] sm:w-[276px] min-h-[134px] shrink-0 rounded-xl bg-[#0b4e7d] hover:opacity-95 text-white p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
            >
              <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                Tagihan Keuangan
              </div>
              <div className="pt-2">
                <div className="text-lg sm:text-xl font-bold font-mono tabular-nums truncate">
                  {overview.loading ? '...' : formatRupiah(overview.sisaTagihan)}
                </div>
                <div className="mt-1 text-xs text-white/90 tabular-nums">
                  {overview.loading
                    ? '...'
                    : `${formatNumberId(overview.jumlahTagihan)} rincian tagihan`}
                </div>
              </div>
            </button>

            {isSiswa && (
              <button
                type="button"
                onClick={() => onSelectSection('siswa-presensi')}
                className="w-[264px] sm:w-[280px] min-h-[134px] shrink-0 rounded-xl bg-[#1e5f43] hover:opacity-95 text-white p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                  Rekap Kehadiran Saya
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <div className="text-[11px] text-white/90">Hadir</div>
                    <div className="mt-1 text-lg sm:text-xl font-bold font-mono tabular-nums">
                      {overview.loading
                        ? '...'
                        : formatNumberId(overview.presensiHadir)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/90">Sakit</div>
                    <div className="mt-1 text-lg sm:text-xl font-bold font-mono tabular-nums">
                      {overview.loading
                        ? '...'
                        : formatNumberId(overview.presensiSakit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/90">Izin</div>
                    <div className="mt-1 text-lg sm:text-xl font-bold font-mono tabular-nums">
                      {overview.loading
                        ? '...'
                        : formatNumberId(overview.presensiIzin)}
                    </div>
                  </div>
                </div>
              </button>
            )}

            {isSiswa && (
              <button
                type="button"
                onClick={() => onSelectSection('siswa-pustaka')}
                className="w-[248px] sm:w-[264px] min-h-[134px] shrink-0 rounded-xl bg-[#167d8a] hover:opacity-95 text-white p-5 shadow-md flex flex-col justify-between text-center transition-opacity cursor-pointer"
              >
                <div className="text-xs sm:text-sm font-bold text-[#ffe838] tracking-tight">
                  Perpustakaan & E-Book
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-xs text-white/90">Pinjam</div>
                    <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                      {overview.loading
                        ? '...'
                        : formatNumberId(overview.pinjamanAktif)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/90">E-Book</div>
                    <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                      {overview.loading
                        ? '...'
                        : formatNumberId(overview.koleksiDigitalTotal)}
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </section>

        {/* 3. Daftar Layanan Mandiri Khusus Siswa / Calon Siswa */}
        <section className="pt-6 border-t border-slate-200 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Layanan Mandiri {isSiswa ? 'Siswa' : 'Calon Siswa (PPDB)'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Menu di bawah ini disesuaikan khusus untuk peran {roleFullName} dan terhubung
              otomatis ke identitas akun Anda.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 divide-y divide-slate-200">
            {menuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                <div className="flex items-baseline gap-3.5 min-w-0">
                  <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                    {item.code}.
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSection(item.id);
                  }}
                >
                  <span>Buka</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <FileSharingModal
          open={fileSharingOpen}
          onClose={() => setFileSharingOpen(false)}
          initialMode={fileSharingMode}
          studentNis={isSiswa ? identityCode : undefined}
          onInspectEntity={onInspectEntity}
          refreshSignal={refreshSignal}
        />
      </div>
    );
  }

  const currentMenu =
    menuItems.find((m) => m.id === activeSection) || menuItems[0];

  const subTabs:
    | {
        id: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary';
        label: string;
      }[]
    | null =
    activeSection === 'siswa-jadwal'
      ? [
          { id: 'primary', label: `Jadwal Kelas (${overview.kelasLabel})` },
          { id: 'secondary', label: 'Kalender Akademik Sekolah' },
        ]
      : activeSection === 'siswa-nilai'
      ? [
          { id: 'primary', label: 'Rapor & Agregasi Akademik' },
          { id: 'secondary', label: 'Riwayat Nilai Ujian' },
        ]
      : activeSection === 'siswa-presensi'
      ? [
          { id: 'primary', label: 'Presensi Mata Pelajaran' },
          { id: 'secondary', label: 'Presensi Harian' },
          { id: 'tertiary', label: 'Riwayat Tap Kartu Pintar' },
        ]
      : activeSection === 'siswa-pustaka'
      ? [
          { id: 'primary', label: 'Buku yang Saya Pinjam' },
          { id: 'secondary', label: 'Daftar Buku Digital (E-Book)' },
          { id: 'tertiary', label: 'Riwayat Baca Digital Saya' },
          { id: 'quaternary', label: 'Katalog Induk Perpustakaan' },
          { id: 'quinary', label: 'Status Eksemplar di Rak' },
        ]
      : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-slate-500 tabular-nums">
              Layanan {currentMenu.code} · {resolvedUrl || currentMenu.endpointHint}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
              {currentMenu.label}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 max-w-2xl leading-relaxed">
              {currentMenu.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeSection === 'siswa-tagihan' && (
              <Button type="button" size="sm" onClick={handleOpenKonfirmasiBayar}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Konfirmasi Pembayaran</span>
              </Button>
            )}

            {activeSection === 'siswa-pustaka' && (
              <Button type="button" size="sm" onClick={handleOpenCatatBacaDigital}>
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Baca Digital</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={loadActiveStudentMenu}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Muat Ulang</span>
            </Button>

            {payload && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onInspectEntity({
                    mode: 'raw-response',
                    title: `GET ${resolvedUrl}`,
                    row: (payload.raw as Record<string, unknown>) || {},
                  })
                }
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Respons JSON</span>
              </Button>
            )}
          </div>
        </div>

        {subTabs && (
          <div className="mt-6 pt-5 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto">
            {subTabs.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSecondaryTab(st.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  secondaryTab === st.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {activeSection === 'siswa-jadwal' && secondaryTab === 'primary' ? (
        <JadwalKelasWorkspace
          lockedIdKelas={overview.idKelas || '201'}
          classNameTitle={overview.kelasLabel}
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
        />
      ) : activeSection === 'siswa-nilai' ? (
        <RaporPenilaianWorkspace
          initialMode={
            secondaryTab === 'secondary' ? 'nilai-ujian' : 'rapor-siswa'
          }
          lockedNis={identityCode}
          studentName={user.nama}
          studentClass={overview.kelasLabel}
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
        />
      ) : activeSection === 'siswa-presensi' &&
      (secondaryTab === 'primary' || secondaryTab === 'secondary') ? (
        <ProfilPresensiSiswa
          endpointType={secondaryTab === 'secondary' ? 'harian' : 'pelajaran'}
          lockedNis={identityCode}
          studentName={user.nama}
          studentClass={overview.kelasLabel}
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
        />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
          {payload?.message && !errorMsg && (
            <div className="px-6 py-3 bg-slate-50/50 text-xs text-slate-600">
              Keterangan Server:{' '}
              <span className="font-medium text-slate-800">{payload.message}</span>
            </div>
          )}

          {errorMsg ? (
            <div className="p-6">
              <Alert variant="default">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-600" aria-hidden="true" />
                <div className="space-y-1">
                  <AlertTitle>Informasi Data</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </div>
              </Alert>
            </div>
          ) : activeSection === 'calon-identitas' && payload ? (
            <IdentityShowcase
              rows={payload.rows}
              onInspectRow={(row) =>
                onInspectEntity({
                  mode: 'generic',
                  title: String(row.nama || 'Identitas Sekolah'),
                  row,
                })
              }
            />
          ) : (
            <SmartDataTable
              rows={payload?.rows || []}
              singleObject={payload?.singleObject || null}
              isLoading={isLoading}
              entityType={
                activeSection === 'siswa-pustaka' && secondaryTab === 'secondary'
                  ? 'pustaka-digital'
                  : activeSection === 'siswa-pustaka' && secondaryTab === 'quaternary'
                  ? 'pustaka'
                  : activeSection === 'siswa-pustaka' && secondaryTab === 'quinary'
                  ? 'eksemplar'
                  : activeSection === 'siswa-pustaka' && secondaryTab === 'primary'
                  ? 'pinjam'
                  : 'generic'
              }
              emptyMessage={
                activeSection === 'siswa-pustaka' && secondaryTab === 'secondary'
                  ? 'Saat ini belum ada buku digital pada katalog perpustakaan.'
                  : activeSection === 'siswa-pustaka' && secondaryTab === 'tertiary'
                  ? 'Belum ada riwayat aktivitas membaca buku digital untuk akun NIS Anda.'
                  : 'Belum ada catatan pada layanan ini untuk identitas akun Anda.'
              }
              onInspect={onInspectEntity}
              onOpenDigitalBook={(row) => setReadingBook(row)}
            />
          )}
        </section>
      )}

      <DigitalBookReaderModal
        book={readingBook}
        studentNis={identityCode}
        onClose={() => setReadingBook(null)}
        onReadLogged={() => {
          if (activeSection === 'siswa-pustaka' && secondaryTab === 'tertiary') {
            loadActiveStudentMenu();
          }
        }}
      />
    </div>
  );
}
