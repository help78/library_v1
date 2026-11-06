import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatColumnLabel,
  isHiddenSyncKey,
  selectTableColumns,
} from '../../lib/formatters';
import { AvatarImage } from './AvatarImage';
import { formatCellDisplay, type InspectedEntity } from './SmartDataTable';
import {
  PegawaiJabatanFormPopup,
  type PegawaiJabatanPopupState,
} from './PegawaiJabatanModal';
import { ProfilPresensiSiswa } from './ProfilPresensiSiswa';
import { RaporPenilaianWorkspace } from './RaporPenilaianWorkspace';
import { JadwalKelasWorkspace } from './JadwalKelasWorkspace';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface EntityDetailSheetProps {
  entity: InspectedEntity | null;
  canManageHakAkses?: boolean;
  onClose: () => void;
  onMutated?: () => void;
}

interface SubFetchState {
  loading: boolean;
  error: string | null;
  rows: Record<string, unknown>[];
  singleObject: Record<string, unknown> | null;
  raw: unknown;
}

const HAKAKSES_MODULE_OPTIONS = [
  { label: 'CBE — Ujian Berbasis Komputer', value: 'CBE' },
  { label: 'INFOGURU — Portal Guru & Pengajaran', value: 'INFOGURU' },
  { label: 'SIMAKA — Manajemen Akademik', value: 'SIMAKA' },
  { label: 'KEUANGAN — Keuangan & Tagihan', value: 'KEUANGAN' },
  { label: 'SIMPEG — Kepegawaian (SDM)', value: 'SIMPEG' },
  { label: 'SIMTAKA — Perpustakaan', value: 'SIMTAKA' },
  { label: 'CARDMAKER — Sistem Kartu Pintar', value: 'CARDMAKER' },
  { label: 'EMA — Eksekutif Manajemen', value: 'EMA' },
  { label: 'JSA — Administrasi Pengguna', value: 'JSA' },
  { label: 'SMSG — Layanan Pesan & Nota', value: 'SMSG' },
];

export function EntityDetailSheet({
  entity,
  canManageHakAkses = false,
  onClose,
  onMutated,
}: EntityDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<string>('primary');
  const [copied, setCopied] = useState(false);
  const [subRefreshKey, setSubRefreshKey] = useState(0);
  const [subState, setSubState] = useState<SubFetchState>({
    loading: false,
    error: null,
    rows: [],
    singleObject: null,
    raw: null,
  });

  // State form tambah cepat POST /api/jbsuser/hakakses pada tab Hak Akses pegawai
  const [newModul, setNewModul] = useState<string>('CBE');
  const [newTingkat, setNewTingkat] = useState<string>('2');
  const [grantLoading, setGrantLoading] = useState<boolean>(false);
  const [revokingReplid, setRevokingReplid] = useState<string | null>(null);
  const [mutationNotice, setMutationNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // State khusus mode === 'jabatan' (GET / PUT / DELETE /api/jbssdm/jabatan/:replid)
  const [jabatanHolders, setJabatanHolders] = useState<
    { nip: string; nama: string; bagian: string }[]
  >([]);
  const [editJabatanName, setEditJabatanName] = useState<string>('');
  const [editSingkatan, setEditSingkatan] = useState<string>('');
  const [editSatker, setEditSatker] = useState<string>('(Tidak Ada)');
  const [editEselon, setEditEselon] = useState<string>('(Tidak Ada)');
  const [editRootId, setEditRootId] = useState<string>('');
  const [jabatanMutating, setJabatanMutating] = useState<boolean>(false);
  const [confirmDeleteJabatan, setConfirmDeleteJabatan] =
    useState<boolean>(false);
  const [pegawaiJabatanPopup, setPegawaiJabatanPopup] =
    useState<PegawaiJabatanPopupState | null>(null);

  useEffect(() => {
    setActiveTab('primary');
    setCopied(false);
    setMutationNotice(null);
    setConfirmDeleteJabatan(false);
    setPegawaiJabatanPopup(null);
  }, [entity]);

  const handleSubRawPayloadLoaded = useCallback((raw: unknown) => {
    setSubState((prev) => (prev.raw === raw ? prev : { ...prev, raw }));
  }, []);

  useEffect(() => {
    setMutationNotice(null);
    setConfirmDeleteJabatan(false);
    setPegawaiJabatanPopup(null);
  }, [activeTab]);

  const loadSubTab = useCallback(() => {
    if (!entity) {
      return () => {};
    }

    let endpoint: string | null = null;
    const id = entity.identifier ? encodeURIComponent(entity.identifier) : '';

    if (entity.mode === 'siswa' && id) {
      if (
        activeTab === 'presensi-mapel' ||
        activeTab === 'presensi-harian' ||
        activeTab === 'nilai'
      ) {
        // Tab presensi individu & rapor/nilai ujian dirender langsung oleh komponen mandiri embedded
        setSubState((prev) => ({ ...prev, loading: false, error: null }));
        return () => {};
      }
      if (activeTab === 'primary') endpoint = `/jbsakad/siswa/detail/${id}`;
      else if (activeTab === 'tagihan') endpoint = `/jbsfina/tagihan/${id}`;
      else if (activeTab === 'baca-digital') endpoint = `/jbsperpus/baca-digital`;
    } else if (entity.mode === 'pegawai' && id) {
      if (activeTab === 'primary') {
        let cancelled = false;
        setSubState((prev) => ({ ...prev, loading: true, error: null }));

        Promise.allSettled([
          apiClient.get(`/jbssdm/pegawai/detail/${id}`),
          apiClient.get('/jbssdm/pegawai', {
            params: { nip: entity.identifier },
          }),
        ]).then(([detailRes, nipListRes]) => {
          if (cancelled) return;

          let liveJabatan: unknown = entity.row?.jabatan ?? null;
          if (nipListRes.status === 'fulfilled') {
            const nipParsed = extractResponsePayload(nipListRes.value.data);
            const matchedRow = nipParsed.rows[0] || nipParsed.singleObject;
            if (matchedRow && matchedRow.jabatan !== undefined) {
              liveJabatan = matchedRow.jabatan;
            }
          }

          if (detailRes.status === 'fulfilled') {
            const parsed = extractResponsePayload(detailRes.value.data);
            const baseObj = parsed.singleObject || entity.row;
            const enrichedObj =
              baseObj && typeof baseObj === 'object'
                ? {
                    ...(liveJabatan !== undefined ? { jabatan: liveJabatan } : {}),
                    ...baseObj,
                  }
                : baseObj;

            setSubState({
              loading: false,
              error: null,
              rows: [],
              singleObject: enrichedObj,
              raw: detailRes.value.data,
            });
          } else if (entity.row && Object.keys(entity.row).length > 0) {
            setSubState({
              loading: false,
              error: null,
              rows: [],
              singleObject: {
                ...(liveJabatan !== undefined ? { jabatan: liveJabatan } : {}),
                ...entity.row,
              },
              raw: entity.row,
            });
          } else {
            setSubState({
              loading: false,
              error: extractApiErrorMessage(detailRes.reason),
              rows: [],
              singleObject: null,
              raw: null,
            });
          }
        });

        return () => {
          cancelled = true;
        };
      }
      if (activeTab === 'hakakses' && canManageHakAkses)
        endpoint = `/jbsuser/hakakses/${id}`;
      else if (activeTab === 'keluarga') endpoint = `/jbssdm/pegawai/${id}/keluarga`;
      else if (activeTab === 'sekolah') endpoint = `/jbssdm/pegawai/${id}/sekolah`;
      else if (activeTab === 'jabatan') endpoint = `/jbssdm/pegawai/${id}/jabatan`;
    } else if (entity.mode === 'jabatan' && id) {
      if (activeTab === 'primary' || activeTab === 'edit') {
        let cancelled = false;
        setSubState((prev) => ({ ...prev, loading: true, error: null }));

        Promise.allSettled([
          apiClient.get(`/jbssdm/jabatan/${id}`),
          apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } }),
        ]).then(([jabRes, pegRes]) => {
          if (cancelled) return;
          if (jabRes.status === 'rejected') {
            setSubState({
              loading: false,
              error: extractApiErrorMessage(jabRes.reason),
              rows: [],
              singleObject: null,
              raw: null,
            });
            setJabatanHolders([]);
            return;
          }

          const parsed = extractResponsePayload(jabRes.value.data);
          const single = parsed.singleObject;
          if (single) {
            setEditJabatanName(single.jabatan ? String(single.jabatan) : '');
            setEditSingkatan(single.singkatan ? String(single.singkatan) : '');
            setEditSatker(
              single.satker && String(single.satker) !== 'null'
                ? String(single.satker)
                : '(Tidak Ada)'
            );
            setEditEselon(
              single.eselon && String(single.eselon) !== 'null'
                ? String(single.eselon)
                : '(Tidak Ada)'
            );
            setEditRootId(
              single.rootid !== undefined && single.rootid !== null
                ? String(single.rootid)
                : ''
            );
          }

          const targetName = String(
            single?.jabatan ?? entity.row?.jabatan ?? ''
          )
            .trim()
            .toLowerCase();
          const holders: { nip: string; nama: string; bagian: string }[] = [];
          if (targetName && pegRes.status === 'fulfilled') {
            const pegRows = extractResponsePayload(pegRes.value.data).rows;
            for (const p of pegRows) {
              if (
                String(p.jabatan ?? '').trim().toLowerCase() === targetName
              ) {
                holders.push({
                  nip: String(p.nip ?? ''),
                  nama: String(p.nama ?? ''),
                  bagian: String(p.bagian ?? '-'),
                });
              }
            }
          }
          setJabatanHolders(holders);

          setSubState({
            loading: false,
            error: null,
            rows: [],
            singleObject: single,
            raw: jabRes.value.data,
          });
        });

        return () => {
          cancelled = true;
        };
      }
    } else if (entity.mode === 'kelas' && id) {
      if (activeTab === 'jadwal') {
        // Tab jadwal kelas dirender langsung secara interaktif oleh <JadwalKelasWorkspace embedded />
        setSubState((prev) => ({ ...prev, loading: false, error: null }));
        return () => {};
      }
      if (activeTab === 'primary') endpoint = `/jbsakad/siswa/kelas/${id}`;
    }

    if (!endpoint) {
      setSubState({
        loading: false,
        error: null,
        rows: [],
        singleObject: entity.row,
        raw: entity.row,
      });
      return () => {};
    }

    let cancelled = false;
    setSubState((prev) => ({ ...prev, loading: true, error: null }));

    apiClient
      .get(endpoint)
      .then((res) => {
        if (cancelled) return;
        const parsed = extractResponsePayload(res.data);
        const filteredRows =
          entity.mode === 'siswa' && activeTab === 'baca-digital' && entity.identifier
            ? parsed.rows.filter(
                (r) => String(r.nis || '').trim() === String(entity.identifier).trim()
              )
            : parsed.rows;

        let mergedSingle = parsed.singleObject;
        if (
          entity.mode === 'siswa' &&
          activeTab === 'primary' &&
          mergedSingle &&
          entity.row &&
          ('tgllulus' in entity.row || 'nama_kelasakhir' in entity.row)
        ) {
          const alumniMeta: Record<string, unknown> = {};
          if (entity.row.nama_kelasakhir !== undefined) {
            alumniMeta.nama_kelasakhir = entity.row.nama_kelasakhir;
          }
          if (entity.row.nama_tahunajaran !== undefined) {
            alumniMeta.nama_tahunajaran = entity.row.nama_tahunajaran;
          }
          if (entity.row.tgllulus !== undefined) {
            alumniMeta.tgllulus = entity.row.tgllulus;
          }
          if (entity.row.departemen !== undefined) {
            alumniMeta.departemen = entity.row.departemen;
          }
          if (
            entity.row.keterangan !== undefined &&
            entity.row.keterangan !== null &&
            String(entity.row.keterangan).trim() !== ''
          ) {
            alumniMeta.keterangan = entity.row.keterangan;
          }
          mergedSingle = {
            ...alumniMeta,
            ...mergedSingle,
          };
        }

        setSubState({
          loading: false,
          error: null,
          rows: filteredRows,
          singleObject: mergedSingle,
          raw: res.data,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (
          activeTab === 'primary' &&
          entity.row &&
          Object.keys(entity.row).length > 0
        ) {
          setSubState({
            loading: false,
            error: null,
            rows: [],
            singleObject: entity.row,
            raw: entity.row,
          });
          return;
        }
        setSubState({
          loading: false,
          error: extractApiErrorMessage(err),
          rows: [],
          singleObject: null,
          raw: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [entity, activeTab, canManageHakAkses]);

  useEffect(() => {
    const cleanup = loadSubTab();
    return cleanup;
  }, [loadSubTab, subRefreshKey]);

  if (!entity) {
    return null;
  }

  const tabs: { id: string; label: string }[] = (() => {
    if (entity.mode === 'siswa') {
      return [
        { id: 'primary', label: 'Biodata Lengkap' },
        { id: 'presensi-mapel', label: 'Presensi Mapel' },
        { id: 'presensi-harian', label: 'Presensi Harian' },
        { id: 'tagihan', label: 'Tagihan Siswa' },
        { id: 'nilai', label: 'Rapor & Nilai' },
        { id: 'baca-digital', label: 'Baca E-Book' },
        { id: 'json', label: 'Respons JSON' },
      ];
    }
    if (entity.mode === 'pegawai') {
      return [
        { id: 'primary', label: 'Biodata SDM' },
        ...(canManageHakAkses ? [{ id: 'hakakses', label: 'Hak Akses' }] : []),
        { id: 'keluarga', label: 'Keluarga' },
        { id: 'sekolah', label: 'Pendidikan' },
        { id: 'jabatan', label: 'Jabatan' },
        { id: 'json', label: 'Respons JSON' },
      ];
    }
    if (entity.mode === 'jabatan') {
      return [
        { id: 'primary', label: 'Detail Jabatan' },
        { id: 'edit', label: 'Ubah Jabatan' },
        { id: 'json', label: 'Respons JSON' },
      ];
    }
    if (entity.mode === 'kelas') {
      return [
        { id: 'primary', label: 'Daftar Siswa Kelas' },
        { id: 'jadwal', label: 'Jadwal Pelajaran' },
        { id: 'json', label: 'Respons JSON' },
      ];
    }
    if (entity.mode === 'raw-response') {
      return [{ id: 'json', label: 'Respons JSON Lengkap' }];
    }
    return [
      { id: 'primary', label: 'Atribut Terformat' },
      { id: 'json', label: 'Respons JSON' },
    ];
  })();

  const effectiveTab =
    entity.mode === 'raw-response' ? 'json' : activeTab;

  const jsonPayload = subState.raw ?? entity.row;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
  };

  const handleQuickGrantHakAkses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageHakAkses) return;
    const nip = String(entity.identifier ?? '').trim();
    if (!nip) return;

    setGrantLoading(true);
    setMutationNotice(null);

    try {
      const payload = {
        nip,
        modul: newModul,
        tingkat: Number(newTingkat),
      };
      const res = await apiClient.post('/jbsuser/hakakses', payload);
      const data = res.data as Record<string, unknown> | undefined;
      if (data && (data.status === 'error' || data.success === false)) {
        setMutationNotice({
          type: 'error',
          message: String(data.pesan || data.message || 'Gagal menambah hak akses.'),
        });
        return;
      }

      setMutationNotice({
        type: 'success',
        message: String(
          data?.pesan ||
            data?.message ||
            `Hak akses modul ${newModul} (Tingkat ${newTingkat}) berhasil ditambahkan untuk NIP ${nip}.`
        ),
      });
      setSubRefreshKey((k) => k + 1);
      onMutated?.();
    } catch (err) {
      setMutationNotice({
        type: 'error',
        message: extractApiErrorMessage(err),
      });
    } finally {
      setGrantLoading(false);
    }
  };

  const handleQuickRevokeHakAkses = async (replid: string) => {
    if (!canManageHakAkses || !replid) return;
    setRevokingReplid(replid);
    setMutationNotice(null);

    try {
      const res = await apiClient.delete(
        `/jbsuser/hakakses/${encodeURIComponent(replid)}`
      );
      const data = res.data as Record<string, unknown> | undefined;
      if (data && (data.status === 'error' || data.success === false)) {
        setMutationNotice({
          type: 'error',
          message: String(data.pesan || data.message || 'Gagal mencabut hak akses.'),
        });
        return;
      }

      setMutationNotice({
        type: 'success',
        message: String(
          data?.pesan ||
            data?.message ||
            `Hak akses (replid #${replid}) berhasil dicabut.`
        ),
      });
      setSubRefreshKey((k) => k + 1);
      onMutated?.();
    } catch (err) {
      setMutationNotice({
        type: 'error',
        message: extractApiErrorMessage(err),
      });
    } finally {
      setRevokingReplid(null);
    }
  };

  const handleUpdateJabatan = async (e: React.FormEvent) => {
    e.preventDefault();
    const replid = String(entity.identifier ?? '').trim();
    if (!replid) return;

    if (!editJabatanName.trim() || !editSingkatan.trim()) {
      setMutationNotice({
        type: 'error',
        message: 'Nama Jabatan dan Singkatan wajib diisi.',
      });
      return;
    }

    setJabatanMutating(true);
    setMutationNotice(null);

    try {
      const payload: Record<string, unknown> = {
        jabatan: editJabatanName.trim(),
        singkatan: editSingkatan.trim(),
        satker: editSatker,
        eselon: editEselon,
      };
      if (editRootId.trim() !== '') {
        payload.rootid = Number(editRootId.trim());
      }

      const res = await apiClient.put(
        `/jbssdm/jabatan/${encodeURIComponent(replid)}`,
        payload
      );
      const data = res.data as Record<string, unknown> | undefined;
      if (data && (data.status === 'error' || data.success === false)) {
        setMutationNotice({
          type: 'error',
          message: String(
            data.pesan || data.message || 'Gagal memperbarui data jabatan.'
          ),
        });
        return;
      }

      setMutationNotice({
        type: 'success',
        message: String(
          data?.pesan ||
            data?.message ||
            `Data jabatan "${editJabatanName.trim()}" berhasil diperbarui.`
        ),
      });
      setSubRefreshKey((k) => k + 1);
      onMutated?.();
    } catch (err) {
      setMutationNotice({
        type: 'error',
        message: extractApiErrorMessage(err),
      });
    } finally {
      setJabatanMutating(false);
    }
  };

  const handleDeleteJabatan = async () => {
    const replid = String(entity.identifier ?? '').trim();
    if (!replid) return;

    setJabatanMutating(true);
    setMutationNotice(null);

    try {
      const res = await apiClient.delete(
        `/jbssdm/jabatan/${encodeURIComponent(replid)}`
      );
      const data = res.data as Record<string, unknown> | undefined;
      if (data && (data.status === 'error' || data.success === false)) {
        setMutationNotice({
          type: 'error',
          message: String(
            data.pesan ||
              data.message ||
              'Data jabatan tidak dapat dihapus karena masih dipakai oleh pegawai.'
          ),
        });
        setConfirmDeleteJabatan(false);
        return;
      }

      onMutated?.();
      onClose();
    } catch (err) {
      setMutationNotice({
        type: 'error',
        message: extractApiErrorMessage(err),
      });
      setConfirmDeleteJabatan(false);
    } finally {
      setJabatanMutating(false);
    }
  };

  const isPegawaiHakAksesTab =
    entity.mode === 'pegawai' && effectiveTab === 'hakakses';

  const isPegawaiJabatanTab =
    entity.mode === 'pegawai' && effectiveTab === 'jabatan';

  const isJabatanInUseNotice = Boolean(
    entity.mode === 'jabatan' &&
      mutationNotice?.type === 'error' &&
      /pegawai|dipakai|digunakan|terpakai|masih|referensi|foreign key|conflict/i.test(
        mutationNotice.message
      )
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div
        className="w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={entity.title}
      >
        {/* Header Drawer */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">
              {entity.mode === 'siswa' && `Profil Peserta Didik · NIS ${entity.identifier}`}
              {entity.mode === 'pegawai' && `Profil Kepegawaian SDM · NIP ${entity.identifier}`}
              {entity.mode === 'jabatan' &&
                `Master Jabatan SDM · GET /api/jbssdm/jabatan/${entity.identifier}`}
              {entity.mode === 'kelas' && `Rombongan Belajar · ID Kelas ${entity.identifier}`}
              {entity.mode === 'generic' && 'Rincian Rekaman Data'}
              {entity.mode === 'raw-response' && 'Inspeksi Respons Endpoint API'}
            </div>
            <h3 className="text-lg font-bold text-slate-900 truncate mt-0.5">
              {String(
                (entity.mode === 'jabatan' && subState.singleObject?.jabatan) ||
                  entity.title
              )}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel rincian"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Sub-Navigasi Tab Kontekstual */}
        {tabs.length > 1 && (
          <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  effectiveTab === t.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Isi Panel */}
        <div className="flex-1 overflow-y-auto">
          {/* Panel Tambah Cepat POST /api/jbsuser/hakakses pada Tab Hak Akses Pegawai */}
          {isPegawaiHakAksesTab && canManageHakAkses && entity.identifier && (
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    POST /api/jbsuser/hakakses
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                    Tambah Hak Akses Baru untuk NIP {entity.identifier}
                  </h4>
                </div>
              </div>

              {mutationNotice && (
                <Alert
                  variant={mutationNotice.type === 'error' ? 'destructive' : 'default'}
                  className={
                    mutationNotice.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                      : ''
                  }
                >
                  {mutationNotice.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
                  )}
                  <div>
                    <AlertTitle>
                      {mutationNotice.type === 'error' ? 'Gagal Memproses' : 'Berhasil'}
                    </AlertTitle>
                    <AlertDescription>{mutationNotice.message}</AlertDescription>
                  </div>
                </Alert>
              )}

              <form
                onSubmit={handleQuickGrantHakAkses}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-6 space-y-1">
                  <label
                    htmlFor="quick-hakakses-modul"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Kode Modul
                  </label>
                  <select
                    id="quick-hakakses-modul"
                    value={newModul}
                    onChange={(e) => setNewModul(e.target.value)}
                    disabled={grantLoading}
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    {HAKAKSES_MODULE_OPTIONS.map((opt, idx) => (
                      <option key={`${opt.value}-${idx}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label
                    htmlFor="quick-hakakses-tingkat"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Tingkat
                  </label>
                  <select
                    id="quick-hakakses-tingkat"
                    value={newTingkat}
                    onChange={(e) => setNewTingkat(e.target.value)}
                    disabled={grantLoading}
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <option value="1">1 (Semua Dept)</option>
                    <option value="2">2 (Pegawai)</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={grantLoading}
                    className="w-full h-9 whitespace-nowrap"
                  >
                    {grantLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Tambah</span>
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Header Aksi Popup CRUD pada Tab Jabatan Pegawai (/api/jbssdm/pegawai/:nip/jabatan) */}
          {isPegawaiJabatanTab && entity.identifier && (
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-slate-500 tabular-nums">
                  GET · POST · PUT · DELETE /api/jbssdm/pegawai/{entity.identifier}/jabatan
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  Riwayat SK & Penugasan Jabatan Pegawai
                </h4>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setPegawaiJabatanPopup({
                    mode: 'create',
                    nip: String(entity.identifier),
                    employeeName: entity.title,
                    employeeFoto: entity.row?.foto,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tambah Jabatan</span>
              </Button>
            </div>
          )}

          {effectiveTab === 'json' ? (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Muatan JSON Asli Server
                </span>
                <Button variant="outline" size="sm" onClick={handleCopyJson}>
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Salin JSON</span>
                    </>
                  )}
                </Button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto">
                {JSON.stringify(jsonPayload, null, 2)}
              </pre>
            </div>
          ) : entity.mode === 'siswa' &&
            effectiveTab === 'nilai' &&
            entity.identifier ? (
            <RaporPenilaianWorkspace
              initialMode="rapor-siswa"
              lockedNis={String(entity.identifier)}
              studentName={entity.title}
              embedded={true}
              refreshSignal={subRefreshKey}
              onMutated={onMutated}
              onRawPayloadLoaded={handleSubRawPayloadLoaded}
            />
          ) : entity.mode === 'kelas' &&
            effectiveTab === 'jadwal' &&
            entity.identifier ? (
            <JadwalKelasWorkspace
              lockedIdKelas={String(entity.identifier)}
              classNameTitle={entity.title}
              embedded={true}
              refreshSignal={subRefreshKey}
              onRawPayloadLoaded={handleSubRawPayloadLoaded}
            />
          ) : entity.mode === 'siswa' &&
            (effectiveTab === 'presensi-mapel' ||
              effectiveTab === 'presensi-harian') &&
            entity.identifier ? (
            <ProfilPresensiSiswa
              endpointType={
                effectiveTab === 'presensi-harian' ? 'harian' : 'pelajaran'
              }
              lockedNis={String(entity.identifier)}
              studentName={entity.title}
              embedded={true}
              refreshSignal={subRefreshKey}
              onRawPayloadLoaded={handleSubRawPayloadLoaded}
            />
          ) : subState.loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" aria-hidden="true" />
              <span>Mengambil data terkait dari server...</span>
            </div>
          ) : subState.error ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800">{subState.error}</p>
              <p className="text-xs text-slate-500">
                Belum terdapat data tercatat pada sub-layanan ini.
              </p>
            </div>
          ) : entity.mode === 'jabatan' && effectiveTab === 'edit' ? (
            <div className="p-6 space-y-5">
              <div>
                <div className="text-xs font-mono text-slate-500 tabular-nums">
                  PUT /api/jbssdm/jabatan/{entity.identifier}
                </div>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">
                  Ubah Data Master Jabatan
                </h4>
              </div>

              {mutationNotice && (
                <Alert
                  variant={mutationNotice.type === 'error' ? 'destructive' : 'default'}
                  className={
                    mutationNotice.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                      : ''
                  }
                >
                  {mutationNotice.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden="true" />
                  )}
                  <div>
                    <AlertTitle>
                      {mutationNotice.type === 'error' ? 'Gagal Memperbarui' : 'Berhasil'}
                    </AlertTitle>
                    <AlertDescription>{mutationNotice.message}</AlertDescription>
                  </div>
                </Alert>
              )}

              <form onSubmit={handleUpdateJabatan} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="sheet-edit-jabatan"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Nama Jabatan <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="sheet-edit-jabatan"
                    value={editJabatanName}
                    onChange={(e) => setEditJabatanName(e.target.value)}
                    disabled={jabatanMutating}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="sheet-edit-singkatan"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Singkatan Jabatan <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="sheet-edit-singkatan"
                    value={editSingkatan}
                    onChange={(e) => setEditSingkatan(e.target.value)}
                    disabled={jabatanMutating}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="sheet-edit-satker"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Satuan Kerja
                    </label>
                    <select
                      id="sheet-edit-satker"
                      value={editSatker}
                      onChange={(e) => setEditSatker(e.target.value)}
                      disabled={jabatanMutating}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <option value="MANAJEMEN">MANAJEMEN</option>
                      <option value="GURU">GURU</option>
                      <option value="TATA USAHA">TATA USAHA</option>
                      <option value="YAYASAN">YAYASAN</option>
                      <option value="KOPERASI">KOPERASI</option>
                      <option value="(Tidak Ada)">(Tidak Ada)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="sheet-edit-eselon"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Eselon
                    </label>
                    <select
                      id="sheet-edit-eselon"
                      value={editEselon}
                      onChange={(e) => setEditEselon(e.target.value)}
                      disabled={jabatanMutating}
                      className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <option value="(Tidak Ada)">(Tidak Ada)</option>
                      <option value="Eselon I">Eselon I</option>
                      <option value="Eselon II">Eselon II</option>
                      <option value="Eselon III">Eselon III</option>
                      <option value="Eselon IV">Eselon IV</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="sheet-edit-rootid"
                    className="block text-xs font-medium text-slate-700"
                  >
                    ID Jabatan Induk (rootid)
                  </label>
                  <Input
                    id="sheet-edit-rootid"
                    type="number"
                    value={editRootId}
                    onChange={(e) => setEditRootId(e.target.value)}
                    disabled={jabatanMutating}
                    placeholder="Contoh: 27"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab('primary')}
                    disabled={jabatanMutating}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={jabatanMutating}>
                    {jabatanMutating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>Simpan Perubahan</span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : subState.singleObject ? (
            <div className="divide-y divide-slate-200">
              {entity.mode === 'jabatan' && (
                <div className="p-6 bg-slate-50/50 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 tabular-nums">
                      ID Jabatan:{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        #{entity.identifier}
                      </span>{' '}
                      · Pegawai Aktif Pemangku:{' '}
                      <span className="font-semibold text-slate-900">
                        {jabatanHolders.length} orang
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={jabatanMutating}
                        onClick={() => setActiveTab('edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ubah</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={jabatanMutating}
                        onClick={() => setConfirmDeleteJabatan((prev) => !prev)}
                        className="text-red-700 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Hapus</span>
                      </Button>
                    </div>
                  </div>

                  {confirmDeleteJabatan && (
                    <div className="rounded-lg border border-red-200 bg-white p-4 space-y-3">
                      <div className="text-xs text-slate-700 leading-relaxed">
                        Konfirmasi penghapusan jabatan{' '}
                        <strong className="text-slate-900">
                          {String(subState.singleObject.jabatan || entity.title)}
                        </strong>{' '}
                        (<code className="font-mono">DELETE /api/jbssdm/jabatan/{entity.identifier}</code>)?
                        {jabatanHolders.length > 0 && (
                          <span className="block mt-1 text-amber-800 font-medium">
                            Catatan: Terdapat {jabatanHolders.length} pegawai aktif yang sedang memangku jabatan ini. Server akan menolak penghapusan apabila jabatan masih dipakai pegawai.
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={jabatanMutating}
                          onClick={() => setConfirmDeleteJabatan(false)}
                        >
                          Batal
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={jabatanMutating}
                          onClick={handleDeleteJabatan}
                        >
                          {jabatanMutating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              <span>Menghapus...</span>
                            </>
                          ) : (
                            <span>Ya, Hapus Jabatan</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {mutationNotice && (
                    <Alert
                      variant={
                        mutationNotice.type === 'error' ? 'destructive' : 'default'
                      }
                      className={
                        mutationNotice.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                          : ''
                      }
                    >
                      {mutationNotice.type === 'error' ? (
                        <AlertCircle
                          className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2
                          className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700"
                          aria-hidden="true"
                        />
                      )}
                      <div className="space-y-1">
                        <AlertTitle>
                          {isJabatanInUseNotice
                            ? 'Jabatan Tidak Dapat Dihapus — Masih Dipakai Pegawai'
                            : mutationNotice.type === 'error'
                            ? 'Penghapusan Gagal'
                            : 'Berhasil'}
                        </AlertTitle>
                        <AlertDescription className="space-y-1">
                          <p>{mutationNotice.message}</p>
                          {isJabatanInUseNotice && (
                            <p className="text-xs text-red-800/90">
                              Silakan ubah atau lepaskan penugasan jabatan pada pegawai terkait terlebih dahulu sebelum menghapus master jabatan ini.
                            </p>
                          )}
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}
                </div>
              )}

              {'foto' in subState.singleObject && (
                <div className="p-6 flex items-center gap-4 bg-slate-50/40">
                  <AvatarImage
                    rawSrc={subState.singleObject.foto}
                    name={String(subState.singleObject.nama || entity.title)}
                    size="lg"
                  />
                  <div>
                    <div className="text-base font-bold text-slate-900">
                      {String(subState.singleObject.nama || entity.title)}
                    </div>
                    {entity.identifier && (
                      <div className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                        ID Induk: {entity.identifier}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-100">
                {Object.entries(subState.singleObject)
                  .filter(
                    ([k]) =>
                      k.toLowerCase() !== 'foto' && !isHiddenSyncKey(k)
                  )
                  .map(([key, val]) => (
                    <div
                      key={key}
                      className="px-6 py-3 flex items-baseline justify-between gap-6 text-sm"
                    >
                      <span className="text-xs font-medium text-slate-500 shrink-0">
                        {formatColumnLabel(key)}
                      </span>
                      <div className="text-right font-medium break-all">
                        {formatCellDisplay(key, val)}
                      </div>
                    </div>
                  ))}
              </div>

              {entity.mode === 'jabatan' && (
                <div className="p-6 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-600">
                    Pegawai Aktif Pemangku Jabatan ({jabatanHolders.length})
                  </h4>
                  {jabatanHolders.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Saat ini belum ada pegawai aktif yang tercatat memangku jabatan ini pada direktori utama.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                      {jabatanHolders.map((h, idx) => (
                        <div
                          key={`${h.nip}-${idx}`}
                          className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs"
                        >
                          <span className="font-semibold text-slate-900">
                            {h.nama}
                          </span>
                          <span className="font-mono text-slate-500 tabular-nums">
                            NIP {h.nip} · {h.bagian}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : subState.rows.length > 0 ? (
            <div className="overflow-x-auto">
              {(() => {
                const cols = selectTableColumns(subState.rows, 6);
                const showRevokeCol = isPegawaiHakAksesTab && canManageHakAkses;
                const showPegawaiJabatanActions =
                  isPegawaiJabatanTab && Boolean(entity.identifier);
                const showActionCol =
                  showRevokeCol || showPegawaiJabatanActions;
                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                        {cols.map((c, cIdx) => (
                          <th key={`${c}-${cIdx}`} className="py-3 px-5 whitespace-nowrap">
                            {formatColumnLabel(c)}
                          </th>
                        ))}
                        {showActionCol && (
                          <th className="py-3 px-5 text-right whitespace-nowrap">
                            Tindakan
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {subState.rows.map((r, idx) => {
                        const rowReplid =
                          r.replid !== undefined ? String(r.replid) : '';
                        const isRevoking = revokingReplid === rowReplid;
                        return (
                          <tr key={`${rowReplid || 'row'}-${idx}`} className="hover:bg-slate-50/70">
                            {cols.map((c, cIdx) => (
                              <td key={`${c}-${cIdx}`} className="py-2.5 px-5">
                                {formatCellDisplay(c, r[c])}
                              </td>
                            ))}
                            {showActionCol && (
                              <td className="py-2.5 px-5 text-right whitespace-nowrap">
                                {showRevokeCol && rowReplid && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isRevoking}
                                    onClick={() =>
                                      handleQuickRevokeHakAkses(rowReplid)
                                    }
                                    className="text-red-700 border-red-200 hover:bg-red-50"
                                  >
                                    {isRevoking ? (
                                      <Loader2
                                        className="h-3.5 w-3.5 animate-spin"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Trash2
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>Cabut</span>
                                  </Button>
                                )}
                                {showPegawaiJabatanActions && rowReplid && (
                                  <div className="inline-flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        setPegawaiJabatanPopup({
                                          mode: 'edit',
                                          nip: String(entity.identifier),
                                          employeeName: entity.title,
                                          employeeFoto: entity.row?.foto,
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
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setPegawaiJabatanPopup({
                                          mode: 'delete',
                                          nip: String(entity.identifier),
                                          employeeName: entity.title,
                                          employeeFoto: entity.row?.foto,
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
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          ) : (
            <div className="p-10 text-center space-y-3 text-sm text-slate-500">
              <p>Belum ada rekaman data pada kategori ini.</p>
              {isPegawaiJabatanTab && entity.identifier && (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setPegawaiJabatanPopup({
                        mode: 'create',
                        nip: String(entity.identifier),
                        employeeName: entity.title,
                        employeeFoto: entity.row?.foto,
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Jabatan Pertama</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PegawaiJabatanFormPopup
        popupState={pegawaiJabatanPopup}
        onClose={() => setPegawaiJabatanPopup(null)}
        onSuccess={() => {
          setSubRefreshKey((k) => k + 1);
          if (onMutated) onMutated();
        }}
        onSwitchMode={(next) => setPegawaiJabatanPopup(next)}
      />
    </div>
  );
}
