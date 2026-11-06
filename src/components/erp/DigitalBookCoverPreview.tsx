import { useState } from 'react';
import {
  Activity,
  BookOpen,
  Calculator,
  Compass,
  FlaskConical,
  Leaf,
  Library,
  SunMedium,
} from 'lucide-react';
import type { DigitalBookPreview } from '../../hooks/useDigitalBooks';

interface DigitalBookCoverPreviewProps {
  book: DigitalBookPreview;
  size?: 'thumb' | 'card' | 'modal';
  className?: string;
}

interface CoverPalette {
  surfaceClass: string;
  frameBorderClass: string;
  accentIconBg: string;
  mutedTextClass: string;
  Icon: typeof BookOpen;
}

function resolveSubjectPalette(book: DigitalBookPreview): CoverPalette {
  const combined = `${book.judul} ${book.katalog}`.toLowerCase();

  if (
    combined.includes('matematika') ||
    combined.includes('perkalian') ||
    combined.includes('hitung') ||
    combined.includes('math')
  ) {
    return {
      surfaceClass: 'bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950',
      frameBorderClass: 'border-blue-300/20',
      accentIconBg: 'bg-blue-500/15 text-blue-200',
      mutedTextClass: 'text-blue-200/80',
      Icon: Calculator,
    };
  }

  if (
    combined.includes('biogas') ||
    combined.includes('surya') ||
    combined.includes('energi')
  ) {
    return {
      surfaceClass: 'bg-gradient-to-br from-amber-900 via-slate-900 to-stone-950',
      frameBorderClass: 'border-amber-300/20',
      accentIconBg: 'bg-amber-500/15 text-amber-200',
      mutedTextClass: 'text-amber-200/80',
      Icon: SunMedium,
    };
  }

  if (
    combined.includes('hutan') ||
    combined.includes('alam') ||
    combined.includes('biologi') ||
    combined.includes('tumbuhan')
  ) {
    return {
      surfaceClass:
        'bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950',
      frameBorderClass: 'border-emerald-300/20',
      accentIconBg: 'bg-emerald-500/15 text-emerald-200',
      mutedTextClass: 'text-emerald-200/80',
      Icon: combined.includes('hutan') ? Leaf : FlaskConical,
    };
  }

  if (
    combined.includes('senam') ||
    combined.includes('pjok') ||
    combined.includes('olahraga')
  ) {
    return {
      surfaceClass: 'bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950',
      frameBorderClass: 'border-teal-300/20',
      accentIconBg: 'bg-teal-500/15 text-teal-200',
      mutedTextClass: 'text-teal-200/80',
      Icon: Activity,
    };
  }

  if (combined.includes('sejarah') || combined.includes('geografi')) {
    return {
      surfaceClass: 'bg-gradient-to-br from-stone-800 via-stone-900 to-slate-950',
      frameBorderClass: 'border-stone-300/20',
      accentIconBg: 'bg-stone-500/20 text-stone-200',
      mutedTextClass: 'text-stone-300/80',
      Icon: Compass,
    };
  }

  return {
    surfaceClass: 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950',
    frameBorderClass: 'border-slate-300/20',
    accentIconBg: 'bg-white/10 text-slate-200',
    mutedTextClass: 'text-slate-300/80',
    Icon: combined.includes('umum') ? Library : BookOpen,
  };
}

export function DigitalBookCoverPreview({
  book,
  size = 'card',
  className = '',
}: DigitalBookCoverPreviewProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const palette = resolveSubjectPalette(book);
  const SubjectIcon = palette.Icon;
  const showRealCover = Boolean(book.coverUrl) && !imgFailed;

  if (size === 'thumb') {
    return (
      <div
        className={`relative h-14 w-11 rounded-md overflow-hidden shrink-0 border border-slate-200 ${palette.surfaceClass} flex items-center justify-center ${className}`}
      >
        <SubjectIcon className="h-5 w-5 text-white/90" aria-hidden="true" />
        {showRealCover && (
          <img
            src={book.coverUrl!}
            alt={`Sampul ${book.judul}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-[3/4] w-full rounded-xl overflow-hidden border border-slate-200 select-none ${palette.surfaceClass} ${className}`}
    >
      {/* Lipatan Punggung Buku Halus (Book Spine Shading) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-black/35 via-white/10 to-transparent z-10"
      />

      {/* Desain Sampul & Ikon Buku Fallback (Selalu siap, bebas gambar pecah) */}
      <div
        className={`h-full w-full p-4 pl-5 flex flex-col justify-between text-white ${
          size === 'modal' ? 'sm:p-5 sm:pl-6' : ''
        }`}
      >
        <div
          className={`h-full w-full rounded-lg border ${palette.frameBorderClass} p-3.5 flex flex-col justify-between`}
        >
          <div className="flex items-start justify-between gap-2">
            <div
              className={`h-10 w-10 rounded-lg ${palette.accentIconBg} flex items-center justify-center shrink-0`}
            >
              <SubjectIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <span
              className={`font-mono text-[10px] font-semibold tracking-wider ${palette.mutedTextClass}`}
            >
              {book.tipe}
            </span>
          </div>

          <div className="my-auto py-2">
            <p
              className={`text-[10px] font-medium ${palette.mutedTextClass} line-clamp-1`}
            >
              {book.katalog}
            </p>
            <p
              className={`mt-1 font-bold leading-snug tracking-tight text-white line-clamp-4 ${
                size === 'modal' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
              }`}
            >
              {book.judul}
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] text-white/70">
            <span className="truncate">{book.penulis}</span>
            {book.tahun && (
              <span className="font-mono tabular-nums shrink-0">
                {book.tahun}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sampul Asli Buku Digital (dari Thumbnail Dokumen/Foto API bila tersedia) */}
      {showRealCover && (
        <img
          src={book.coverUrl!}
          alt={`Pratinjau sampul buku digital ${book.judul}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover bg-white transition-opacity duration-150 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}
