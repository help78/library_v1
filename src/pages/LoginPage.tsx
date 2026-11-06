import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { authService } from '../services/auth.service';
import {
  API_URL_CHANGED_EVENT,
  extractApiErrorMessage,
  getActiveApiBaseUrl,
  isUsingCustomApiUrl,
} from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSchoolIdentity } from '../hooks/useSchoolIdentity';
import {
  useDigitalBooks,
  type DigitalBookPreview,
} from '../hooks/useDigitalBooks';
import type { LoginRoleMode } from '../types/auth';
import { DigitalBookCoverPreview } from '../components/erp/DigitalBookCoverPreview';
import { ApiEndpointSettingsModal } from '../components/erp/ApiEndpointSettingsModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

interface RoleFormConfig {
  mode: LoginRoleMode;
  tabLabel: string;
  roleTitle: string;
  roleDescription: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierEmptyError: string;
  secretLabel: string;
  secretPlaceholder: string;
  secretEmptyError: string;
}

const LOGIN_ROLE_CONFIGS: Record<LoginRoleMode, RoleFormConfig> = {
  nip: {
    mode: 'nip',
    tabLabel: 'NIP',
    roleTitle: 'Pegawai, Guru & Administrator',
    roleDescription:
      'Masuk menggunakan NIP pegawai atau akun administrator untuk mengelola modul sesuai hak akses.',
    identifierLabel: 'NIP / Username',
    identifierPlaceholder: 'Masukkan NIP pegawai atau username admin',
    identifierEmptyError: 'NIP atau Username wajib diisi.',
    secretLabel: 'Password',
    secretPlaceholder: 'Masukkan password akun pegawai',
    secretEmptyError: 'Password wajib diisi.',
  },
  nis: {
    mode: 'nis',
    tabLabel: 'NIS',
    roleTitle: 'Portal Mandiri Siswa',
    roleDescription:
      'Masuk menggunakan Nomor Induk Siswa (NIS) untuk melihat jadwal, nilai, presensi, tagihan, e-book, dan kartu QR.',
    identifierLabel: 'Nomor Induk Siswa (NIS)',
    identifierPlaceholder: 'Contoh: 1779',
    identifierEmptyError: 'Nomor Induk Siswa (NIS) wajib diisi.',
    secretLabel: 'PIN / Password Siswa',
    secretPlaceholder: 'Masukkan PIN siswa',
    secretEmptyError: 'PIN siswa wajib diisi.',
  },
  nopendaftaran: {
    mode: 'nopendaftaran',
    tabLabel: 'NO PENDAFTARAN',
    roleTitle: 'Portal Calon Siswa (PPDB)',
    roleDescription:
      'Masuk menggunakan Nomor Pendaftaran PPDB untuk memantau rincian biaya masuk, kalender akademik, dan kartu peserta.',
    identifierLabel: 'No. Pendaftaran (PPDB)',
    identifierPlaceholder: 'Contoh: ppdb230070',
    identifierEmptyError: 'Nomor Pendaftaran calon siswa wajib diisi.',
    secretLabel: 'PIN Calon Siswa',
    secretPlaceholder: 'Masukkan PIN pendaftaran PPDB',
    secretEmptyError: 'PIN calon siswa wajib diisi.',
  },
};

const ECOSYSTEM_CAPABILITIES = [
  {
    index: '01.',
    title: 'Akademik, Jadwal & Presensi Real-Time',
    description:
      'Pemantauan kelas, jadwal pelajaran, rekap presensi harian maupun per mata pelajaran, serta histori nilai ujian.',
  },
  {
    index: '02.',
    title: 'Administrasi Keuangan & Konfirmasi Tagihan',
    description:
      'Transparansi kewajiban pembayaran siswa aktif maupun calon siswa PPDB lengkap dengan konfirmasi pembayaran daring.',
  },
  {
    index: '03.',
    title: 'Perpustakaan Cetak & Pembaca E-Book Digital',
    description:
      'Katalog pustaka induk, ketersediaan eksemplar di rak, sirkulasi peminjaman, serta pembaca e-book terintegrasi log baca.',
  },
  {
    index: '04.',
    title: 'Kartu Identitas QR & Modul Mobile View',
    description:
      'Kartu identitas digital berstandar QR Code siap cetak serta antarmuka Mobile View yang nyaman dioperasikan satu tangan.',
  },
];

function SchoolLogoMark({
  logoSrc,
  schoolName,
  size = 'lg',
}: {
  logoSrc: string | null;
  schoolName: string;
  size?: 'sm' | 'lg';
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoSrc]);

  const boxClass =
    size === 'lg'
      ? 'h-20 w-20 sm:h-24 sm:w-24 rounded-2xl p-2'
      : 'h-12 w-12 rounded-xl p-1.5';

  if (logoSrc && !imgFailed) {
    return (
      <div
        className={`${boxClass} bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden`}
      >
        <img
          src={logoSrc}
          alt={`Logo ${schoolName}`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${boxClass} bg-slate-900 text-white flex items-center justify-center shrink-0`}
    >
      <GraduationCap
        className={size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'}
        aria-hidden="true"
      />
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const { primary: school } = useSchoolIdentity();
  const {
    books: digitalBooks,
    loading: booksLoading,
    error: booksError,
    reload: reloadBooks,
  } = useDigitalBooks();

  const loginCardRef = useRef<HTMLDivElement>(null);
  const identifierInputRef = useRef<HTMLInputElement>(null);

  const [roleMode, setRoleMode] = useState<LoginRoleMode>('nip');
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    secret?: string;
  }>({});

  // State Katalog Buku Digital & Wajib Login
  const [bookSearch, setBookSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [pendingBook, setPendingBook] = useState<DigitalBookPreview | null>(
    null
  );
  const [previewModalBook, setPreviewModalBook] =
    useState<DigitalBookPreview | null>(null);

  // State Pengaturan Dinamis Endpoint REST API (Ikon Gir di Pojok Atas)
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [activeApiUrl, setActiveApiUrl] = useState<string>(() =>
    getActiveApiBaseUrl()
  );
  const [hasCustomApiUrl, setHasCustomApiUrl] = useState<boolean>(() =>
    isUsingCustomApiUrl()
  );

  useEffect(() => {
    const syncApiState = () => {
      setActiveApiUrl(getActiveApiBaseUrl());
      setHasCustomApiUrl(isUsingCustomApiUrl());
      setErrorMessage(null);
    };
    window.addEventListener(API_URL_CHANGED_EVENT, syncApiState);
    return () =>
      window.removeEventListener(API_URL_CHANGED_EVENT, syncApiState);
  }, []);

  const activeConfig = LOGIN_ROLE_CONFIGS[roleMode];
  const locationState = location.state as LocationState | null;
  const redirectTarget = locationState?.from?.pathname || '/dashboard';

  const bookCategories = useMemo(() => {
    const unique = new Set<string>();
    for (const book of digitalBooks) {
      if (book.katalog) {
        unique.add(book.katalog);
      }
    }
    return Array.from(unique);
  }, [digitalBooks]);

  const filteredBooks = useMemo(() => {
    const query = bookSearch.trim().toLowerCase();
    return digitalBooks.filter((book) => {
      if (selectedCategory !== 'ALL' && book.katalog !== selectedCategory) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        book.judul.toLowerCase().includes(query) ||
        book.penulis.toLowerCase().includes(query) ||
        book.penerbit.toLowerCase().includes(query) ||
        book.katalog.toLowerCase().includes(query)
      );
    });
  }, [digitalBooks, bookSearch, selectedCategory]);

  const handleSelectRole = (nextMode: LoginRoleMode) => {
    setRoleMode(nextMode);
    setErrorMessage(null);
    setFieldErrors({});
  };

  const focusLoginForm = () => {
    loginCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    window.setTimeout(() => {
      identifierInputRef.current?.focus();
    }, 180);
  };

  const handleRequireLoginForBook = (book: DigitalBookPreview) => {
    setPreviewModalBook(null);
    setPendingBook(book);
    setErrorMessage(null);
    if (!identifier.trim() && !secret) {
      setRoleMode('nis');
    }
    focusLoginForm();
  };

  const validateForm = (): boolean => {
    const errors: { identifier?: string; secret?: string } = {};

    if (!identifier.trim()) {
      errors.identifier = activeConfig.identifierEmptyError;
    }

    if (!secret) {
      errors.secret = activeConfig.secretEmptyError;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const userData = await authService.login({
        roleMode,
        identifier: identifier.trim(),
        secret,
      });

      login(userData);
      navigate(redirectTarget, {
        replace: true,
        state: pendingBook
          ? { pendingDigitalBook: pendingBook.rawRecord }
          : undefined,
      });
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zona (Wordmark - Nav Links - 1 Primary Action) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#beranda"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate max-w-[220px] sm:max-w-none"
          >
            {school.nama}
          </a>

          <nav
            aria-label="Navigasi Halaman Utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#beranda"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Profil Sekolah
            </a>
            <a
              href="#buku-digital"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Buku Digital
            </a>
            <a
              href="#layanan"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Layanan Digital
            </a>
            <a
              href="#portal-login"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Portal Login
            </a>
            <a
              href="#kontak"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak Resmi
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="default"
              onClick={focusLoginForm}
              className="whitespace-nowrap shrink-0"
            >
              Masuk Portal
            </Button>
            <button
              type="button"
              onClick={() => setIsApiSettingsOpen(true)}
              aria-label="Pengaturan Endpoint REST API"
              title={
                hasCustomApiUrl
                  ? `Endpoint Kustom Aktif: ${activeApiUrl}`
                  : 'Pengaturan Endpoint REST API'
              }
              className={`h-10 w-10 inline-flex items-center justify-center rounded-lg border transition-colors duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                hasCustomApiUrl
                  ? 'border-slate-900 bg-slate-100 text-slate-900 hover:bg-slate-200/80'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Konten Utama Landing Page */}
      <main id="beranda" className="flex-1">
        {/* Hero Split: Identitas & Logo Sekolah di Kiri + Form Login 3 Role di Kanan */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            {/* Kolom Kiri (7 Kolom): Identitas Lembaga, Logo Resmi & Kapabilitas */}
            <div className="lg:col-span-7 rounded-2xl bg-slate-900 text-slate-100 p-6 sm:p-10 lg:p-12 flex flex-col justify-between tracking-[0.01em]">
              <div>
                {/* Identitas Utama & Logo Sekolah */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <SchoolLogoMark
                    logoSrc={school.logoSrc}
                    schoolName={school.nama}
                    size="lg"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>Portal Sistem Informasi Terpadu</span>
                      {school.departemen && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Unit {school.departemen}</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
                      {school.nama}
                    </h1>
                    {school.alamat && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                        {school.alamat}
                      </p>
                    )}
                  </div>
                </div>

                {/* Proposisi Utama */}
                <div className="mt-8 pt-8 border-t border-slate-800 max-w-2xl">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white leading-snug [text-wrap:balance]">
                    Satu pintu layanan akademik, keuangan, perpustakaan digital, dan
                    kepegawaian bagi seluruh warga sekolah.
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                    Gunakan identitas resmi sesuai peran Anda—<strong>NIP</strong> untuk
                    Pegawai & Guru, <strong>NIS</strong> untuk Siswa Aktif, atau{' '}
                    <strong>No. Pendaftaran</strong> untuk Calon Siswa PPDB.
                  </p>
                </div>

                {/* Daftar Kapabilitas Editorial */}
                <div
                  id="layanan"
                  className="mt-8 border-t border-slate-800 divide-y divide-slate-800"
                >
                  {ECOSYSTEM_CAPABILITIES.map((cap) => (
                    <div key={cap.index} className="py-4 flex items-baseline gap-4">
                      <span className="font-mono text-xs font-medium text-slate-400 tabular-nums shrink-0">
                        {cap.index}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {cap.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                          {cap.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informasi Kontak Singkat Lembaga */}
              <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
                {school.telepon && (
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    <Phone
                      className="h-3.5 w-3.5 text-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{school.telepon}</span>
                  </span>
                )}
                {school.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail
                      className="h-3.5 w-3.5 text-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{school.email}</span>
                  </span>
                )}
                {school.situs && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe
                      className="h-3.5 w-3.5 text-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{school.situs}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Kolom Kanan (5 Kolom): Form Login 3 Role (NIP / NIS / NO PENDAFTARAN) */}
            <div
              id="portal-login"
              ref={loginCardRef}
              className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between"
            >
              <div>
                {/* Header Kartu Login dengan Logo Sekolah */}
                <div className="flex items-center gap-3.5">
                  <SchoolLogoMark
                    logoSrc={school.logoSrc}
                    schoolName={school.nama}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      Masuk Portal Sekolah
                    </h2>
                    <p className="text-xs text-slate-500 truncate">
                      Pilih jenis identitas akun Anda di bawah ini
                    </p>
                  </div>
                </div>

                {/* Notifikasi Kontekstual: Membaca Buku Digital Wajib Login */}
                {pendingBook && (
                  <div
                    role="status"
                    className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-3"
                  >
                    <DigitalBookCoverPreview book={pendingBook} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                        <Lock
                          className="h-3.5 w-3.5 text-amber-700 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Membaca Buku Digital Wajib Login</span>
                      </div>
                      <p className="mt-0.5 text-xs font-bold text-slate-900 truncate">
                        {pendingBook.judul}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                        Masuk menggunakan akun Siswa, Pegawai, atau Calon Siswa untuk
                        membuka buku ini secara otomatis.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingBook(null)}
                      aria-label="Batalkan pilihan buku digital"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-amber-100 hover:text-slate-900 shrink-0 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Pemilih 3 Role Interaktif: NIP / NIS / NO PENDAFTARAN */}
                <div className="mt-6">
                  <div
                    role="tablist"
                    aria-label="Pilih Peran Login"
                    className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
                  >
                    {(Object.keys(LOGIN_ROLE_CONFIGS) as LoginRoleMode[]).map(
                      (modeKey) => {
                        const cfg = LOGIN_ROLE_CONFIGS[modeKey];
                        const isSelected = roleMode === modeKey;
                        return (
                          <button
                            key={modeKey}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => handleSelectRole(modeKey)}
                            className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-semibold tracking-tight transition-colors duration-150 whitespace-nowrap shrink-0 truncate cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                              isSelected
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {cfg.tabLabel}
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Keterangan Kontekstual Peran Terpilih */}
                  <div className="mt-4 pb-4 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-900">
                      {activeConfig.roleTitle}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {activeConfig.roleDescription}
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <Alert variant="destructive" className="mt-5">
                    <AlertCircle
                      className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <AlertTitle>Autentikasi Gagal</AlertTitle>
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </div>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-identifier">
                      {activeConfig.identifierLabel}
                    </Label>
                    <Input
                      ref={identifierInputRef}
                      id="login-identifier"
                      name="identifier"
                      type="text"
                      autoComplete="username"
                      placeholder={activeConfig.identifierPlaceholder}
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (fieldErrors.identifier) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            identifier: undefined,
                          }));
                        }
                      }}
                      disabled={isLoading}
                      className="h-11 font-mono text-sm"
                      aria-invalid={Boolean(fieldErrors.identifier)}
                      aria-describedby={
                        fieldErrors.identifier ? 'identifier-error' : undefined
                      }
                    />
                    {fieldErrors.identifier && (
                      <p
                        id="identifier-error"
                        className="text-xs font-medium text-red-600"
                      >
                        {fieldErrors.identifier}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-secret">{activeConfig.secretLabel}</Label>
                    <div className="relative">
                      <Input
                        id="login-secret"
                        name="secret"
                        type={showSecret ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder={activeConfig.secretPlaceholder}
                        value={secret}
                        onChange={(e) => {
                          setSecret(e.target.value);
                          if (fieldErrors.secret) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              secret: undefined,
                            }));
                          }
                        }}
                        disabled={isLoading}
                        className="h-11 pr-12"
                        aria-invalid={Boolean(fieldErrors.secret)}
                        aria-describedby={
                          fieldErrors.secret ? 'secret-error' : undefined
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((prev) => !prev)}
                        disabled={isLoading}
                        aria-label={
                          showSecret
                            ? 'Sembunyikan kata sandi atau PIN'
                            : 'Tampilkan kata sandi atau PIN'
                        }
                        className="absolute right-0 top-0 h-11 w-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-r-lg cursor-pointer"
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.secret && (
                      <p
                        id="secret-error"
                        className="text-xs font-medium text-red-600"
                      >
                        {fieldErrors.secret}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-11 whitespace-nowrap"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Memverifikasi Kredensial...</span>
                        </>
                      ) : pendingBook ? (
                        <>
                          <span>Masuk & Baca Buku ({activeConfig.tabLabel})</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          <span>Masuk sebagai {activeConfig.tabLabel}</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                Mendukung tampilan <strong>Desktop ERP</strong> maupun{' '}
                <strong>Mobile View</strong> otomatis sesuai perangkat dan hak akses
                akun Anda.
              </div>
            </div>
          </div>
        </section>

        {/* Etalase Publik: Daftar Buku Digital (Membaca Wajib Login) */}
        <section
          id="buku-digital"
          className="border-t border-slate-200 bg-white py-12 sm:py-16"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Perpustakaan Digital Sekolah</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {digitalBooks.length} Koleksi E-Book
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Membaca Wajib Login</span>
                  </span>
                </div>
                <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  Daftar Buku Digital
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Telusuri pratinjau koleksi buku elektronik resmi perpustakaan
                  sekolah. Pilih buku yang ingin dibaca, lalu masuk menggunakan akun
                  portal Anda untuk membuka dokumen lengkap.
                </p>
              </div>

              {/* Pencarian Judul / Penulis */}
              <div className="w-full lg:w-80 shrink-0">
                <div className="relative">
                  <Search
                    className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder="Cari judul atau penulis buku..."
                    aria-label="Cari buku digital"
                    className="pl-10 h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Filter Kategori Interaktif */}
            {bookCategories.length > 1 && (
              <div
                role="tablist"
                aria-label="Filter Kategori Buku Digital"
                className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'ALL'}
                  onClick={() => setSelectedCategory('ALL')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  Semua Koleksi ({digitalBooks.length})
                </button>
                {bookCategories.map((category, idx) => (
                  <button
                    key={`${category}-${idx}`}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {/* Status Memuat / Galat / Grid Kartu Buku Digital */}
            {booksLoading ? (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 animate-pulse"
                  >
                    <div className="aspect-[3/4] w-full rounded-xl bg-slate-200" />
                    <div className="h-3 w-2/3 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-9 w-full rounded-lg bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : booksError ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Gagal Memuat Daftar Buku Digital
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">{booksError}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsApiSettingsOpen(true)}
                    className="whitespace-nowrap shrink-0"
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pengaturan API</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => reloadBooks(true)}
                    className="whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Muat Ulang</span>
                  </Button>
                </div>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <BookOpen
                  className="h-8 w-8 text-slate-400 mx-auto"
                  aria-hidden="true"
                />
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  Tidak Ada Buku Digital yang Cocok
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  {digitalBooks.length === 0
                    ? 'Saat ini belum ada koleksi e-book digital yang ditautkan pada perpustakaan.'
                    : 'Coba ubah kata kunci pencarian atau pilih kategori koleksi lainnya.'}
                </p>
                {(bookSearch || selectedCategory !== 'ALL') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBookSearch('');
                      setSelectedCategory('ALL');
                    }}
                    className="mt-4 whitespace-nowrap"
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {filteredBooks.map((book, idx) => {
                  const isPending = pendingBook?.idpustaka === book.idpustaka;
                  return (
                    <article
                      key={`${book.id}-${idx}`}
                      className={`group rounded-2xl border bg-white p-3.5 sm:p-4 flex flex-col justify-between transition-colors duration-150 ${
                        isPending
                          ? 'border-slate-900 ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Pratinjau Gambar Sampul / Ikon Buku Interaktif */}
                        <button
                          type="button"
                          onClick={() => setPreviewModalBook(book)}
                          aria-label={`Lihat pratinjau buku ${book.judul}`}
                          className="relative block w-full text-left rounded-xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
                        >
                          <DigitalBookCoverPreview book={book} size="card" />

                          {/* Scrim Kontras Terukur saat Hover / Fokus */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex items-end p-3 z-20">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                              <Lock
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Pratinjau & Info Akses</span>
                            </span>
                          </div>
                        </button>

                        {/* Metadata Teks Bersih (Tanpa Pill) */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono font-medium text-slate-700">
                            {book.tipe}
                          </span>
                          {book.tahun && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {book.tahun}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[130px]">
                            {book.katalog}
                          </span>
                        </div>

                        {/* Judul & Penulis */}
                        <h3 className="mt-1 text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                          <button
                            type="button"
                            onClick={() => setPreviewModalBook(book)}
                            className="text-left hover:underline underline-offset-2 cursor-pointer"
                          >
                            {book.judul}
                          </button>
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 truncate">
                          {book.penulis}
                        </p>
                      </div>

                      {/* Tombol Aksi Wajib Login */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <Button
                          type="button"
                          variant={isPending ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRequireLoginForBook(book)}
                          className="w-full min-h-[40px] whitespace-nowrap shrink-0"
                        >
                          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {isPending
                              ? 'Silakan Login di Atas'
                              : 'Login untuk Baca'}
                          </span>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Dialog Pratinjau Sampul Buku & Gerbang Wajib Login */}
      {previewModalBook && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewModalBook(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-gate-modal-title"
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <BookOpen className="h-4 w-4 text-slate-700" aria-hidden="true" />
                <span>Pratinjau Koleksi Buku Digital</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalBook(null)}
                aria-label="Tutup dialog pratinjau buku"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
              <div className="sm:col-span-5 max-w-[200px] mx-auto sm:max-w-none w-full">
                <DigitalBookCoverPreview book={previewModalBook} size="modal" />
              </div>

              <div className="sm:col-span-7 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-mono font-medium text-slate-700">
                      Format {previewModalBook.tipe}
                    </span>
                    {previewModalBook.tahun && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Terbit {previewModalBook.tahun}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{previewModalBook.katalog}</span>
                  </div>

                  <h3
                    id="book-gate-modal-title"
                    className="mt-2 text-lg font-bold tracking-tight text-slate-900 leading-snug"
                  >
                    {previewModalBook.judul}
                  </h3>

                  <dl className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Penulis</dt>
                      <dd className="font-medium text-slate-900 text-right">
                        {previewModalBook.penulis}
                      </dd>
                    </div>
                    {previewModalBook.penerbit && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Penerbit</dt>
                        <dd className="font-medium text-slate-900 text-right">
                          {previewModalBook.penerbit}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">ID Pustaka</dt>
                      <dd className="font-mono tabular-nums font-medium text-slate-900">
                        #{previewModalBook.idpustaka}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                    <Lock
                      className="h-3.5 w-3.5 text-amber-700 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Akses Membaca Wajib Login</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                    Untuk membuka halaman lengkap e-book dan mencatat log aktivitas
                    literasi, silakan masuk menggunakan akun Siswa (NIS), Pegawai
                    (NIP), atau Calon Siswa.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <Button
                    type="button"
                    onClick={() => handleRequireLoginForBook(previewModalBook)}
                    className="flex-1 min-h-[42px] whitespace-nowrap"
                  >
                    <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Masuk untuk Membaca</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreviewModalBook(null)}
                    className="min-h-[42px] whitespace-nowrap"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Pengaturan Dinamis Endpoint REST API */}
      <ApiEndpointSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
      />

      {/* Footer Tenang & Informasi Kontak Resmi */}
      <footer
        id="kontak"
        className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{school.nama}</span>
            <span aria-hidden="true">·</span>
            <span>Sistem Informasi Manajemen Sekolah Terpadu</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {school.telepon && (
              <span className="font-mono tabular-nums">{school.telepon}</span>
            )}
            {school.situs && <span>{school.situs}</span>}
          </div>
        </div>
      </footer>
    </div>
  );
}
