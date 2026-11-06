import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  GraduationCap,
  Home,
  LogOut,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import {
  extractUserModuleCodes,
  isLandlordUser,
  resolvePermittedErpModules,
} from '../../lib/rbac';
import { ERP_MODULES } from '../../data/erpModules';
import { RoleTingkat } from '../../types/auth';
import type { JibasAkademikTabKey } from '../erp/JibasAkademikSubmain';

export interface FriendlyHeaderProps {
  onLogout: () => void;
  activeAkademikTab?: JibasAkademikTabKey;
  onSelectAkademikTab?: (tab: JibasAkademikTabKey) => void;
}

export function JibasAkademikLogo() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Authentic JIBAS Green Folded Leaf/Butterfly Wings Logo */}
      <svg className="w-8 h-8 shrink-0 drop-shadow-xs" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 20C14 8 7 10 6 15C5 20 12 25 20 20Z"
          fill="#388e3c"
          stroke="#1b5e20"
          strokeWidth="1.2"
        />
        <path
          d="M20 20C26 8 33 10 34 15C35 20 28 25 20 20Z"
          fill="#4caf50"
          stroke="#2e7d32"
          strokeWidth="1.2"
        />
        <path
          d="M20 20C14 32 7 30 6 25C5 20 12 18 20 20Z"
          fill="#2e7d32"
          stroke="#1b5e20"
          strokeWidth="1.2"
        />
        <path
          d="M20 20C26 32 33 30 34 25C35 20 28 18 20 20Z"
          fill="#43a047"
          stroke="#1b5e20"
          strokeWidth="1.2"
        />
        <line x1="20" y1="8" x2="20" y2="32" stroke="#1b5e20" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-bold text-emerald-800 tracking-wide uppercase leading-none">
          JIBAS
        </span>
        <span className="text-sm font-black tracking-tight text-slate-900 uppercase leading-none mt-0.5">
          AKADEMIK
        </span>
      </div>
    </div>
  );
}

// 10 Tab Standar JIBAS AKADEMIK (Khusus Admin / Guru dengan hak akses SIMAKA)
const AKADEMIK_NAV_TABS: { key: JibasAkademikTabKey; label: string; isHome?: boolean }[] = [
  { key: 'home', label: 'Home', isHome: true },
  { key: 'referensi', label: 'Referensi' },
  { key: 'psb', label: 'Penerimaan Siswa Baru' },
  { key: 'guru-pelajaran', label: 'Guru & Pelajaran' },
  { key: 'jadwal-kalender', label: 'Jadwal & Kalender' },
  { key: 'siswa', label: 'Siswa' },
  { key: 'reposisi', label: 'Reposisi Siswa' },
  { key: 'presensi', label: 'Presensi' },
  { key: 'penilaian', label: 'Penilaian' },
  { key: 'pengaturan', label: 'Pengaturan' },
];

export function FriendlyHeader({
  onLogout,
  activeAkademikTab = 'home',
  onSelectAkademikTab,
}: FriendlyHeaderProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showErpMenu, setShowErpMenu] = useState(false);

  const tingkat = Number(user?.tingkat ?? 0);
  const isLandlord = isLandlordUser(user);
  const isSiswa = tingkat === RoleTingkat.SISWA;
  const isCalon = tingkat === RoleTingkat.CALON_SISWA;
  const isPegawai = tingkat === RoleTingkat.PEGAWAI;

  const accessibleModules = useMemo(
    () => resolvePermittedErpModules(user, ERP_MODULES),
    [user]
  );

  const ownedModuleCodes = useMemo(
    () => extractUserModuleCodes(user),
    [user]
  );

  // Cek apakah Pegawai memiliki hak akses modul Akademik (SIMAKA/INFOGURU/CBE)
  const hasAkadAccess = useMemo(() => {
    if (isLandlord) return true;
    return (
      ownedModuleCodes.has('SIMAKA') ||
      ownedModuleCodes.has('AKADEMIK') ||
      ownedModuleCodes.has('INFOGURU') ||
      ownedModuleCodes.has('CBE') ||
      ownedModuleCodes.has('JBSAKAD') ||
      ownedModuleCodes.has('EMA') ||
      ownedModuleCodes.has('SUPERADMIN')
    );
  }, [isLandlord, ownedModuleCodes]);

  const isAkademikRoute =
    location.pathname === '/dashboard' ||
    location.pathname === '/akademik' ||
    location.pathname === '/';

  const handleTabClick = (key: JibasAkademikTabKey) => {
    if (onSelectAkademikTab) {
      onSelectAkademikTab(key);
    }
    if (!isAkademikRoute) {
      navigate('/dashboard');
    }
  };

  // Navigasi Mandiri Khusus Siswa (Tingkat 3 - Akademik, Keuangan, Perpustakaan)
  const siswaNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Home },
    { label: 'Biodata', path: '/siswa/biodata', icon: User },
    { label: 'Jadwal', path: '/siswa/jadwal', icon: Calendar },
    { label: 'Rapor & Nilai', path: '/siswa/nilai', icon: GraduationCap },
    { label: 'Presensi', path: '/siswa/presensi', icon: User },
    { label: 'Tagihan Keuangan', path: '/siswa/tagihan', icon: Wallet },
    { label: 'Pustaka Digital', path: '/siswa/pustaka', icon: BookOpen },
  ];

  // Navigasi Mandiri Khusus Calon Siswa (Tingkat 4 - PPDB Akademik & Keuangan)
  const calonNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Home },
    { label: 'Tagihan PPDB', path: '/calon/tagihan', icon: Wallet },
    { label: 'Kalender Akademik', path: '/calon/kalender', icon: Calendar },
    { label: 'Profil Sekolah', path: '/calon/identitas', icon: Building2 },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs">
      <div className="w-full max-w-[1500px] mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">
          {/* Logo & Identitas JIBAS */}
          <Link
            to="/dashboard"
            onClick={() => handleTabClick('home')}
            className="shrink-0 flex items-center pr-2 focus-visible:outline-none"
            title="Kembali ke Beranda"
          >
            <JibasAkademikLogo />
          </Link>

          {/* BARIS MENU NAVIGASI SESUAI ROLE & HAK AKSES */}
          <nav
            aria-label="Menu Utama Sistem"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 lg:gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-full pt-1"
          >
            {/* 1. ROLE SISWA (TINGKAT 3): HANYA AKADEMIK & KEUANGAN & PUSTAKA */}
            {isSiswa ? (
              <div className="flex items-center gap-1 sm:gap-2">
                {siswaNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`h-11 flex items-center gap-1.5 px-2.5 sm:px-3 text-xs whitespace-nowrap transition-colors rounded-md ${
                        isActive
                          ? 'text-slate-950 font-bold bg-slate-100 border-b-2 border-[#1565d8]'
                          : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-600" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : isCalon ? (
              /* 2. ROLE CALON SISWA (TINGKAT 4): HANYA PPDB AKADEMIK & KEUANGAN */
              <div className="flex items-center gap-1 sm:gap-2">
                {calonNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`h-11 flex items-center gap-1.5 px-2.5 sm:px-3 text-xs whitespace-nowrap transition-colors rounded-md ${
                        isActive
                          ? 'text-slate-950 font-bold bg-slate-100 border-b-2 border-[#1565d8]'
                          : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-600" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              /* 3. ROLE LANDLORD & PEGAWAI (GURU SESUAI HAK AKSES) */
              <>
                {/* Jika Landlord (Bypass All) atau Guru memiliki Hak Akses SIMAKA */}
                {hasAkadAccess ? (
                  AKADEMIK_NAV_TABS.map((tab) => {
                    const isActive = isAkademikRoute && activeAkademikTab === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabClick(tab.key)}
                        className={`h-full flex items-center justify-center px-2 sm:px-2.5 text-xs whitespace-nowrap transition-colors cursor-pointer relative ${
                          isActive
                            ? 'text-slate-950 font-bold border-t-[3px] border-fuchsia-600'
                            : 'text-slate-600 hover:text-slate-900 font-medium hover:border-t-2 hover:border-slate-300'
                        }`}
                        title={tab.label}
                      >
                        {tab.isHome ? (
                          <Home className="h-4 w-4 shrink-0 text-slate-800" aria-label="Home" />
                        ) : (
                          <span>{tab.label}</span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  /* Jika Guru TIDAK memiliki modul Akademik, tampilkan modul yang diizinkan langsung di navbar */
                  <div className="flex items-center gap-2">
                    <Link
                      to="/dashboard"
                      className={`h-11 flex items-center gap-1.5 px-3 text-xs whitespace-nowrap transition-colors rounded-md ${
                        location.pathname === '/dashboard'
                          ? 'font-bold text-slate-900 bg-slate-100'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Home className="h-4 w-4" />
                      <span>Beranda</span>
                    </Link>

                    {accessibleModules.map((mod) => (
                      <Link
                        key={mod.id}
                        to={`/${mod.id.replace('jbs', '')}`}
                        className={`h-11 flex items-center gap-1.5 px-3 text-xs whitespace-nowrap transition-colors rounded-md ${
                          location.pathname.startsWith(`/${mod.id.replace('jbs', '')}`)
                            ? 'font-bold text-slate-900 bg-slate-100 border-b-2 border-[#1565d8]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{mod.shortName || mod.name}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Dropdown Modul ERP: Landlord melihat semua, Guru hanya melihat modul sesuai hak akses */}
                {(isLandlord || accessibleModules.length > 0) && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowErpMenu((v) => !v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                      title="Pindah ke Modul ERP sesuai hak akses"
                    >
                      <span>Modul ERP</span>
                      <ChevronDown className="h-3 w-3 text-slate-500" />
                    </button>

                    {showErpMenu && (
                      <div
                        className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                        onMouseLeave={() => setShowErpMenu(false)}
                      >
                        <div className="px-3 py-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                          {isLandlord ? 'Semua Modul (Landlord)' : 'Modul Sesuai Hak Akses'}
                        </div>

                        {/* Keuangan: Landlord atau Pegawai dengan akses KEUANGAN */}
                        {(isLandlord || accessibleModules.some((m) => m.id === 'jbsfina')) && (
                          <Link
                            to="/keuangan"
                            onClick={() => setShowErpMenu(false)}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Wallet className="h-3.5 w-3.5 text-amber-600" />
                            <span>Keuangan (SIMKEU)</span>
                          </Link>
                        )}

                        {/* SDM: Landlord atau Pegawai dengan akses PERSONALIA */}
                        {(isLandlord || accessibleModules.some((m) => m.id === 'jbssdm')) && (
                          <Link
                            to="/sdm"
                            onClick={() => setShowErpMenu(false)}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Users className="h-3.5 w-3.5 text-blue-600" />
                            <span>Kepegawaian (SIMPEG)</span>
                          </Link>
                        )}

                        {/* Umum: Landlord atau Pegawai dengan akses UMUM */}
                        {(isLandlord || accessibleModules.some((m) => m.id === 'jbsumum')) && (
                          <Link
                            to="/umum"
                            onClick={() => setShowErpMenu(false)}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Sarpras & Umum (SIMSAR)</span>
                          </Link>
                        )}

                        {/* Perpustakaan: Landlord atau Pegawai dengan akses SIMTAKA */}
                        {(isLandlord || accessibleModules.some((m) => m.id === 'jbsperpus')) && (
                          <Link
                            to="/perpustakaan"
                            onClick={() => setShowErpMenu(false)}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                            <span>Perpustakaan (SIMTAKA)</span>
                          </Link>
                        )}

                        {/* Khusus Landlord: Hak Akses Pengguna */}
                        {isLandlord && (
                          <Link
                            to="/pengguna"
                            onClick={() => setShowErpMenu(false)}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-t border-slate-100 font-semibold"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Manajemen Pengguna (Landlord)</span>
                          </Link>
                        )}

                        <Link
                          to="/mobile"
                          onClick={() => setShowErpMenu(false)}
                          className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-t border-slate-100"
                        >
                          <Smartphone className="h-3.5 w-3.5 text-slate-600" />
                          <span>Tampilan Mobile</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </nav>

          {/* User Profile & Red Logout Icon (Persis Screenshot 1) */}
          <div className="flex items-center gap-2.5 shrink-0 pl-2">
            <div className="flex flex-col text-right leading-none">
              <span className="text-[11px] text-slate-500 font-normal">
                {isLandlord
                  ? 'jibas · Landlord'
                  : isSiswa
                  ? `NIS ${user?.username} · Siswa`
                  : isCalon
                  ? `No. ${user?.username} · Calon`
                  : `NIP ${user?.username} · Pegawai`}
              </span>
              <span className="text-xs font-semibold text-slate-800 mt-0.5 truncate max-w-[150px]">
                {user?.nama || 'Pengguna'}
              </span>
            </div>

            {/* Tombol Logout Merah JIBAS */}
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded text-red-700 hover:bg-red-50 hover:text-red-800 transition-colors cursor-pointer"
              title="Keluar / Logout dari Sistem"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
