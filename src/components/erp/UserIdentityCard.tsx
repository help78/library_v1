import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Expand, GraduationCap, Printer, X } from 'lucide-react';
import { apiClient } from '../../lib/api';
import {
  extractResponsePayload,
  formatDateId,
  resolveImageSrc,
} from '../../lib/formatters';
import {
  buildQrCodeMatrix,
  exportIdentityCardPng,
  type IdentityCardField,
} from '../../lib/idCardExport';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';
import { RoleTingkat, type UserData } from '../../types/auth';
import { Button } from '../ui/button';
import { AvatarImage } from './AvatarImage';

interface UserIdentityCardProps {
  user: UserData;
  identitasRows?: Record<string, unknown>[];
  className?: string;
  onOpenFullProfile?: () => void;
}

interface EnrichedCardProfile {
  loading: boolean;
  institutionName: string;
  institutionSubtitle: string;
  institutionLogo: unknown;
  fallbackPhoto: unknown;
  subtitle: string;
  fields: IdentityCardField[];
}

type QrContentMode = 'id-only' | 'full-summary';

function QrCodeSvg({
  value,
  label,
  sizeClass = 'h-14 w-14',
}: {
  value: string;
  label: string;
  sizeClass?: string;
}) {
  const matrix = useMemo(() => buildQrCodeMatrix(value), [value]);

  return (
    <div className="p-1.5 bg-white rounded-lg border border-slate-200 shrink-0 inline-flex items-center justify-center">
      <svg
        viewBox={`0 0 ${matrix.size} ${matrix.size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={label}
        className={cn(sizeClass, 'text-slate-900 block')}
      >
        <rect width={matrix.size} height={matrix.size} fill="#ffffff" />
        <path d={matrix.svgPath} fill="currentColor" />
      </svg>
    </div>
  );
}

function pickPrimaryInstitution(rows: Record<string, unknown>[]): {
  name: string;
  subtitle: string;
  logo: unknown;
} {
  if (!rows.length) {
    return {
      name: 'Sistem Informasi Akademik Sekolah',
      subtitle: 'Kartu Identitas Digital Terpadu',
      logo: null,
    };
  }

  const yayasanRow =
    rows.find(
      (r) =>
        String(r.departemen || '').toLowerCase() === 'yayasan' &&
        String(r.nama || '').trim() !== ''
    ) ||
    rows.find((r) => String(r.nama || '').trim() !== '') ||
    rows[0];

  const name = String(yayasanRow.nama || 'Sistem Informasi Akademik Sekolah').trim();
  const alamat = String(yayasanRow.alamat1 || '').trim();
  const situs = String(yayasanRow.situs || '').trim();
  const telp = String(yayasanRow.telp1 || '').trim();

  const subtitleParts = [alamat, situs || telp].filter(Boolean);
  return {
    name,
    subtitle:
      subtitleParts.join(' · ') || 'Identitas Resmi Lingkungan Pendidikan',
    logo: yayasanRow.foto ?? null,
  };
}

function formatBirthInfo(tmplahir: unknown, tgllahir: unknown): string {
  const place = typeof tmplahir === 'string' ? tmplahir.trim() : '';
  const dateFormatted = tgllahir ? formatDateId(tgllahir) : '-';
  if (place && dateFormatted && dateFormatted !== '-') {
    return `${place}, ${dateFormatted}`;
  }
  if (place) return place;
  if (dateFormatted && dateFormatted !== '-') return dateFormatted;
  return '-';
}

export function UserIdentityCard({
  user,
  identitasRows,
  className,
  onOpenFullProfile,
}: UserIdentityCardProps) {
  const updateUserPhoto = useAuthStore((state) => state.updateUserPhoto);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qrMode, setQrMode] = useState<QrContentMode>('id-only');
  const [isExporting, setIsExporting] = useState(false);

  const tingkat = Number(user.tingkat ?? 0);
  const identityCode = String(user.username || '').trim();

  const cardMeta = useMemo(() => {
    if (tingkat === RoleTingkat.PEGAWAI) {
      return {
        cardTitle: 'Kartu Identitas Pegawai',
        primaryIdLabel: 'NIP',
        filePrefix: 'Kartu-Pegawai',
        defaultSubtitle: 'Pegawai / Tenaga Pendidik',
      };
    }
    if (tingkat === RoleTingkat.SISWA) {
      return {
        cardTitle: 'Kartu Identitas Siswa',
        primaryIdLabel: 'NIS',
        filePrefix: 'Kartu-Siswa',
        defaultSubtitle: 'Peserta Didik Aktif',
      };
    }
    if (tingkat === RoleTingkat.CALON_SISWA) {
      return {
        cardTitle: 'Kartu Peserta Calon Siswa',
        primaryIdLabel: 'No. Daftar',
        filePrefix: 'Kartu-Calon-Siswa',
        defaultSubtitle: 'Peserta Seleksi PPDB',
      };
    }
    return {
      cardTitle: 'Kartu Otoritas Sistem',
      primaryIdLabel: 'ID Akun',
      filePrefix: 'Kartu-Administrator',
      defaultSubtitle: 'Super Administrator (Landlord)',
    };
  }, [tingkat]);

  const [profile, setProfile] = useState<EnrichedCardProfile>(() => {
    const initialInst = pickPrimaryInstitution(identitasRows || []);
    return {
      loading: true,
      institutionName: initialInst.name,
      institutionSubtitle: initialInst.subtitle,
      institutionLogo: initialInst.logo,
      fallbackPhoto: null,
      subtitle: cardMeta.defaultSubtitle,
      fields: [
        { label: cardMeta.primaryIdLabel, value: identityCode || '-', mono: true },
        { label: 'Tingkat Peran', value: `Tingkat ${tingkat}`, mono: false },
      ],
    };
  });

  const enrichCardData = useCallback(async () => {
    const hasProvidedIdentitas =
      Array.isArray(identitasRows) && identitasRows.length > 0;
    const encodedId = encodeURIComponent(identityCode);

    const identitasPromise = hasProvidedIdentitas
      ? Promise.resolve(null)
      : apiClient.get('/jbsumum/identitas');

    if (tingkat === RoleTingkat.SISWA && identityCode) {
      const [idenRes, siswaRes, kelasRes] = await Promise.allSettled([
        identitasPromise,
        apiClient.get(`/jbsakad/siswa/detail/${encodedId}`),
        apiClient.get('/jbsakad/kelas'),
      ]);

      const resolvedIdentitasRows = hasProvidedIdentitas
        ? identitasRows!
        : idenRes.status === 'fulfilled' && idenRes.value
        ? extractResponsePayload(idenRes.value.data).rows
        : [];
      const inst = pickPrimaryInstitution(resolvedIdentitasRows);

      const detailObj =
        siswaRes.status === 'fulfilled'
          ? extractResponsePayload(siswaRes.value.data).singleObject
          : null;

      let kelasName = user.kelas || '-';
      const idKelas = detailObj?.idkelas ? String(detailObj.idkelas) : '';
      if (idKelas && kelasRes.status === 'fulfilled') {
        const kelasRows = extractResponsePayload(kelasRes.value.data).rows;
        const found = kelasRows.find((r) => String(r.idkelas) === idKelas);
        if (found?.nama_kelas) {
          kelasName = String(found.nama_kelas);
        } else {
          kelasName = `Kelas ${idKelas}`;
        }
      }

      const nisn = detailObj?.nisn ? String(detailObj.nisn).trim() : '-';
      const tahunMasuk = detailObj?.tahunmasuk
        ? String(detailObj.tahunmasuk).trim()
        : '-';
      const ttl = formatBirthInfo(detailObj?.tmplahir, detailObj?.tgllahir);
      const detailPhoto = detailObj?.foto ?? null;

      if (!resolveImageSrc(user.foto) && resolveImageSrc(detailPhoto)) {
        updateUserPhoto(detailPhoto);
      }

      setProfile({
        loading: false,
        institutionName: inst.name,
        institutionSubtitle: inst.subtitle,
        institutionLogo: inst.logo,
        fallbackPhoto: detailPhoto,
        subtitle:
          kelasName && kelasName !== '-'
            ? `Peserta Didik Aktif · Kelas ${kelasName}`
            : 'Peserta Didik Aktif',
        fields: [
          { label: 'Nomor Induk Siswa', value: identityCode, mono: true },
          { label: 'NISN', value: nisn || '-', mono: true },
          { label: 'Kelas Aktif', value: kelasName || '-', mono: false },
          {
            label: ttl !== '-' ? 'Tempat, Tgl Lahir' : 'Tahun Masuk',
            value: ttl !== '-' ? ttl : tahunMasuk,
            mono: ttl === '-',
          },
        ],
      });
      return;
    }

    if (tingkat === RoleTingkat.PEGAWAI && identityCode) {
      const [idenRes, pegRes] = await Promise.allSettled([
        identitasPromise,
        apiClient.get(`/jbssdm/pegawai/detail/${encodedId}`),
      ]);

      const resolvedIdentitasRows = hasProvidedIdentitas
        ? identitasRows!
        : idenRes.status === 'fulfilled' && idenRes.value
        ? extractResponsePayload(idenRes.value.data).rows
        : [];
      const inst = pickPrimaryInstitution(resolvedIdentitasRows);

      const detailObj =
        pegRes.status === 'fulfilled'
          ? extractResponsePayload(pegRes.value.data).singleObject
          : null;

      const bagian = detailObj?.bagian
        ? String(detailObj.bagian).trim()
        : user.bagian || 'Pendidik & Tenaga Kependidikan';
      const nuptk = detailObj?.nuptk
        ? String(detailObj.nuptk).trim()
        : detailObj?.nrp
        ? String(detailObj.nrp).trim()
        : '-';
      const ttl = formatBirthInfo(detailObj?.tmplahir, detailObj?.tgllahir);
      const kontak = detailObj?.handphone
        ? String(detailObj.handphone).trim()
        : detailObj?.email
        ? String(detailObj.email).trim()
        : '-';
      const detailPhoto = detailObj?.foto ?? null;

      if (!resolveImageSrc(user.foto) && resolveImageSrc(detailPhoto)) {
        updateUserPhoto(detailPhoto);
      }

      setProfile({
        loading: false,
        institutionName: inst.name,
        institutionSubtitle: inst.subtitle,
        institutionLogo: inst.logo,
        fallbackPhoto: detailPhoto,
        subtitle: `Pegawai / Guru · ${bagian}`,
        fields: [
          { label: 'NIP Pegawai', value: identityCode, mono: true },
          { label: 'Bagian / Unit', value: bagian, mono: false },
          {
            label: nuptk !== '-' ? 'NUPTK / NRP' : 'Kontak Aktif',
            value: nuptk !== '-' ? nuptk : kontak,
            mono: true,
          },
          { label: 'Tempat, Tgl Lahir', value: ttl, mono: false },
        ],
      });
      return;
    }

    if (tingkat === RoleTingkat.CALON_SISWA) {
      const [idenRes, tagihanCalonRes] = await Promise.allSettled([
        identitasPromise,
        identityCode
          ? apiClient.get(`/jbsfina/tagihan-calon/${encodedId}`)
          : Promise.resolve(null),
      ]);

      const resolvedIdentitasRows = hasProvidedIdentitas
        ? identitasRows!
        : idenRes.status === 'fulfilled' && idenRes.value
        ? extractResponsePayload(idenRes.value.data).rows
        : [];
      const inst = pickPrimaryInstitution(resolvedIdentitasRows);

      let statusAdministrasi = 'Terdaftar PPDB';
      if (tagihanCalonRes.status === 'fulfilled' && tagihanCalonRes.value) {
        const rows = extractResponsePayload(tagihanCalonRes.value.data).rows;
        if (rows.length > 0) {
          const lunas = rows.every(
            (r) => Number(r.sisa_asli || r.sisa || 0) <= 0
          );
          statusAdministrasi = lunas
            ? 'Administrasi Lunas'
            : `${rows.length} Tagihan Aktif`;
        }
      }

      setProfile({
        loading: false,
        institutionName: inst.name,
        institutionSubtitle: inst.subtitle,
        institutionLogo: inst.logo,
        fallbackPhoto: null,
        subtitle: 'Calon Peserta Didik · Seleksi PPDB',
        fields: [
          { label: 'No. Pendaftaran', value: identityCode || '-', mono: true },
          { label: 'Jalur Masuk', value: 'Penerimaan Siswa Baru', mono: false },
          { label: 'Administrasi', value: statusAdministrasi, mono: false },
          {
            label: 'Tahun Pendaftaran',
            value: String(new Date().getFullYear()),
            mono: true,
          },
        ],
      });
      return;
    }

    // Tingkat 1: Landlord / Super Admin
    const [idenRes] = await Promise.allSettled([identitasPromise]);
    const resolvedIdentitasRows = hasProvidedIdentitas
      ? identitasRows!
      : idenRes.status === 'fulfilled' && idenRes.value
      ? extractResponsePayload(idenRes.value.data).rows
      : [];
    const inst = pickPrimaryInstitution(resolvedIdentitasRows);

    setProfile({
      loading: false,
      institutionName: inst.name,
      institutionSubtitle: inst.subtitle,
      institutionLogo: inst.logo,
      fallbackPhoto: null,
      subtitle: 'Super Administrator · Otoritas Penuh Sistem',
      fields: [
        { label: 'ID Otoritas', value: identityCode || '-', mono: true },
        { label: 'Tingkat Peran', value: 'Tingkat 1 (Landlord)', mono: false },
        { label: 'Cakupan Modul', value: 'Seluruh Modul (6/6)', mono: false },
        { label: 'Departemen', value: 'Semua Unit Sekolah', mono: false },
      ],
    });
  }, [
    identitasRows,
    identityCode,
    tingkat,
    updateUserPhoto,
    user.bagian,
    user.foto,
    user.kelas,
  ]);

  useEffect(() => {
    enrichCardData();
  }, [enrichCardData]);

  // Prioritaskan foto langsung dari respons login (/api/jbsuser/login -> data.foto)
  const effectiveRawPhoto = resolveImageSrc(user.foto)
    ? user.foto
    : profile.fallbackPhoto;

  const qrPayloadValue = useMemo(() => {
    if (qrMode === 'full-summary') {
      return [
        cardMeta.cardTitle,
        `${cardMeta.primaryIdLabel}: ${identityCode || '-'}`,
        `Nama: ${user.nama}`,
        `Institusi: ${profile.institutionName}`,
      ].join('\n');
    }
    return identityCode || user.nama || 'JIBAS';
  }, [
    qrMode,
    cardMeta.cardTitle,
    cardMeta.primaryIdLabel,
    identityCode,
    user.nama,
    profile.institutionName,
  ]);

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      await exportIdentityCardPng({
        cardTitle: cardMeta.cardTitle,
        institutionName: profile.institutionName,
        institutionSubtitle: profile.institutionSubtitle,
        institutionLogoSrc: resolveImageSrc(profile.institutionLogo),
        personName: user.nama,
        personSubtitle: profile.subtitle,
        personPhotoSrc: resolveImageSrc(effectiveRawPhoto),
        primaryIdLabel: cardMeta.primaryIdLabel,
        primaryIdValue: identityCode || '-',
        qrPayloadValue,
        fields: profile.fields,
        fileName: `${cardMeta.filePrefix}-${identityCode || 'JIBAS'}.png`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <>
      <article
        aria-label={cardMeta.cardTitle}
        className={cn(
          'rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between',
          className
        )}
      >
        {/* Header Kelembagaan Kartu */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3 tracking-[0.01em]">
          <div className="flex items-center gap-3 min-w-0">
            {resolveImageSrc(profile.institutionLogo) ? (
              <AvatarImage
                rawSrc={profile.institutionLogo}
                name={profile.institutionName}
                kind="institution"
                size="sm"
                className="h-9 w-9 rounded-lg border-white/15 bg-white p-1"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">
                {profile.institutionName}
              </div>
              <div className="text-xs text-slate-300 truncate">
                {cardMeta.cardTitle}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 hidden sm:block">
            <div className="text-[11px] text-slate-400">
              {cardMeta.primaryIdLabel}
            </div>
            <div className="text-xs font-mono font-semibold text-white tabular-nums">
              {identityCode}
            </div>
          </div>
        </div>

        {/* Isi Utama Kartu: Pasfoto 3:4 + Metadata Terstruktur */}
        <div className="p-5 flex items-start gap-4 sm:gap-5 flex-1">
          <div className="shrink-0">
            <AvatarImage
              rawSrc={effectiveRawPhoto}
              name={user.nama}
              size="pasfoto"
              className="shadow-xs"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug break-words">
                {user.nama}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 truncate">
                {profile.subtitle}
              </p>
            </div>

            <dl className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {profile.fields.slice(0, 4).map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-slate-500 truncate">{field.label}</dt>
                  <dd
                    className={cn(
                      'mt-0.5 font-semibold text-slate-900 truncate',
                      field.mono && 'font-mono tabular-nums'
                    )}
                    title={field.value}
                  >
                    {field.value || '-'}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Zona Footer QR Code Presensi & Verifikasi */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-3.5 min-w-0 text-left group cursor-pointer"
            title="Klik untuk memperbesar QR Code dan detail kartu"
          >
            <QrCodeSvg
              value={qrPayloadValue}
              label={`QR Code ${cardMeta.primaryIdLabel} ${identityCode}`}
              sizeClass="h-12 w-12"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 group-hover:text-slate-700 truncate">
                Kode QR Identitas
              </div>
              <div className="text-xs font-mono text-slate-500 tabular-nums truncate mt-0.5">
                {cardMeta.primaryIdLabel} · {identityCode}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="h-9 px-3 text-xs"
            >
              <Expand className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Detail Kartu</span>
            </Button>
          </div>
        </div>
      </article>

      {/* Modal Pratinjau CR80, Pengaturan Isi QR, Unduh PNG, & Cetak */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="id-card-modal-title"
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3
                  id="id-card-modal-title"
                  className="text-base font-bold text-slate-900"
                >
                  {cardMeta.cardTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dilengkapi Kode QR standar yang dapat dipindai mesin presensi maupun kamera ponsel.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Kontrol Pilihan Muatan QR Code */}
                <div
                  className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                  role="group"
                  aria-label="Muatan QR Code"
                >
                  <button
                    type="button"
                    onClick={() => setQrMode('id-only')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer',
                      qrMode === 'id-only'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    QR {cardMeta.primaryIdLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode('full-summary')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer',
                      qrMode === 'full-summary'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    QR Profil
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Tutup pratinjau kartu"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Area Kartu Cetak CR80 3-Zona (#printable-id-card) */}
            <div className="p-6 bg-slate-50">
              <div
                id="printable-id-card"
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs"
              >
                {/* Header Kelembagaan */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4 tracking-[0.01em]">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {resolveImageSrc(profile.institutionLogo) ? (
                      <AvatarImage
                        rawSrc={profile.institutionLogo}
                        name={profile.institutionName}
                        kind="institution"
                        size="md"
                        className="h-11 w-11 rounded-lg border-white/15 bg-white p-1"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
                        <GraduationCap className="h-5 w-5" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-base font-bold text-white truncate">
                        {profile.institutionName}
                      </div>
                      <div className="text-xs text-slate-300 truncate">
                        {profile.institutionSubtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-slate-200">
                      {cardMeta.cardTitle}
                    </div>
                    <div className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                      {cardMeta.primaryIdLabel}: {identityCode}
                    </div>
                  </div>
                </div>

                {/* Isi 3-Zona: Pasfoto (Kiri) · Biodata (Tengah) · QR Code (Kanan) */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="shrink-0">
                    <AvatarImage
                      rawSrc={effectiveRawPhoto}
                      name={user.nama}
                      size="pasfoto-lg"
                      className="shadow-xs"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3 w-full">
                    <div>
                      <div className="text-lg font-bold text-slate-900 leading-snug break-words">
                        {user.nama}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {profile.subtitle}
                      </div>
                    </div>

                    <dl className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
                      {profile.fields.map((field) => (
                        <div key={field.label} className="min-w-0">
                          <dt className="text-slate-500 truncate">{field.label}</dt>
                          <dd
                            className={cn(
                              'mt-0.5 text-sm font-semibold text-slate-900 break-words',
                              field.mono && 'font-mono tabular-nums'
                            )}
                          >
                            {field.value || '-'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-6 flex sm:flex-col items-center justify-between sm:justify-center gap-3 shrink-0">
                    <QrCodeSvg
                      value={qrPayloadValue}
                      label={`QR Code ${cardMeta.primaryIdLabel} ${identityCode}`}
                      sizeClass="h-24 w-24"
                    />
                    <div className="text-right sm:text-center">
                      <div className="text-[11px] text-slate-500">
                        Pindai Kode QR
                      </div>
                      <div className="text-xs font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                        {identityCode}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Kelembagaan */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4 text-xs text-slate-500">
                  <span className="truncate">{profile.institutionSubtitle}</span>
                  <span className="shrink-0 tabular-nums">
                    Kartu Digital Terverifikasi · {new Date().getFullYear()}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div>
                {onOpenFullProfile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPreviewOpen(false);
                      onOpenFullProfile();
                    }}
                  >
                    Buka Biodata Lengkap
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrintCard}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  <span>Cetak Kartu</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isExporting}
                  onClick={handleDownloadPng}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{isExporting ? 'Menyiapkan...' : 'Unduh PNG'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
