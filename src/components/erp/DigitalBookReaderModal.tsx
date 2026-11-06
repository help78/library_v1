import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Loader2, X } from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import { Button } from '../ui/button';

interface DigitalBookReaderModalProps {
  book: Record<string, unknown> | null;
  studentNis?: string;
  onClose: () => void;
  onManualLogRead?: (idPustaka: string) => void;
  onReadLogged?: () => void;
}

/**
 * Mengonversi URL berbagi Google Drive / Google Docs menjadi URL /preview agar dapat ditampilkan di dalam iframe pembaca.
 */
function resolveEmbeddableBookUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  // Pola: https://drive.google.com/file/d/{FILE_ID}/view?...
  const driveFileMatch = trimmed.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
  );
  if (driveFileMatch?.[1]) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  // Pola: https://drive.google.com/open?id={FILE_ID}
  const driveOpenMatch = trimmed.match(
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/
  );
  if (driveOpenMatch?.[1]) {
    return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  }

  return trimmed;
}

export function DigitalBookReaderModal({
  book,
  studentNis,
  onClose,
  onManualLogRead,
  onReadLogged,
}: DigitalBookReaderModalProps) {
  const [logState, setLogState] = useState<
    'idle' | 'logging' | 'logged' | 'error'
  >('idle');
  const [logMessage, setLogMessage] = useState<string>('');
  const loggedKeyRef = useRef<string>('');

  const idPustaka = book
    ? String(book.id_pustaka ?? book.idpustaka ?? book.replid ?? '').trim()
    : '';
  const rawFileUrl = book ? String(book.file_url ?? '').trim() : '';
  const embedUrl = useMemo(
    () => resolveEmbeddableBookUrl(rawFileUrl),
    [rawFileUrl]
  );

  // Otomatis catat log aktivitas baca ke POST /api/jbsperpus/baca-digital apabila dibuka oleh akun Siswa
  useEffect(() => {
    if (!book || !idPustaka || !studentNis) {
      setLogState('idle');
      setLogMessage('');
      return;
    }

    const sessionKey = `${idPustaka}:${studentNis}`;
    if (loggedKeyRef.current === sessionKey) {
      return;
    }
    loggedKeyRef.current = sessionKey;

    let cancelled = false;
    setLogState('logging');
    setLogMessage('');

    apiClient
      .post('/jbsperpus/baca-digital', {
        idpustaka: Number(idPustaka),
        nis: studentNis,
      })
      .then((res) => {
        if (cancelled) return;
        setLogState('logged');
        const msg =
          res.data && typeof res.data.message === 'string'
            ? res.data.message
            : `Aktivitas baca tercatat (NIS ${studentNis})`;
        setLogMessage(msg);
        onReadLogged?.();
      })
      .catch((err) => {
        if (cancelled) return;
        setLogState('error');
        setLogMessage(extractApiErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [book, idPustaka, studentNis, onReadLogged]);

  if (!book) {
    return null;
  }

  const judul = String(book.judul || `Pustaka Digital #${idPustaka}`);
  const penulis = book.penulis ? String(book.penulis) : null;
  const penerbit = book.penerbit ? String(book.penerbit) : null;
  const format = String(book.tipe || book.format || 'PDF');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ebook-reader-title"
    >
      <div
        className="w-full max-w-5xl h-[88vh] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Pembaca Buku Digital */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-white shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono tabular-nums">ID Pustaka: {idPustaka}</span>
              <span aria-hidden="true">·</span>
              <span>Format {format}</span>
              {penulis && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{penulis}</span>
                </>
              )}
              {penerbit && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{penerbit}</span>
                </>
              )}
            </div>
            <h3
              id="ebook-reader-title"
              className="mt-1 text-base font-bold text-slate-900 truncate"
            >
              {judul}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {logState === 'logging' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Mencatat log baca...</span>
              </span>
            )}

            {logState === 'logged' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{logMessage}</span>
              </span>
            )}

            {!studentNis && onManualLogRead && idPustaka && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onManualLogRead(idPustaka)}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Log Baca Siswa</span>
              </Button>
            )}

            {rawFileUrl && (
              <a
                href={rawFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Buka Tautan Asli</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pembaca buku digital"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Kanvas Iframe Pembaca Dokumen PDF / E-Book */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Pembaca E-Book ${judul}`}
              className="w-full h-full border-0 bg-white"
              allow="autoplay"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-semibold text-slate-800">
                Berkas E-Book Belum Ditautkan
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md leading-relaxed">
                Judul pustaka ini belum memiliki tautan berkas digital (PDF/EPUB). Petugas perpustakaan dapat menautkan URL berkas melalui aksi Tautkan E-Book Digital.
              </p>
            </div>
          )}
        </div>

        {logState === 'error' && logMessage && (
          <div className="px-6 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
            Catatan log aktivitas baca belum tersimpan otomatis: {logMessage}
          </div>
        )}
      </div>
    </div>
  );
}
