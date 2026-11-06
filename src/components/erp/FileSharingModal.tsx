import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  ImageIcon,
  Info,
  Loader2,
  Music,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { ERP_MODULES, type ErpMutationAction } from '../../data/erpModules';
import {
  apiClient,
  extractApiErrorMessage,
  getCloudFileUrl,
} from '../../lib/api';
import {
  extractResponsePayload,
  formatDateId,
  formatNumberId,
} from '../../lib/formatters';
import { useAuthStore } from '../../store/useAuthStore';
import { RoleTingkat } from '../../types/auth';
import { isLandlordUser } from '../../lib/rbac';
import { useCloudFolders } from '../../hooks/useCloudFolders';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DigitalBookReaderModal } from './DigitalBookReaderModal';
import type { InspectedEntity } from './SmartDataTable';

export interface FileSharingModalProps {
  open: boolean;
  onClose: () => void;
  canAccessUmum?: boolean;
  canManageDigitalFiles?: boolean;
  studentNis?: string;
  initialMode?: 'list' | 'upload';
  initialFolder?: string;
  onTriggerMutation?: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  onInspectEntity?: (entity: InspectedEntity) => void;
  refreshSignal?: number;
}

export type FileCategoryTab =
  | 'all'
  | 'cloud'
  | 'folders'
  | 'images'
  | 'documents'
  | 'ebook'
  | 'dokumen-umum';

export interface CloudFileItem {
  path: string;
  name: string;
  size: number;
  extension: string;
  modified: string;
  modified_formatted?: string;
  mode?: number;
  isDir: boolean;
  isSymlink?: boolean;
  type?: string;
  resolution?: { width: number; height: number };
}

export interface UnifiedFileItem {
  key: string;
  source: 'cloud' | 'ebook' | 'dokumen-umum';
  title: string;
  subtitle: string;
  formatLabel: string;
  dateLabel: string;
  sizeBytes?: number;
  url?: string;
  publicUrl?: string;
  path?: string;
  isDir?: boolean;
  rawRow: Record<string, unknown>;
  resolution?: { width: number; height: number };
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileSharingModal({
  open,
  onClose,
  canAccessUmum = false,
  canManageDigitalFiles = false,
  studentNis,
  initialMode = 'list',
  initialFolder = '/',
  onTriggerMutation,
  onInspectEntity,
  refreshSignal = 0,
}: FileSharingModalProps) {
  const user = useAuthStore((s) => s.user);
  const isLandlord = isLandlordUser(user);
  const userTingkat = Number(user?.tingkat ?? 0);
  const isSiswa = userTingkat === RoleTingkat.SISWA;
  const isCalonSiswa = userTingkat === RoleTingkat.CALON_SISWA;
  const isStudentOnly = isSiswa || isCalonSiswa;

  // Folder Navigation State
  const [currentFolder, setCurrentFolder] = useState<string>(initialFolder);
  const [activeTab, setActiveTab] = useState<FileCategoryTab>(
    isStudentOnly ? 'ebook' : 'cloud'
  );
  const [query, setQuery] = useState('');

  // Mode View (List vs Upload) - Siswa & Calon Siswa dipaksa mode 'list' saja
  const [viewMode, setViewMode] = useState<'list' | 'upload'>(
    isStudentOnly ? 'list' : initialMode
  );

  // Data State
  const [cloudFiles, setCloudFiles] = useState<CloudFileItem[]>([]);
  const [ebookFiles, setEbookFiles] = useState<UnifiedFileItem[]>([]);
  const [suratFiles, setSuratFiles] = useState<UnifiedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dynamic Cloud Folders Hook
  const {
    folders: dynamicFolders,
    loading: loadingFolders,
    refreshFolders,
    addDiscoveredFolder,
  } = useCloudFolders(['/']);

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string>(
    initialFolder || '/'
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lastUploadedResult, setLastUploadedResult] = useState<{
    nama_file: string;
    url_publik?: string;
    url_internal?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<CloudFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview Image Lightbox / Inspector
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    dimensions?: string;
  } | null>(null);

  // Detail Sheet State
  const [inspectItem, setInspectItem] = useState<UnifiedFileItem | null>(null);

  // Modal Pembaca Buku Digital
  const [readingBook, setReadingBook] = useState<Record<string, unknown> | null>(
    null
  );

  // Sinkronkan initialMode & initialFolder saat modal dibuka
  useEffect(() => {
    if (open) {
      refreshFolders();
      if (isStudentOnly) {
        setViewMode('list');
        setActiveTab('ebook');
      } else {
        setViewMode(initialMode);
        if (initialFolder) {
          setCurrentFolder(initialFolder);
          setUploadTargetFolder(initialFolder);
        }
      }
    }
  }, [open, initialMode, initialFolder, isStudentOnly, refreshFolders]);

  // Muat data dari endpoint /api/files/list
  const loadCloudFiles = useCallback(async (folderPath: string) => {
    if (isStudentOnly) {
      setCloudFiles([]);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get('/files/list', {
        params: { path: folderPath },
      });
      const data = res.data;
      if (data && Array.isArray(data.data)) {
        const items = data.data as CloudFileItem[];
        setCloudFiles(items);
        items.forEach((item) => {
          if (item && (item.isDir || item.type === 'directory') && item.path) {
            addDiscoveredFolder(item.path);
          }
        });
      } else {
        setCloudFiles([]);
      }
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err, '/api/files/list'));
      setCloudFiles([]);
    } finally {
      setLoading(false);
    }
  }, [isStudentOnly, addDiscoveredFolder]);

  // Muat E-Book dan Surat untuk tab terkait
  const loadLegacyFiles = useCallback(async () => {
    try {
      const [digitalRes, suratRes] = await Promise.allSettled([
        apiClient.get('/jbsperpus/pustaka/digital'),
        !isStudentOnly && canAccessUmum
          ? apiClient.get('/jbsumum/lampiransurat')
          : Promise.resolve(null),
      ]);

      if (digitalRes.status === 'fulfilled' && digitalRes.value) {
        const parsed = extractResponsePayload(digitalRes.value.data);
        const mapped: UnifiedFileItem[] = parsed.rows.map((row, index) => {
          const id = String(row.id ?? row.idpustaka ?? index + 1);
          const idPustaka = row.idpustaka ? `ID Pustaka #${row.idpustaka}` : 'Pustaka Digital';
          const tipe = String(row.tipe || 'PDF').toUpperCase();
          const url = String(row.file_url || row.url || row.link || '').trim();
          return {
            key: `ebook-${id}`,
            source: 'ebook',
            title: String(row.judul || `Buku Digital #${id}`),
            subtitle: `${idPustaka} · Koleksi Perpustakaan`,
            formatLabel: tipe,
            dateLabel: row.tanggal ? formatDateId(row.tanggal) : 'Tersedia',
            url,
            rawRow: row,
          };
        });
        setEbookFiles(mapped);
      }

      if (suratRes.status === 'fulfilled' && suratRes.value) {
        const parsed = extractResponsePayload(suratRes.value.data);
        const mapped: UnifiedFileItem[] = parsed.rows.map((row, index) => {
          const id = String(row.replid ?? row.id ?? index + 1);
          const dept = String(row.departemen || 'Umum');
          return {
            key: `surat-${id}`,
            source: 'dokumen-umum',
            title: String(row.judul || `Lampiran Surat #${id}`),
            subtitle: `Departemen ${dept} · Arsip Lampiran Surat`,
            formatLabel: 'LAMPIRAN',
            dateLabel: row.tanggal ? formatDateId(row.tanggal) : '-',
            rawRow: row,
          };
        });
        setSuratFiles(mapped);
      }
    } catch {
      // Abaikan jika modul perpustakaan belum terisi
    }
  }, [isStudentOnly, canAccessUmum]);

  // Trigger muat data saat modal dibuka atau folder berganti
  useEffect(() => {
    if (open) {
      if (!isStudentOnly) {
        loadCloudFiles(currentFolder);
      }
      loadLegacyFiles();
    }
  }, [open, currentFolder, loadCloudFiles, loadLegacyFiles, refreshSignal, isStudentOnly]);

  // Gabungkan dan petakan berkas Cloud ke UnifiedFileItem
  const unifiedCloudFiles = useMemo<UnifiedFileItem[]>(() => {
    return cloudFiles.map((f, idx) => {
      const isDir = Boolean(f.isDir);
      const ext = f.extension ? f.extension.toUpperCase().replace('.', '') : isDir ? 'FOLDER' : 'FILE';
      const pathSegments = f.path.split('/').filter(Boolean);
      const folderContext = pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : 'Root';

      return {
        key: `cloud-${f.path}-${idx}`,
        source: 'cloud',
        title: f.name,
        subtitle: isDir
          ? `Direktori / Folder · ${f.path}`
          : `Folder /${folderContext} · ${formatBytes(f.size)}`,
        formatLabel: ext,
        dateLabel: f.modified_formatted || (f.modified ? formatDateId(f.modified) : '-'),
        sizeBytes: f.size,
        path: f.path,
        isDir,
        url: f.path ? getCloudFileUrl(f.path) : undefined,
        publicUrl: f.path ? getCloudFileUrl(f.path) : undefined,
        rawRow: f as unknown as Record<string, unknown>,
        resolution: f.resolution,
      };
    });
  }, [cloudFiles]);

  // Gabungkan seluruh item sesuai filter tab & pencarian
  const filteredItems = useMemo<UnifiedFileItem[]>(() => {
    let sourceList: UnifiedFileItem[] = [];

    if (isStudentOnly) {
      sourceList = ebookFiles;
    } else if (activeTab === 'cloud') {
      sourceList = unifiedCloudFiles;
    } else if (activeTab === 'folders') {
      sourceList = unifiedCloudFiles.filter((f) => f.isDir);
    } else if (activeTab === 'images') {
      sourceList = unifiedCloudFiles.filter((f) =>
        ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(f.formatLabel)
      );
    } else if (activeTab === 'documents') {
      sourceList = unifiedCloudFiles.filter((f) =>
        ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'TXT', 'ZIP', 'RAR'].includes(
          f.formatLabel
        )
      );
    } else if (activeTab === 'ebook') {
      sourceList = ebookFiles;
    } else if (activeTab === 'dokumen-umum') {
      sourceList = suratFiles;
    } else {
      sourceList = [...unifiedCloudFiles, ...ebookFiles, ...suratFiles];
    }

    const q = query.trim().toLowerCase();
    if (!q) return sourceList;

    return sourceList.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.formatLabel.toLowerCase().includes(q) ||
        (item.path && item.path.toLowerCase().includes(q))
    );
  }, [activeTab, unifiedCloudFiles, ebookFiles, suratFiles, query]);

  // Breadcrumbs folder navigator
  const breadcrumbParts = useMemo(() => {
    const trimmed = currentFolder.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) {
      return [{ name: 'Root (/)', path: '/' }];
    }
    const segments = trimmed.split('/');
    const result = [{ name: 'Root (/)', path: '/' }];
    let accum = '';
    for (const seg of segments) {
      accum += `/${seg}`;
      result.push({ name: seg, path: accum });
    }
    return result;
  }, [currentFolder]);

  // Handler Salin Link
  const handleCopyUrl = async (key: string, url?: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // Abaikan jika browser membatasi akses clipboard
    }
  };

  // Handler Buka / Navigasi Folder
  const handleFolderClick = (path: string) => {
    setCurrentFolder(path);
    setUploadTargetFolder(path);
    setQuery('');
  };

  // Handler Kembali ke Folder Induk
  const handleGoUp = () => {
    if (currentFolder === '/') return;
    const parts = currentFolder.replace(/^\/+|\/+$/g, '').split('/');
    parts.pop();
    const parent = parts.length > 0 ? `/${parts.join('/')}` : '/';
    handleFolderClick(parent);
  };

  // Handler Upload Berkas via POST /api/files/upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setErrorMsg('Pilih file terlebih dahulu untuk diunggah.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgress(15);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const target = uploadTargetFolder.trim() || '/';
      formData.append('folder', target);

      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 150);

      const res = await apiClient.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      const resData = res.data?.data || {};
      setLastUploadedResult({
        nama_file: resData.nama_file || uploadFile.name,
        url_publik: resData.url_publik,
        url_internal: resData.url_internal,
      });

      setSuccessMsg(
        `Berkas "${uploadFile.name}" berhasil diunggah ke folder "${target}".`
      );
      setUploadFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh file list & dynamic folders
      loadCloudFiles(currentFolder);
      refreshFolders();
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err, '/api/files/upload'));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // Handler Hapus Berkas via DELETE /api/files/delete?path=...
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await apiClient.delete('/files/delete', {
        params: { path: deleteTarget.path },
      });
      setSuccessMsg(`File atau folder "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
      loadCloudFiles(currentFolder);
      refreshFolders();
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err, '/api/files/delete'));
    } finally {
      setDeleting(false);
    }
  };

  // Render Icon Sesuai Ekstensi / Tipe Berkas
  const renderFileIcon = (item: UnifiedFileItem) => {
    if (item.isDir) {
      return <Folder className="h-5 w-5 text-amber-600 fill-amber-100" />;
    }
    const fmt = item.formatLabel.toUpperCase();
    if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(fmt)) {
      return <ImageIcon className="h-5 w-5 text-indigo-600" />;
    }
    if (['PDF', 'DOC', 'DOCX'].includes(fmt)) {
      return <FileText className="h-5 w-5 text-rose-600" />;
    }
    if (['XLS', 'XLSX', 'CSV'].includes(fmt)) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
    }
    if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(fmt)) {
      return <Archive className="h-5 w-5 text-amber-700" />;
    }
    if (['MP3', 'WAV', 'OGG', 'M4A'].includes(fmt)) {
      return <Music className="h-5 w-5 text-cyan-600" />;
    }
    if (['MP4', 'MKV', 'WEBM', 'AVI'].includes(fmt)) {
      return <Film className="h-5 w-5 text-purple-600" />;
    }
    if (['JS', 'TS', 'JSON', 'HTML', 'CSS', 'PHP', 'PY'].includes(fmt)) {
      return <FileCode className="h-5 w-5 text-slate-700" />;
    }
    if (item.source === 'ebook') {
      return <BookOpen className="h-5 w-5 text-amber-600" />;
    }
    return <File className="h-5 w-5 text-slate-500" />;
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-sharing-modal-title"
      >
        <div
          className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Modal Utama */}
          <div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-[#1053b5] text-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                {isStudentOnly ? (
                  <BookOpen className="h-6 w-6 text-amber-300" aria-hidden="true" />
                ) : (
                  <FolderOpen className="h-6 w-6 text-sky-300" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="file-sharing-modal-title"
                    className="text-base sm:text-lg font-bold text-white tracking-tight truncate"
                  >
                    {isStudentOnly ? 'Pustaka Digital Siswa' : 'File Sharing & Cloud Storage'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {isStudentOnly ? '/api/jbsperpus' : '/api/files'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 truncate">
                  {isStudentOnly
                    ? 'Koleksi buku digital dan referensi belajar perpustakaan sekolah'
                    : 'Penyimpanan berkas Cloud Drive SDN 2 Balepanjang, repositori dokumen sekolah, dan pustaka e-book'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Toggle Tombol View Mode: List vs Upload (Khusus Pegawai / Landlord) */}
              {!isStudentOnly && (
                <div className="bg-white/10 p-0.5 rounded-lg border border-white/20 flex items-center">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Daftar Berkas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('upload')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'upload'
                        ? 'bg-[#1565d8] text-white shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload Berkas</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup jendela File Sharing"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Alert Error / Success */}
          {errorMsg && (
            <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span className="truncate">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-500 hover:text-rose-800 text-xs shrink-0 font-medium"
              >
                Tutup
              </button>
            </div>
          )}

          {successMsg && (
            <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate">{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-600 hover:text-emerald-900 text-xs shrink-0 font-medium"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Breadcrumbs & Folder Fast-Switcher (Hanya untuk Admin / Guru) */}
          {!isStudentOnly && (
            <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center flex-wrap gap-1 text-slate-600 min-w-0">
                <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  <span>Lokasi:</span>
                </span>
                {breadcrumbParts.map((b, i) => (
                  <div key={b.path} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                    <button
                      type="button"
                      onClick={() => handleFolderClick(b.path)}
                      className={`px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                        i === breadcrumbParts.length - 1
                          ? 'font-bold text-[#1053b5] bg-blue-50/80 border border-blue-200'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {b.name}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  Pintasan Folder:
                </span>
                {dynamicFolders.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => handleFolderClick(dir)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      currentFolder === dir
                        ? 'bg-[#1565d8] text-white font-semibold shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {dir === '/' ? 'Root /' : dir.replace(/^\//, '')}
                  </button>
                ))}
                {!dynamicFolders.includes(currentFolder) && currentFolder && (
                  <button
                    type="button"
                    onClick={() => handleFolderClick(currentFolder)}
                    className="px-2 py-1 rounded text-[11px] font-mono bg-[#1565d8] text-white font-semibold shadow-2xs"
                  >
                    {currentFolder.replace(/^\//, '')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    refreshFolders();
                    loadCloudFiles(currentFolder);
                  }}
                  disabled={loadingFolders || loading}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Segarkan daftar folder dari server (/api/files)"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${loadingFolders ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* VIEW MODE: FORM UPLOAD */}
          {viewMode === 'upload' && (
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-[#1565d8]" />
                    <span>Upload Berkas ke Cloud Storage (/api/files/upload)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Unggah berkas tugas, materi ajar, dokumen, atau foto langsung ke server Cloud Drive SDN 2 Balepanjang.
                  </p>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pilih Folder Target Penyimpanan
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={uploadTargetFolder}
                        onChange={(e) => setUploadTargetFolder(e.target.value)}
                        className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1565d8] w-52 shrink-0"
                      >
                        {dynamicFolders.map((dir) => (
                          <option key={dir} value={dir}>
                            {dir === '/' ? '/ (Root)' : dir}
                          </option>
                        ))}
                        {!dynamicFolders.includes(uploadTargetFolder) && uploadTargetFolder && (
                          <option value={uploadTargetFolder}>
                            {uploadTargetFolder} (Kustom)
                          </option>
                        )}
                      </select>
                      <Input
                        value={uploadTargetFolder}
                        onChange={(e) => setUploadTargetFolder(e.target.value)}
                        placeholder="Atau ketik custom path, cth: /Tugas/Kelas5A"
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Dropzone Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pilih Berkas
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                        uploadFile
                          ? 'border-emerald-400 bg-emerald-50/50'
                          : 'border-slate-300 hover:border-[#1565d8] hover:bg-slate-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setUploadFile(file);
                        }}
                      />
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-blue-50 text-[#1565d8] flex items-center justify-center">
                          <UploadCloud className="h-6 w-6" />
                        </div>
                        {uploadFile ? (
                          <div>
                            <p className="text-sm font-bold text-emerald-800 break-all">
                              {uploadFile.name}
                            </p>
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Ukuran: {formatBytes(uploadFile.size)} · Tipe: {uploadFile.type || 'Berkas'}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-2 underline">
                              Klik untuk mengganti berkas lain
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              Klik untuk memilih berkas dari perangkat Anda
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Mendukung PDF, Word, Excel, PowerPoint, Gambar (PNG/JPG), Arsip ZIP, dan teks (hingga 50MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar jika sedang upload */}
                  {uploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>Mengunggah berkas ke server...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1565d8] transition-all duration-200 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tombol Submit */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setViewMode('list')}
                      disabled={uploading}
                    >
                      Kembali ke Daftar
                    </Button>
                    <Button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="bg-[#1565d8] hover:bg-[#1053b5] text-white"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4" />
                          <span>Mulai Upload Berkas</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {/* Hasil Upload Terakhir */}
                {lastUploadedResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Upload Berhasil Terverifikasi!</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-500">Nama File:</span>{' '}
                        <span className="font-mono font-bold text-slate-800">
                          {lastUploadedResult.nama_file}
                        </span>
                      </div>
                      {lastUploadedResult.url_publik && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded-lg border border-emerald-200">
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-emerald-700 block">
                              Link Publik (Share):
                            </span>
                            <span className="font-mono text-slate-700 text-[11px] truncate block">
                              {lastUploadedResult.url_publik}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleCopyUrl('last-pub', lastUploadedResult.url_publik)
                              }
                              className="h-7 text-xs px-2.5"
                            >
                              {copiedKey === 'last-pub' ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span>Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Salin Link</span>
                                </>
                              )}
                            </Button>
                            <a
                              href={lastUploadedResult.url_publik}
                              target="_blank"
                              rel="noreferrer"
                              className="h-7 px-2.5 text-xs inline-flex items-center gap-1 rounded-md bg-[#1565d8] text-white hover:bg-[#1053b5]"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Buka</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW MODE: LIST BERKAS */}
          {viewMode === 'list' && (
            <>
              {/* Toolbar Filter & Pencarian */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto self-start">
                  {isStudentOnly ? (
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-slate-900 shadow-2xs flex items-center gap-1.5 cursor-default"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                      <span>Koleksi E-Book Digital ({ebookFiles.length})</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab('cloud')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeTab === 'cloud'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Cloud Storage ({unifiedCloudFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('folders')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeTab === 'folders'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Folder ({unifiedCloudFiles.filter((f) => f.isDir).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('images')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeTab === 'images'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Gambar
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('documents')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeTab === 'documents'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Dokumen
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ebook')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeTab === 'ebook'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        E-Book Pustaka
                      </button>
                      {canAccessUmum && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('dokumen-umum')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            activeTab === 'dokumen-umum'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Surat Umum
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search
                      className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        isStudentOnly
                          ? 'Cari judul e-book, format...'
                          : 'Cari nama berkas, ekstensi...'
                      }
                      className="pl-9 h-9 bg-white text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      isStudentOnly
                        ? loadLegacyFiles()
                        : loadCloudFiles(currentFolder)
                    }
                    disabled={loading}
                    className="h-9 px-3 shrink-0"
                    title="Segarkan daftar berkas"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="sr-only sm:not-sr-only">Muat Ulang</span>
                  </Button>
                </div>
              </div>

              {/* Tabel / Daftar Berkas */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {/* Tombol Navigasi Kembali ke Folder Induk (jika tidak di root dan bukan mode siswa) */}
                {!isStudentOnly && currentFolder !== '/' && (
                  <div
                    onClick={handleGoUp}
                    className="px-6 py-2.5 bg-slate-50/70 hover:bg-slate-100 flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <Folder className="h-4 w-4 text-amber-600" />
                    <span>.. (Kembali ke folder induk)</span>
                  </div>
                )}

                {loading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className="h-16 rounded-xl bg-slate-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      {isStudentOnly ? (
                        <BookOpen className="h-6 w-6 text-amber-500" />
                      ) : (
                        <FolderOpen className="h-6 w-6" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {isStudentOnly
                        ? 'Belum ada koleksi buku digital yang tersedia'
                        : 'Folder ini masih kosong atau tidak ada berkas yang cocok'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {isStudentOnly
                        ? 'Silakan hubungi petugas perpustakaan untuk ketersediaan referensi digital sekolah.'
                        : `Belum ada berkas yang tersimpan di direktori ${currentFolder}. Anda dapat mengunggah berkas baru sekarang.`}
                    </p>
                    {!isStudentOnly && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setViewMode('upload')}
                        className="bg-[#1565d8] hover:bg-[#1053b5] text-white mt-2"
                      >
                        <UploadCloud className="h-4 w-4" />
                        <span>Upload Berkas ke {currentFolder}</span>
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.key}
                      className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/90 transition-colors group"
                    >
                      {/* Kolom Kiri: Ikon & Info File */}
                      <div
                        className={`flex items-start gap-3.5 min-w-0 ${
                          item.isDir ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => {
                          if (item.isDir && item.path) {
                            handleFolderClick(item.path);
                          }
                        }}
                      >
                        <div className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs group-hover:border-slate-300">
                          {renderFileIcon(item)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold text-slate-900 break-words ${
                                item.isDir ? 'hover:text-[#1565d8] hover:underline' : ''
                              }`}
                            >
                              {item.title}
                            </span>
                            {item.isDir && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                DIREKTORI
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-mono font-medium text-slate-700">
                              {item.formatLabel}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{item.subtitle}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{item.dateLabel}</span>
                            {item.resolution && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-indigo-700 font-medium">
                                  {item.resolution.width}×{item.resolution.height}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Kolom Kanan: Aksi (Lihat, Copy Link, Detail, Hapus) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Jika Folder: Tombol Masuk Folder */}
                        {item.isDir && item.path && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleFolderClick(item.path!)}
                            className="h-8 px-2.5 text-xs font-semibold"
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
                            <span>Buka Folder</span>
                          </Button>
                        )}

                        {/* Jika Berkas Gambar: Preview Lightbox */}
                        {['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(
                          item.formatLabel.toUpperCase()
                        ) &&
                          item.url && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPreviewImage({
                                  url: item.url!,
                                  title: item.title,
                                  dimensions: item.resolution
                                    ? `${item.resolution.width}×${item.resolution.height}`
                                    : undefined,
                                })
                              }
                              className="h-8 px-2 text-xs"
                              title="Lihat Pratinjau Gambar"
                            >
                              <Eye className="h-3.5 w-3.5 text-indigo-600" />
                              <span className="hidden sm:inline">Pratinjau</span>
                            </Button>
                          )}

                        {/* Tombol Salin Link Publik */}
                        {item.url && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyUrl(item.key, item.url)}
                            className="h-8 px-2 text-xs"
                            title="Salin Link Berkas"
                          >
                            {copiedKey === item.key ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Salin Link</span>
                              </>
                            )}
                          </Button>
                        )}

                        {/* Buka Tautan Eksternal / E-Book */}
                        {item.source === 'ebook' ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setReadingBook(item.rawRow)}
                            className="h-8 px-2.5 text-xs bg-[#1565d8] hover:bg-[#1053b5] text-white"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Baca</span>
                          </Button>
                        ) : item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-2 text-xs inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                            title="Buka Berkas di Tab Baru"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Buka</span>
                          </a>
                        ) : null}

                        {/* Detail Inspector */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectItem(item)}
                          className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                          title="Rincian Berkas"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </Button>

                        {/* Hapus Berkas via DELETE /api/files/delete (Khusus Berkas Cloud & Non-Student) */}
                        {!isStudentOnly && item.source === 'cloud' && item.path && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget(item.rawRow as unknown as CloudFileItem)
                            }
                            className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Hapus berkas dari server"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Footer Modal Ringkas */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="tabular-nums font-medium text-slate-700">
                {isStudentOnly
                  ? `Menampilkan ${formatNumberId(filteredItems.length)} buku digital di Pustaka Siswa`
                  : `Menampilkan ${formatNumberId(filteredItems.length)} berkas di ${currentFolder}`}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-[11px] text-slate-500">
                {isStudentOnly
                  ? 'Endpoint: /api/jbsperpus/pustaka/digital'
                  : 'Backend: Cloudflare Workers (Hono) + Cloud Drive SDN 2 Balepanjang'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isStudentOnly && viewMode === 'list' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setViewMode('upload')}
                  className="bg-[#1565d8] hover:bg-[#1053b5] text-white h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Upload Berkas Baru</span>
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8">
                Tutup
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Berkas */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Konfirmasi Hapus Berkas
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus berkas{' '}
              <strong className="text-slate-900 font-mono">{deleteTarget.name}</strong>{' '}
              pada lokasi <strong className="font-mono text-slate-800">{deleteTarget.path}</strong>? Tindakan ini permanen pada storage server.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Hapus Sekarang</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Pratinjau Gambar */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{previewImage.title}</p>
                {previewImage.dimensions && (
                  <p className="text-xs text-slate-400 font-mono">
                    Resolusi: {previewImage.dimensions} px
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="text-[#1565d8] hover:underline font-semibold flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Buka Gambar Ukuran Asli</span>
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewImage(null)}
              >
                Tutup Pratinjau
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rincian Berkas (Inspector Sheet) */}
      {inspectItem && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectItem(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Info className="h-5 w-5 text-[#1565d8]" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  Detail Metadata Berkas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Nama File:</span>
                <span className="col-span-2 font-mono font-bold text-slate-900 break-all">
                  {inspectItem.title}
                </span>
              </div>
              {inspectItem.path && (
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Path Folder:</span>
                  <span className="col-span-2 font-mono text-slate-800 break-all">
                    {inspectItem.path}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Format / Tipe:</span>
                <span className="col-span-2 font-mono text-slate-800">
                  {inspectItem.formatLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Ukuran Berkas:</span>
                <span className="col-span-2 font-mono text-slate-800">
                  {formatBytes(inspectItem.sizeBytes)} ({inspectItem.sizeBytes ?? 0} bytes)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Waktu Modifikasi:</span>
                <span className="col-span-2 text-slate-800">
                  {inspectItem.dateLabel}
                </span>
              </div>
              {inspectItem.resolution && (
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Dimensi Gambar:</span>
                  <span className="col-span-2 font-mono text-indigo-700 font-semibold">
                    {inspectItem.resolution.width} px × {inspectItem.resolution.height} px
                  </span>
                </div>
              )}
              {inspectItem.url && (
                <div className="py-2">
                  <span className="text-slate-500 font-medium block mb-1">
                    URL Langsung / Publik:
                  </span>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 break-all">
                    {inspectItem.url}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              {inspectItem.url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyUrl('inspect-url', inspectItem.url)}
                >
                  {copiedKey === 'inspect-url' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => setInspectItem(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembaca E-Book Langsung */}
      <DigitalBookReaderModal
        book={readingBook}
        studentNis={studentNis}
        onClose={() => setReadingBook(null)}
      />
    </>
  );
}
