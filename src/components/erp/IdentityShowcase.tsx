import { Eye, Globe, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { AvatarImage } from './AvatarImage';
import { Button } from '../ui/button';

interface IdentityShowcaseProps {
  rows: Record<string, unknown>[];
  onInspectRow: (row: Record<string, unknown>) => void;
  onViewDetailById?: (replid: string) => void;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (row: Record<string, unknown>) => void;
}

export function IdentityShowcase({
  rows,
  onInspectRow,
  onViewDetailById,
  onEditRow,
  onDeleteRow,
}: IdentityShowcaseProps) {
  if (!rows.length) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Belum ada data profil identitas lembaga yang terdaftar.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {rows.map((item, idx) => {
        const rawNama =
          item.nama && String(item.nama) !== 'null'
            ? String(item.nama).trim()
            : '';
        const departemen =
          item.departemen && String(item.departemen) !== 'null'
            ? String(item.departemen).trim()
            : 'Yayasan / Pusat';
        const nama = rawNama || `Unit ${departemen}`;
        const replid =
          item.replid !== undefined && item.replid !== null
            ? String(item.replid)
            : '';

        const alamatParts = [
          item.alamat1,
          item.alamat2,
          item.alamat3,
          item.alamat4,
        ]
          .filter((v) => Boolean(v && String(v) !== 'null' && String(v).trim()))
          .map((v) => String(v).trim());
        const telpParts = [item.telp1, item.telp2, item.telp3, item.telp4]
          .filter((v) => Boolean(v && String(v) !== 'null' && String(v).trim()))
          .map((v) => String(v).trim());
        const situs =
          item.situs && String(item.situs) !== 'null'
            ? String(item.situs).trim()
            : '';
        const email =
          item.email && String(item.email) !== 'null'
            ? String(item.email).trim()
            : '';

        return (
          <div
            key={`${String(item.replid ?? 'unit')}-${idx}`}
            className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-start justify-between gap-6 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-start gap-5 min-w-0">
              <AvatarImage
                rawSrc={item.foto}
                name={nama}
                kind="institution"
                size="lg"
              />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Departemen: {departemen}
                  </span>
                  {replid && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        replid #{replid}
                      </span>
                    </>
                  )}
                  {!rawNama && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-700">Nama belum diisi</span>
                    </>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {nama}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 pt-1 text-sm text-slate-600">
                  {alamatParts.length > 0 && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin
                        className="h-4 w-4 text-slate-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{alamatParts.join(', ')}</span>
                    </div>
                  )}

                  {telpParts.length > 0 && (
                    <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                      <Phone
                        className="h-3.5 w-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{telpParts.join(' / ')}</span>
                    </div>
                  )}

                  {email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail
                        className="h-3.5 w-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{email}</span>
                    </div>
                  )}

                  {situs && (
                    <div className="flex items-center gap-2 text-xs">
                      <Globe
                        className="h-3.5 w-3.5 text-slate-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{situs}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {replid && onViewDetailById && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onViewDetailById(replid)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Detail #{replid}</span>
                </Button>
              )}
              {onEditRow && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEditRow(item)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ubah</span>
                </Button>
              )}
              {onDeleteRow && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteRow(item)}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInspectRow(item)}
              >
                <span>Rincian Atribut</span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
