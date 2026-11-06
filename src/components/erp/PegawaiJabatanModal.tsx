import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Loader2,
  MinusCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatNumberId,
  parseDateToIsoInput,
} from '../../lib/formatters';
import { AvatarImage } from './AvatarImage';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Can } from '../auth/Can';

export interface PegawaiJabatanPopupState {
  mode: 'create' | 'edit' | 'delete' | 'detail';
  nip: string;
  employeeName?: string;
  employeeBagian?: string;
  employeeFoto?: unknown;
  allowChangeNip?: boolean;
  record?: Record<string, unknown>;
}

interface MasterJabatanOption {
  replid: number;
  jabatan: string;
  singkatan: string;
  satker: string;
}

interface PegawaiSimpleOption {
  nip: string;
  nama: string;
  bagian: string;
}

interface PegawaiJabatanFormPopupProps {
  popupState: PegawaiJabatanPopupState | null;
  onClose: () => void;
  onSuccess: () => void;
  onSwitchMode?: (nextState: PegawaiJabatanPopupState) => void;
}

const DEFAULT_JENIS_OPTIONS = [
  'KEPALA SEKOLAH',
  'WAKA BIDANG KURIKULUM',
  'WAKA BIDANG KESISWAAN',
  'GURU',
  'STAF',
  'STRUKTURAL',
  'FUNGSIONAL',
];

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function PegawaiJabatanFormPopup({
  popupState,
  onClose,
  onSuccess,
  onSwitchMode,
}: PegawaiJabatanFormPopupProps) {
  const [nip, setNip] = useState('');
  const [idJabatan, setIdJabatan] = useState('');
  const [namaJab, setNamaJab] = useState('');
  const [jenis, setJenis] = useState('STAF');
  const [tmt, setTmt] = useState('');
  const [sk, setSk] = useState('');
  const [terakhir, setTerakhir] = useState('1');
  const [keterangan, setKeterangan] = useState('');

  const [masterJabatanList, setMasterJabatanList] = useState<
    MasterJabatanOption[]
  >([]);
  const [jenisOptions, setJenisOptions] = useState<string[]>(
    DEFAULT_JENIS_OPTIONS
  );
  const [pegawaiOptions, setPegawaiOptions] = useState<PegawaiSimpleOption[]>(
    []
  );
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sinkronisasi state awal saat popup dibuka atau berganti mode
  useEffect(() => {
    if (!popupState) {
      return;
    }
    setErrorMsg(null);
    setNip(String(popupState.nip || '').trim());

    const rec = popupState.record;
    if (
      (popupState.mode === 'edit' ||
        popupState.mode === 'detail' ||
        popupState.mode === 'delete') &&
      rec
    ) {
      setIdJabatan(
        rec.idjabatan !== undefined && rec.idjabatan !== null
          ? String(rec.idjabatan)
          : ''
      );
      setNamaJab(
        String(rec.namajab || rec.nama_jabatan_master || '').trim()
      );
      setJenis(String(rec.jenis || 'STAF').trim() || 'STAF');
      setTmt(parseDateToIsoInput(rec.tmt) || getTodayIso());
      setSk(rec.sk && String(rec.sk) !== 'null' ? String(rec.sk) : '');
      setTerakhir(Number(rec.terakhir) === 1 ? '1' : '0');
      setKeterangan(
        rec.keterangan && String(rec.keterangan) !== 'null'
          ? String(rec.keterangan)
          : ''
      );
    } else {
      setIdJabatan('');
      setNamaJab('');
      setJenis('GURU');
      setTmt(getTodayIso());
      setSk('');
      setTerakhir('1');
      setKeterangan('');
    }
  }, [popupState]);

  // Muat referensi Master Jabatan, Master Jenis Jabatan, dan daftar Pegawai Aktif (bila pilih NIP diaktifkan)
  useEffect(() => {
    if (!popupState) {
      return;
    }
    let cancelled = false;
    setLoadingRefs(true);

    const requests: Promise<unknown>[] = [
      apiClient.get('/jbssdm/jabatan'),
      apiClient.get('/jbssdm/jenisjabatan'),
    ];
    if (popupState.allowChangeNip) {
      requests.push(
        apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } })
      );
    }

    Promise.allSettled(requests).then((results) => {
      if (cancelled) return;
      const [jabRes, jenisRes, pegRes] = results;

      if (jabRes && jabRes.status === 'fulfilled') {
        const rows = extractResponsePayload(
          (jabRes.value as { data: unknown }).data
        ).rows;
        const mapped: MasterJabatanOption[] = rows
          .filter((r) => r.replid !== undefined)
          .map((r) => ({
            replid: Number(r.replid),
            jabatan: String(r.jabatan ?? '').trim(),
            singkatan: String(r.singkatan ?? '').trim(),
            satker:
              r.satker && String(r.satker) !== 'null'
                ? String(r.satker).trim()
                : '',
          }))
          .filter((r) => r.jabatan !== '' && r.jabatan.toUpperCase() !== 'NA');
        setMasterJabatanList(mapped);

        if (popupState.mode === 'create' && mapped.length > 0) {
          setIdJabatan((prev) => {
            if (prev) return prev;
            const preferred =
              mapped.find((m) => m.jabatan.toLowerCase() === 'guru') ||
              mapped[0];
            setNamaJab(preferred.jabatan);
            return String(preferred.replid);
          });
        }
      }

      if (jenisRes && jenisRes.status === 'fulfilled') {
        const jRows = extractResponsePayload(
          (jenisRes.value as { data: unknown }).data
        ).rows;
        const dynamicJenis = jRows
          .map((r) => String(r.jenis ?? '').trim())
          .filter(Boolean);
        const merged = Array.from(
          new Set([...dynamicJenis, ...DEFAULT_JENIS_OPTIONS])
        );
        setJenisOptions(merged);
      }

      if (pegRes && pegRes.status === 'fulfilled') {
        const pRows = extractResponsePayload(
          (pegRes.value as { data: unknown }).data
        ).rows;
        setPegawaiOptions(
          pRows
            .filter((p) => !('aktif' in p) || Number(p.aktif) === 1)
            .map((p) => ({
              nip: String(p.nip ?? '').trim(),
              nama: String(p.nama ?? '').trim(),
              bagian: String(p.bagian ?? '').trim(),
            }))
            .filter((p) => Boolean(p.nip))
        );
      }

      setLoadingRefs(false);
    });

    return () => {
      cancelled = true;
    };
  }, [popupState]);

  const resolvedEmployeeLabel = useMemo(() => {
    if (!popupState) return '';
    if (popupState.employeeName) {
      return popupState.employeeName;
    }
    const found = pegawaiOptions.find((p) => p.nip === nip);
    return found ? found.nama : '';
  }, [popupState, pegawaiOptions, nip]);

  if (!popupState) {
    return null;
  }

  const replid =
    popupState.record?.replid !== undefined &&
    popupState.record?.replid !== null
      ? String(popupState.record.replid)
      : '';

  const endpointDisplay = (() => {
    const cleanNip = nip.trim() || ':nip';
    if (popupState.mode === 'create') {
      return `POST /api/jbssdm/pegawai/${cleanNip}/jabatan`;
    }
    if (popupState.mode === 'edit') {
      return `PUT /api/jbssdm/pegawai/${cleanNip}/jabatan/${replid || ':replid'}`;
    }
    if (popupState.mode === 'delete') {
      return `DELETE /api/jbssdm/pegawai/${cleanNip}/jabatan/${replid || ':replid'}`;
    }
    return `GET /api/jbssdm/pegawai/${cleanNip}/jabatan`;
  })();

  const handleSelectMasterJabatan = (selectedId: string) => {
    setIdJabatan(selectedId);
    const matched = masterJabatanList.find(
      (item) => String(item.replid) === selectedId
    );
    if (matched) {
      setNamaJab(matched.jabatan);
      const upper = matched.jabatan.toUpperCase();
      if (upper.includes('KEPALA SEKOLAH') && !upper.includes('WAKIL')) {
        setJenis('KEPALA SEKOLAH');
      } else if (upper.includes('KURIKULUM')) {
        setJenis('WAKA BIDANG KURIKULUM');
      } else if (upper.includes('KESISWAAN')) {
        setJenis('WAKA BIDANG KESISWAAN');
      } else if (upper.includes('GURU')) {
        setJenis('GURU');
      }
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetNip = nip.trim();
    if (!targetNip) {
      setErrorMsg('NIP Pegawai wajib dipilih atau diisi.');
      return;
    }
    if (!idJabatan.trim()) {
      setErrorMsg('Master Jabatan (ID Jabatan) wajib dipilih.');
      return;
    }
    if (!tmt.trim()) {
      setErrorMsg('TMT (Tanggal Mulai Tugas) wajib diisi.');
      return;
    }

    const matchedMaster = masterJabatanList.find(
      (m) => String(m.replid) === idJabatan.trim()
    );
    const finalNamaJab =
      namaJab.trim() || matchedMaster?.jabatan || 'Jabatan Pegawai';

    const payload = {
      idjabatan: Number(idJabatan),
      tmt: tmt.trim(),
      sk: sk.trim(),
      jenis: jenis.trim(),
      namajab: finalNamaJab,
      keterangan: keterangan.trim(),
      terakhir: Number(terakhir) === 1 ? 1 : 0,
    };

    setIsSubmitting(true);
    try {
      const response =
        popupState.mode === 'create'
          ? await apiClient.post(
              `/jbssdm/pegawai/${encodeURIComponent(targetNip)}/jabatan`,
              payload
            )
          : await apiClient.put(
              `/jbssdm/pegawai/${encodeURIComponent(targetNip)}/jabatan/${encodeURIComponent(replid)}`,
              payload
            );

      const respData = response.data as Record<string, unknown> | undefined;
      if (
        respData &&
        typeof respData === 'object' &&
        (respData.status === 'error' || respData.success === false)
      ) {
        setErrorMsg(
          String(
            respData.pesan ||
              respData.message ||
              respData.error ||
              'Permintaan ditolak oleh server.'
          )
        );
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setErrorMsg(null);
    const targetNip = nip.trim();
    if (!targetNip || !replid) {
      setErrorMsg('Parameter NIP atau ID riwayat jabatan tidak lengkap.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.delete(
        `/jbssdm/pegawai/${encodeURIComponent(targetNip)}/jabatan/${encodeURIComponent(replid)}`
      );
      const respData = response.data as Record<string, unknown> | undefined;
      if (
        respData &&
        typeof respData === 'object' &&
        (respData.status === 'error' || respData.success === false)
      ) {
        setErrorMsg(
          String(
            respData.pesan ||
              respData.message ||
              respData.error ||
              'Penghapusan riwayat jabatan ditolak oleh server.'
          )
        );
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle =
    popupState.mode === 'create'
      ? 'Tambah Riwayat Jabatan Pegawai'
      : popupState.mode === 'edit'
      ? 'Ubah Riwayat Jabatan Pegawai'
      : popupState.mode === 'delete'
      ? 'Hapus Riwayat Jabatan Pegawai'
      : 'Rincian SK & Penugasan Jabatan';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white text-slate-900 overflow-hidden max-h-[92vh] flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pegawai-jabatan-popup-title"
      >
        {/* Header Popup */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-500 tabular-nums truncate">
              {endpointDisplay}
            </div>
            <h3
              id="pegawai-jabatan-popup-title"
              className="text-base font-bold text-slate-900 mt-0.5"
            >
              {modalTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Banner Identitas Pegawai (Bila sudah dikunci ke NIP tertentu) */}
        {!popupState.allowChangeNip && nip && (
          <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3 shrink-0">
            <AvatarImage
              rawSrc={popupState.employeeFoto}
              name={resolvedEmployeeLabel || nip}
              size="sm"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {resolvedEmployeeLabel || `Pegawai NIP ${nip}`}
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums truncate">
                NIP {nip}
                {popupState.employeeBagian
                  ? ` · ${popupState.employeeBagian}`
                  : ''}
              </div>
            </div>
          </div>
        )}

        {/* Isi Popup Berdasarkan Mode */}
        {popupState.mode === 'detail' && popupState.record ? (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {[
                {
                  label: 'ID Riwayat (replid)',
                  value: `#${String(popupState.record.replid ?? '-')}`,
                  mono: true,
                },
                {
                  label: 'NIP Pegawai',
                  value: String(popupState.record.nip || nip || '-'),
                  mono: true,
                },
                {
                  label: 'Master Jabatan',
                  value: `${String(
                    popupState.record.nama_jabatan_master ||
                      popupState.record.namajab ||
                      '-'
                  )}${
                    popupState.record.singkatan
                      ? ` (${String(popupState.record.singkatan)})`
                      : ''
                  }`,
                },
                {
                  label: 'Nama Jabatan SK',
                  value: String(popupState.record.namajab || '-'),
                },
                {
                  label: 'Jenis Jabatan',
                  value: String(popupState.record.jenis || '-'),
                },
                {
                  label: 'Nomor SK',
                  value: String(popupState.record.sk || '-'),
                  mono: true,
                },
                {
                  label: 'Tanggal Mulai Tugas (TMT)',
                  value: String(popupState.record.tmt || '-'),
                },
                {
                  label: 'Status Jabatan',
                  value:
                    Number(popupState.record.terakhir) === 1
                      ? 'Jabatan Aktif / Terakhir Saat Ini'
                      : 'Riwayat Jabatan Sebelumnya',
                },
                {
                  label: 'Keterangan',
                  value: String(popupState.record.keterangan || '-'),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-4 py-2.5 flex items-baseline justify-between gap-4 text-xs"
                >
                  <span className="text-slate-500 font-medium shrink-0">
                    {item.label}
                  </span>
                  <span
                    className={`text-right font-semibold text-slate-900 ${
                      item.mono ? 'font-mono tabular-nums' : ''
                    }`}
                  >
                    {item.value || '-'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Tutup
              </Button>
              {onSwitchMode && (
                <div className="flex items-center gap-2">
                  <Can modul="PERSONALIA" action="update">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onSwitchMode({ ...popupState, mode: 'edit' })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ubah</span>
                    </Button>
                  </Can>
                  <Can modul="PERSONALIA" action="delete">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        onSwitchMode({ ...popupState, mode: 'delete' })
                      }
                      className="text-red-700 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Hapus</span>
                    </Button>
                  </Can>
                </div>
              )}
            </div>
          </div>
        ) : popupState.mode === 'delete' ? (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="space-y-2 text-sm text-slate-700 leading-relaxed">
              <p>
                Apakah Anda yakin ingin menghapus rekaman riwayat jabatan
                berikut dari data kepegawaian?
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-900 text-sm">
                  {String(
                    popupState.record?.nama_jabatan_master ||
                      popupState.record?.namajab ||
                      'Riwayat Jabatan'
                  )}
                  {popupState.record?.singkatan
                    ? ` (${String(popupState.record.singkatan)})`
                    : ''}
                </div>
                <div className="text-slate-600 font-mono tabular-nums">
                  ID #{replid} · Nomor SK:{' '}
                  {String(popupState.record?.sk || '-')} · TMT:{' '}
                  {String(popupState.record?.tmt || '-')}
                </div>
                {Number(popupState.record?.terakhir) === 1 && (
                  <p className="text-amber-800 font-medium pt-1">
                    Perhatian: Rekaman ini berstatus sebagai Jabatan Aktif /
                    Terakhir pegawai saat ini.
                  </p>
                )}
              </div>
            </div>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle
                  className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <AlertTitle>Gagal Menghapus Riwayat Jabatan</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </div>
              </Alert>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Ya, Hapus Jabatan</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmitForm}
            className="p-6 overflow-y-auto space-y-4"
          >
            {popupState.allowChangeNip && (
              <div className="space-y-1.5">
                <Label htmlFor="pj-nip">
                  Pilih Pegawai Aktif (NIP){' '}
                  <span className="text-red-600">*</span>
                </Label>
                {pegawaiOptions.length > 0 ? (
                  <select
                    id="pj-nip"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    disabled={isSubmitting}
                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <option value="">-- Pilih Pegawai --</option>
                    {pegawaiOptions.map((p, idx) => (
                      <option key={`${p.nip}-${idx}`} value={p.nip}>
                        {p.nama} — NIP {p.nip} ({p.bagian || 'SDM'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="pj-nip"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="Contoh: 2001072003"
                    disabled={isSubmitting}
                    required
                  />
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pj-idjabatan">
                  Struktur Master Jabatan{' '}
                  <span className="text-red-600">*</span>
                </Label>
                {loadingRefs && (
                  <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    <Loader2
                      className="h-3 w-3 animate-spin"
                      aria-hidden="true"
                    />
                    Memuat master...
                  </span>
                )}
              </div>
              {masterJabatanList.length > 0 ? (
                <select
                  id="pj-idjabatan"
                  value={idJabatan}
                  onChange={(e) => handleSelectMasterJabatan(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <option value="">-- Pilih Master Jabatan --</option>
                  {masterJabatanList.map((m, idx) => (
                    <option key={`${m.replid}-${idx}`} value={String(m.replid)}>
                      #{m.replid} — {m.jabatan} ({m.singkatan})
                      {m.satker && m.satker !== '(Tidak Ada)'
                        ? ` · ${m.satker}`
                        : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="pj-idjabatan"
                  type="number"
                  value={idJabatan}
                  onChange={(e) => setIdJabatan(e.target.value)}
                  placeholder="Contoh: 28 (Kepala Sekolah)"
                  disabled={isSubmitting}
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pj-namajab">Nama Jabatan pada SK</Label>
                <Input
                  id="pj-namajab"
                  value={namaJab}
                  onChange={(e) => setNamaJab(e.target.value)}
                  placeholder="Contoh: Kepala Sekolah / Guru Kelas"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pj-jenis">Jenis Jabatan</Label>
                <select
                  id="pj-jenis"
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value)}
                  disabled={isSubmitting}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  {jenisOptions.map((j, idx) => (
                    <option key={`${j}-${idx}`} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pj-tmt">
                  Tanggal Mulai Tugas (TMT){' '}
                  <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="pj-tmt"
                  type="date"
                  value={tmt}
                  onChange={(e) => setTmt(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pj-sk">Nomor SK Pengangkatan</Label>
                <Input
                  id="pj-sk"
                  value={sk}
                  onChange={(e) => setSk(e.target.value)}
                  placeholder="Contoh: SDI/SK-01/2026"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pj-terakhir">Status Penugasan Jabatan</Label>
              <select
                id="pj-terakhir"
                value={terakhir}
                onChange={(e) => setTerakhir(e.target.value)}
                disabled={isSubmitting}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <option value="1">
                  1 — Jabatan Aktif / Terakhir Saat Ini
                </option>
                <option value="0">0 — Riwayat Jabatan Sebelumnya</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pj-keterangan">Keterangan Tambahan</Label>
              <textarea
                id="pj-keterangan"
                rows={2}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Catatan penugasan atau periode masa bakti (opsional)"
                disabled={isSubmitting}
                className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </div>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle
                  className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <AlertTitle>Gagal Menyimpan Data Jabatan</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </div>
              </Alert>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>
                    {popupState.mode === 'create'
                      ? 'Simpan Jabatan Baru'
                      : 'Simpan Perubahan'}
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export interface ManagedEmployeeTarget {
  nip: string;
  nama: string;
  bagian?: string;
  jabatan?: string;
  foto?: unknown;
}

interface PegawaiJabatanManagerPopupProps {
  employee: ManagedEmployeeTarget | null;
  onClose: () => void;
  onMutated?: () => void;
}

export function PegawaiJabatanManagerPopup({
  employee,
  onClose,
  onMutated,
}: PegawaiJabatanManagerPopupProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formPopup, setFormPopup] = useState<PegawaiJabatanPopupState | null>(
    null
  );

  const fetchEmployeeJabatan = useCallback(async (targetNip: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get(
        `/jbssdm/pegawai/${encodeURIComponent(targetNip)}/jabatan`
      );
      const parsed = extractResponsePayload(res.data);
      setRows(parsed.rows);
    } catch (err) {
      setRows([]);
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!employee?.nip) {
      return;
    }
    fetchEmployeeJabatan(employee.nip);
  }, [employee?.nip, fetchEmployeeJabatan]);

  if (!employee) {
    return null;
  }

  const activeRow = rows.find((r) => Number(r.terakhir) === 1) || rows[0];
  const currentActiveLabel = activeRow
    ? String(
        activeRow.nama_jabatan_master || activeRow.namajab || 'Terdaftar'
      )
    : employee.jabatan || 'Belum Ditetapkan';

  const handleChildSuccess = () => {
    fetchEmployeeJabatan(employee.nip);
    if (onMutated) {
      onMutated();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
        <div
          className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white text-slate-900 overflow-hidden max-h-[90vh] flex flex-col shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-jabatan-title"
        >
          {/* Header Dialog */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-500 tabular-nums truncate">
                GET / POST / PUT / DELETE · /api/jbssdm/pegawai/{employee.nip}
                /jabatan
              </div>
              <h3
                id="manager-jabatan-title"
                className="text-base font-bold text-slate-900 mt-0.5 truncate"
              >
                Kelola Riwayat Jabatan — {employee.nama}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog manajemen jabatan"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Ringkasan Identitas & Tombol Aksi */}
          <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <AvatarImage
                rawSrc={employee.foto}
                name={employee.nama}
                size="md"
              />
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {employee.nama}
                </div>
                <div className="text-xs text-slate-600 font-mono tabular-nums mt-0.5">
                  NIP {employee.nip}
                  {employee.bagian ? ` · ${employee.bagian}` : ''} ·{' '}
                  {formatNumberId(rows.length)} SK Tercatat · Aktif:{' '}
                  <span className="font-sans font-semibold text-slate-900">
                    {currentActiveLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => fetchEmployeeJabatan(employee.nip)}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Muat Ulang</span>
              </Button>
              <Can modul="PERSONALIA" action="create">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setFormPopup({
                      mode: 'create',
                      nip: employee.nip,
                      employeeName: employee.nama,
                      employeeBagian: employee.bagian,
                      employeeFoto: employee.foto,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tambah Jabatan</span>
                </Button>
              </Can>
            </div>
          </div>

          {/* Tabel Daftar Jabatan Pegawai */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2
                  className="h-5 w-5 animate-spin text-slate-700"
                  aria-hidden="true"
                />
                <span>Memuat riwayat jabatan pegawai...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-6">
                <Alert variant="destructive">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <AlertTitle>Gagal Memuat Data</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </div>
                </Alert>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Briefcase
                  className="h-8 w-8 text-slate-300 mx-auto"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Belum Ada Riwayat Jabatan Tercatat
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Pegawai dengan NIP {employee.nip} belum memiliki data SK
                    penugasan jabatan pada basis data SDM.
                  </p>
                </div>
                <Can modul="PERSONALIA" action="create">
                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setFormPopup({
                          mode: 'create',
                          nip: employee.nip,
                          employeeName: employee.nama,
                          employeeBagian: employee.bagian,
                          employeeFoto: employee.foto,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tambah Jabatan Pertama</span>
                    </Button>
                  </div>
                </Can>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-5 whitespace-nowrap">ID</th>
                      <th className="py-3 px-5 whitespace-nowrap">
                        Jabatan & Singkatan
                      </th>
                      <th className="py-3 px-5 whitespace-nowrap">Jenis</th>
                      <th className="py-3 px-5 whitespace-nowrap">Nomor SK</th>
                      <th className="py-3 px-5 whitespace-nowrap">
                        TMT Jabatan
                      </th>
                      <th className="py-3 px-5 whitespace-nowrap">Status</th>
                      <th className="py-3 px-5 text-right whitespace-nowrap">
                        Tindakan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {rows.map((r, idx) => {
                      const rowId = String(r.replid ?? idx);
                      const isActive = Number(r.terakhir) === 1;
                      const masterLabel = String(
                        r.nama_jabatan_master || r.namajab || '-'
                      );
                      const singkatan =
                        r.singkatan && String(r.singkatan) !== 'null'
                          ? String(r.singkatan)
                          : '';

                      return (
                        <tr
                          key={`${rowId}-${idx}`}
                          onClick={() =>
                            setFormPopup({
                              mode: 'detail',
                              nip: employee.nip,
                              employeeName: employee.nama,
                              employeeBagian: employee.bagian,
                              employeeFoto: employee.foto,
                              record: r,
                            })
                          }
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-5 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                            #{rowId}
                          </td>
                          <td className="py-3 px-5">
                            <div className="font-semibold text-slate-900">
                              {masterLabel}
                            </div>
                            <div className="text-xs text-slate-500">
                              {singkatan ? `${singkatan} · ` : ''}
                              SK: {String(r.namajab || masterLabel)}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-xs text-slate-700 whitespace-nowrap">
                            {String(r.jenis || '-')}
                          </td>
                          <td className="py-3 px-5 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                            {String(r.sk || '-')}
                          </td>
                          <td className="py-3 px-5 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                            {String(r.tmt || '-')}
                          </td>
                          <td className="py-3 px-5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                isActive
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isActive ? (
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <MinusCircle
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{isActive ? 'Aktif' : 'Riwayat'}</span>
                            </span>
                          </td>
                          <td
                            className="py-3 px-5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-2">
                              <Can modul="PERSONALIA" action="update">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setFormPopup({
                                      mode: 'edit',
                                      nip: employee.nip,
                                      employeeName: employee.nama,
                                      employeeBagian: employee.bagian,
                                      employeeFoto: employee.foto,
                                      record: r,
                                    })
                                  }
                                >
                                  <Pencil
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Ubah</span>
                                </Button>
                              </Can>
                              <Can modul="PERSONALIA" action="delete">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setFormPopup({
                                      mode: 'delete',
                                      nip: employee.nip,
                                      employeeName: employee.nama,
                                      employeeBagian: employee.bagian,
                                      employeeFoto: employee.foto,
                                      record: r,
                                    })
                                  }
                                  className="text-red-700 border-red-200 hover:bg-red-50"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Hapus</span>
                                </Button>
                              </Can>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>Klik baris untuk melihat rincian lengkap SK jabatan.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Selesai
            </Button>
          </div>
        </div>
      </div>

      <PegawaiJabatanFormPopup
        popupState={formPopup}
        onClose={() => setFormPopup(null)}
        onSuccess={handleChildSuccess}
        onSwitchMode={(next) => setFormPopup(next)}
      />
    </>
  );
}
