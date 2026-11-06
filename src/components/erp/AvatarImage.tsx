import { useEffect, useState } from 'react';
import { Building2, User } from 'lucide-react';
import { resolveImageSrc } from '../../lib/formatters';
import { cn } from '../../lib/utils';

interface AvatarImageProps {
  rawSrc: unknown;
  name?: string;
  kind?: 'person' | 'institution';
  size?: 'sm' | 'md' | 'lg' | 'pasfoto' | 'pasfoto-lg';
  className?: string;
}

export function AvatarImage({
  rawSrc,
  name,
  kind = 'person',
  size = 'md',
  className,
}: AvatarImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageSrc(rawSrc);

  useEffect(() => {
    setFailed(false);
  }, [rawSrc]);

  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8 text-xs rounded-md'
      : size === 'lg'
      ? 'h-20 w-20 text-lg rounded-xl'
      : size === 'pasfoto'
      ? 'w-24 h-32 text-base rounded-lg'
      : size === 'pasfoto-lg'
      ? 'w-28 h-36 text-lg rounded-xl'
      : 'h-12 w-12 text-sm rounded-lg';

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={name ? `Foto ${name}` : 'Gambar profil'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn(
          sizeClass,
          kind === 'institution'
            ? 'object-contain bg-slate-50 p-1'
            : 'object-cover object-top bg-slate-100',
          'border border-slate-200 shrink-0',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        'bg-slate-100 border border-slate-200 text-slate-600 font-semibold flex items-center justify-center shrink-0',
        className
      )}
      aria-hidden="true"
    >
      {initials ? (
        <span>{initials}</span>
      ) : kind === 'institution' ? (
        <Building2 className="h-5 w-5 text-slate-400" />
      ) : (
        <User className="h-5 w-5 text-slate-400" />
      )}
    </div>
  );
}
