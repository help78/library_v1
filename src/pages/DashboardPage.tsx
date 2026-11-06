import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Lock } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { ERP_MODULES, type ErpMutationAction } from '../data/erpModules';
import {
  isLandlordUser,
  resolveMenuByPath,
  resolvePermittedErpModules,
  resolvePortalMode,
  resolveSectionPath,
} from '../lib/rbac';
import { RequireAuth } from '../components/auth/ProtectedRoute';
import { FriendlyHeader } from '../components/layout/FriendlyHeader';
import { ExecutiveOverview } from '../components/erp/ExecutiveOverview';
import { MobileViewWorkspace } from '../components/erp/MobileViewWorkspace';
import { ModuleWorkspace } from '../components/erp/ModuleWorkspace';
import { StudentPortalWorkspace } from '../components/erp/StudentPortalWorkspace';
import { EntityDetailSheet } from '../components/erp/EntityDetailSheet';
import { EndpointFormModal } from '../components/erp/EndpointFormModal';
import { DigitalBookReaderModal } from '../components/erp/DigitalBookReaderModal';
import {
  JibasAkademikSubmain,
  JIBAS_SUBMAIN_CONFIGS,
  type JibasAkademikTabKey,
} from '../components/erp/JibasAkademikSubmain';
import { Button } from '../components/ui/button';
import { RoleTingkat } from '../types/auth';
import type { InspectedEntity } from '../components/erp/SmartDataTable';

interface DashboardLocationState {
  pendingDigitalBook?: Record<string, unknown>;
  initialViewId?: string;
  initialTab?: JibasAkademikTabKey;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const [initialModuleViewId, setInitialModuleViewId] = useState<
    string | undefined
  >(undefined);
  const [inspectedEntity, setInspectedEntity] =
    useState<InspectedEntity | null>(null);
  const [activeMutation, setActiveMutation] = useState<{
    action: ErpMutationAction;
    initialValues?: Record<string, string>;
  } | null>(null);
  const [autoReadBook, setAutoReadBook] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Alur Tiga Klik (3x Klik) JIBAS AKADEMIK:
  // 1. Klik Main Menu di Header (home, referensi, psb, guru-pelajaran, jadwal-kalender, siswa, reposisi, presensi, penilaian, pengaturan)
  // 2. Tampil Sub-Main (JibasAkademikSubmain)
  // 3. Klik item di Sub-Main -> Tampil Page data (ModuleWorkspace)
  const [activeAkademikTab, setActiveAkademikTab] =
    useState<JibasAkademikTabKey>('home');
  const [activeAkademikViewId, setActiveAkademikViewId] = useState<
    string | null
  >(null);
  const [activeItemTitle, setActiveItemTitle] = useState<string>('');

  const isLandlord = useMemo(() => isLandlordUser(user), [user]);
  const portalMode = useMemo(() => resolvePortalMode(user), [user]);
  const isStudentOrApplicant =
    portalMode === 'siswa-selfservice' || portalMode === 'calon-selfservice';

  const accessibleModules = useMemo(
    () => resolvePermittedErpModules(user, ERP_MODULES),
    [user]
  );

  const hasAkadAccess = useMemo(
    () => isLandlord || accessibleModules.some((m) => m.id === 'jbsakad'),
    [isLandlord, accessibleModules]
  );

  const matchedMenu = useMemo(
    () => resolveMenuByPath(location.pathname),
    [location.pathname]
  );
  const activeSection = matchedMenu?.id ?? 'overview';

  const akadModule = useMemo(
    () => ERP_MODULES.find((m) => m.id === 'jbsakad') || ERP_MODULES[1],
    []
  );

  // Sinkronkan initialViewId apabila dikirim via navigasi pintasan
  useEffect(() => {
    const locState = location.state as DashboardLocationState | null;
    if (locState?.initialViewId) {
      setInitialModuleViewId(locState.initialViewId);
      setActiveAkademikViewId(locState.initialViewId);
    }
    if (locState?.initialTab) {
      setActiveAkademikTab(locState.initialTab);
    }
  }, [location.pathname, location.state]);

  // Buka otomatis pembaca buku digital apabila pengguna login dari landing page
  useEffect(() => {
    const locState = location.state as DashboardLocationState | null;
    if (!locState?.pendingDigitalBook || !user) {
      return;
    }

    setAutoReadBook(locState.pendingDigitalBook);

    if (Number(user.tingkat) === RoleTingkat.SISWA) {
      navigate('/siswa/pustaka', { replace: true, state: null });
    } else if (accessibleModules.some((mod) => mod.id === 'jbsperpus')) {
      navigate('/perpustakaan', { replace: true, state: null });
    } else {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate, user, accessibleModules]);

  const selectedModule = useMemo(
    () =>
      !isStudentOrApplicant &&
      activeSection !== 'mobile-view' &&
      activeSection !== 'overview' &&
      activeSection !== 'akademik'
        ? accessibleModules.find((mod) => mod.id === activeSection) ?? null
        : null,
    [isStudentOrApplicant, accessibleModules, activeSection]
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSelectSection = (sectionId: string, viewId?: string) => {
    const targetPath = resolveSectionPath(sectionId);
    setInitialModuleViewId(viewId);
    navigate(targetPath, {
      state: viewId ? { initialViewId: viewId } : null,
    });
  };

  // Handler Alur Tiga Klik (3x Klik)
  // Klik 1: Header Main Menu
  const handleSelectAkademikTab = (tab: JibasAkademikTabKey) => {
    setActiveAkademikTab(tab);
    setActiveAkademikViewId(null);
    setActiveItemTitle('');
    if (location.pathname !== '/dashboard' && location.pathname !== '/akademik') {
      navigate('/dashboard');
    }
  };

  // Klik 3: Klik link di dalam Submain -> Buka Halaman (Page)
  const handleSelectSubmainView = (
    viewId: string,
    submainKey: JibasAkademikTabKey,
    label: string
  ) => {
    setActiveAkademikTab(submainKey);
    setActiveAkademikViewId(viewId);
    setActiveItemTitle(label);
  };

  // Handler klik kartu rekapitulasi di Beranda Home (Screenshot 1)
  const handleOverviewSelectModule = (moduleId: string, viewId?: string) => {
    if (moduleId === 'jbsakad') {
      if (viewId === 'alumni') {
        setActiveAkademikTab('reposisi');
        setActiveAkademikViewId('alumni');
        setActiveItemTitle('Daftar Alumni');
      } else if (viewId === 'guru') {
        setActiveAkademikTab('guru-pelajaran');
        setActiveAkademikViewId('guru');
        setActiveItemTitle('Guru');
      } else if (viewId === 'kelas') {
        setActiveAkademikTab('referensi');
        setActiveAkademikViewId('kelas');
        setActiveItemTitle('Kelas');
      } else if (viewId === 'rapor') {
        setActiveAkademikTab('penilaian');
        setActiveAkademikViewId('rapor');
        setActiveItemTitle('Rapor Siswa');
      } else if (viewId === 'presensiharian') {
        setActiveAkademikTab('presensi');
        setActiveAkademikViewId('presensiharian');
        setActiveItemTitle('Pendataan Presensi Harian');
      } else {
        setActiveAkademikTab('siswa');
        setActiveAkademikViewId('siswa-aktif');
        setActiveItemTitle('Pendataan Siswa');
      }
    } else {
      handleSelectSection(moduleId, viewId);
    }
  };

  if (!user) {
    return null;
  }

  const currentTabConfig = JIBAS_SUBMAIN_CONFIGS[activeAkademikTab];
  const isAkademikWorkspace =
    !selectedModule &&
    activeSection !== 'mobile-view' &&
    !isStudentOrApplicant;

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans w-full">
      {/* Header Utama JIBAS AKADEMIK Otentik (Persis Screenshot 1 s/d 10) */}
      <FriendlyHeader
        onLogout={handleLogout}
        activeAkademikTab={activeAkademikTab}
        onSelectAkademikTab={handleSelectAkademikTab}
      />

      {/* Konten Utama */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <RequireAuth menu={matchedMenu}>
          {activeSection === 'mobile-view' ? (
            <MobileViewWorkspace
              user={user}
              onInspectEntity={(ent) => setInspectedEntity(ent)}
              onTriggerMutation={(action, initialValues) =>
                setActiveMutation({ action, initialValues })
              }
              onOpenDesktopModule={handleSelectSection}
              refreshSignal={refreshSignal}
            />
          ) : isStudentOrApplicant ? (
            <StudentPortalWorkspace
              user={user}
              activeSection={activeSection}
              onSelectSection={handleSelectSection}
              onInspectEntity={(ent) => setInspectedEntity(ent)}
              onTriggerMutation={(action, initialValues) =>
                setActiveMutation({ action, initialValues })
              }
              refreshSignal={refreshSignal}
            />
          ) : selectedModule ? (
            /* Modul Lainnya (Keuangan, SDM, Umum, Perpustakaan, Pengguna) */
            <ModuleWorkspace
              module={selectedModule}
              initialViewId={initialModuleViewId}
              isLandlord={isLandlord}
              onInspectEntity={(ent) => setInspectedEntity(ent)}
              onTriggerMutation={(action, initialValues) =>
                setActiveMutation({ action, initialValues })
              }
              onMutated={() => setRefreshSignal((n) => n + 1)}
              refreshSignal={refreshSignal}
            />
          ) : isAkademikWorkspace ? (
            /* Alur 3x Klik JIBAS AKADEMIK */
            <div>
              {/* KLIK 1: Beranda Home (Screenshot 1) */}
              {activeAkademikTab === 'home' && !activeAkademikViewId && (
                <ExecutiveOverview
                  user={user}
                  accessibleModules={accessibleModules}
                  onSelectModule={handleOverviewSelectModule}
                  onInspectEntity={(ent) => setInspectedEntity(ent)}
                  onTriggerMutation={(action, initialValues) =>
                    setActiveMutation({ action, initialValues })
                  }
                  refreshSignal={refreshSignal}
                />
              )}

              {/* KLIK 2: Sub-Main Menu Kategori (Screenshot 2 s/d 10) */}
              {activeAkademikTab !== 'home' && !activeAkademikViewId && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-10 shadow-xs">
                  {!hasAkadAccess ? (
                    <div className="text-center py-8 space-y-4 max-w-md mx-auto">
                      <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <Lock className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">
                        Akses Modul Akademik Terbatas
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Akun Anda tidak memiliki hak akses untuk menu Akademik (SIMAKA). Silakan pilih modul yang telah ditugaskan kepada Anda.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveAkademikTab('home')}
                        >
                          Kembali ke Beranda
                        </Button>
                        {accessibleModules.map((mod) => (
                          <Button
                            key={mod.id}
                            type="button"
                            size="sm"
                            className="bg-[#1565d8] hover:bg-[#1053b5] text-white"
                            onClick={() => handleSelectSection(mod.id)}
                          >
                            Buka {mod.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <JibasAkademikSubmain
                      activeTab={activeAkademikTab}
                      onSelectView={handleSelectSubmainView}
                      onNavigatePath={(path) => navigate(path)}
                    />
                  )}
                </div>
              )}

              {/* KLIK 3: Tampilan Halaman (Page View) Lengkap dengan Navigasi Balik */}
              {activeAkademikViewId && (
                <div className="space-y-4">
                  {/* Breadcrumb & Tombol Balik ke Sub-Main */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAkademikTab('home');
                          setActiveAkademikViewId(null);
                        }}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
                        title="Kembali ke Beranda"
                      >
                        <Home className="h-3.5 w-3.5" />
                        <span>Home</span>
                      </button>
                      <span className="text-slate-400">/</span>
                      <button
                        type="button"
                        onClick={() => setActiveAkademikViewId(null)}
                        className="text-slate-500 hover:text-slate-900 font-medium cursor-pointer uppercase"
                        title={`Kembali ke Menu Submain ${currentTabConfig?.headerTitle || activeAkademikTab}`}
                      >
                        {currentTabConfig?.headerTitle || activeAkademikTab}
                      </button>
                      <span className="text-slate-400">/</span>
                      <span className="font-bold text-slate-900 truncate">
                        {activeItemTitle || activeAkademikViewId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveAkademikViewId(null)}
                        className="h-7 text-xs gap-1.5 cursor-pointer bg-white"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>
                          Kembali ke Submain{' '}
                          {currentTabConfig?.headerTitle || 'Akademik'}
                        </span>
                      </Button>
                    </div>
                  </div>

                  {/* Render Workspace Halaman Aktif Tanpa Header Modul Ganda */}
                  <ModuleWorkspace
                    module={akadModule}
                    initialViewId={activeAkademikViewId}
                    isLandlord={isLandlord}
                    hideHeaderBanner={true}
                    onInspectEntity={(ent) => setInspectedEntity(ent)}
                    onTriggerMutation={(action, initialValues) =>
                      setActiveMutation({ action, initialValues })
                    }
                    onMutated={() => setRefreshSignal((n) => n + 1)}
                    refreshSignal={refreshSignal}
                  />
                </div>
              )}
            </div>
          ) : null}
        </RequireAuth>
      </main>

      {/* Footer Otentik JIBAS Sesuai Gambar */}
      <footer className="w-full bg-[#f8f9fa] border-t border-slate-200 py-2 px-4 text-center text-xs font-mono text-slate-500 tracking-tight">
        Basis data: 10.147.18.31:3434 &nbsp;&nbsp;&nbsp;&nbsp; Versi: AKAD-36.0.1321 - 07.OKT.2026
      </footer>

      {/* Panel Slide-Over Detail Rekaman / Profil Lintas Modul / JSON */}
      <EntityDetailSheet
        entity={inspectedEntity}
        canManageHakAkses={isLandlord}
        onClose={() => setInspectedEntity(null)}
        onMutated={() => setRefreshSignal((n) => n + 1)}
      />

      {/* Modal Eksekusi Form POST / PUT / DELETE */}
      <EndpointFormModal
        action={activeMutation?.action ?? null}
        initialValues={activeMutation?.initialValues}
        onClose={() => setActiveMutation(null)}
        onSuccess={() => setRefreshSignal((n) => n + 1)}
      />

      {/* Modal Pembaca Buku Digital Otomatis Pasca-Login dari Landing Page */}
      <DigitalBookReaderModal
        book={autoReadBook}
        studentNis={
          Number(user.tingkat) === RoleTingkat.SISWA
            ? String(user.username || '').trim()
            : undefined
        }
        onClose={() => setAutoReadBook(null)}
        onReadLogged={() => setRefreshSignal((n) => n + 1)}
      />
    </div>
  );
}
