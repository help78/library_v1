import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Code2,
  Loader2,
  MinusCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import {
  extractResponsePayload,
  formatNumberId,
} from '../../lib/formatters';
import { AvatarImage } from './AvatarImage';
import {
  PegawaiJabatanFormPopup,
  type PegawaiJabatanPopupState,
} from './PegawaiJabatanModal';
import type { InspectedEntity } from './SmartDataTable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Can } from '../auth/Can';

interface PegawaiDirectoryItem {
  nip: string;
  nama: string;
  bagian: string;
  jabatan: string;
  foto: unknown;
}

interface PegawaiJabatanDashboardProps {
  initialNip?: string;
  refreshSignal: number;
  onInspectEntity: (entity: InspectedEntity) => void;
  onMutated?: () => void;
}

export function PegawaiJabatanDashboard({
  initialNip = '2001072003',
  refreshSignal,
  onInspectEntity,
  onMutated,
}: PegawaiJabatanDashboardProps) {
  const [selectedNip, setSelectedNip] = useState<string>(
    initialNip || '2001072003'
  );
  const [customNipInput, setCustomNipInput] = useState<string>(
    initialNip || '2001072003'
  );
  const [pegawaiSearch, setPegawaiSearch] = useState<string>('');
  const [pegawaiFilter, setPegawaiFilter] = useState<
    'all' | 'assigned' | 'unassigned'
  >('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  const [pegawaiList, setPegawaiList] = useState<PegawaiDirectoryItem[]>([]);
  const [masterJabatanCount, setMasterJabatanCount] = useState<number>(0);
  const [loadingDirectory, setLoadingDirectory] = useState<boolean>(true);

  const [jabatanRows, setJabatanRows] = useState<Record<string, unknown>[]>([]);
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const [loadingJabatan, setLoadingJabatan] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [popupState, setPopupState] =
    useState<PegawaiJabatanPopupState | null>(null);
  const [localRefresh, setLocalRefresh] = useState<number>(0);

  // Sinkronisasi apabila parameter NIP eksternal berubah
  useEffect(() => {
    if (initialNip && initialNip.trim()) {
      setSelectedNip(initialNip.trim());
      setCustomNipInput(initialNip.trim());
    }
  }, [initialNip]);

  // Muat daftar pegawai aktif (aktif=1) & jumlah master jabatan untuk panel direktori dan ringkasan KPI
  const fetchDirectoryAndMasters = useCallback(async () => {
    setLoadingDirectory(true);
    try {
      const [pegRes, jabRes] = await Promise.allSettled([
        apiClient.get('/jbssdm/pegawai', { params: { aktif: '1' } }),
        apiClient.get('/jbssdm/jabatan'),
      ]);

      if (pegRes.status === 'fulfilled') {
        const parsed = extractResponsePayload(pegRes.value.data);
        const activeItems: PegawaiDirectoryItem[] = parsed.rows
          .filter((r) => !('aktif' in r) || Number(r.aktif) === 1)
          .map((r) => ({
            nip: String(r.nip ?? '').trim(),
            nama: String(r.nama ?? '').trim(),
            bagian:
              r.bagian && String(r.bagian) !== 'null'
                ? String(r.bagian).trim()
                : 'SDM',
            jabatan:
              r.jabatan && String(r.jabatan) !== 'null'
                ? String(r.jabatan).trim()
                : '',
            foto: r.foto,
          }))
          .filter((item) => Boolean(item.nip));

        // Urutkan pegawai yang sudah memiliki jabatan aktif di bagian atas agar mudah dipantau, lalu alfabetis
        activeItems.sort((a, b) => {
          const aHas = a.jabatan ? 1 : 0;
          const bHas = b.jabatan ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          return a.nama.localeCompare(b.nama);
        });

        setPegawaiList(activeItems);
      }

      if (jabRes.status === 'fulfilled') {
        const jRows = extractResponsePayload(jabRes.value.data).rows.filter(
          (r) => String(r.jabatan ?? '').toUpperCase() !== 'NA'
        );
        setMasterJabatanCount(jRows.length);
      }
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectoryAndMasters();
  }, [fetchDirectoryAndMasters, refreshSignal, localRefresh]);

  // Muat GET /api/jbssdm/pegawai/:nip/jabatan setiap kali NIP terpilih berubah
  const fetchJabatanForNip = useCallback(async (nipTarget: string) => {
    const clean = nipTarget.trim();
    if (!clean) {
      setJabatanRows([]);
      setRawPayload(null);
      setErrorMsg('Pilih pegawai atau masukkan NIP terlebih dahulu.');
      return;
    }

    setLoadingJabatan(true);
    setErrorMsg(null);
    try {
      const response = await apiClient.get(
        `/jbssdm/pegawai/${encodeURIComponent(clean)}/jabatan`
      );
      const parsed = extractResponsePayload(response.data);
      setJabatanRows(parsed.rows);
      setRawPayload(response.data);
    } catch (err) {
      setJabatanRows([]);
      setRawPayload(null);
      setErrorMsg(extractApiErrorMessage(err));
    } finally {
      setLoadingJabatan(false);
    }
  }, []);

  useEffect(() => {
    fetchJabatanForNip(selectedNip);
  }, [selectedNip, refreshSignal, localRefresh, fetchJabatanForNip]);

  const selectedEmployee = useMemo(
    () => pegawaiList.find((p) => p.nip === selectedNip) || null,
    [pegawaiList, selectedNip]
  );

  const assignedEmployeesCount = useMemo(
    () => pegawaiList.filter((p) => Boolean(p.jabatan)).length,
    [pegawaiList]
  );

  const filteredPegawai = useMemo(() => {
    let base = pegawaiList;
    if (pegawaiFilter === 'assigned') {
      base = base.filter((p) => Boolean(p.jabatan));
    } else if (pegawaiFilter === 'unassigned') {
      base = base.filter((p) => !p.jabatan);
    }
    const q = pegawaiSearch.trim().toLowerCase();
    if (!q) {
      return base;
    }
    return base.filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        p.nip.toLowerCase().includes(q) ||
        p.jabatan.toLowerCase().includes(q) ||
        p.bagian.toLowerCase().includes(q)
    );
  }, [pegawaiList, pegawaiFilter, pegawaiSearch]);

  const filteredJabatanRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) {
      return jabatanRows;
    }
    return jabatanRows.filter((r) =>
      Object.values(r).some(
        (v) =>
          v !== null &&
          v !== undefined &&
          typeof v !== 'object' &&
          String(v).toLowerCase().includes(q)
      )
    );
  }, [jabatanRows, tableSearch]);

  const activeJabatanRecord = useMemo(
    () =>
      jabatanRows.find((r) => Number(r.terakhir) === 1) ||
      jabatanRows[0] ||
      null,
    [jabatanRows]
  );

  const currentJabatanTitle = activeJabatanRecord
    ? String(
        activeJabatanRecord.nama_jabatan_master ||
          activeJabatanRecord.namajab ||
          '-'
      )
    : selectedEmployee?.jabatan || 'Belum Ditetapkan';

  const handleSelectPegawai = (nipTarget: string) => {
    setSelectedNip(nipTarget);
    setCustomNipInput(nipTarget);
  };

  const handleApplyCustomNip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNipInput.trim()) return;
    setSelectedNip(customNipInput.trim());
  };

  const handlePopupSuccess = () => {
    setLocalRefresh((k) => k + 1);
    if (onMutated) {
      onMutated();
    }
  };

  return (
    <div className="divide-y divide-slate-200">
      {/* Bilah Ringkasan KPI Dashboard Jabatan Pegawai */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
        <div className="px-6 py-4">
          <div className="text-xs font-medium text-slate-500">
            Pegawai Aktif Terdaftar
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
            {formatNumberId(pegawaiList.length)} Pegawai
          </div>
          <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
            {formatNumberId(assignedEmployeesCount)} sudah menjabat ·{' '}
            {formatNumberId(
              Math.max(0, pegawaiList.length - assignedEmployeesCount)
            )}{' '}
            belum
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="text-xs font-medium text-slate-500">
            Pegawai Terpilih
          </div>
          <div className="mt-1 text-base font-bold text-slate-900 truncate">
            {selectedEmployee?.nama || `NIP ${selectedNip}`}
          </div>
          <div className="mt-0.5 text-xs font-mono tabular-nums text-slate-500">
            NIP {selectedNip}
            {selectedEmployee?.bagian ? ` · ${selectedEmployee.bagian}` : ''}
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="text-xs font-medium text-slate-500">
            Total Riwayat SK Jabatan
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
            {formatNumberId(jabatanRows.length)} SK
          </div>
          <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
            Master Struktur: {formatNumberId(masterJabatanCount)} jabatan
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="text-xs font-medium text-slate-500">
            Jabatan Aktif Saat Ini
          </div>
          <div
            className={`mt-1 text-base font-bold truncate ${
              currentJabatanTitle === 'Belum Ditetapkan'
                ? 'text-slate-400'
                : 'text-emerald-700'
            }`}
          >
            {currentJabatanTitle}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 tabular-nums truncate">
            {activeJabatanRecord?.sk
              ? `SK: ${String(activeJabatanRecord.sk)}`
              : 'Klik + Tambah Jabatan untuk mencatat SK'}
          </div>
        </div>
      </div>

      {/* Ruang Kerja 2 Kolom: Pemilih Pegawai Aktif (Kiri) + Tabel CRUD Riwayat Jabatan (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Kolom Kiri: Direktori Pilih Cepat Pegawai */}
        <div className="lg:col-span-4 flex flex-col divide-y divide-slate-200 bg-white">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700">
                Pilih Pegawai Aktif ({formatNumberId(filteredPegawai.length)})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setPopupState({
                    mode: 'create',
                    nip: selectedNip,
                    allowChangeNip: true,
                  })
                }
                className="text-xs font-semibold text-[#1565d8] hover:underline cursor-pointer whitespace-nowrap"
              >
                + Pilih NIP Bebas
              </button>
            </div>

            <div className="relative">
              <Search
                className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={pegawaiSearch}
                onChange={(e) => setPegawaiSearch(e.target.value)}
                placeholder="Cari nama atau NIP pegawai..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </div>

            <div
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="Filter status jabatan pegawai"
            >
              {[
                { id: 'all', label: 'Semua' },
                { id: 'assigned', label: 'Ada Jabatan' },
                { id: 'unassigned', label: 'Belum Ada' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setPegawaiFilter(
                      tab.id as 'all' | 'assigned' | 'unassigned'
                    )
                  }
                  className={`py-1 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    pegawaiFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
            {loadingDirectory ? (
              <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2
                  className="h-4 w-4 animate-spin text-slate-600"
                  aria-hidden="true"
                />
                <span>Memuat direktori pegawai aktif...</span>
              </div>
            ) : filteredPegawai.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Tidak ada pegawai aktif yang sesuai pencarian.
              </div>
            ) : (
              filteredPegawai.map((emp, idx) => {
                const isSelected = emp.nip === selectedNip;
                return (
                  <button
                    key={`${emp.nip}-${idx}`}
                    type="button"
                    onClick={() => handleSelectPegawai(emp.nip)}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <AvatarImage
                      rawSrc={emp.foto}
                      name={emp.nama}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-semibold truncate ${
                          isSelected ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {emp.nama}
                      </div>
                      <div
                        className={`text-[11px] font-mono tabular-nums truncate mt-0.5 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {emp.nip} · {emp.bagian}
                      </div>
                      <div
                        className={`text-[11px] truncate mt-0.5 ${
                          emp.jabatan
                            ? isSelected
                              ? 'text-emerald-300 font-medium'
                              : 'text-emerald-700 font-medium'
                            : isSelected
                            ? 'text-slate-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {emp.jabatan || 'Belum ada jabatan aktif'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Input Cepat NIP Manual */}
          <form
            onSubmit={handleApplyCustomNip}
            className="p-4 bg-slate-50/60 flex items-center gap-2"
          >
            <Input
              value={customNipInput}
              onChange={(e) => setCustomNipInput(e.target.value)}
              placeholder="Ketik NIP manual..."
              className="h-8 text-xs font-mono"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 whitespace-nowrap shrink-0"
            >
              Cek NIP
            </Button>
          </form>
        </div>

        {/* Kolom Kanan: Tabel & Kontrol CRUD /api/jbssdm/pegawai/:nip/jabatan */}
        <div className="lg:col-span-8 flex flex-col divide-y divide-slate-200 bg-white">
          {/* Header Pegawai Terpilih & Tombol Popup CRUD */}
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <AvatarImage
                rawSrc={selectedEmployee?.foto}
                name={selectedEmployee?.nama || selectedNip}
                size="md"
              />
              <div className="min-w-0">
                <div className="text-xs font-mono text-slate-500 tabular-nums truncate">
                  GET /api/jbssdm/pegawai/{selectedNip}/jabatan
                </div>
                <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
                  {selectedEmployee?.nama || `Pegawai NIP ${selectedNip}`}
                </h3>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  NIP {selectedNip}
                  {selectedEmployee?.bagian
                    ? ` · ${selectedEmployee.bagian}`
                    : ''}{' '}
                  · {formatNumberId(jabatanRows.length)} rekaman jabatan
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingJabatan}
                onClick={() => fetchJabatanForNip(selectedNip)}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    loadingJabatan ? 'animate-spin' : ''
                  }`}
                  aria-hidden="true"
                />
                <span>Muat Ulang</span>
              </Button>

              {rawPayload !== null && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onInspectEntity({
                      mode: 'raw-response',
                      title: `GET /api/jbssdm/pegawai/${selectedNip}/jabatan`,
                      row: (rawPayload as Record<string, unknown>) || {},
                    })
                  }
                >
                  <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>JSON</span>
                </Button>
              )}

              <Can modul="PERSONALIA" action="create">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setPopupState({
                      mode: 'create',
                      nip: selectedNip,
                      employeeName: selectedEmployee?.nama,
                      employeeBagian: selectedEmployee?.bagian,
                      employeeFoto: selectedEmployee?.foto,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tambah Jabatan</span>
                </Button>
              </Can>
            </div>
          </div>

          {/* Pencarian Baris Riwayat Jabatan */}
          {jabatanRows.length > 0 && (
            <div className="px-6 py-3 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Cari jabatan, nomor SK, atau jenis..."
                  className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                />
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                Menampilkan {formatNumberId(filteredJabatanRows.length)} dari{' '}
                {formatNumberId(jabatanRows.length)} SK
              </div>
            </div>
          )}

          {/* Konten Tabel / Empty State / Loading */}
          <div className="flex-1">
            {loadingJabatan ? (
              <div className="divide-y divide-slate-200">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="px-6 py-4 flex items-center gap-6 animate-pulse"
                  >
                    <div className="h-4 w-12 bg-slate-200 rounded" />
                    <div className="h-4 w-44 bg-slate-200 rounded" />
                    <div className="h-4 w-28 bg-slate-100 rounded hidden sm:block" />
                    <div className="h-4 w-24 bg-slate-100 rounded ml-auto" />
                  </div>
                ))}
              </div>
            ) : errorMsg ? (
              <div className="p-6">
                <Alert variant="destructive">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <AlertTitle>Gagal Memuat Riwayat Jabatan</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </div>
                </Alert>
              </div>
            ) : jabatanRows.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-3">
                <Briefcase
                  className="h-9 w-9 text-slate-300 mx-auto"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Belum Ada Riwayat Jabatan untuk NIP {selectedNip}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Tambahkan penugasan jabatan struktural atau fungsional baru
                    beserta Nomor SK dan Tanggal Mulai Tugas (TMT) melalui
                    dialog popup.
                  </p>
                </div>
                <Can modul="PERSONALIA" action="create">
                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setPopupState({
                          mode: 'create',
                          nip: selectedNip,
                          employeeName: selectedEmployee?.nama,
                          employeeBagian: selectedEmployee?.bagian,
                          employeeFoto: selectedEmployee?.foto,
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
                      <th className="py-3 px-5 whitespace-nowrap">
                        Jenis Jabatan
                      </th>
                      <th className="py-3 px-5 whitespace-nowrap">
                        Nomor SK & TMT
                      </th>
                      <th className="py-3 px-5 whitespace-nowrap">Status</th>
                      <th className="py-3 px-5 text-right whitespace-nowrap">
                        Tindakan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredJabatanRows.map((row, idx) => {
                      const rowId = String(row.replid ?? idx);
                      const isActive = Number(row.terakhir) === 1;
                      const masterName = String(
                        row.nama_jabatan_master || row.namajab || '-'
                      );
                      const singkatan =
                        row.singkatan && String(row.singkatan) !== 'null'
                          ? String(row.singkatan)
                          : '';

                      return (
                        <tr
                          key={`${rowId}-${idx}`}
                          onClick={() =>
                            setPopupState({
                              mode: 'detail',
                              nip: selectedNip,
                              employeeName: selectedEmployee?.nama,
                              employeeBagian: selectedEmployee?.bagian,
                              employeeFoto: selectedEmployee?.foto,
                              record: row,
                            })
                          }
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-5 font-mono text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                            #{rowId}
                          </td>
                          <td className="py-3 px-5">
                            <div className="font-semibold text-slate-900">
                              {masterName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {singkatan ? `${singkatan} · ` : ''}
                              Penugasan: {String(row.namajab || masterName)}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-xs text-slate-700 whitespace-nowrap">
                            {String(row.jenis || '-')}
                          </td>
                          <td className="py-3 px-5 whitespace-nowrap">
                            <div className="font-mono text-xs font-medium text-slate-800 tabular-nums">
                              {row.sk && String(row.sk).trim() !== ''
                                ? String(row.sk)
                                : '-'}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              TMT: {String(row.tmt || '-')}
                            </div>
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
                              <span>
                                {isActive ? 'Aktif / Terakhir' : 'Riwayat'}
                              </span>
                            </span>
                          </td>
                          <td
                            className="py-3 px-5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setPopupState({
                                    mode: 'detail',
                                    nip: selectedNip,
                                    employeeName: selectedEmployee?.nama,
                                    employeeBagian: selectedEmployee?.bagian,
                                    employeeFoto: selectedEmployee?.foto,
                                    record: row,
                                  })
                                }
                              >
                                Detail
                              </Button>
                              <Can modul="PERSONALIA" action="update">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setPopupState({
                                      mode: 'edit',
                                      nip: selectedNip,
                                      employeeName: selectedEmployee?.nama,
                                      employeeBagian: selectedEmployee?.bagian,
                                      employeeFoto: selectedEmployee?.foto,
                                      record: row,
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
                                    setPopupState({
                                      mode: 'delete',
                                      nip: selectedNip,
                                      employeeName: selectedEmployee?.nama,
                                      employeeBagian: selectedEmployee?.bagian,
                                      employeeFoto: selectedEmployee?.foto,
                                      record: row,
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
        </div>
      </div>

      {/* Popup Dialog untuk Create / Detail / Edit / Delete Riwayat Jabatan */}
      <PegawaiJabatanFormPopup
        popupState={popupState}
        onClose={() => setPopupState(null)}
        onSuccess={handlePopupSuccess}
        onSwitchMode={(next) => setPopupState(next)}
      />
    </div>
  );
}
