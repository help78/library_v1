import { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  ImageIcon,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCircle2,
} from 'lucide-react';
import {
  apiClient,
  extractApiErrorMessage,
  getCloudFileUrl,
} from '../../lib/api';
import {
  extractResponsePayload,
  formatDateId,
  resolveImageSrc,
} from '../../lib/formatters';
import { RoleTingkat, type UserData } from '../../types/auth';
import { useCloudFolders } from '../../hooks/useCloudFolders';
import { Button } from '../ui/button';
import { UserIdentityCard } from './UserIdentityCard';

interface JibasGreetingBannerProps {
  user: UserData;
  identitasRows?: Record<string, unknown>[];
  onOpenFileSharing: () => void;
  onOpenUploadFile?: () => void;
  onOpenFullProfile?: () => void;
  onOpenHakAkses?: () => void;
}

interface QuickFileItem {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: string;
  modified_formatted?: string;
  isDir: boolean;
  type?: string;
}

function getJibasRoleSubtitle(
  user: UserData,
  liveJabatan?: string | null,
  liveBagian?: string | null
): string {
  const tingkat = Number(user.tingkat ?? 0);
  if (tingkat === RoleTingkat.LANDLORD) {
    return 'Administrator';
  }
  if (tingkat === RoleTingkat.PEGAWAI) {
    const jab = (liveJabatan || '').trim();
    const bag = (liveBagian || user.bagian || '').trim();
    if (jab && bag) return `${jab} · ${bag}`;
    if (jab) return jab;
    return bag ? `Pegawai · ${bag}` : 'Pegawai';
  }
  if (tingkat === RoleTingkat.SISWA) {
    return user.kelas ? `Siswa · Kelas ${user.kelas}` : 'Siswa';
  }
  if (tingkat === RoleTingkat.CALON_SISWA) {
    return 'Calon Siswa (PPDB)';
  }
  return `Tingkat ${tingkat}`;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function JibasGreetingBanner({
  user,
  identitasRows,
  onOpenFileSharing,
  onOpenUploadFile,
  onOpenFullProfile,
  onOpenHakAkses,
}: JibasGreetingBannerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [showQrIdentityCard, setShowQrIdentityCard] = useState(false);
  const [showQuickFilesPanel, setShowQuickFilesPanel] = useState(false);
  const [livePegawaiMeta, setLivePegawaiMeta] = useState<{
    jabatan: string | null;
    bagian: string | null;
  }>({ jabatan: null, bagian: null });

  // Dynamic Cloud Folders Hook
  const {
    folders: dynamicFolders,
    loading: loadingFolders,
    refreshFolders,
  } = useCloudFolders(['/']);

  // Quick Inline Files State
  const [quickFolderPath, setQuickFolderPath] = useState<string>('/Tugas');
  const [quickFiles, setQuickFiles] = useState<QuickFileItem[]>([]);
  const [loadingQuickFiles, setLoadingQuickFiles] = useState(false);
  const [quickUploadLoading, setQuickUploadLoading] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  // Jika folder aktif awal tidak ditemukan setelah load, sesuaikan ke folder valid pertama
  useEffect(() => {
    if (dynamicFolders.length > 1 && !dynamicFolders.includes(quickFolderPath)) {
      const fallback = dynamicFolders.find((f) => f !== '/') || '/';
      setQuickFolderPath(fallback);
    }
  }, [dynamicFolders, quickFolderPath]);

  const resolvedPhoto = resolveImageSrc(user.foto);

  useEffect(() => {
    setImgFailed(false);
  }, [user.foto]);

  // Ambil atribut "jabatan" langsung dari GET /api/jbssdm/pegawai?nip=xxxxxxx saat login sebagai Pegawai
  useEffect(() => {
    const tingkat = Number(user.tingkat ?? 0);
    const nip = String(user.username ?? '').trim();
    if (tingkat !== RoleTingkat.PEGAWAI || !nip) {
      setLivePegawaiMeta({ jabatan: null, bagian: null });
      return;
    }

    let cancelled = false;
    apiClient
      .get('/jbssdm/pegawai', { params: { nip } })
      .then((res) => {
        if (cancelled) return;
        const parsed = extractResponsePayload(res.data);
        const row = parsed.rows[0] || parsed.singleObject;
        if (row) {
          setLivePegawaiMeta({
            jabatan: row.jabatan ? String(row.jabatan) : null,
            bagian: row.bagian ? String(row.bagian) : null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLivePegawaiMeta({ jabatan: null, bagian: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.tingkat, user.username]);

  // Muat data berkas cepat jika panel cepat dibuka
  const loadQuickFiles = async (folder: string) => {
    setLoadingQuickFiles(true);
    setQuickFeedback(null);
    try {
      const res = await apiClient.get('/files/list', {
        params: { path: folder },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setQuickFiles(res.data.data as QuickFileItem[]);
      } else {
        setQuickFiles([]);
      }
    } catch (err) {
      setQuickFeedback(extractApiErrorMessage(err, '/api/files/list'));
      setQuickFiles([]);
    } finally {
      setLoadingQuickFiles(false);
    }
  };

  useEffect(() => {
    if (showQuickFilesPanel) {
      loadQuickFiles(quickFolderPath);
    }
  }, [showQuickFilesPanel, quickFolderPath]);

  // Quick Direct Upload dari Banner
  const handleQuickUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQuickUploadLoading(true);
    setQuickFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', quickFolderPath);

      const res = await apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const resData = res.data?.data;
      setQuickFeedback(
        `Sukses mengunggah "${file.name}"! Link share siap digunakan.`
      );
      loadQuickFiles(quickFolderPath);
      refreshFolders();
    } catch (err) {
      setQuickFeedback(extractApiErrorMessage(err, '/api/files/upload'));
    } finally {
      setQuickUploadLoading(false);
      e.target.value = '';
    }
  };

  // Quick Delete Berkas / Direktori (tanpa window.confirm yang diblokir iframe)
  const handleQuickDelete = async (filePath: string) => {
    setDeletingPath(filePath);
    setQuickFeedback(null);
    try {
      await apiClient.delete('/files/delete', {
        params: { path: filePath },
      });
      setQuickFeedback(`Berkas atau folder "${filePath}" berhasil dihapus.`);
      setConfirmDeletePath(null);
      await loadQuickFiles(quickFolderPath);
      refreshFolders();
    } catch (err) {
      setQuickFeedback(extractApiErrorMessage(err, '/api/files/delete'));
    } finally {
      setDeletingPath(null);
    }
  };

  const handleCopyLink = async (path: string) => {
    const directUrl = getCloudFileUrl(path);
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Ignore clipboard write restrictions
    }
  };

  const roleSubtitle = getJibasRoleSubtitle(
    user,
    livePegawaiMeta.jabatan,
    livePegawaiMeta.bagian
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Kiri: Avatar Lingkaran Berbingkai Putih + 4 Baris Greeting JIBAS */}
        <div className="flex items-center gap-5 sm:gap-6 min-w-0">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-white bg-white shadow-md ring-1 ring-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
            {resolvedPhoto && !imgFailed ? (
              <img
                src={resolvedPhoto}
                alt={`Foto ${user.nama}`}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <svg
                viewBox="0 0 120 120"
                className="h-full w-full block"
                role="img"
                aria-label={`Avatar ${user.nama}`}
              >
                <rect width="120" height="120" fill="#ffffff" />
                <circle cx="60" cy="43" r="23" fill="#17b2d3" />
                <path
                  d="M18 114c4-24 22-37 42-37s38 13 42 37H18z"
                  fill="#17b2d3"
                />
              </svg>
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <p className="text-xs sm:text-sm text-slate-600">Selamat Datang</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight [text-wrap:balance] break-words">
              {user.nama}
            </h1>
            <p className="text-sm sm:text-base text-slate-700 font-mono tabular-nums truncate">
              {user.username}
            </p>
            <p className="text-xs sm:text-sm text-slate-500">{roleSubtitle}</p>

            {/* Aksi Kontekstual Ringkas: Kartu QR & Profil */}
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => setShowQrIdentityCard((prev) => !prev)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5 text-[#1565d8]" aria-hidden="true" />
                <span>
                  {showQrIdentityCard
                    ? 'Sembunyikan Kartu QR'
                    : 'Kartu Identitas QR'}
                </span>
              </button>

              {onOpenFullProfile && (
                <button
                  type="button"
                  onClick={onOpenFullProfile}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserCircle2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Biodata Saya</span>
                </button>
              )}

              {onOpenHakAkses && Number(user.tingkat) === RoleTingkat.LANDLORD && (
                <button
                  type="button"
                  onClick={onOpenHakAkses}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>Kelola Hak Akses</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kanan: UI Dampingan Toggle "File Sharing" / Pustaka Siswa */}
        {Number(user.tingkat) === RoleTingkat.SISWA ? (
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={onOpenFileSharing}
              className="px-5 py-2.5 rounded-xl bg-[#1565d8] hover:bg-[#1053b5] active:bg-[#0d479d] text-white text-sm font-semibold shadow-xs transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565d8]"
              title="Buka Pustaka Digital Siswa (/api/jbsperpus/)"
            >
              <BookOpen className="h-4 w-4 text-amber-300" />
              <span>Pustaka Digital</span>
            </button>
          </div>
        ) : Number(user.tingkat) === RoleTingkat.CALON_SISWA ? null : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start lg:self-center shrink-0">
            {/* Tombol Utama File Sharing + Companion Button Upload Berkas */}
            <div className="inline-flex rounded-xl shadow-md border border-[#1053b5]/30 p-1 bg-linear-to-r from-blue-50 to-indigo-50/50">
              <button
                type="button"
                onClick={onOpenFileSharing}
                className="px-6 py-2.5 rounded-lg bg-[#1565d8] hover:bg-[#1053b5] active:bg-[#0d479d] text-white text-sm font-semibold shadow-xs transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1565d8]"
              >
                <FolderOpen className="h-4 w-4" />
                <span>File Sharing</span>
              </button>

              <button
                type="button"
                onClick={onOpenUploadFile || onOpenFileSharing}
                className="px-3.5 py-2.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                title="Unggah berkas baru langsung ke Cloud Storage (/api/files/upload)"
              >
                <UploadCloud className="h-4 w-4 text-[#1565d8]" />
                <span>+ Upload</span>
              </button>
            </div>

            {/* Toggle Dampingan: Panel Cepat Berkas (Expandable Inline Strip) */}
            <button
              type="button"
              onClick={() => setShowQuickFilesPanel((prev) => !prev)}
              className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                showQuickFilesPanel
                  ? 'bg-[#1565d8] border-[#1565d8] text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Buka / Tutup panel cepat berkas Cloud Storage di bawah banner"
            >
              <span>Tampilan Cepat</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  showQuickFilesPanel ? 'rotate-180 text-white' : 'text-slate-400'
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Panel Kartu Identitas QR (Dapat Dibuka / Ditutup dari Greeting) */}
      {showQrIdentityCard && (
        <div className="pt-2 max-w-2xl">
          <UserIdentityCard
            user={user}
            identitasRows={identitasRows}
            onOpenFullProfile={onOpenFullProfile}
          />
        </div>
      )}

      {/* PANEL CEPAT BERKAS CLOUD STORAGE (DIDAMPINGKAN DENGAN TOGGLE FILE SHARING) */}
      {showQuickFilesPanel &&
        Number(user.tingkat) !== RoleTingkat.SISWA &&
        Number(user.tingkat) !== RoleTingkat.CALON_SISWA && (
        <div className="rounded-2xl border border-blue-200 bg-linear-to-b from-blue-50/70 via-white to-slate-50 p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header Panel Cepat */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-[#1565d8] text-white flex items-center justify-center shrink-0">
                <Folder className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    Panel Cepat Cloud Storage
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-medium">
                    /api/files
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Folder aktif: <span className="font-mono font-bold text-slate-700">{quickFolderPath}</span>
                </p>
              </div>
            </div>

            {/* Folder Picker Chips & Action */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {dynamicFolders.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setQuickFolderPath(dir)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors cursor-pointer ${
                    quickFolderPath === dir
                      ? 'bg-[#1565d8] text-white font-bold shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {dir === '/' ? 'Root /' : dir.replace(/^\//, '')}
                </button>
              ))}
              {!dynamicFolders.includes(quickFolderPath) && quickFolderPath && (
                <button
                  type="button"
                  onClick={() => setQuickFolderPath(quickFolderPath)}
                  className="px-2.5 py-1 rounded-md font-mono text-[11px] bg-[#1565d8] text-white font-bold shadow-2xs"
                >
                  {quickFolderPath.replace(/^\//, '')}
                </button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  refreshFolders();
                  loadQuickFiles(quickFolderPath);
                }}
                disabled={loadingQuickFiles || loadingFolders}
                className="h-7 px-2 text-xs"
                title="Segarkan daftar folder & berkas"
              >
                <RefreshCw
                  className={`h-3 w-3 ${loadingQuickFiles || loadingFolders ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          {/* Quick Feedback Alert */}
          {quickFeedback && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
              <span>{quickFeedback}</span>
              <button
                type="button"
                onClick={() => setQuickFeedback(null)}
                className="text-blue-600 hover:text-blue-900 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Body: Daftar Berkas Cepat & Dropzone Upload */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 2 Kolom: Daftar Berkas Terkini di Folder */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>Berkas Tersimpan ({quickFiles.length})</span>
                <button
                  type="button"
                  onClick={onOpenFileSharing}
                  className="text-[#1565d8] hover:underline font-semibold flex items-center gap-1 text-[11px]"
                >
                  <span>Buka Explorer Lengkap</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs">
                {loadingQuickFiles ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-[#1565d8]" />
                    Memuat berkas...
                  </div>
                ) : quickFiles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Folder {quickFolderPath} masih kosong. Silakan unggah berkas melalui form di sebelah kanan.
                  </div>
                ) : (
                  quickFiles.map((f) => (
                    <div
                      key={f.path}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                          {f.isDir ? (
                            <Folder className="h-3.5 w-3.5 text-amber-600" />
                          ) : ['PNG', 'JPG', 'JPEG', 'WEBP'].includes(
                              f.extension.toUpperCase().replace('.', '')
                            ) ? (
                            <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {f.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatBytes(f.size)} · {f.modified_formatted || '-'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!f.isDir && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(f.path)}
                              className="h-7 px-2 rounded text-[10px] border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center gap-1 cursor-pointer"
                              title="Salin Link Publik"
                            >
                              {copiedPath === f.path ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Link</span>
                                </>
                              )}
                            </button>
                            <a
                              href={getCloudFileUrl(f.path)}
                              target="_blank"
                              rel="noreferrer"
                              className="h-7 px-2 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Lihat</span>
                            </a>
                            {confirmDeletePath === f.path ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5 animate-in fade-in duration-150">
                                <span className="text-[10px] text-rose-700 font-medium px-1">
                                  Hapus?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDelete(f.path)}
                                  disabled={deletingPath === f.path}
                                  className="h-6 px-2 rounded text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
                                  title="Konfirmasi hapus berkas permanen"
                                >
                                  {deletingPath === f.path ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <span>Ya</span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePath(null)}
                                  disabled={deletingPath === f.path}
                                  className="h-6 px-1.5 rounded text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                  title="Batal"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePath(f.path)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                                title="Hapus berkas"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        {f.isDir && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQuickFolderPath(f.path)}
                              className="h-7 px-2.5 rounded text-[10px] bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium cursor-pointer"
                            >
                              Masuk
                            </button>
                            {confirmDeletePath === f.path ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5 animate-in fade-in duration-150">
                                <span className="text-[10px] text-rose-700 font-medium px-1">
                                  Hapus?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickDelete(f.path)}
                                  disabled={deletingPath === f.path}
                                  className="h-6 px-2 rounded text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
                                  title="Konfirmasi hapus folder permanen"
                                >
                                  {deletingPath === f.path ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <span>Ya</span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePath(null)}
                                  disabled={deletingPath === f.path}
                                  className="h-6 px-1.5 rounded text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                  title="Batal"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePath(f.path)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded text-rose-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                title="Hapus folder"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 1 Kolom: Quick Upload Box */}
            <div className="rounded-xl border border-dashed border-blue-300 bg-white p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <UploadCloud className="h-4 w-4 text-[#1565d8]" />
                  <span>Unggah Cepat ke {quickFolderPath}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pilih berkas dari komputer/HP untuk langsung dikirim ke Cloud Storage (/api/files/upload).
                </p>
              </div>

              <div className="space-y-2">
                <label className="block w-full py-2.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-center text-xs font-semibold text-[#1565d8] cursor-pointer transition-colors">
                  {quickUploadLoading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Mengunggah berkas...
                    </span>
                  ) : (
                    <span>+ Pilih Berkas untuk Diunggah</span>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    disabled={quickUploadLoading}
                    onChange={handleQuickUploadFile}
                  />
                </label>
                <p className="text-[10px] text-slate-400 text-center">
                  Otomatis terbit dengan tautan share publik
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
