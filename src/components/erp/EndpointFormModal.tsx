import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import type { ErpMutationAction } from '../../data/erpModules';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import { extractResponsePayload } from '../../lib/formatters';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface EndpointFormModalProps {
  action: ErpMutationAction | null;
  initialValues?: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}

interface GuruCandidateOption {
  value: string;
  nama: string;
  label: string;
  isTeachingGroup: boolean;
}

interface PelajaranDropdownOption {
  value: string;
  namaPelajaran: string;
  departemen: string;
  aktif: boolean;
  label: string;
}

interface StatusGuruDropdownOption {
  value: string;
  label: string;
}

const FALLBACK_STATUS_GURU = [
  'Guru Pelajaran',
  'Guru Kelas',
  'Guru Terpadu',
  'Guru Tetap',
];

export function EndpointFormModal({
  action,
  initialValues,
  onClose,
  onSuccess,
}: EndpointFormModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<unknown | null>(null);
  const [jabatanUsagePreview, setJabatanUsagePreview] = useState<{
    jabatanName: string;
    singkatan: string;
    activeHolders: { nip: string; nama: string }[];
  } | null>(null);

  // State khusus referensi dropdown dinamis Set Guru Mapel (POST /api/jbsakad/guru)
  const [isLoadingGuruRefs, setIsLoadingGuruRefs] = useState(false);
  const [guruCandidates, setGuruCandidates] = useState<GuruCandidateOption[]>(
    []
  );
  const [pelajaranOptions, setPelajaranOptions] = useState<
    PelajaranDropdownOption[]
  >([]);
  const [statusGuruOptions, setStatusGuruOptions] = useState<
    StatusGuruDropdownOption[]
  >([]);
  const [umumCardOptions, setUmumCardOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [umumBagianOptions, setUmumBagianOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [umumWilayahOptions, setUmumWilayahOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const isPutJabatan =
    action?.pathTemplate === '/jbssdm/jabatan/:replid' &&
    action?.method === 'PUT';
  const isDeleteJabatan =
    action?.pathTemplate === '/jbssdm/jabatan/:replid' &&
    action?.method === 'DELETE';
  const isSetGuruMapel =
    action?.pathTemplate === '/jbsakad/guru' && action?.method === 'POST';
  const isPutIdentitas =
    action?.pathTemplate === '/jbsumum/identitas/:replid' &&
    action?.method === 'PUT';
  const isJbsUmumAction = Boolean(action?.pathTemplate.startsWith('/jbsumum/'));

  useEffect(() => {
    if (!action) {
      return;
    }
    const defaults: Record<string, string> = {};
    for (const field of action.fields) {
      if (initialValues && initialValues[field.name] !== undefined) {
        defaults[field.name] = String(initialValues[field.name]);
      } else if (field.defaultValue !== undefined) {
        defaults[field.name] = String(field.defaultValue);
      } else {
        defaults[field.name] = '';
      }
    }
    setValues(defaults);
    setErrorMsg(null);
    setSuccessResult(null);
    setJabatanUsagePreview(null);
  }, [action, initialValues]);

  const loadGuruMapelReferences = useCallback(async () => {
    setIsLoadingGuruRefs(true);
    try {
      const [pegawaiRes, guruRes, pelajaranRes] = await Promise.allSettled([
        apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } }),
        apiClient.get('/jbsakad/guru'),
        apiClient.get('/jbsakad/pelajaran'),
      ]);

      // 1. Kumpulkan daftar Nama Guru (gabungan pegawai aktif SDM & daftar guru pengampu)
      const teacherMap = new Map<
        string,
        { nip: string; nama: string; bagian: string; isExistingGuru: boolean }
      >();

      if (pegawaiRes.status === 'fulfilled') {
        const rows = extractResponsePayload(pegawaiRes.value.data).rows;
        for (const r of rows) {
          if ('aktif' in r && Number(r.aktif) !== 1) continue;
          const nip = String(r.nip ?? '').trim();
          if (!nip) continue;
          const nama = String(r.nama ?? r.nama_pegawai ?? '').trim();
          const bagian =
            r.bagian && String(r.bagian) !== 'null'
              ? String(r.bagian).trim()
              : '';
          teacherMap.set(nip, {
            nip,
            nama,
            bagian,
            isExistingGuru: false,
          });
        }
      }

      // 2. Ekstrak nama guru tambahan & daftar unik "statusguru" dari GET /api/jbsakad/guru
      const statusMap = new Map<string, { value: string; label: string }>();

      if (guruRes.status === 'fulfilled') {
        const guruRows = extractResponsePayload(guruRes.value.data).rows;
        for (const r of guruRows) {
          const nip = String(r.nip ?? '').trim();
          const nama = String(r.nama ?? r.nama_pegawai ?? '').trim();
          if (nip) {
            const existing = teacherMap.get(nip);
            if (existing) {
              existing.isExistingGuru = true;
              if (!existing.nama && nama) existing.nama = nama;
            } else {
              teacherMap.set(nip, {
                nip,
                nama,
                bagian: 'Akademik',
                isExistingGuru: true,
              });
            }
          }

          if (r.statusguru !== undefined && r.statusguru !== null) {
            const rawStatus = String(r.statusguru);
            const cleanLabel = rawStatus.trim();
            if (cleanLabel && cleanLabel !== 'null') {
              const normKey = cleanLabel.toLowerCase();
              if (!statusMap.has(normKey)) {
                statusMap.set(normKey, {
                  value: rawStatus,
                  label: cleanLabel,
                });
              }
            }
          }
        }
      }

      const sortedTeachers: GuruCandidateOption[] = Array.from(
        teacherMap.values()
      )
        .map((item) => {
          const isTeachingGroup =
            item.isExistingGuru ||
            item.bagian.toLowerCase() === 'akademik' ||
            !item.bagian;
          const displayLabel = item.nama
            ? `${item.nama} — NIP ${item.nip}${
                item.bagian ? ` (${item.bagian})` : ''
              }`
            : `NIP ${item.nip}`;
          return {
            value: item.nip,
            nama: item.nama || item.nip,
            label: displayLabel,
            isTeachingGroup,
          };
        })
        .sort((a, b) => {
          if (a.isTeachingGroup !== b.isTeachingGroup) {
            return a.isTeachingGroup ? -1 : 1;
          }
          return a.nama.localeCompare(b.nama, 'id');
        });

      const resolvedStatuses: StatusGuruDropdownOption[] =
        statusMap.size > 0
          ? Array.from(statusMap.values()).sort((a, b) =>
              a.label.localeCompare(b.label, 'id')
            )
          : FALLBACK_STATUS_GURU.map((s) => ({ value: s, label: s }));

      // 3. Kumpulkan daftar Mata Pelajaran (render namaPelajaran / nama_mapel) dari GET /api/jbsakad/pelajaran
      const parsedPelajaran: PelajaranDropdownOption[] = [];
      const seenPelajaranIds = new Set<string>();

      if (pelajaranRes.status === 'fulfilled') {
        const pelRows = extractResponsePayload(pelajaranRes.value.data).rows;
        for (const r of pelRows) {
          const rawId = r.idpelajaran ?? r.replid ?? r.id;
          const idStr =
            rawId !== undefined && rawId !== null ? String(rawId).trim() : '';
          if (!idStr || seenPelajaranIds.has(idStr)) continue;
          seenPelajaranIds.add(idStr);

          const namaPelajaran = String(
            r.namaPelajaran ??
              r.nama_mapel ??
              r.namapelajaran ??
              r.nama_pelajaran ??
              r.nama ??
              ''
          ).trim();
          const kode =
            r.kode && String(r.kode) !== 'null' ? String(r.kode).trim() : '';
          const departemen =
            r.departemen && String(r.departemen) !== 'null'
              ? String(r.departemen).trim()
              : '';
          const aktif = !('aktif' in r) || Number(r.aktif) === 1;

          const baseName = namaPelajaran || `Pelajaran #${idStr}`;
          const metaParts: string[] = [];
          if (kode) metaParts.push(kode);
          if (departemen) metaParts.push(departemen);
          const metaSuffix =
            metaParts.length > 0 ? ` (${metaParts.join(' · ')})` : '';

          parsedPelajaran.push({
            value: idStr,
            namaPelajaran: baseName,
            departemen,
            aktif,
            label: `${baseName}${metaSuffix}`,
          });
        }
      }

      parsedPelajaran.sort((a, b) => {
        if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
        if (a.departemen !== b.departemen) {
          return a.departemen.localeCompare(b.departemen, 'id');
        }
        return a.namaPelajaran.localeCompare(b.namaPelajaran, 'id');
      });

      setGuruCandidates(sortedTeachers);
      setPelajaranOptions(parsedPelajaran);
      setStatusGuruOptions(resolvedStatuses);

      // Sinkronkan nilai awal statusguru (dan cocokkan apabila dipicu dari baris tabel)
      setValues((prev) => {
        const next = { ...prev };
        const currentStatusTrimmed = String(prev.statusguru ?? '')
          .trim()
          .toLowerCase();
        if (currentStatusTrimmed) {
          const matchedStatus = resolvedStatuses.find(
            (s) => s.label.toLowerCase() === currentStatusTrimmed
          );
          if (matchedStatus) {
            next.statusguru = matchedStatus.value;
          }
        } else if (resolvedStatuses.length > 0) {
          next.statusguru = resolvedStatuses[0].value;
        }
        return next;
      });
    } finally {
      setIsLoadingGuruRefs(false);
    }
  }, []);

  useEffect(() => {
    if (!isSetGuruMapel) {
      return;
    }
    loadGuruMapelReferences();
  }, [isSetGuruMapel, loadGuruMapelReferences]);

  // Muat referensi dinamis untuk aksi-aksi JBS Umum (Master Kartu, Bagian Nota, Wilayah)
  useEffect(() => {
    if (!isJbsUmumAction || !action) {
      return;
    }
    let cancelled = false;
    const needsCards = action.fields.some((f) => f.name === 'idcard');
    const needsBagian =
      action.pathTemplate.startsWith('/jbsumum/nota') &&
      action.fields.some((f) => f.name === 'bagian' && f.in === 'body');
    const needsWilayah =
      action.pathTemplate.startsWith('/jbsumum/sekolah') &&
      action.fields.some((f) => f.name === 'wilayah' && f.in === 'body');

    if (!needsCards && !needsBagian && !needsWilayah) {
      return;
    }

    Promise.allSettled([
      needsCards ? apiClient.get('/jbsumum/card') : Promise.resolve(null),
      needsBagian ? apiClient.get('/jbsumum/bagiannota') : Promise.resolve(null),
      needsWilayah ? apiClient.get('/jbsumum/wilayah') : Promise.resolve(null),
    ]).then(([cardRes, bagianRes, wilayahRes]) => {
      if (cancelled) return;

      if (cardRes.status === 'fulfilled' && cardRes.value) {
        const rows = extractResponsePayload(cardRes.value.data).rows;
        const opts = rows
          .map((r) => {
            const id = String(r.replid ?? r.id ?? '').trim();
            if (!id) return null;
            const judul = String(r.judul ?? `Kartu #${id}`).trim();
            const dept =
              r.departemen && String(r.departemen) !== 'null'
                ? String(r.departemen).trim()
                : '';
            return {
              value: id,
              label: `${judul}${dept ? ` — ${dept}` : ''} (ID #${id})`,
            };
          })
          .filter((x): x is { value: string; label: string } => Boolean(x));
        setUmumCardOptions(opts);
        if (opts.length > 0) {
          setValues((prev) =>
            prev.idcard ? prev : { ...prev, idcard: opts[0].value }
          );
        }
      }

      if (bagianRes.status === 'fulfilled' && bagianRes.value) {
        const rows = extractResponsePayload(bagianRes.value.data).rows;
        const opts = rows
          .map((r) => String(r.bagian ?? '').trim())
          .filter((b) => Boolean(b && b !== 'null'))
          .map((b) => ({ value: b, label: b }));
        setUmumBagianOptions(opts);
      }

      if (wilayahRes.status === 'fulfilled' && wilayahRes.value) {
        const rows = extractResponsePayload(wilayahRes.value.data).rows;
        const opts = rows
          .map((r) => String(r.namawilayah ?? r.wilayah ?? '').trim())
          .filter((w) => Boolean(w && w !== 'null'))
          .map((w) => ({ value: w, label: w }));
        setUmumWilayahOptions(opts);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isJbsUmumAction, action]);

  // Pratinjau detail jabatan & pegawai pemangku saat akan menghapus jabatan (DELETE /jbssdm/jabatan/:replid)
  useEffect(() => {
    if (!isDeleteJabatan) {
      setJabatanUsagePreview(null);
      return;
    }
    const replid = String(values.replid ?? '').trim();
    if (!replid) {
      setJabatanUsagePreview(null);
      return;
    }

    let cancelled = false;
    Promise.allSettled([
      apiClient.get(`/jbssdm/jabatan/${encodeURIComponent(replid)}`),
      apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } }),
    ]).then(([jabRes, pegRes]) => {
      if (cancelled) return;
      if (jabRes.status !== 'fulfilled') {
        setJabatanUsagePreview(null);
        return;
      }
      const jabData = (jabRes.value.data as Record<string, unknown>)?.data as
        | Record<string, unknown>
        | undefined;
      if (!jabData || typeof jabData !== 'object') {
        setJabatanUsagePreview(null);
        return;
      }

      const jabatanName = String(jabData.jabatan ?? '').trim();
      const singkatan = String(jabData.singkatan ?? '').trim();
      const activeHolders: { nip: string; nama: string }[] = [];

      if (jabatanName && pegRes.status === 'fulfilled') {
        const pegPayload = pegRes.value.data as Record<string, unknown>;
        const pegRows = Array.isArray(pegPayload?.data)
          ? (pegPayload.data as Record<string, unknown>[])
          : [];
        for (const p of pegRows) {
          if (
            String(p.jabatan ?? '').trim().toLowerCase() ===
            jabatanName.toLowerCase()
          ) {
            activeHolders.push({
              nip: String(p.nip ?? ''),
              nama: String(p.nama ?? ''),
            });
          }
        }
      }

      setJabatanUsagePreview({
        jabatanName,
        singkatan,
        activeHolders,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isDeleteJabatan, values.replid]);

  const handleLoadJabatanById = async () => {
    const replid = String(values.replid ?? '').trim();
    if (!replid) {
      setErrorMsg('Masukkan ID Jabatan (replid) terlebih dahulu untuk memuat data.');
      return;
    }
    setIsFetchingDetail(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get(
        `/jbssdm/jabatan/${encodeURIComponent(replid)}`
      );
      const dataObj = (res.data as Record<string, unknown>)?.data as
        | Record<string, unknown>
        | undefined;
      if (!dataObj || typeof dataObj !== 'object') {
        setErrorMsg(`Data jabatan dengan ID ${replid} tidak ditemukan.`);
        return;
      }
      setValues((prev) => ({
        ...prev,
        jabatan: dataObj.jabatan ? String(dataObj.jabatan) : '',
        singkatan: dataObj.singkatan ? String(dataObj.singkatan) : '',
        satker:
          dataObj.satker && String(dataObj.satker) !== 'null'
            ? String(dataObj.satker)
            : '(Tidak Ada)',
        eselon:
          dataObj.eselon && String(dataObj.eselon) !== 'null'
            ? String(dataObj.eselon)
            : '(Tidak Ada)',
        rootid:
          dataObj.rootid !== undefined && dataObj.rootid !== null
            ? String(dataObj.rootid)
            : '',
      }));
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handleLoadIdentitasById = async () => {
    const replid = String(values.replid ?? '').trim();
    if (!replid) {
      setErrorMsg(
        'Masukkan ID Identitas (replid) terlebih dahulu untuk memuat data.'
      );
      return;
    }
    setIsFetchingDetail(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get(
        `/jbsumum/identitas/${encodeURIComponent(replid)}`
      );
      const parsed = extractResponsePayload(res.data);
      const dataObj = parsed.singleObject || parsed.rows[0];
      if (!dataObj) {
        setErrorMsg(`Data identitas dengan ID ${replid} tidak ditemukan.`);
        return;
      }
      const cleanStr = (v: unknown) =>
        v !== undefined && v !== null && String(v) !== 'null' ? String(v) : '';
      setValues((prev) => ({
        ...prev,
        nama: cleanStr(dataObj.nama),
        departemen: cleanStr(dataObj.departemen),
        situs: cleanStr(dataObj.situs),
        email: cleanStr(dataObj.email),
        alamat1: cleanStr(dataObj.alamat1),
        alamat2: cleanStr(dataObj.alamat2),
        telp1: cleanStr(dataObj.telp1),
        telp2: cleanStr(dataObj.telp2),
        fax1: cleanStr(dataObj.fax1),
        keterangan: cleanStr(dataObj.keterangan),
      }));
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const previewRequest = useMemo(() => {
    if (!action) {
      return { path: '', body: {} as Record<string, unknown>, hasBody: false };
    }
    let resolvedPath = action.pathTemplate;
    const bodyPayload: Record<string, unknown> = {};
    let hasBodyField = false;

    for (const field of action.fields) {
      const rawString = String(values[field.name] ?? '');
      const trimmedVal = rawString.trim();
      if (field.in === 'path') {
        if (trimmedVal) {
          resolvedPath = resolvedPath.replace(
            `:${field.name}`,
            encodeURIComponent(trimmedVal)
          );
        }
      } else {
        hasBodyField = true;
        if (trimmedVal !== '') {
          const isNum =
            field.type === 'number' || field.valueType === 'number';
          const strVal = field.type === 'select' ? rawString : trimmedVal;
          bodyPayload[field.name] = isNum ? Number(trimmedVal) : strVal;
        }
      }
    }

    return {
      path: `/api${resolvedPath}`,
      body: bodyPayload,
      hasBody: hasBodyField,
    };
  }, [action, values]);

  if (!action) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessResult(null);

    for (const field of action.fields) {
      if (field.required && !String(values[field.name] ?? '').trim()) {
        setErrorMsg(`Kolom "${field.label}" wajib dipilih atau diisi.`);
        return;
      }
    }

    let resolvedPath = action.pathTemplate;
    const bodyPayload: Record<string, unknown> = {};

    for (const field of action.fields) {
      const rawString = String(values[field.name] ?? '');
      const trimmedVal = rawString.trim();
      if (field.in === 'path') {
        resolvedPath = resolvedPath.replace(
          `:${field.name}`,
          encodeURIComponent(trimmedVal)
        );
      } else if (trimmedVal !== '') {
        const isNum = field.type === 'number' || field.valueType === 'number';
        const strVal = field.type === 'select' ? rawString : trimmedVal;
        bodyPayload[field.name] = isNum ? Number(trimmedVal) : strVal;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.request({
        method: action.method,
        url: resolvedPath,
        data:
          Object.keys(bodyPayload).length > 0 ? bodyPayload : undefined,
      });

      const respData = response.data as Record<string, unknown> | undefined;
      if (
        respData &&
        typeof respData === 'object' &&
        (respData.status === 'error' || respData.success === false)
      ) {
        const msg = String(
          respData.pesan || respData.message || respData.error || 'Permintaan ditolak oleh server.'
        );
        setErrorMsg(msg);
        return;
      }

      setSuccessResult(response.data);
      onSuccess();
    } catch (err) {
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isJabatanInUseError = Boolean(
    isDeleteJabatan &&
      errorMsg &&
      /pegawai|dipakai|digunakan|terpakai|masih|referensi|foreign key|conflict/i.test(
        errorMsg
      )
  );

  const teachingGroupCandidates = guruCandidates.filter(
    (g) => g.isTeachingGroup
  );
  const nonTeachingCandidates = guruCandidates.filter(
    (g) => !g.isTeachingGroup
  );
  const activePelajaranOptions = pelajaranOptions.filter((p) => p.aktif);
  const inactivePelajaranOptions = pelajaranOptions.filter((p) => !p.aktif);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white text-slate-900 overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-action-title"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-500 tabular-nums truncate">
              {action.method} {previewRequest.path}
            </div>
            <h3 id="modal-action-title" className="text-base font-bold text-slate-900 mt-0.5">
              {action.label}
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

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {action.description}
          </p>

          {isSetGuruMapel && (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 border-b border-slate-100 pb-2.5">
              <span>
                {isLoadingGuruRefs
                  ? 'Memuat daftar guru, mata pelajaran, dan status guru...'
                  : `${guruCandidates.length} pegawai · ${pelajaranOptions.length} mata pelajaran · ${statusGuruOptions.length} status guru`}
              </span>
              <button
                type="button"
                onClick={loadGuruMapelReferences}
                disabled={isLoadingGuruRefs || isSubmitting}
                className="inline-flex items-center gap-1 font-semibold text-[#1565d8] hover:underline disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isLoadingGuruRefs ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Muat Ulang Opsi</span>
              </button>
            </div>
          )}

          {isDeleteJabatan && jabatanUsagePreview && !successResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
              <div className="font-semibold text-slate-800">
                Target Jabatan: {jabatanUsagePreview.jabatanName}
                {jabatanUsagePreview.singkatan
                  ? ` (${jabatanUsagePreview.singkatan})`
                  : ''}
              </div>
              {jabatanUsagePreview.activeHolders.length > 0 ? (
                <p className="text-amber-800 leading-relaxed">
                  Perhatian: Jabatan ini terdeteksi masih dipakai oleh{' '}
                  <strong>{jabatanUsagePreview.activeHolders.length} pegawai aktif</strong>{' '}
                  (
                  {jabatanUsagePreview.activeHolders
                    .map((h) => `${h.nama} [${h.nip}]`)
                    .join(', ')}
                  ). Server akan menolak penghapusan selama jabatan masih terpakai.
                </p>
              ) : (
                <p className="text-slate-600">
                  Pastikan jabatan ini tidak sedang tercatat pada riwayat jabatan pegawai sebelum menghapus.
                </p>
              )}
            </div>
          )}

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              <div className="space-y-1">
                <AlertTitle>
                  {isJabatanInUseError
                    ? 'Gagal Menghapus — Jabatan Masih Dipakai Pegawai'
                    : 'Permintaan Gagal'}
                </AlertTitle>
                <AlertDescription className="space-y-1.5">
                  <p>{errorMsg}</p>
                  {isJabatanInUseError && (
                    <p className="text-xs text-red-800/90">
                      Silakan ubah atau alihkan penugasan jabatan pada pegawai yang bersangkutan terlebih dahulu sebelum menghapus master jabatan ini.
                    </p>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {successResult !== null && (
            <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-950">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-2">
                <AlertTitle>Berhasil Diproses</AlertTitle>
                <AlertDescription>
                  <pre className="mt-1 p-3 rounded-lg bg-white border border-emerald-200 font-mono text-xs text-slate-800 overflow-x-auto">
                    {JSON.stringify(successResult, null, 2)}
                  </pre>
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className="space-y-4 pt-1">
            {action.fields.map((field) => {
              const currentVal = values[field.name] ?? '';

              // Render dropdown dinamis khusus untuk Set Guru Mapel (POST /api/jbsakad/guru)
              if (isSetGuruMapel && field.name === 'nip') {
                const hasCustomInitialNip =
                  Boolean(currentVal) &&
                  !guruCandidates.some((g) => g.value === currentVal);

                return (
                  <div key={field.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`field-${field.name}`}>
                        {field.label}
                        {field.required && (
                          <span className="text-red-600 ml-1">*</span>
                        )}
                      </Label>
                      {currentVal && (
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          NIP: {currentVal}
                        </span>
                      )}
                    </div>
                    {guruCandidates.length > 0 || isLoadingGuruRefs ? (
                      <select
                        id={`field-${field.name}`}
                        value={currentVal}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.name]: e.target.value,
                          }))
                        }
                        disabled={isSubmitting || isLoadingGuruRefs}
                        className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60"
                      >
                        <option value="">
                          {isLoadingGuruRefs
                            ? 'Memuat daftar nama guru...'
                            : '-- Pilih Nama Guru --'}
                        </option>
                        {hasCustomInitialNip && (
                          <option value={currentVal}>NIP {currentVal}</option>
                        )}
                        {teachingGroupCandidates.length > 0 &&
                        nonTeachingCandidates.length > 0 ? (
                          <>
                            <optgroup label="Tenaga Pendidik & Akademik">
                              {teachingGroupCandidates.map((opt, idx) => (
                                <option key={`${opt.value}-${idx}`} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Pegawai Lainnya">
                              {nonTeachingCandidates.map((opt, idx) => (
                                <option key={`${opt.value}-${idx}`} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          </>
                        ) : (
                          guruCandidates.map((opt, idx) => (
                            <option key={`${opt.value}-${idx}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <Input
                        id={`field-${field.name}`}
                        type="text"
                        placeholder="Masukkan NIP Guru"
                        value={currentVal}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.name]: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                      />
                    )}
                  </div>
                );
              }

              if (isSetGuruMapel && field.name === 'idpelajaran') {
                const hasCustomInitialPelajaran =
                  Boolean(currentVal) &&
                  !pelajaranOptions.some((p) => p.value === currentVal);

                return (
                  <div key={field.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`field-${field.name}`}>
                        {field.label}
                        {field.required && (
                          <span className="text-red-600 ml-1">*</span>
                        )}
                      </Label>
                      {currentVal && (
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          ID Mapel: {currentVal}
                        </span>
                      )}
                    </div>
                    {pelajaranOptions.length > 0 || isLoadingGuruRefs ? (
                      <select
                        id={`field-${field.name}`}
                        value={currentVal}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.name]: e.target.value,
                          }))
                        }
                        disabled={isSubmitting || isLoadingGuruRefs}
                        className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60"
                      >
                        <option value="">
                          {isLoadingGuruRefs
                            ? 'Memuat daftar mata pelajaran...'
                            : '-- Pilih Mata Pelajaran --'}
                        </option>
                        {hasCustomInitialPelajaran && (
                          <option value={currentVal}>
                            ID Pelajaran #{currentVal}
                          </option>
                        )}
                        {activePelajaranOptions.length > 0 &&
                        inactivePelajaranOptions.length > 0 ? (
                          <>
                            <optgroup label="Mata Pelajaran Aktif">
                              {activePelajaranOptions.map((opt, idx) => (
                                <option key={`${opt.value}-${idx}`} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Mata Pelajaran Nonaktif">
                              {inactivePelajaranOptions.map((opt, idx) => (
                                <option key={`${opt.value}-${idx}`} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          </>
                        ) : (
                          pelajaranOptions.map((opt, idx) => (
                            <option key={`${opt.value}-${idx}`} value={opt.value}>
                              {opt.label}
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      <Input
                        id={`field-${field.name}`}
                        type="number"
                        placeholder="Masukkan ID Mata Pelajaran"
                        value={currentVal}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.name]: e.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                      />
                    )}
                  </div>
                );
              }

              if (isSetGuruMapel && field.name === 'statusguru') {
                const hasCustomInitialStatus =
                  Boolean(currentVal) &&
                  !statusGuruOptions.some((s) => s.value === currentVal);

                return (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={`field-${field.name}`}>
                      {field.label}
                      {field.required && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </Label>
                    <select
                      id={`field-${field.name}`}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting || isLoadingGuruRefs}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60"
                    >
                      {statusGuruOptions.length === 0 && (
                        <option value="">
                          {isLoadingGuruRefs
                            ? 'Memuat status guru...'
                            : '-- Pilih Status Guru --'}
                        </option>
                      )}
                      {hasCustomInitialStatus && (
                        <option value={currentVal}>{currentVal.trim()}</option>
                      )}
                      {statusGuruOptions.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (
                isJbsUmumAction &&
                field.name === 'idcard' &&
                umumCardOptions.length > 0
              ) {
                return (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={`field-${field.name}`}>
                      {field.label}
                      {field.required && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </Label>
                    <select
                      id={`field-${field.name}`}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      {umumCardOptions.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (
                isJbsUmumAction &&
                field.name === 'bagian' &&
                field.in === 'body' &&
                !field.options &&
                umumBagianOptions.length > 0
              ) {
                const hasCustom =
                  Boolean(currentVal) &&
                  !umumBagianOptions.some((b) => b.value === currentVal);
                return (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={`field-${field.name}`}>
                      {field.label}
                      {field.required && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </Label>
                    <select
                      id={`field-${field.name}`}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <option value="">-- Pilih Bagian Nota --</option>
                      {hasCustom && (
                        <option value={currentVal}>{currentVal}</option>
                      )}
                      {umumBagianOptions.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (
                isJbsUmumAction &&
                field.name === 'wilayah' &&
                field.in === 'body' &&
                umumWilayahOptions.length > 0
              ) {
                const hasCustom =
                  Boolean(currentVal) &&
                  !umumWilayahOptions.some((w) => w.value === currentVal);
                return (
                  <div key={field.name} className="space-y-1.5">
                    <Label htmlFor={`field-${field.name}`}>
                      {field.label}
                      {field.required && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </Label>
                    <select
                      id={`field-${field.name}`}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <option value="">-- Pilih Wilayah (Opsional) --</option>
                      {hasCustom && (
                        <option value={currentVal}>{currentVal}</option>
                      )}
                      {umumWilayahOptions.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={field.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`field-${field.name}`}>
                      {field.label}
                      {field.required && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </Label>
                    {(isPutJabatan || isPutIdentitas) &&
                      field.name === 'replid' && (
                        <button
                          type="button"
                          onClick={
                            isPutIdentitas
                              ? handleLoadIdentitasById
                              : handleLoadJabatanById
                          }
                          disabled={isSubmitting || isFetchingDetail}
                          className="text-xs font-semibold text-[#1565d8] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          {isFetchingDetail ? 'Memuat...' : 'Muat Detail ID'}
                        </button>
                      )}
                  </div>

                  {field.type === 'select' && field.options ? (
                    <select
                      id={`field-${field.name}`}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      {field.options.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={`field-${field.name}`}
                      rows={3}
                      placeholder={field.placeholder}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                      className="flex w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  ) : (
                    <Input
                      id={`field-${field.name}`}
                      type={field.type === 'select' ? 'number' : field.type}
                      placeholder={field.placeholder}
                      value={currentVal}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Pratinjau Muatan JSON Real-Time */}
          {previewRequest.hasBody && (
            <div className="pt-2 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">
                Pratinjau Payload JSON
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto">
                {JSON.stringify(previewRequest.body, null, 2)}
              </pre>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Tutup
            </Button>
            <Button
              type="submit"
              variant={action.destructive ? 'destructive' : 'default'}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Kirim Permintaan</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
