import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Code2,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Can } from '../auth/Can';
import {
  resolveModulePermissionCode,
  resolveMutationActionType,
  usePermission,
} from '../../hooks/usePermission';
import { IdentityShowcase } from './IdentityShowcase';
import { DaftarSiswaTable } from './DaftarSiswaTable';
import { SmartDataTable, type InspectedEntity } from './SmartDataTable';
import { DigitalBookReaderModal } from './DigitalBookReaderModal';
import { PegawaiJabatanDashboard } from './PegawaiJabatanDashboard';
import { PresensiKelasTable } from './PresensiKelasTable';
import { ProfilPresensiSiswa } from './ProfilPresensiSiswa';
import { RaporPenilaianWorkspace } from './RaporPenilaianWorkspace';
import { JadwalKelasWorkspace } from './JadwalKelasWorkspace';
import { JbsUmumWorkspace } from './JbsUmumWorkspace';
import {
  PegawaiJabatanFormPopup,
  PegawaiJabatanManagerPopup,
  type ManagedEmployeeTarget,
  type PegawaiJabatanPopupState,
} from './PegawaiJabatanModal';

interface AlumniYearOption {
  value: string;
  label: string;
}

interface GuruStatusOption {
  value: string;
  label: string;
}

interface KelasOption {
  idkelas: string;
  nama_kelas: string;
  wali_kelas?: string;
  hp_wali?: string;
  label: string;
}

interface ModuleWorkspaceProps {
  module: ErpModuleDefinition;
  initialViewId?: string;
  isLandlord?: boolean;
  onInspectEntity: (entity: InspectedEntity) => void;
  onTriggerMutation: (
    action: ErpMutationAction,
    initialValues?: Record<string, string>
  ) => void;
  onMutated?: () => void;
  refreshSignal: number;
  hideHeaderBanner?: boolean;
}

export function ModuleWorkspace({
  module,
  initialViewId,
  isLandlord = false,
  onInspectEntity,
  onTriggerMutation,
  onMutated,
  refreshSignal,
  hideHeaderBanner = false,
}: ModuleWorkspaceProps) {
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    if (initialViewId && module.views.some((v) => v.id === initialViewId)) {
      return initialViewId;
    }
    return module.views[0]?.id || '';
  });
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [appliedParams, setAppliedParams] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState<NormalizedApiPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvedEndpointUrl, setResolvedEndpointUrl] = useState<string>('');
  const [readingBook, setReadingBook] = useState<Record<string, unknown> | null>(
    null
  );
  const [alumniYearOptions, setAlumniYearOptions] = useState<AlumniYearOption[]>(
    []
  );
  const [guruStatusOptions, setGuruStatusOptions] = useState<GuruStatusOption[]>(
    []
  );
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([]);
  const [managedPegawaiJabatan, setManagedPegawaiJabatan] =
    useState<ManagedEmployeeTarget | null>(null);
  const [quickPegawaiJabatanPopup, setQuickPegawaiJabatanPopup] =
    useState<PegawaiJabatanPopupState | null>(null);

  // Reset atau arahkan sub-view ketika berpindah modul utama / pintasan spesifik
  useEffect(() => {
    if (initialViewId && module.views.some((v) => v.id === initialViewId)) {
      setActiveViewId(initialViewId);
      return;
    }
    const firstView = module.views[0];
    if (firstView) {
      setActiveViewId(firstView.id);
    }
  }, [module.id, module.views, initialViewId]);

  const activeView: ErpSubView | undefined = useMemo(
    () =>
      module.views.find((v) => v.id === activeViewId) || module.views[0],
    [module.views, activeViewId]
  );

  // Inisialisasi nilai parameter default saat sub-view berganti
  useEffect(() => {
    if (!activeView) {
      return;
    }
    const defaults: Record<string, string> = {};
    for (const p of activeView.params || []) {
      defaults[p.name] = p.defaultValue ?? '';
    }
    setParamValues(defaults);
    setAppliedParams(defaults);
  }, [activeView]);

  const fetchActiveEndpoint = useCallback(
    async (view: ErpSubView, currentParams: Record<string, string>) => {
      // Validasi parameter path yang wajib diisi
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

      // Pastikan endpoint Direktori Pegawai SDM hanya mengambil dan merender pegawai aktif (aktif=1),
      // sedangkan tampilan khusus "Jabatan Pegawai (NIP)" merender tepat GET /api/jbssdm/pegawai?nip=...
      if (path === '/jbssdm/pegawai' && view.id !== 'pegawai-jabatan-nip') {
        queryObj.aktif = '1';
      }

      for (const p of view.params || []) {
        const val = String(currentParams[p.name] ?? '').trim();
        if (p.in === 'path') {
          path = path.replace(`:${p.name}`, encodeURIComponent(val));
        } else if (p.in === 'query' && val !== '') {
          queryObj[p.name] = val;
        }
      }

      const qs = new URLSearchParams(queryObj).toString();
      const displayUrl = `/api${path}${qs ? `?${qs}` : ''}`;
      setResolvedEndpointUrl(displayUrl);

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const response = await apiClient.get(path, {
          params: Object.keys(queryObj).length > 0 ? queryObj : undefined,
        });
        const normalized = extractResponsePayload(response.data);
        if (path === '/jbssdm/pegawai' && view.id !== 'pegawai-jabatan-nip') {
          const activeRows = normalized.rows.filter(
            (r) => !('aktif' in r) || Number(r.aktif) === 1
          );
          setPayload({
            ...normalized,
            rows: activeRows,
            totalCount: activeRows.length,
          });
        } else if (path === '/jbsakad/guru' && queryObj.statusguru) {
          const targetStatus = queryObj.statusguru.trim().toLowerCase();
          const filtered = normalized.rows.filter(
            (r) => String(r.statusguru ?? '').trim().toLowerCase() === targetStatus
          );
          setPayload({
            ...normalized,
            rows: filtered,
            totalCount: filtered.length,
          });
        } else if (view.id === 'riwayat-baca-digital' && queryObj.nis) {
          const targetNis = queryObj.nis.trim().toLowerCase();
          const filtered = normalized.rows.filter(
            (r) => String(r.nis ?? '').trim().toLowerCase() === targetNis
          );
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
    if (
      !activeView ||
      activeView.id === 'riwayat-jabatan' ||
      activeView.id === 'presensiharian' ||
      activeView.id === 'presensi-pelajaran' ||
      activeView.id === 'presensiharian-nis' ||
      activeView.id === 'presensi-pelajaran-nis' ||
      activeView.id === 'rapor' ||
      activeView.id === 'rapor-detail' ||
      activeView.id === 'rapor-nilaiujian' ||
      activeView.id === 'jadwal-kelas' ||
      module.id === 'jbsumum'
    ) {
      return;
    }
    fetchActiveEndpoint(activeView, appliedParams);
  }, [module.id, activeView, appliedParams, refreshSignal, fetchActiveEndpoint]);

  // Muat daftar pilihan cepat Tahun Ajaran untuk tampilan Data Alumni (/jbsakad/alumni)
  useEffect(() => {
    if (activeView?.pathTemplate !== '/jbsakad/alumni') {
      return;
    }
    let cancelled = false;

    Promise.allSettled([
      apiClient.get('/jbsakad/alumni'),
      apiClient.get('/jbsakad/tahunajaran'),
    ]).then(([alumniRes, taRes]) => {
      if (cancelled) return;

      const countByYear = new Map<string, number>();
      if (alumniRes.status === 'fulfilled') {
        const rows = extractResponsePayload(alumniRes.value.data).rows;
        for (const r of rows) {
          const yr = String(r.nama_tahunajaran || '').trim();
          if (yr) {
            countByYear.set(yr, (countByYear.get(yr) || 0) + 1);
          }
        }
      }

      if (taRes.status === 'fulfilled') {
        const taRows = extractResponsePayload(taRes.value.data).rows;
        for (const r of taRows) {
          const yr = String(r.tahunajaran || '').trim();
          if (yr && !countByYear.has(yr)) {
            countByYear.set(yr, 0);
          }
        }
      }

      const sortedYears = Array.from(countByYear.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([yr, count]) => ({
          value: yr,
          label:
            count > 0
              ? `${yr} (${formatNumberId(count)} alumni)`
              : yr,
        }));

      setAlumniYearOptions(sortedYears);
    });

    return () => {
      cancelled = true;
    };
  }, [activeView?.pathTemplate, refreshSignal]);

  // Muat opsi dropdown "statusguru" dari GET /api/jbsakad/guru untuk tampilan Guru Pengampu
  useEffect(() => {
    if (activeView?.pathTemplate !== '/jbsakad/guru') {
      return;
    }
    let cancelled = false;

    apiClient
      .get('/jbsakad/guru')
      .then((res) => {
        if (cancelled) return;
        const rows = extractResponsePayload(res.data).rows;
        const statusCounts = new Map<
          string,
          { display: string; count: number }
        >();

        for (const r of rows) {
          const cleanStatus = String(r.statusguru ?? '').trim();
          if (!cleanStatus || cleanStatus === 'null') continue;
          const key = cleanStatus.toLowerCase();
          const existing = statusCounts.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            statusCounts.set(key, { display: cleanStatus, count: 1 });
          }
        }

        const options: GuruStatusOption[] = Array.from(statusCounts.values())
          .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, 'id'))
          .map((item) => ({
            value: item.display,
            label: `${item.display} (${formatNumberId(item.count)} guru)`,
          }));

        setGuruStatusOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setGuruStatusOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView?.pathTemplate, refreshSignal]);

  // Muat opsi master kelas dari GET /api/jbsakad/kelas untuk tampilan Siswa per Kelas (/jbsakad/siswa/kelas/:idkelas)
  useEffect(() => {
    if (module.id !== 'jbsakad') {
      return;
    }
    let cancelled = false;

    apiClient
      .get('/jbsakad/kelas')
      .then((res) => {
        if (cancelled) return;
        const rows = extractResponsePayload(res.data).rows;
        const options: KelasOption[] = [];
        for (const r of rows) {
          const id = String(r.idkelas ?? '').trim();
          if (!id || id === 'null') continue;
          const nama = String(r.nama_kelas ?? r.kelas ?? '').trim();
          const wali = String(r.wali_kelas ?? '').trim();
          const hpWali = String(r.hp_wali ?? '').trim();
          options.push({
            idkelas: id,
            nama_kelas: nama,
            wali_kelas: wali || undefined,
            hp_wali: hpWali || undefined,
            label: wali
              ? `Kelas ${nama || id} (ID: ${id}) — Wali: ${wali}`
              : `Kelas ${nama || id} (ID: ${id})`,
          });
        }
        setKelasOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setKelasOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [module.id, refreshSignal]);

  const isSiswaPerKelasView =
    activeView?.pathTemplate === '/jbsakad/siswa/kelas/:idkelas' ||
    activeView?.id === 'siswa-per-kelas';

  const activeIdKelas = String(
    paramValues.idkelas ?? appliedParams.idkelas ?? '201'
  ).trim();

  const matchedKelas = useMemo(() => {
    if (!isSiswaPerKelasView || !activeIdKelas) return null;
    return kelasOptions.find((k) => k.idkelas === activeIdKelas) ?? null;
  }, [isSiswaPerKelasView, activeIdKelas, kelasOptions]);

  const activeKelasName = useMemo(() => {
    if (!isSiswaPerKelasView) return '';
    if (matchedKelas?.nama_kelas) return matchedKelas.nama_kelas;
    const fromPayload = (payload?.raw as Record<string, unknown>)?.nama_kelas;
    if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload.trim();
    const fromFirstRow = payload?.rows?.[0]?.nama_kelas;
    if (typeof fromFirstRow === 'string' && fromFirstRow.trim()) return fromFirstRow.trim();
    return '';
  }, [isSiswaPerKelasView, matchedKelas, payload]);

  const handleApplyParams = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedParams({ ...paramValues });
  };

  const handleResetParams = () => {
    if (!activeView) return;
    const defaults: Record<string, string> = {};
    for (const p of activeView.params || []) {
      defaults[p.name] = p.defaultValue ?? '';
    }
    setParamValues(defaults);
    setAppliedParams(defaults);
  };

  const handleQuickReturnBook = (replid: string) => {
    const returnAction = module.mutations.find(
      (m) => m.id === 'proses-kembali-buku'
    );
    if (returnAction) {
      onTriggerMutation(returnAction, { id: replid });
    }
  };

  const handleQuickBorrowBook = (kodepustaka: string) => {
    const borrowAction = module.mutations.find(
      (m) => m.id === 'catat-pinjam-buku'
    );
    if (borrowAction) {
      onTriggerMutation(borrowAction, { kodepustaka });
    }
  };

  const linkDigitalAction = useMemo(
    () => module.mutations.find((m) => m.id === 'tautkan-pustaka-digital') ?? null,
    [module.mutations]
  );

  const logDigitalReadAction = useMemo(
    () => module.mutations.find((m) => m.id === 'catat-baca-digital') ?? null,
    [module.mutations]
  );

  const unlinkDigitalAction = useMemo(
    () => module.mutations.find((m) => m.id === 'hapus-pustaka-digital') ?? null,
    [module.mutations]
  );

  const addHakAksesAction = useMemo(
    () =>
      isLandlord
        ? module.mutations.find((m) => m.id === 'add-hakakses') ?? null
        : null,
    [isLandlord, module.mutations]
  );

  const deleteHakAksesAction = useMemo(
    () =>
      isLandlord
        ? module.mutations.find((m) => m.id === 'delete-hakakses') ?? null
        : null,
    [isLandlord, module.mutations]
  );

  const modulePermCode = useMemo(
    () => resolveModulePermissionCode(module.id),
    [module.id]
  );
  const canCreateInModule = usePermission(modulePermCode, 'create');
  const canUpdateInModule = usePermission(modulePermCode, 'update');
  const canDeleteInModule = usePermission(modulePermCode, 'delete');

  const tambahSiswaAction = useMemo(
    () => module.mutations.find((m) => m.id === 'tambah-siswa') ?? null,
    [module.mutations]
  );

  const editSiswaAction = useMemo(
    () => module.mutations.find((m) => m.id === 'edit-siswa') ?? null,
    [module.mutations]
  );

  const hapusSiswaAction = useMemo(
    () => module.mutations.find((m) => m.id === 'hapus-siswa') ?? null,
    [module.mutations]
  );

  const updateJabatanAction = useMemo(
    () =>
      canUpdateInModule
        ? module.mutations.find((m) => m.id === 'update-jabatan') ?? null
        : null,
    [canUpdateInModule, module.mutations]
  );

  const deleteJabatanAction = useMemo(
    () =>
      canDeleteInModule
        ? module.mutations.find((m) => m.id === 'hapus-jabatan') ?? null
        : null,
    [canDeleteInModule, module.mutations]
  );

  const setGuruMapelAction = useMemo(
    () =>
      canCreateInModule
        ? module.mutations.find((m) => m.id === 'tambah-guru') ?? null
        : null,
    [canCreateInModule, module.mutations]
  );

  const buildJabatanInitialValues = (
    row: Record<string, unknown>
  ): Record<string, string> => ({
    replid: row.replid !== undefined && row.replid !== null ? String(row.replid) : '',
    jabatan: row.jabatan ? String(row.jabatan) : '',
    singkatan: row.singkatan ? String(row.singkatan) : '',
    satker:
      row.satker && String(row.satker) !== 'null'
        ? String(row.satker)
        : '(Tidak Ada)',
    eselon:
      row.eselon && String(row.eselon) !== 'null'
        ? String(row.eselon)
        : '(Tidak Ada)',
    rootid:
      row.rootid !== undefined && row.rootid !== null ? String(row.rootid) : '',
  });

  const handleLinkDigitalBook = (row: Record<string, unknown>) => {
    if (!linkDigitalAction) return;
    const idPustaka = String(
      row.idpustaka ?? row.id_pustaka ?? row.replid ?? ''
    ).trim();
    const existingUrl =
      row.file_url && String(row.file_url) !== 'null'
        ? String(row.file_url).trim()
        : '';
    const formatUpper = String(row.tipe || row.format || '').trim().toUpperCase();
    const defaultTipe = formatUpper === 'EPUB' ? 'EPUB' : 'PDF';

    onTriggerMutation(linkDigitalAction, {
      idpustaka: idPustaka,
      file_url: existingUrl,
      tipe: defaultTipe,
    });
  };

  const handleUnlinkDigitalBook = (row: Record<string, unknown>) => {
    if (!unlinkDigitalAction) return;
    const idPustaka = String(
      row.idpustaka ?? row.id_pustaka ?? row.replid ?? ''
    ).trim();
    onTriggerMutation(unlinkDigitalAction, {
      idpustaka: idPustaka,
    });
  };

  if (module.id === 'jbsumum') {
    return (
      <JbsUmumWorkspace
        module={module}
        initialViewId={initialViewId}
        onInspectEntity={onInspectEntity}
        onTriggerMutation={onTriggerMutation}
        refreshSignal={refreshSignal}
      />
    );
  }

  if ((module.id === 'jbsuser' && !isLandlord) || !activeView) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Modul & Tindakan CRUD */}
      {!hideHeaderBanner && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>Modul {module.code}</span>
              <span aria-hidden="true">·</span>
              <span>Prefix {module.prefix}</span>
              <span aria-hidden="true">·</span>
              <span>{module.views.length} tampilan data</span>
              {module.matchedHakAkses && module.matchedHakAkses.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-700 font-semibold">
                    Akses: {module.matchedHakAkses.join(', ')}
                  </span>
                </>
              )}
            </div>
            {module.id !== 'jbsperpus' && (
              <>
                <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  {module.name}
                </h1>
                {module.summary && (
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {module.summary}
                  </p>
                )}
              </>
            )}
          </div>

          {(module.mutations.length > 0 || module.id === 'jbssdm') && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {module.id === 'jbssdm' && (
                <Can modul="PERSONALIA" action="create">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setQuickPegawaiJabatanPopup({
                        mode: 'create',
                        nip:
                          String(
                            appliedParams.nip || paramValues.nip || '2001072003'
                          ).trim() || '2001072003',
                        allowChangeNip: true,
                      })
                    }
                  >
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Jabatan Pegawai</span>
                  </Button>
                </Can>
              )}
              {module.mutations.map((act) => (
                <Can
                  key={act.id}
                  modul={modulePermCode}
                  action={resolveMutationActionType(act.method)}
                >
                  <Button
                    type="button"
                    variant={act.destructive ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => {
                      const currentNip = String(
                        appliedParams.nip || paramValues.nip || ''
                      ).trim();
                      if (
                        act.id === 'add-hakakses' &&
                        activeView.id === 'hakakses-nip' &&
                        currentNip
                      ) {
                        onTriggerMutation(act, { nip: currentNip });
                      } else if (
                        act.id === 'update-jabatan' &&
                        activeView.id === 'jabatan-detail-sdm' &&
                        payload?.singleObject
                      ) {
                        onTriggerMutation(
                          act,
                          buildJabatanInitialValues(payload.singleObject)
                        );
                      } else if (
                        act.id === 'hapus-jabatan' &&
                        activeView.id === 'jabatan-detail-sdm'
                      ) {
                        const currentReplid = String(
                          payload?.singleObject?.replid ??
                            appliedParams.replid ??
                            paramValues.replid ??
                            ''
                        ).trim();
                        onTriggerMutation(
                          act,
                          currentReplid ? { replid: currentReplid } : undefined
                        );
                      } else {
                        onTriggerMutation(act);
                      }
                    }}
                    className={
                      act.destructive
                        ? 'text-red-700 border-red-200 hover:bg-red-50'
                        : ''
                    }
                  >
                    {!act.destructive && (
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{act.label}</span>
                  </Button>
                </Can>
              ))}
            </div>
          )}
        </div>

        {/* Navigasi Sub-Layanan Endpoint GET */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label={`Sub-layanan ${module.name}`}
          >
            {module.views.map((view) => {
              const isActive = view.id === activeView.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveViewId(view.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Permukaan Utama Data Endpoint Aktif */}
      {activeView.id === 'riwayat-jabatan' ? (
        <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  CRUD /api/jbssdm/pegawai/:nip/jabatan
                </span>
                <span aria-hidden="true">·</span>
                <span>GET · POST · PUT · DELETE</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {activeView.label}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeView.description}
              </p>
            </div>
          </div>

          <PegawaiJabatanDashboard
            initialNip={appliedParams.nip || '2001072003'}
            refreshSignal={refreshSignal}
            onInspectEntity={onInspectEntity}
            onMutated={onMutated}
          />
        </section>
      ) : activeView.id === 'presensiharian' ||
        activeView.id === 'presensi-pelajaran' ? (
        <PresensiKelasTable
          endpoint={
            activeView.id === 'presensiharian'
              ? '/jbsakad/presensiharian'
              : '/jbsakad/presensi-pelajaran'
          }
          title={activeView.label}
          description={activeView.description}
          initialIdKelas="201"
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
        />
      ) : activeView.id === 'presensiharian-nis' ||
        activeView.id === 'presensi-pelajaran-nis' ? (
        <ProfilPresensiSiswa
          endpointType={
            activeView.id === 'presensiharian-nis' ? 'harian' : 'pelajaran'
          }
          initialNis={appliedParams.nis || '1779'}
          title={activeView.label}
          description={activeView.description}
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
        />
      ) : activeView.id === 'rapor' ||
        activeView.id === 'rapor-detail' ||
        activeView.id === 'rapor-nilaiujian' ? (
        <RaporPenilaianWorkspace
          initialMode={
            activeView.id === 'rapor'
              ? 'direktori'
              : activeView.id === 'rapor-detail'
              ? 'rapor-siswa'
              : 'nilai-ujian'
          }
          initialNis="1629"
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
          onMutated={onMutated}
        />
      ) : activeView.id === 'jadwal-kelas' ? (
        <JadwalKelasWorkspace
          initialIdKelas={appliedParams.idkelas || '201'}
          title={activeView.label}
          description={activeView.description}
          refreshSignal={refreshSignal}
          onInspectEntity={onInspectEntity}
        />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
          {/* Info Endpoint Aktif & Kontrol Refresh / JSON */}
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800">
                  GET {resolvedEndpointUrl || `/api${activeView.pathTemplate}`}
                </span>
                {isSiswaPerKelasView && activeKelasName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-emerald-700">
                      Kelas {activeKelasName}
                    </span>
                  </>
                )}
                {payload && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium text-slate-700">
                      Total: {formatNumberId(payload.totalCount)} data
                    </span>
                  </>
                )}
                {payload?.source && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Basis Data: {payload.source}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                <h2 className="text-base font-bold text-slate-900">
                  {activeView.label}
                  {isSiswaPerKelasView && activeKelasName
                    ? ` — Kelas ${activeKelasName}`
                    : ''}
                </h2>
                {isSiswaPerKelasView && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {activeKelasName
                        ? `Kelas ${activeKelasName}`
                        : `ID Kelas #${activeIdKelas}`}
                      {matchedKelas?.wali_kelas
                        ? ` · Wali: ${matchedKelas.wali_kelas}`
                        : ''}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isSiswaPerKelasView && activeKelasName
                  ? `Daftar anggota siswa aktif yang terdaftar dalam rombongan belajar Kelas ${activeKelasName} (ID: ${activeIdKelas})${
                      matchedKelas?.wali_kelas
                        ? ` dengan Wali Kelas ${matchedKelas.wali_kelas}`
                        : ''
                    }.`
                  : activeView.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => fetchActiveEndpoint(activeView, appliedParams)}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
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

          {/* Form Parameter Query / Path Apabila Endpoint Membutuhkan Filter */}
          {activeView.params && activeView.params.length > 0 && (
            <form
              onSubmit={handleApplyParams}
              className="px-6 py-4 bg-slate-50/70 flex flex-wrap items-end gap-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2.5 mr-1">
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Parameter Query:</span>
              </div>

              {activeView.pathTemplate === '/jbsakad/alumni' &&
                alumniYearOptions.length > 0 && (
                  <div className="w-full sm:w-60 space-y-1">
                    <label
                      htmlFor="alumni-quick-tahunajaran"
                      className="block text-xs font-medium text-slate-600"
                    >
                      Pilih Cepat Tahun Ajaran
                    </label>
                    <select
                      id="alumni-quick-tahunajaran"
                      value={
                        alumniYearOptions.some(
                          (opt) => opt.value === (paramValues.tahunajaran ?? '')
                        )
                          ? (paramValues.tahunajaran ?? '')
                          : ''
                      }
                      onChange={(e) => {
                        const selected = e.target.value;
                        setParamValues((prev) => ({
                          ...prev,
                          tahunajaran: selected,
                        }));
                        setAppliedParams((prev) => ({
                          ...prev,
                          tahunajaran: selected,
                        }));
                      }}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                    >
                      <option value="">Semua Tahun Ajaran</option>
                      {alumniYearOptions.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {activeView.params.map((param) => {
                const isGuruStatusDropdown =
                  activeView.pathTemplate === '/jbsakad/guru' &&
                  param.name === 'statusguru';

                const isSiswaPerKelasIdParam =
                  isSiswaPerKelasView && param.name === 'idkelas';

                return (
                  <div
                    key={param.name}
                    className={`w-full ${
                      isSiswaPerKelasIdParam ? 'sm:w-80' : 'sm:w-60'
                    } space-y-1.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`param-${param.name}`}
                        className="block text-xs font-medium text-slate-700"
                      >
                        {isSiswaPerKelasIdParam ? 'Pilih Kelas' : param.label}
                        {param.required && (
                          <span className="text-red-600 ml-0.5">*</span>
                        )}
                      </label>
                      {isSiswaPerKelasIdParam && activeKelasName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <GraduationCap className="h-3 w-3" aria-hidden="true" />
                          <span>Kelas {activeKelasName}</span>
                        </span>
                      )}
                    </div>

                    {isSiswaPerKelasIdParam ? (
                      <div className="space-y-1.5">
                        <select
                          id={`param-${param.name}-select`}
                          value={paramValues[param.name] ?? ''}
                          onChange={(e) => {
                            const selected = e.target.value;
                            setParamValues((prev) => ({
                              ...prev,
                              [param.name]: selected,
                            }));
                            setAppliedParams((prev) => ({
                              ...prev,
                              [param.name]: selected,
                            }));
                          }}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                        >
                          <option value="">-- Pilih Kelas dari Dropdown --</option>
                          {kelasOptions.map((opt) => (
                            <option key={opt.idkelas} value={opt.idkelas}>
                              Kelas {opt.nama_kelas || opt.idkelas} (ID: {opt.idkelas}
                              {opt.wali_kelas ? ` · Wali: ${opt.wali_kelas}` : ''})
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2">
                          <div className="w-24 shrink-0">
                            <Input
                              id={`param-${param.name}`}
                              value={paramValues[param.name] ?? ''}
                              onChange={(e) =>
                                setParamValues((prev) => ({
                                  ...prev,
                                  [param.name]: e.target.value,
                                }))
                              }
                              placeholder="ID Kelas"
                              className="h-8 text-xs font-mono"
                              title="ID Kelas numerik"
                            />
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight truncate">
                            {matchedKelas ? (
                              <span>
                                <strong className="text-slate-800">
                                  Kelas {matchedKelas.nama_kelas}
                                </strong>
                                {matchedKelas.wali_kelas
                                  ? ` · Wali: ${matchedKelas.wali_kelas}`
                                  : ''}
                              </span>
                            ) : (
                              <span>Pilih dropdown atau ketik ID kelas</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isGuruStatusDropdown ? (
                      <select
                        id={`param-${param.name}`}
                        value={paramValues[param.name] ?? ''}
                        onChange={(e) => {
                          const selected = e.target.value;
                          setParamValues((prev) => ({
                            ...prev,
                            [param.name]: selected,
                          }));
                          setAppliedParams((prev) => ({
                            ...prev,
                            [param.name]: selected,
                          }));
                        }}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                      >
                        <option value="">Semua Status Guru</option>
                        {guruStatusOptions.map((opt, idx) => (
                          <option key={`${opt.value}-${idx}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`param-${param.name}`}
                        value={paramValues[param.name] ?? ''}
                        onChange={(e) =>
                          setParamValues((prev) => ({
                            ...prev,
                            [param.name]: e.target.value,
                          }))
                        }
                        placeholder={param.placeholder}
                        className="h-9 text-xs"
                      />
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={isLoading}>
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tampilkan</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetParams}
                  disabled={isLoading}
                >
                  Reset
                </Button>
              </div>
            </form>
          )}

          {/* Pesan Status Server (Bila Ada) */}
          {payload?.message && !errorMsg && (
            <div className="px-6 py-2.5 bg-slate-50/40 text-xs text-slate-600">
              Keterangan Server: <span className="font-medium text-slate-800">{payload.message}</span>
            </div>
          )}

          {/* Penanganan Error Endpoint */}
          {errorMsg ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                <div className="space-y-1">
                  <AlertTitle>Kendala Memuat Endpoint</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </div>
              </Alert>
            </div>
          ) : activeView.renderMode === 'identity-cards' && payload ? (
            <IdentityShowcase
              rows={payload.rows}
              onInspectRow={(row) =>
                onInspectEntity({
                  mode: 'generic',
                  title: String(row.nama || 'Identitas Lembaga'),
                  row,
                })
              }
            />
          ) : activeView.id === 'siswa-aktif' || isSiswaPerKelasView ? (
            <DaftarSiswaTable
              rows={
                isSiswaPerKelasView && payload?.rows
                  ? payload.rows.map((r) => ({
                      ...r,
                      nama_kelas: r.nama_kelas ?? activeKelasName,
                      idkelas: r.idkelas ?? activeIdKelas,
                    }))
                  : payload?.rows || []
              }
              isLoading={isLoading}
              onInspect={onInspectEntity}
              onAddSiswa={
                tambahSiswaAction
                  ? () => onTriggerMutation(tambahSiswaAction)
                  : undefined
              }
              onEditSiswa={
                editSiswaAction
                  ? (row) =>
                      onTriggerMutation(editSiswaAction, {
                        nis: String(row.nis ?? '').trim(),
                        nama: String(row.nama ?? row.nama_siswa ?? '').trim(),
                        hportu:
                          row.hportu && String(row.hportu) !== 'null'
                            ? String(row.hportu).trim()
                            : '',
                        emailsiswa:
                          row.emailsiswa && String(row.emailsiswa) !== 'null'
                            ? String(row.emailsiswa).trim()
                            : '',
                      })
                  : undefined
              }
              onDeleteSiswa={
                hapusSiswaAction
                  ? (row) =>
                      onTriggerMutation(hapusSiswaAction, {
                        nis: String(row.nis ?? '').trim(),
                      })
                  : undefined
              }
            />
          ) : (
            <SmartDataTable
              rows={payload?.rows || []}
              singleObject={payload?.singleObject || null}
              isLoading={isLoading}
              entityType={activeView.entityType}
              onInspect={onInspectEntity}
              onQuickReturnBook={
                canUpdateInModule ? handleQuickReturnBook : undefined
              }
              onQuickBorrowBook={
                canCreateInModule ? handleQuickBorrowBook : undefined
              }
              onOpenDigitalBook={(row) => setReadingBook(row)}
              onLinkDigitalBook={
                canCreateInModule && linkDigitalAction
                  ? handleLinkDigitalBook
                  : undefined
              }
              onUnlinkDigitalBook={
                canDeleteInModule && unlinkDigitalAction
                  ? handleUnlinkDigitalBook
                  : undefined
              }
              onGrantHakAkses={
                addHakAksesAction
                  ? (nip) => onTriggerMutation(addHakAksesAction, { nip })
                  : undefined
              }
              onRevokeHakAkses={
                deleteHakAksesAction
                  ? (replid) =>
                      onTriggerMutation(deleteHakAksesAction, { replid })
                  : undefined
              }
              onEditJabatan={
                updateJabatanAction
                  ? (row) =>
                      onTriggerMutation(
                        updateJabatanAction,
                        buildJabatanInitialValues(row)
                      )
                  : undefined
              }
              onDeleteJabatan={
                deleteJabatanAction
                  ? (row) =>
                      onTriggerMutation(deleteJabatanAction, {
                        replid: String(row.replid ?? ''),
                      })
                  : undefined
              }
              onManagePegawaiJabatan={
                module.id === 'jbssdm'
                  ? (row) =>
                      setManagedPegawaiJabatan({
                        nip: String(row.nip ?? ''),
                        nama: String(
                          row.nama || row.nama_pegawai || `NIP ${String(row.nip ?? '')}`
                        ),
                        bagian:
                          row.bagian && String(row.bagian) !== 'null'
                            ? String(row.bagian)
                            : undefined,
                        jabatan:
                          row.jabatan && String(row.jabatan) !== 'null'
                            ? String(row.jabatan)
                            : undefined,
                        foto: row.foto,
                      })
                  : undefined
              }
              onSetGuruMapel={
                setGuruMapelAction &&
                (activeView.id === 'guru' || activeView.id === 'pelajaran')
                  ? (row) => {
                      if (activeView.id === 'guru') {
                        onTriggerMutation(setGuruMapelAction, {
                          nip: String(row.nip ?? '').trim(),
                          statusguru:
                            row.statusguru !== undefined &&
                            row.statusguru !== null
                              ? String(row.statusguru)
                              : '',
                        });
                      } else {
                        const rawId =
                          row.idpelajaran ?? row.replid ?? row.id ?? '';
                        onTriggerMutation(setGuruMapelAction, {
                          idpelajaran: String(rawId).trim(),
                        });
                      }
                    }
                  : undefined
              }
            />
          )}
        </section>
      )}

      <DigitalBookReaderModal
        book={readingBook}
        onClose={() => setReadingBook(null)}
        onManualLogRead={
          logDigitalReadAction
            ? (idPustaka) => {
                setReadingBook(null);
                onTriggerMutation(logDigitalReadAction, { idpustaka: idPustaka });
              }
            : undefined
        }
      />

      {/* Popup Manager Jabatan Pegawai (Saat klik Kelola Jabatan dari Direktori Pegawai) */}
      <PegawaiJabatanManagerPopup
        employee={managedPegawaiJabatan}
        onClose={() => setManagedPegawaiJabatan(null)}
        onMutated={onMutated}
      />

      {/* Popup Form Cepat Tambah Jabatan Pegawai (Saat klik dari Header Modul SDM) */}
      <PegawaiJabatanFormPopup
        popupState={quickPegawaiJabatanPopup}
        onClose={() => setQuickPegawaiJabatanPopup(null)}
        onSuccess={() => {
          if (onMutated) onMutated();
        }}
        onSwitchMode={(next) => setQuickPegawaiJabatanPopup(next)}
      />
    </div>
  );
}
