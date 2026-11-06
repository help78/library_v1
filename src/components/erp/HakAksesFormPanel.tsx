import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  HAK_AKSES_EXAMPLES,
  HAK_AKSES_POST_SPEC,
  type CreateHakAksesPayload,
} from '../../data/swagger';
import { apiClient, extractApiErrorMessage } from '../../lib/api';
import { extractResponsePayload } from '../../lib/formatters';
import { useSchoolIdentity } from '../../hooks/useSchoolIdentity';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface PegawaiAccountItem {
  nip: string;
  nama: string;
  aktif: number;
}

interface ExistingHakAksesRow {
  replid: number | string;
  login?: string;
  modul: string;
  tingkat: number;
  departemen: string | null;
  keterangan: string | null;
  aktif?: number;
}

interface HakAksesFormPanelProps {
  onSuccessMutate?: () => void;
  onRequestCreateLoginAccount?: (nip: string) => void;
  onRequestEditHakAkses?: (row: ExistingHakAksesRow) => void;
}

const JIBAS_MODULES: { value: string; label: string; scopeHint: string }[] = [
  {
    value: 'KEUANGAN',
    label: 'KEUANGAN — Administrasi Keuangan & Kasir',
    scopeHint: 'Tagihan siswa/calon, pembayaran, verifikasi jurnal',
  },
  {
    value: 'SIMAKA',
    label: 'SIMAKA — Sistem Informasi Manajemen Akademik',
    scopeHint: 'Siswa, kelas, jadwal, presensi, PPDB, kalender',
  },
  {
    value: 'INFOGURU',
    label: 'INFOGURU — Portal Guru & Pengajaran',
    scopeHint: 'Presensi pelajaran, nilai ujian, jadwal mengajar',
  },
  {
    value: 'SIMPEG',
    label: 'SIMPEG — Kepegawaian (SDM)',
    scopeHint: 'Biodata pendidik & staf, presensi SDM, riwayat jabatan',
  },
  {
    value: 'SIMTAKA',
    label: 'SIMTAKA — Perpustakaan & Pustaka Digital',
    scopeHint: 'Katalog buku, sirkulasi pinjam/kembali, e-book digital',
  },
  {
    value: 'CBE',
    label: 'CBE — Computer Based Exam (Ujian)',
    scopeHint: 'Evaluasi dan rekap nilai ujian berbasis komputer',
  },
  {
    value: 'EMA',
    label: 'EMA — Executive Management Access',
    scopeHint: 'Pemantauan eksekutif lintas modul (read-only)',
  },
  {
    value: 'JSA',
    label: 'JSA — JIBAS System Administrator',
    scopeHint: 'Manajemen akun login pegawai dan distribusi hak akses',
  },
  {
    value: 'CARDMAKER',
    label: 'CARDMAKER — Sistem Kartu Identitas Pintar',
    scopeHint: 'Templat kartu QR dan riwayat pemindaian kartu',
  },
  {
    value: 'SMSG',
    label: 'SMSG — Layanan Pesan & Nota Digital',
    scopeHint: 'Komunikasi internal, nota digital, pengantar surat',
  },
];

export function HakAksesFormPanel({
  onSuccessMutate,
  onRequestCreateLoginAccount,
  onRequestEditHakAkses,
}: HakAksesFormPanelProps) {
  const { units } = useSchoolIdentity();

  // Inisialisasi default langsung dari contoh AksesKeuangan pada swagger.ts (Single Source of Truth)
  const aksesKeuanganExample = HAK_AKSES_EXAMPLES.AksesKeuangan.value;
  const aksesAkademikExample = HAK_AKSES_EXAMPLES.AksesAkademik.value;

  const [formValues, setFormValues] = useState<CreateHakAksesPayload>({
    nip: aksesKeuanganExample.nip,
    modul: aksesKeuanganExample.modul,
    tingkat: aksesKeuanganExample.tingkat,
    departemen: aksesKeuanganExample.departemen,
    keterangan: aksesKeuanganExample.keterangan,
  });

  const [activePresetKey, setActivePresetKey] = useState<
    'AksesKeuangan' | 'AksesAkademik' | 'custom'
  >('AksesKeuangan');

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CreateHakAksesPayload, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<{
    status: number;
    data: unknown;
  } | null>(null);

  // Daftar akun login pegawai aktif dari GET /api/jbsuser/pegawai (untuk validasi SOP)
  const [accounts, setAccounts] = useState<PegawaiAccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(true);

  // Daftar hak akses milik NIP yang sedang dipilih dari GET /api/jbsuser/hakakses/{nip}
  const [existingAccess, setExistingAccess] = useState<ExistingHakAksesRow[]>([]);
  const [accessLoading, setAccessLoading] = useState<boolean>(false);
  const [deletingReplid, setDeletingReplid] = useState<string | null>(null);

  const departmentSuggestions = useMemo(() => {
    const base = ['SMA', 'ALL'];
    for (const u of units) {
      const dept = u.departemen?.trim();
      if (dept && !base.includes(dept)) {
        base.push(dept);
      }
    }
    return base;
  }, [units]);

  const loadPegawaiAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await apiClient.get('/jbsuser/pegawai');
      const extracted = extractResponsePayload(res.data);
      const parsed: PegawaiAccountItem[] = extracted.rows
        .map((r) => ({
          nip: String(r.nip ?? r.login ?? '').trim(),
          nama: String(r.nama ?? '').trim(),
          aktif: r.aktif !== undefined ? Number(r.aktif) : 1,
        }))
        .filter((item) => Boolean(item.nip));
      setAccounts(parsed);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPegawaiAccounts();
  }, [loadPegawaiAccounts]);

  const matchedAccount = useMemo(() => {
    const cleanNip = formValues.nip.trim().toLowerCase();
    if (!cleanNip) return null;
    return (
      accounts.find((acc) => acc.nip.toLowerCase() === cleanNip) ?? null
    );
  }, [accounts, formValues.nip]);

  const loadExistingHakAksesForNip = useCallback(async (targetNip: string) => {
    const clean = targetNip.trim();
    if (!clean) {
      setExistingAccess([]);
      return;
    }
    setAccessLoading(true);
    try {
      const res = await apiClient.get(
        `/jbsuser/hakakses/${encodeURIComponent(clean)}`
      );
      const extracted = extractResponsePayload(res.data);
      const rows: ExistingHakAksesRow[] = extracted.rows.map((r, i) => ({
        replid: (r.replid as number | string) ?? i,
        login: r.login ? String(r.login) : clean,
        modul: String(r.modul ?? '-'),
        tingkat: Number(r.tingkat ?? 1),
        departemen:
          r.departemen && String(r.departemen) !== 'null'
            ? String(r.departemen)
            : null,
        keterangan:
          r.keterangan && String(r.keterangan) !== 'null'
            ? String(r.keterangan)
            : null,
        aktif: r.aktif !== undefined ? Number(r.aktif) : 1,
      }));
      setExistingAccess(rows);
    } catch {
      setExistingAccess([]);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  // Muat otomatis daftar hak akses apabila NIP terdaftar di akun pegawai
  useEffect(() => {
    if (matchedAccount) {
      loadExistingHakAksesForNip(matchedAccount.nip);
    } else {
      setExistingAccess([]);
    }
  }, [matchedAccount, loadExistingHakAksesForNip]);

  const applySwaggerPreset = (presetKey: 'AksesKeuangan' | 'AksesAkademik') => {
    const source = HAK_AKSES_EXAMPLES[presetKey].value;
    // Pertahankan NIP pegawai asli apabila admin sudah memilih NIP terdaftar, kecuali masih contoh "123"
    const nextNip =
      matchedAccount && formValues.nip.trim() !== '123'
        ? formValues.nip.trim()
        : source.nip;

    setFormValues({
      nip: nextNip,
      modul: source.modul,
      tingkat: Number(source.tingkat),
      departemen: source.departemen,
      keterangan: source.keterangan,
    });
    setActivePresetKey(presetKey);
    setFieldErrors({});
    setSubmitError(null);
  };

  const updateField = <K extends keyof CreateHakAksesPayload>(
    key: K,
    value: CreateHakAksesPayload[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setActivePresetKey('custom');
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleTingkatChange = (nextTingkat: number) => {
    setFormValues((prev) => ({
      ...prev,
      tingkat: nextTingkat,
      departemen:
        nextTingkat === 1
          ? 'ALL'
          : prev.departemen === 'ALL' || !prev.departemen.trim()
          ? 'SMA'
          : prev.departemen,
    }));
    setActivePresetKey('custom');
  };

  // Payload JSON bersih sesuai schema OpenAPI POST /api/jbsuser/hakakses
  const sanitizedPayload: CreateHakAksesPayload = useMemo(
    () => ({
      nip: formValues.nip.trim(),
      modul: formValues.modul.trim(),
      tingkat: Number(formValues.tingkat),
      departemen: formValues.departemen.trim(),
      keterangan: formValues.keterangan.trim(),
    }),
    [formValues]
  );

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateHakAksesPayload, string>> = {};
    if (!sanitizedPayload.nip) {
      errors.nip = 'NIP pegawai wajib diisi (string).';
    }
    if (!sanitizedPayload.modul) {
      errors.modul = 'Kode modul wajib dipilih (contoh: KEUANGAN, SIMAKA).';
    }
    if (
      !Number.isInteger(sanitizedPayload.tingkat) ||
      (sanitizedPayload.tingkat !== 1 && sanitizedPayload.tingkat !== 2)
    ) {
      errors.tingkat = 'Tingkat otorisasi wajib berupa integer (1 atau 2).';
    }
    if (!sanitizedPayload.departemen) {
      errors.departemen = 'Departemen wajib diisi (contoh: SMA atau ALL).';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitResponse(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        '/jbsuser/hakakses',
        sanitizedPayload
      );
      setSubmitResponse({
        status: response.status,
        data: response.data,
      });
      await loadExistingHakAksesForNip(sanitizedPayload.nip);
      onSuccessMutate?.();
    } catch (err) {
      setSubmitError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAccess = async (replid: number | string) => {
    const idStr = String(replid);
    setDeletingReplid(idStr);
    setSubmitError(null);
    try {
      await apiClient.delete(`/jbsuser/hakakses/${encodeURIComponent(idStr)}`);
      await loadExistingHakAksesForNip(sanitizedPayload.nip);
      onSuccessMutate?.();
    } catch (err) {
      setSubmitError(extractApiErrorMessage(err));
    } finally {
      setDeletingReplid(null);
    }
  };

  const selectedModuleMeta = JIBAS_MODULES.find(
    (m) => m.value === formValues.modul
  );

  return (
    <div className="p-6 space-y-6">
      {/* Baris Preset Contoh Resmi dari OpenAPI swagger.ts */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-800">
              OpenAPI 3.0.3 · POST /api/jbsuser/hakakses
            </span>
            <span aria-hidden="true">·</span>
            <span>{HAK_AKSES_POST_SPEC.summary}</span>
          </div>
          <p className="text-xs text-slate-600">
            Pilih templat contoh resmi dari spesifikasi <code className="font-mono text-slate-800">swagger.ts</code> atau sesuaikan langsung untuk pegawai terdaftar:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => applySwaggerPreset('AksesKeuangan')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
              activePresetKey === 'AksesKeuangan'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Contoh: AksesKeuangan (Kasir SMA)
          </button>
          <button
            type="button"
            onClick={() => applySwaggerPreset('AksesAkademik')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
              activePresetKey === 'AksesAkademik'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Contoh: AksesAkademik (Admin ALL)
          </button>
        </div>
      </div>

      {/* Grid Utama 2 Kolom: Form Input di Kiri (7 Kolom) + Payload JSON & Daftar Akses Aktif di Kanan (5 Kolom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI: FORM UI REACT POST /api/jbsuser/hakakses */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Formulir Tambah Hak Akses Pegawai
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Mengirimkan payload <code className="font-mono">application/json</code> sesuai skema{' '}
                <code className="font-mono">POST /api/jbsuser/hakakses</code>.
              </p>
            </div>
            <ShieldCheck
              className="h-5 w-5 text-slate-400 shrink-0"
              aria-hidden="true"
            />
          </div>

          {submitError && (
            <Alert variant="destructive">
              <AlertCircle
                className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <AlertTitle>Gagal Menambahkan Hak Akses (HTTP 400/Error)</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </div>
            </Alert>
          )}

          {submitResponse && (
            <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-950">
              <CheckCircle2
                className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <AlertTitle>
                  Hak Akses Berhasil Ditambahkan (HTTP {submitResponse.status})
                </AlertTitle>
                <AlertDescription>
                  <pre className="mt-1 p-2.5 rounded-lg bg-white border border-emerald-200 font-mono text-xs text-slate-800 overflow-x-auto">
                    {JSON.stringify(submitResponse.data, null, 2)}
                  </pre>
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* 1. Field NIP + Helper Pemilih Akun Login Pegawai (SOP Check) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="hakakses-nip">
                NIP Pegawai (<code className="font-mono text-xs">nip: string</code>)
                <span className="text-red-600 ml-1">*</span>
              </Label>

              {accounts.length > 0 && (
                <select
                  aria-label="Pilih cepat dari akun pegawai terdaftar"
                  value={matchedAccount ? matchedAccount.nip : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      updateField('nip', e.target.value);
                    }
                  }}
                  className="h-8 max-w-[260px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <option value="">
                    -- Pilih Akun Pegawai ({accounts.length} terdaftar) --
                  </option>
                  {accounts.map((acc, idx) => (
                    <option key={`${acc.nip}-${idx}`} value={acc.nip}>
                      {acc.nip} — {acc.nama}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Input
              id="hakakses-nip"
              name="nip"
              type="text"
              value={formValues.nip}
              onChange={(e) => updateField('nip', e.target.value)}
              placeholder='Contoh: "123" atau pilih NIP pegawai terdaftar'
              disabled={isSubmitting}
              className="font-mono text-sm"
              aria-invalid={Boolean(fieldErrors.nip)}
            />

            {fieldErrors.nip && (
              <p className="text-xs font-medium text-red-600">{fieldErrors.nip}</p>
            )}

            {/* Status Verifikasi SOP Akun Login */}
            {!accountsLoading && formValues.nip.trim() !== '' && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
                  matchedAccount
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                    : 'border-amber-200 bg-amber-50/70 text-amber-900'
                }`}
              >
                {matchedAccount ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <UserCheck
                      className="h-3.5 w-3.5 text-emerald-700 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      SOP Terpenuhi: Akun login ditemukan atas nama{' '}
                      <strong>{matchedAccount.nama}</strong>
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="leading-relaxed">
                      SOP: NIP <strong className="font-mono">{formValues.nip.trim()}</strong>{' '}
                      belum memiliki Akun Login di <code className="font-mono">/api/jbsuser/pegawai</code>.
                      Pastikan akun login sudah dibuat agar server tidak menolak (HTTP 400).
                    </span>
                    {onRequestCreateLoginAccount && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onRequestCreateLoginAccount(formValues.nip.trim())
                        }
                        className="h-7 px-2.5 text-xs bg-white whitespace-nowrap shrink-0"
                      >
                        Buat Akun Login
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. Field Modul (modul: string) */}
          <div className="space-y-2">
            <Label htmlFor="hakakses-modul">
              Modul Sistem (<code className="font-mono text-xs">modul: string</code>)
              <span className="text-red-600 ml-1">*</span>
            </Label>
            <select
              id="hakakses-modul"
              name="modul"
              value={formValues.modul}
              onChange={(e) => updateField('modul', e.target.value)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              {JIBAS_MODULES.map((mod, idx) => (
                <option key={`${mod.value}-${idx}`} value={mod.value}>
                  {mod.label}
                </option>
              ))}
            </select>
            {selectedModuleMeta && (
              <p className="text-xs text-slate-500">
                Cakupan akses: {selectedModuleMeta.scopeHint}.
              </p>
            )}
            {fieldErrors.modul && (
              <p className="text-xs font-medium text-red-600">
                {fieldErrors.modul}
              </p>
            )}
          </div>

          {/* 3. Field Tingkat Otorisasi (tingkat: integer) */}
          <div className="space-y-2">
            <Label>
              Tingkat Kewenangan (
              <code className="font-mono text-xs">tingkat: integer</code>)
              <span className="text-red-600 ml-1">*</span>
            </Label>
            <div
              role="radiogroup"
              aria-label="Pilih Tingkat Hak Akses"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={formValues.tingkat === 1}
                onClick={() => handleTingkatChange(1)}
                disabled={isSubmitting}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  formValues.tingkat === 1
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">Tingkat 1 — Semua Dept</span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      formValues.tingkat === 1
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    int: 1
                  </span>
                </div>
                <p
                  className={`mt-1 text-[11px] leading-relaxed ${
                    formValues.tingkat === 1
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  Akses penuh lintas departemen (contoh: Admin Akademik, ALL).
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={formValues.tingkat === 2}
                onClick={() => handleTingkatChange(2)}
                disabled={isSubmitting}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  formValues.tingkat === 2
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    Tingkat 2 — Unit Spesifik
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      formValues.tingkat === 2
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    int: 2
                  </span>
                </div>
                <p
                  className={`mt-1 text-[11px] leading-relaxed ${
                    formValues.tingkat === 2
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  Operator / Kasir unit tertentu (contoh AksesKeuangan: SMA).
                </p>
              </button>
            </div>
            {fieldErrors.tingkat && (
              <p className="text-xs font-medium text-red-600">
                {fieldErrors.tingkat}
              </p>
            )}
          </div>

          {/* 4. Field Departemen (departemen: string) */}
          <div className="space-y-2">
            <Label htmlFor="hakakses-departemen">
              Departemen (
              <code className="font-mono text-xs">departemen: string</code>)
              <span className="text-red-600 ml-1">*</span>
            </Label>
            <Input
              id="hakakses-departemen"
              name="departemen"
              type="text"
              value={formValues.departemen}
              onChange={(e) => updateField('departemen', e.target.value)}
              placeholder='Contoh: "SMA" atau "ALL"'
              disabled={isSubmitting}
              className="font-mono text-sm"
              aria-invalid={Boolean(fieldErrors.departemen)}
            />

            {/* Pilihan Cepat Departemen dari Contoh Swagger & Database Sekolah */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-slate-500 mr-1">
                Pilihan cepat:
              </span>
              {departmentSuggestions.map((dept) => {
                const active = formValues.departemen === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => updateField('departemen', dept)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>

            {fieldErrors.departemen && (
              <p className="text-xs font-medium text-red-600">
                {fieldErrors.departemen}
              </p>
            )}
          </div>

          {/* 5. Field Keterangan (keterangan: string) */}
          <div className="space-y-2">
            <Label htmlFor="hakakses-keterangan">
              Keterangan Jabatan / Otorisasi (
              <code className="font-mono text-xs">keterangan: string</code>)
            </Label>
            <Input
              id="hakakses-keterangan"
              name="keterangan"
              type="text"
              value={formValues.keterangan}
              onChange={(e) => updateField('keterangan', e.target.value)}
              placeholder='Contoh: "Kasir SMA" atau "Admin Akademik"'
              disabled={isSubmitting}
            />
          </div>

          {/* Tombol Aksi Submit */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => applySwaggerPreset('AksesKeuangan')}
            >
              Reset ke AksesKeuangan
            </Button>

            <Button type="submit" disabled={isSubmitting} className="whitespace-nowrap">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Menyimpan Hak Akses...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Simpan Hak Akses (POST)</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* KOLOM KANAN: PRATINJAU PAYLOAD JSON & HAK AKSES AKTIF MILIK NIP */}
        <div className="lg:col-span-5 space-y-5">
          {/* Panel Pratinjau Payload JSON Real-Time */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Code2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <span>Request Body JSON</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                POST /api/jbsuser/hakakses
              </span>
            </div>

            <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(sanitizedPayload, null, 2)}
            </pre>

            <div className="text-[11px] text-slate-400 leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>nip: string</span>
              <span aria-hidden="true">·</span>
              <span>modul: string</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-200 font-medium">
                tingkat: integer ({typeof sanitizedPayload.tingkat})
              </span>
              <span aria-hidden="true">·</span>
              <span>departemen: string</span>
            </div>
          </div>

          {/* Panel Daftar Hak Akses Aktif untuk NIP Terpilih */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  Hak Akses Milik NIP{' '}
                  <span className="font-mono">{sanitizedPayload.nip || '-'}</span>
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  GET /api/jbsuser/hakakses/{sanitizedPayload.nip || '{nip}'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={accessLoading || !sanitizedPayload.nip}
                onClick={() => loadExistingHakAksesForNip(sanitizedPayload.nip)}
                className="shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${accessLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Cek</span>
              </Button>
            </div>

            {accessLoading ? (
              <div className="p-5 space-y-2.5">
                <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
              </div>
            ) : existingAccess.length === 0 ? (
              <div className="p-5 text-xs text-slate-500 leading-relaxed">
                {matchedAccount
                  ? `Pegawai ${matchedAccount.nama} belum memiliki entri hak akses modul atau klik "Cek" untuk menyegarkan.`
                  : 'Pilih NIP pegawai terdaftar atau klik "Cek" untuk melihat hak akses yang sudah dimiliki.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {existingAccess.map((item, idx) => (
                  <div
                    key={`${String(item.replid)}-${idx}`}
                    className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-mono font-bold text-slate-900">
                          {item.modul}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-600 font-mono tabular-nums">
                          Tingkat {item.tingkat}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-600 font-mono">
                          Dept: {item.departemen || 'ALL'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 truncate">
                        <span className="font-mono tabular-nums">
                          replid #{String(item.replid)}
                        </span>
                        {item.keterangan && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{item.keterangan}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onRequestEditHakAkses && (
                        <button
                          type="button"
                          onClick={() => onRequestEditHakAkses(item)}
                          title="Update hak akses (PUT /api/jbsuser/hakakses/{replid})"
                          aria-label={`Update hak akses replid ${item.replid}`}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deletingReplid === String(item.replid)}
                        onClick={() => handleRevokeAccess(item.replid)}
                        title="Cabut hak akses (DELETE /api/jbsuser/hakakses/{replid})"
                        aria-label={`Hapus hak akses replid ${item.replid}`}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                      >
                        {deletingReplid === String(item.replid) ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
