import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Settings,
  X,
} from 'lucide-react';
import {
  DEFAULT_API_BASE_URL,
  extractApiErrorMessage,
  getActiveApiBaseUrl,
  isUsingCustomApiUrl,
  resetCustomApiBaseUrl,
  setCustomApiBaseUrl,
  testApiEndpointConnection,
  validateCustomApiUrl,
} from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ApiEndpointSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiEndpointSettingsModal({
  isOpen,
  onClose,
}: ApiEndpointSettingsModalProps) {
  const [urlInput, setUrlInput] = useState<string>(() => getActiveApiBaseUrl());
  const [autoAppendApi, setAutoAppendApi] = useState<boolean>(() =>
    getActiveApiBaseUrl().endsWith('/api')
  );
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>(() =>
    getActiveApiBaseUrl()
  );
  const [isCustomActive, setIsCustomActive] = useState<boolean>(() =>
    isUsingCustomApiUrl()
  );

  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const current = getActiveApiBaseUrl();
    setActiveBaseUrl(current);
    setIsCustomActive(isUsingCustomApiUrl());
    setUrlInput(current);
    setAutoAppendApi(current.endsWith('/api'));
    setErrorMessage(null);
    setStatusMessage(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const validation = useMemo(
    () => validateCustomApiUrl(urlInput, autoAppendApi),
    [urlInput, autoAppendApi]
  );

  if (!isOpen) {
    return null;
  }

  const handleTestConnection = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!validation.valid) {
      setErrorMessage(validation.error || 'Format URL tidak valid.');
      return;
    }

    setIsTesting(true);
    try {
      const result = await testApiEndpointConnection(validation.normalizedUrl);
      const schoolInfo = result.detectedSchoolName
        ? ` · Unit terdeteksi: ${result.detectedSchoolName}`
        : '';
      setStatusMessage({
        title: `Koneksi Berhasil (${result.latencyMs} ms)`,
        detail: `Endpoint ${result.resolvedUrl} merespons dengan baik${schoolInfo}. Klik "Simpan & Terapkan" untuk mengaktifkan.`,
      });
    } catch (err) {
      setErrorMessage(extractApiErrorMessage(err, validation.normalizedUrl));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!validation.valid) {
      setErrorMessage(validation.error || 'Format URL tidak valid.');
      return;
    }

    const applied = setCustomApiBaseUrl(validation.normalizedUrl);
    setActiveBaseUrl(applied);
    setIsCustomActive(isUsingCustomApiUrl());
    onClose();
  };

  const handleResetDefault = () => {
    const restored = resetCustomApiBaseUrl();
    setActiveBaseUrl(restored);
    setIsCustomActive(false);
    setUrlInput(restored);
    setAutoAppendApi(restored.endsWith('/api'));
    setErrorMessage(null);
    setStatusMessage({
      title: 'Dikembalikan ke Endpoint Bawaan',
      detail: `Konfigurasi kustom dihapus dan seluruh layanan kini terhubung ke ${restored}.`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-endpoint-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="api-endpoint-modal-title"
                className="text-base font-bold tracking-tight text-slate-900 truncate"
              >
                Pengaturan Endpoint REST API
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Konfigurasi dinamis alamat server backend aplikasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan endpoint REST API"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form Konfigurasi */}
        <form onSubmit={handleSave} noValidate className="p-6 space-y-5">
          {/* Informasi Endpoint Aktif */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Status Konfigurasi</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-800">
                {isCustomActive
                  ? 'Endpoint Kustom Aktif'
                  : 'Server Bawaan (Default)'}
              </span>
            </div>
            <p className="font-mono text-xs text-slate-900 break-all">
              {activeBaseUrl}
            </p>
          </div>

          {/* Input URL Endpoint */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="custom-api-url-input">
                Alamat Base URL REST API
              </Label>
              {urlInput.trim() !== DEFAULT_API_BASE_URL && (
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput(DEFAULT_API_BASE_URL);
                    setAutoAppendApi(true);
                    setErrorMessage(null);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Isi URL Default
                </button>
              )}
            </div>

            <Input
              id="custom-api-url-input"
              name="customApiUrl"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="Contoh: https://api.wahab.my.id/api"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setErrorMessage(null);
                setStatusMessage(null);
              }}
              className="h-11 font-mono text-xs sm:text-sm"
              aria-invalid={Boolean(errorMessage)}
            />

            <label className="pt-1 inline-flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAppendApi}
                onChange={(e) => {
                  setAutoAppendApi(e.target.checked);
                  setErrorMessage(null);
                  setStatusMessage(null);
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
              />
              <span className="leading-relaxed">
                Otomatis sertakan akhiran path{' '}
                <code className="font-mono font-semibold text-slate-800">
                  /api
                </code>{' '}
                bila belum tertulis (standar routing backend)
              </span>
            </label>

            {validation.valid && (
              <div className="pt-1 text-[11px] text-slate-500 space-y-0.5">
                <div>
                  Base URL efektif:{' '}
                  <span className="font-mono font-medium text-slate-800 break-all">
                    {validation.normalizedUrl}
                  </span>
                </div>
                <div>
                  Contoh pemanggilan login:{' '}
                  <span className="font-mono text-slate-600 break-all">
                    {validation.normalizedUrl}/jbsuser/login
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Umpan Balik Uji Koneksi / Validasi */}
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle
                className="h-4 w-4 shrink-0 mt-0.5 text-red-600"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <AlertTitle>Validasi / Koneksi Gagal</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </div>
            </Alert>
          )}

          {statusMessage && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-2.5"
            >
              <CheckCircle2
                className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-semibold text-emerald-950 font-mono tabular-nums">
                  {statusMessage.title}
                </div>
                <p className="text-xs text-emerald-900/90 leading-relaxed break-words">
                  {statusMessage.detail}
                </p>
              </div>
            </div>
          )}

          {/* Tombol Aksi */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefault}
              disabled={!isCustomActive && urlInput.trim() === DEFAULT_API_BASE_URL}
              className="whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Reset ke Default</span>
            </Button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="min-h-[40px] whitespace-nowrap shrink-0"
              >
                {isTesting ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin shrink-0"
                      aria-hidden="true"
                    />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <span>Uji Koneksi</span>
                )}
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isTesting}
                className="min-h-[40px] whitespace-nowrap shrink-0"
              >
                Simpan & Terapkan
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
