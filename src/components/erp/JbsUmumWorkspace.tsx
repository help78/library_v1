import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Code2,
  CreditCard,
  Database,
  FileArchive,
  FileText,
  LayoutGrid,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
} from 'lucide-react';
import type {
  ErpModuleDefinition,
  ErpMutationAction,
  ErpSubView,
} from '../../data/erpModules';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatNumberId,
  type NormalizedApiPayload,
} from '../../lib/formatters';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Can } from '../auth/Can';
import { usePermission } from '../../hooks/usePermission';
import { IdentityShowcase } from './IdentityShowcase';
import { SmartDataTable, type InspectedEntity } from './SmartDataTable';

type UmumCategoryId =
  | 'identitas-group'
  | 'master-group'
  | 'nota-group'
  | 'surat-group'
  | 'wilayah-group'
  | 'kartu-group';

type UmumTabId =
  | 'identitas'
  | 'identitas-detail'
  | 'master-agama'
  | 'master-suku'
  | 'master-pekerjaan'
  | 'master-pendidikan'
  | 'bagian-nota'
  | 'nota-digital'
  | 'lampiran-surat'
  | 'pengantar-surat'
  | 'pemetaan-wilayah'
  | 'pemetaan-sekolah'
  | 'sistem-kartu'
  | 'aktifitas-kartu'
  | 'riwayat-scan-kartu';

interface UmumSubTabDefinition {
  id: UmumTabId;
  label: string;
  endpointSummary: string;
  viewId?: string;
  createActionId?: string;
  updateActionId?: string;
  deleteActionId?: string;
  readOnly?: boolean;
}

interface UmumCategoryDefinition {
  id: UmumCategoryId;
  numberLabel: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tabs: UmumSubTabDefinition[];
}

const UMUM_CATEGORIES: UmumCategoryDefinition[] = [
  {
    id: 'identitas-group',
    numberLabel: '1',
    label: 'Identitas Sekolah / Lembaga',
    shortLabel: 'Identitas Lembaga',
    description:
      'Mengelola profil dan informasi dasar sekolah, departemen, atau yayasan.',
    icon: Building2,
    tabs: [
      {
        id: 'identitas',
        label: 'Daftar Identitas',
        endpointSummary: 'GET /api/jbsumum/identitas',
        viewId: 'identitas',
        createActionId: 'tambah-identitas',
        updateActionId: 'ubah-identitas',
        deleteActionId: 'hapus-identitas',
      },
      {
        id: 'identitas-detail',
        label: 'Detail 1 Identitas (:replid)',
        endpointSummary: 'GET /api/jbsumum/identitas/:replid',
        viewId: 'identitas-detail',
        createActionId: 'tambah-identitas',
        updateActionId: 'ubah-identitas',
        deleteActionId: 'hapus-identitas',
      },
    ],
  },
  {
    id: 'master-group',
    numberLabel: '2',
    label: 'Master Data Umum',
    shortLabel: 'Master Data',
    description:
      'Mengelola data referensi dasar (Agama, Suku, Jenis Pekerjaan, dan Tingkat Pendidikan).',
    icon: Database,
    tabs: [
      {
        id: 'master-agama',
        label: 'Agama',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/agama',
        viewId: 'master-agama',
        createActionId: 'tambah-agama',
        updateActionId: 'ubah-agama',
        deleteActionId: 'hapus-agama',
      },
      {
        id: 'master-suku',
        label: 'Suku',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/suku',
        viewId: 'master-suku',
        createActionId: 'tambah-suku',
        updateActionId: 'ubah-suku',
        deleteActionId: 'hapus-suku',
      },
      {
        id: 'master-pekerjaan',
        label: 'Jenis Pekerjaan',
        endpointSummary:
          'GET · POST · PUT · DELETE /api/jbsumum/jenispekerjaan',
        viewId: 'master-pekerjaan',
        createActionId: 'tambah-pekerjaan',
        updateActionId: 'ubah-pekerjaan',
        deleteActionId: 'hapus-pekerjaan',
      },
      {
        id: 'master-pendidikan',
        label: 'Tingkat Pendidikan',
        endpointSummary:
          'GET · POST · PUT · DELETE /api/jbsumum/tingkatpendidikan',
        viewId: 'master-pendidikan',
        createActionId: 'tambah-pendidikan',
        updateActionId: 'ubah-pendidikan',
        deleteActionId: 'hapus-pendidikan',
      },
    ],
  },
  {
    id: 'nota-group',
    numberLabel: '3',
    label: 'Sistem Nota Digital',
    shortLabel: 'Nota Digital',
    description:
      'Manajemen kategori/bagian nota dan pencatatan data nota internal.',
    icon: FileText,
    tabs: [
      {
        id: 'bagian-nota',
        label: 'Bagian Nota',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/bagiannota',
        viewId: 'bagian-nota',
        createActionId: 'tambah-bagiannota',
        updateActionId: 'ubah-bagiannota',
        deleteActionId: 'hapus-bagiannota',
      },
      {
        id: 'nota-digital',
        label: 'Data Nota',
        endpointSummary: 'GET · PUT · DELETE /api/jbsumum/nota',
        viewId: 'nota-digital',
        updateActionId: 'ubah-nota',
        deleteActionId: 'hapus-nota',
      },
    ],
  },
  {
    id: 'surat-group',
    numberLabel: '4',
    label: 'Pengarsipan Surat',
    shortLabel: 'Arsip Surat',
    description:
      'Manajemen dokumen surat menyurat (Pengantar Surat dan Lampiran Surat).',
    icon: FileArchive,
    tabs: [
      {
        id: 'lampiran-surat',
        label: 'Lampiran Surat',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/lampiransurat',
        viewId: 'lampiran-surat',
        createActionId: 'tambah-lampiran-surat',
        updateActionId: 'ubah-lampiran-surat',
        deleteActionId: 'hapus-lampiran-surat',
      },
      {
        id: 'pengantar-surat',
        label: 'Pengantar Surat (:replid)',
        endpointSummary: 'PUT · DELETE /api/jbsumum/pengantarsurat/:replid',
        updateActionId: 'ubah-pengantar-surat',
        deleteActionId: 'hapus-pengantar-surat',
      },
    ],
  },
  {
    id: 'wilayah-group',
    numberLabel: '5',
    label: 'Pemetaan Wilayah & Sekolah',
    shortLabel: 'Wilayah & Sekolah',
    description:
      'Mencatat lokasi wilayah domisili dan daftar sebaran sekolah/yayasan.',
    icon: MapPin,
    tabs: [
      {
        id: 'pemetaan-wilayah',
        label: 'Wilayah',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/wilayah',
        viewId: 'pemetaan-wilayah',
        createActionId: 'tambah-wilayah',
        updateActionId: 'ubah-wilayah',
        deleteActionId: 'hapus-wilayah',
      },
      {
        id: 'pemetaan-sekolah',
        label: 'Sekolah',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/sekolah',
        viewId: 'pemetaan-sekolah',
        createActionId: 'tambah-sekolah',
        updateActionId: 'ubah-sekolah',
        deleteActionId: 'hapus-sekolah',
      },
    ],
  },
  {
    id: 'kartu-group',
    numberLabel: '6',
    label: 'Sistem Kartu (Card & Tap Scan)',
    shortLabel: 'Sistem Kartu',
    description:
      'Manajemen master kartu siswa/pegawai, aktifitas kartu, dan histori tap scan.',
    icon: CreditCard,
    tabs: [
      {
        id: 'sistem-kartu',
        label: 'Master Kartu',
        endpointSummary: 'GET · POST · PUT · DELETE /api/jbsumum/card',
        viewId: 'sistem-kartu',
        createActionId: 'tambah-card',
        updateActionId: 'ubah-card',
        deleteActionId: 'hapus-card',
      },
      {
        id: 'aktifitas-kartu',
        label: 'Aktifitas Kartu',
        endpointSummary:
          'GET · POST · PUT · DELETE /api/jbsumum/cardaktifitas',
        viewId: 'aktifitas-kartu',
        createActionId: 'tambah-cardaktifitas',
        updateActionId: 'ubah-cardaktifitas',
        deleteActionId: 'hapus-cardaktifitas',
      },
      {
        id: 'riwayat-scan-kartu',
        label: 'Riwayat Scan / Tap (Read Only)',
        endpointSummary: 'GET /api/jbsumum/cardscandata',
        viewId: 'riwayat-scan-kartu',
        readOnly: true,
      },
    ],
  },
];

function cleanFieldStr(val: unknown): string {
  if (val === null || val === undefined || val === 'null') return '';
  return String(val).trim();
}

function toIsoDateOnly(val: unknown): string {
  const raw = cleanFieldStr(val);
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function findCategoryForTab(tabId: string): {
  categoryId: UmumCategoryId;
  tabId: UmumTabId;
} {
  for (const cat of UMUM_CATEGORIES) {
    const found = cat.tabs.find((t) => t.id === tabId || t.viewId === tabId);
    if (found) {
      return { categoryId: cat.id, tabId: found.id };
    }
  }
  return { categoryId: 'identitas-group', tabId: 'identitas' };
}

interface JbsUmumWorkspaceProps {
  module: ErpModuleDefinition;
  initialViewId?: string;
  onInspectEntity: (entity: InspectedEntity) => void;
  onTriggerMutation: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  refreshSignal: number;
}

export function JbsUmumWorkspace({
  module,
  initialViewId,
  onInspectEntity,
  onTriggerMutation,
  refreshSignal,
}: JbsUmumWorkspaceProps) {
  const initialSelection = useMemo(
    () => findCategoryForTab(initialViewId || 'identitas'),
    [initialViewId]
  );

  const [activeCategoryId, setActiveCategoryId] = useState<UmumCategoryId>(
    initialSelection.categoryId
  );
  const [activeTabId, setActiveTabId] = useState<UmumTabId>(
    initialSelection.tabId
  );
  const [identityDisplayMode, setIdentityDisplayMode] = useState<
    'cards' | 'table'
  >('cards');

  // Parameter filter & path per endpoint aktif
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [appliedParams, setAppliedParams] = useState<Record<string, string>>(
    {}
  );

  // State data utama endpoint aktif
  const [payload, setPayload] = useState<NormalizedApiPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvedEndpointUrl, setResolvedEndpointUrl] = useState<string>('');

  // Referensi pendukung (daftar ringkas identitas untuk pilih cepat :replid & daftar bagian nota untuk filter ?bagian=)
  const [identitasRefOptions, setIdentitasRefOptions] = useState<
    { replid: string; label: string }[]
  >([]);
  const [bagianNotaRefOptions, setBagianNotaRefOptions] = useState<string[]>(
    []
  );

  // State khusus panel Pengantar Surat (:replid)
  const [pengantarReplidInput, setPengantarReplidInput] = useState<string>('1');

  useEffect(() => {
    if (!initialViewId) return;
    const mapped = findCategoryForTab(initialViewId);
    setActiveCategoryId(mapped.categoryId);
    setActiveTabId(mapped.tabId);
  }, [initialViewId]);

  const activeCategory = useMemo(
    () =>
      UMUM_CATEGORIES.find((c) => c.id === activeCategoryId) ||
      UMUM_CATEGORIES[0],
    [activeCategoryId]
  );

  const activeTab = useMemo(
    () =>
      activeCategory.tabs.find((t) => t.id === activeTabId) ||
      activeCategory.tabs[0],
    [activeCategory, activeTabId]
  );

  const activeSubView: ErpSubView | undefined = useMemo(
    () =>
      activeTab.viewId
        ? module.views.find((v) => v.id === activeTab.viewId)
        : undefined,
    [module.views, activeTab.viewId]
  );

  const findMutation = useCallback(
    (actionId?: string): ErpMutationAction | undefined =>
      actionId ? module.mutations.find((m) => m.id === actionId) : undefined,
    [module.mutations]
  );

  const canUpdateUmum = usePermission('UMUM', 'update');
  const canDeleteUmum = usePermission('UMUM', 'delete');

  const createAction = useMemo(
    () => findMutation(activeTab.createActionId),
    [findMutation, activeTab.createActionId]
  );
  const updateAction = useMemo(
    () => findMutation(activeTab.updateActionId),
    [findMutation, activeTab.updateActionId]
  );
  const deleteAction = useMemo(
    () => findMutation(activeTab.deleteActionId),
    [findMutation, activeTab.deleteActionId]
  );

  // Muat opsi referensi identitas (:replid) dan bagian nota (?bagian=)
  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      apiClient.get('/jbsumum/identitas'),
      apiClient.get('/jbsumum/bagiannota'),
    ]).then(([idenRes, bagianRes]) => {
      if (cancelled) return;

      if (idenRes.status === 'fulfilled') {
        const rows = extractResponsePayload(idenRes.value.data).rows;
        const opts = rows
          .map((r) => {
            const id = cleanFieldStr(r.replid);
            const nama = cleanFieldStr(r.nama);
            const dept = cleanFieldStr(r.departemen);
            if (!id) return null;
            const title = nama || (dept ? `Unit ${dept}` : `Identitas #${id}`);
            return {
              replid: id,
              label: dept ? `#${id} — ${title} (${dept})` : `#${id} — ${title}`,
            };
          })
          .filter((item): item is { replid: string; label: string } =>
            Boolean(item)
          );
        setIdentitasRefOptions(opts);
      }

      if (bagianRes.status === 'fulfilled') {
        const rows = extractResponsePayload(bagianRes.value.data).rows;
        const names = Array.from(
          new Set(rows.map((r) => cleanFieldStr(r.bagian)).filter(Boolean))
        );
        setBagianNotaRefOptions(names);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  // Reset parameter saat sub-tab berganti
  useEffect(() => {
    if (!activeSubView) {
      setPayload(null);
      setErrorMsg(null);
      setResolvedEndpointUrl('');
      return;
    }

    const defaults: Record<string, string> = {};
    for (const p of activeSubView.params || []) {
      if (
        activeSubView.id === 'identitas-detail' &&
        p.name === 'replid' &&
        paramValues.replid
      ) {
        defaults[p.name] = paramValues.replid;
      } else {
        defaults[p.name] = p.defaultValue ?? '';
      }
    }
    setParamValues(defaults);
    setAppliedParams(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubView?.id]);

  const fetchEndpointData = useCallback(
    async (view: ErpSubView, currentParams: Record<string, string>) => {
      for (const p of view.params || []) {
        if (p.required && !String(currentParams[p.name] ?? '').trim()) {
          setPayload(null);
          setErrorMsg(
            `Silakan isi parameter "${p.label}" terlebih dahulu untuk memuat data.`
          );
          return;
        }
      }

      let path = view.pathTemplate;
      const queryObj: Record<string, string> = {};

      for (const p of view.params || []) {
        const val = String(currentParams[p.name] ?? '').trim();
        if (p.in === 'path') {
          path = path.replace(`:${p.name}`, encodeURIComponent(val));
        } else if (p.in === 'query' && val !== '') {
          queryObj[p.name] = val;
        }
      }

      const qs = new URLSearchParams(queryObj).toString();
      setResolvedEndpointUrl(`/api${path}${qs ? `?${qs}` : ''}`);
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const response = await apiClient.get(path, {
          params: Object.keys(queryObj).length > 0 ? queryObj : undefined,
        });
        const normalized = extractResponsePayload(response.data);

        // Pastikan filter query pada /nota dan /cardscandata tetap presisi
        if (view.id === 'nota-digital' && Object.keys(queryObj).length > 0) {
          const filtered = normalized.rows.filter((row) => {
            if (queryObj.bagian) {
              const rowBagian = cleanFieldStr(
                row.bagian ?? row.idbagian
              ).toLowerCase();
              if (
                rowBagian &&
                rowBagian !== queryObj.bagian.trim().toLowerCase()
              ) {
                return false;
              }
            }
            if (queryObj.nis) {
              const rowNis = cleanFieldStr(row.nis).toLowerCase();
              if (!rowNis.includes(queryObj.nis.trim().toLowerCase())) {
                return false;
              }
            }
            if (queryObj.nip) {
              const rowNip = cleanFieldStr(row.nip).toLowerCase();
              if (!rowNip.includes(queryObj.nip.trim().toLowerCase())) {
                return false;
              }
            }
            if (queryObj.tanggal) {
              const rowDate = toIsoDateOnly(row.tanggal);
              if (rowDate !== queryObj.tanggal.trim()) {
                return false;
              }
            }
            return true;
          });
          setPayload({
            ...normalized,
            rows: filtered,
            totalCount: filtered.length,
          });
        } else if (
          view.id === 'riwayat-scan-kartu' &&
          Object.keys(queryObj).length > 0
        ) {
          const filtered = normalized.rows.filter((row) => {
            if (queryObj.nis) {
              const rowNis = cleanFieldStr(row.nis).toLowerCase();
              if (!rowNis.includes(queryObj.nis.trim().toLowerCase())) {
                return false;
              }
            }
            if (queryObj.nip) {
              const rowNip = cleanFieldStr(row.nip).toLowerCase();
              if (!rowNip.includes(queryObj.nip.trim().toLowerCase())) {
                return false;
              }
            }
            return true;
          });
          setPayload({
            ...normalized,
            rows: filtered,
            totalCount: filtered.length,
          });
        } else {
          setPayload(normalized);
        }
      } catch (err) {
        setPayload(null);
        setErrorMsg(extractApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!activeSubView) return;
    fetchEndpointData(activeSubView, appliedParams);
  }, [activeSubView, appliedParams, refreshSignal, fetchEndpointData]);

  const handleSelectCategory = (cat: UmumCategoryDefinition) => {
    setActiveCategoryId(cat.id);
    setActiveTabId(cat.tabs[0].id);
  };

  const handleViewIdentityDetailById = (replid: string) => {
    setActiveCategoryId('identitas-group');
    setActiveTabId('identitas-detail');
    setParamValues({ replid });
    setAppliedParams({ replid });
  };

  const buildEditInitialValues = useCallback(
    (tabId: UmumTabId, row: Record<string, unknown>): Record<string, string> => {
      switch (tabId) {
        case 'identitas':
        case 'identitas-detail':
          return {
            replid: cleanFieldStr(row.replid),
            nama: cleanFieldStr(row.nama),
            departemen: cleanFieldStr(row.departemen),
            situs: cleanFieldStr(row.situs),
            email: cleanFieldStr(row.email),
            alamat1: cleanFieldStr(row.alamat1),
            alamat2: cleanFieldStr(row.alamat2),
            telp1: cleanFieldStr(row.telp1),
            telp2: cleanFieldStr(row.telp2),
            fax1: cleanFieldStr(row.fax1),
            keterangan: cleanFieldStr(row.keterangan),
          };
        case 'master-agama': {
          const agama = cleanFieldStr(row.agama);
          return {
            nama: agama,
            agama,
            urutan: cleanFieldStr(row.urutan),
          };
        }
        case 'master-suku': {
          const suku = cleanFieldStr(row.suku);
          return {
            nama: suku,
            suku,
            urutan: cleanFieldStr(row.urutan),
          };
        }
        case 'master-pekerjaan': {
          const pekerjaan = cleanFieldStr(row.pekerjaan);
          return {
            pekerjaan_lama: pekerjaan,
            pekerjaan,
          };
        }
        case 'master-pendidikan': {
          const pendidikan = cleanFieldStr(row.pendidikan);
          return {
            pendidikan_lama: pendidikan,
            pendidikan,
            urutan: cleanFieldStr(row.urutan),
          };
        }
        case 'bagian-nota': {
          const bagian = cleanFieldStr(row.bagian);
          return {
            bagian_lama: bagian,
            bagian,
            urutan: cleanFieldStr(row.urutan),
          };
        }
        case 'nota-digital':
          return {
            id: cleanFieldStr(row.id ?? row.replid),
            bagian: cleanFieldStr(row.bagian),
            judul: cleanFieldStr(row.judul),
            nota: cleanFieldStr(row.nota),
            tanggal: toIsoDateOnly(row.tanggal),
            nip: cleanFieldStr(row.nip),
            nis: cleanFieldStr(row.nis),
          };
        case 'lampiran-surat':
          return {
            replid: cleanFieldStr(row.replid),
            departemen: cleanFieldStr(row.departemen),
            judul: cleanFieldStr(row.judul),
            pengantar: cleanFieldStr(row.pengantar ?? row.lampiran),
            aktif: cleanFieldStr(row.aktif) || '1',
          };
        case 'pemetaan-wilayah':
          return {
            replid: cleanFieldStr(row.replid),
            namawilayah: cleanFieldStr(row.namawilayah ?? row.wilayah),
          };
        case 'pemetaan-sekolah':
          return {
            replid: cleanFieldStr(row.replid),
            namasekolah: cleanFieldStr(row.namasekolah ?? row.sekolah),
            wilayah: cleanFieldStr(row.wilayah ?? row.namawilayah),
          };
        case 'sistem-kartu':
          return {
            replid: cleanFieldStr(row.replid),
            departemen: cleanFieldStr(row.departemen),
            judul: cleanFieldStr(row.judul),
            deskripsi: cleanFieldStr(row.deskripsi),
            aktif: cleanFieldStr(row.aktif) || '1',
          };
        case 'aktifitas-kartu':
          return {
            replid: cleanFieldStr(row.replid),
            departemen: cleanFieldStr(row.departemen),
            judul: cleanFieldStr(row.judul ?? row.aktifitas),
            keterangan: cleanFieldStr(row.keterangan),
            aktif: cleanFieldStr(row.aktif) || '1',
          };
        default:
          return {};
      }
    },
    []
  );

  const buildDeleteInitialValues = useCallback(
    (tabId: UmumTabId, row: Record<string, unknown>): Record<string, string> => {
      switch (tabId) {
        case 'master-agama':
          return { nama: cleanFieldStr(row.agama) };
        case 'master-suku':
          return { nama: cleanFieldStr(row.suku) };
        case 'master-pekerjaan':
          return { pekerjaan: cleanFieldStr(row.pekerjaan) };
        case 'master-pendidikan':
          return { pendidikan: cleanFieldStr(row.pendidikan) };
        case 'bagian-nota':
          return { bagian: cleanFieldStr(row.bagian) };
        case 'nota-digital':
          return { id: cleanFieldStr(row.id ?? row.replid) };
        default:
          return { replid: cleanFieldStr(row.replid) };
      }
    },
    []
  );

  const handleEditRow = useCallback(
    (row: Record<string, unknown>) => {
      if (!updateAction) return;
      onTriggerMutation(updateAction, buildEditInitialValues(activeTab.id, row));
    },
    [updateAction, onTriggerMutation, buildEditInitialValues, activeTab.id]
  );

  const handleDeleteRow = useCallback(
    (row: Record<string, unknown>) => {
      if (!deleteAction) return;
      onTriggerMutation(
        deleteAction,
        buildDeleteInitialValues(activeTab.id, row)
      );
    },
    [deleteAction, onTriggerMutation, buildDeleteInitialValues, activeTab.id]
  );

  const handleHeaderUpdateClick = () => {
    if (!updateAction) return;
    if (activeTab.id === 'identitas-detail' && payload?.singleObject) {
      onTriggerMutation(
        updateAction,
        buildEditInitialValues('identitas-detail', payload.singleObject)
      );
      return;
    }
    if (activeTab.id === 'pengantar-surat') {
      const replid = pengantarReplidInput.trim();
      onTriggerMutation(updateAction, replid ? { replid } : undefined);
      return;
    }
    onTriggerMutation(updateAction);
  };

  const handleHeaderDeleteClick = () => {
    if (!deleteAction) return;
    if (activeTab.id === 'identitas-detail') {
      const replid = cleanFieldStr(
        payload?.singleObject?.replid ??
          appliedParams.replid ??
          paramValues.replid
      );
      onTriggerMutation(deleteAction, replid ? { replid } : undefined);
      return;
    }
    if (activeTab.id === 'pengantar-surat') {
      const replid = pengantarReplidInput.trim();
      onTriggerMutation(deleteAction, replid ? { replid } : undefined);
      return;
    }
    onTriggerMutation(deleteAction);
  };

  const handleApplyParams = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedParams({ ...paramValues });
  };

  const handleResetParams = () => {
    if (!activeSubView) return;
    const defaults: Record<string, string> = {};
    for (const p of activeSubView.params || []) {
      defaults[p.name] = p.defaultValue ?? '';
    }
    setParamValues(defaults);
    setAppliedParams(defaults);
  };

  return (
    <div className="space-y-6">
      {/* Header Modul JBS UMUM & Navigasi 6 Kelompok Layanan */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>Modul {module.code}</span>
              <span aria-hidden="true">·</span>
              <span>Prefix {module.prefix}</span>
              <span aria-hidden="true">·</span>
              <span>6 kelompok layanan</span>
              {module.matchedHakAkses && module.matchedHakAkses.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-700 font-semibold">
                    Akses: {module.matchedHakAkses.join(', ')}
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              {module.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {module.summary}
            </p>
          </div>

          {/* Tombol Aksi Kontekstual Sesuai Sub-Layanan Aktif */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {createAction && (
              <Can modul="UMUM" action="create">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onTriggerMutation(createAction)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{createAction.label}</span>
                </Button>
              </Can>
            )}
            {updateAction && (
              <Can modul="UMUM" action="update">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleHeaderUpdateClick}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{updateAction.label}</span>
                </Button>
              </Can>
            )}
            {deleteAction && (
              <Can modul="UMUM" action="delete">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleHeaderDeleteClick}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{deleteAction.label}</span>
                </Button>
              </Can>
            )}
          </div>
        </div>

        {/* Navigasi Tingkat 1: 6 Kelompok Domain JBS UMUM */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Kelompok Layanan JBS Umum"
          >
            {UMUM_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = cat.id === activeCategory.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectCategory(cat)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">{cat.numberLabel}.</span>
                  <span>{cat.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Permukaan Utama Kelompok Aktif */}
      <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
        {/* Baris Sub-Tab di Dalam Kelompok Aktif */}
        <div className="px-6 py-4 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-semibold text-slate-800">
              {activeCategory.numberLabel}. {activeCategory.label}
            </div>
            <p className="text-xs text-slate-500">
              {activeCategory.description}
            </p>
          </div>

          <div
            className="flex items-center gap-1.5 overflow-x-auto"
            role="tablist"
            aria-label={`Sub-menu ${activeCategory.label}`}
          >
            {activeCategory.tabs.map((tab) => {
              const isTabActive = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isTabActive}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isTabActive
                      ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Khusus Pengantar Surat (PUT & DELETE /pengantarsurat/:replid) */}
        {activeTab.id === 'pengantar-surat' ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  {activeTab.endpointSummary}
                </span>
                <span aria-hidden="true">·</span>
                <span>Operasi Pembaruan & Penghapusan Berdasarkan replid</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Manajemen Pengantar Surat
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                Kelola pembaruan isi dokumen pengantar surat (
                <span className="font-mono">
                  PUT /api/jbsumum/pengantarsurat/:replid
                </span>
                ) atau penghapusan arsip pengantar surat (
                <span className="font-mono">
                  DELETE /api/jbsumum/pengantarsurat/:replid
                </span>
                ) dengan memasukkan nomor ID dokumen (<span className="font-mono">replid</span>).
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 max-w-xl space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="pengantar-replid-input"
                  className="block text-xs font-medium text-slate-700"
                >
                  Target ID Pengantar Surat (replid)
                </label>
                <Input
                  id="pengantar-replid-input"
                  type="number"
                  value={pengantarReplidInput}
                  onChange={(e) => setPengantarReplidInput(e.target.value)}
                  placeholder="Contoh: 1"
                  className="bg-white max-w-xs font-mono tabular-nums"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {updateAction && (
                  <Can modul="UMUM" action="update">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleHeaderUpdateClick}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buka Form PUT /pengantarsurat/:replid</span>
                    </Button>
                  </Can>
                )}
                {deleteAction && (
                  <Can modul="UMUM" action="delete">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleHeaderDeleteClick}
                      className="text-red-700 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Hapus DELETE /pengantarsurat/:replid</span>
                    </Button>
                  </Can>
                )}
              </div>
            </div>
          </div>
        ) : (
          activeSubView && (
            <>
              {/* Info Endpoint GET Aktif & Kontrol Refresh / Mode Tampilan / JSON */}
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-800">
                      GET{' '}
                      {resolvedEndpointUrl ||
                        `/api${activeSubView.pathTemplate}`}
                    </span>
                    {payload && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums font-medium text-slate-700">
                          Total: {formatNumberId(payload.totalCount)} data
                        </span>
                      </>
                    )}
                    {activeTab.readOnly && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-600">Read Only</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeSubView.label}
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {activeSubView.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activeTab.id === 'identitas' && (
                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setIdentityDisplayMode('cards')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                          identityDisplayMode === 'cards'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Kartu Profil</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdentityDisplayMode('table')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                          identityDisplayMode === 'table'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Tabel Data</span>
                      </button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() =>
                      fetchEndpointData(activeSubView, appliedParams)
                    }
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        isLoading ? 'animate-spin' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>Muat Ulang</span>
                  </Button>

                  {payload && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onInspectEntity({
                          mode: 'raw-response',
                          title: `GET ${resolvedEndpointUrl}`,
                          row: (payload.raw as Record<string, unknown>) || {},
                        })
                      }
                    >
                      <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Respons JSON</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Filter / Path Parameter Bar */}
              {activeSubView.params && activeSubView.params.length > 0 && (
                <form
                  onSubmit={handleApplyParams}
                  className="px-6 py-4 bg-slate-50/70 flex flex-wrap items-end gap-4"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2.5 mr-1">
                    <SlidersHorizontal
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    <span>Parameter Endpoint:</span>
                  </div>

                  {/* Pilihan cepat unit identitas untuk GET /identitas/:replid */}
                  {activeTab.id === 'identitas-detail' &&
                    identitasRefOptions.length > 0 && (
                      <div className="w-full sm:w-72 space-y-1">
                        <label
                          htmlFor="quick-select-identitas"
                          className="block text-xs font-medium text-slate-600"
                        >
                          Pilih Cepat Unit Identitas
                        </label>
                        <select
                          id="quick-select-identitas"
                          value={
                            identitasRefOptions.some(
                              (o) => o.replid === (paramValues.replid ?? '')
                            )
                              ? (paramValues.replid ?? '')
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            setParamValues({ replid: val });
                            setAppliedParams({ replid: val });
                          }}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                        >
                          <option value="">-- Pilih dari daftar --</option>
                          {identitasRefOptions.map((opt, idx) => (
                            <option key={`${opt.replid}-${idx}`} value={opt.replid}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  {activeSubView.params.map((param) => {
                    const isBagianNotaFilter =
                      activeTab.id === 'nota-digital' &&
                      param.name === 'bagian';
                    const isDateFilter = param.name === 'tanggal';

                    return (
                      <div key={param.name} className="w-full sm:w-52 space-y-1">
                        <label
                          htmlFor={`umum-param-${param.name}`}
                          className="block text-xs font-medium text-slate-600"
                        >
                          {param.label}
                          {param.required && (
                            <span className="text-red-600 ml-0.5">*</span>
                          )}
                        </label>

                        {isBagianNotaFilter ? (
                          <select
                            id={`umum-param-${param.name}`}
                            value={paramValues[param.name] ?? ''}
                            onChange={(e) => {
                              const selected = e.target.value;
                              setParamValues((prev) => ({
                                ...prev,
                                bagian: selected,
                              }));
                              setAppliedParams((prev) => ({
                                ...prev,
                                bagian: selected,
                              }));
                            }}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                          >
                            <option value="">Semua Bagian</option>
                            {bagianNotaRefOptions.map((b, idx) => (
                              <option key={`${b}-${idx}`} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`umum-param-${param.name}`}
                            type={isDateFilter ? 'date' : 'text'}
                            value={paramValues[param.name] ?? ''}
                            onChange={(e) =>
                              setParamValues((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder}
                            className="bg-white h-9 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={isLoading}>
                      <Search className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Terapkan</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isLoading}
                      onClick={handleResetParams}
                    >
                      Reset
                    </Button>
                  </div>
                </form>
              )}

              {/* Pesan Galat */}
              {errorMsg && (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Gagal Memuat Data</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Konten Data */}
              {!errorMsg &&
                (activeTab.id === 'identitas' &&
                identityDisplayMode === 'cards' ? (
                  isLoading ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Memuat profil identitas lembaga...
                    </div>
                  ) : (
                    <IdentityShowcase
                      rows={payload?.rows || []}
                      onViewDetailById={handleViewIdentityDetailById}
                      onEditRow={
                        canUpdateUmum && updateAction ? handleEditRow : undefined
                      }
                      onDeleteRow={
                        canDeleteUmum && deleteAction
                          ? handleDeleteRow
                          : undefined
                      }
                      onInspectRow={(row) =>
                        onInspectEntity({
                          mode: 'generic',
                          title: String(
                            row.nama ||
                              (row.departemen
                                ? `Unit ${row.departemen}`
                                : 'Identitas Lembaga')
                          ),
                          identifier: row.departemen
                            ? `Departemen ${row.departemen}`
                            : undefined,
                          row,
                        })
                      }
                    />
                  )
                ) : (
                  <SmartDataTable
                    rows={payload?.rows || []}
                    singleObject={payload?.singleObject || null}
                    isLoading={isLoading}
                    entityType={activeSubView.entityType || 'generic'}
                    onInspect={onInspectEntity}
                    onEditRow={
                      !activeTab.readOnly && canUpdateUmum && updateAction
                        ? handleEditRow
                        : undefined
                    }
                    onDeleteRow={
                      !activeTab.readOnly && canDeleteUmum && deleteAction
                        ? handleDeleteRow
                        : undefined
                    }
                  />
                ))}
            </>
          )
        )}
      </section>
    </div>
  );
}
