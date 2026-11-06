import axios, { AxiosError } from 'axios';

export const API_URL_CHANGED_EVENT = 'jibas:api-url-changed';
const CUSTOM_API_URL_STORAGE_KEY = 'jibas_custom_api_base_url';

export function resolveApiBaseUrl(rawUrl?: string): string {
  const fallback = 'https://api.wahab.my.id/api';
  if (!rawUrl) {
    return fallback;
  }

  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed || (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/'))) {
    return fallback;
  }

  // Seluruh endpoint backend Cloudflare Workers (Hono) menggunakan prefix /api
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const DEFAULT_API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL
);

export const CLOUD_DRIVE_BASE_URL = (
  import.meta.env.VITE_API_CLOUD_URL ||
  import.meta.env.vite_api_cloud_url ||
  import.meta.env.VITE_CLOUD_DRIVE_BASE_URL ||
  'https://drive.sdn2balepanjang.sch.id'
)
  .trim()
  .replace(/\/+$/, '');

export const VITE_API_CLOUD_URL = CLOUD_DRIVE_BASE_URL;

export function getCloudFileUrl(path?: string): string {
  if (!path) return '';
  if (path.includes('guru.hidis.id')) {
    return path.replace(/https?:\/\/guru\.hidis\.id/i, CLOUD_DRIVE_BASE_URL);
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${CLOUD_DRIVE_BASE_URL}/files${encodeURI(cleanPath)}`;
}

function readStoredCustomUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_API_URL_STORAGE_KEY);
    if (!raw || !raw.trim()) {
      return null;
    }
    return raw.trim().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getActiveApiBaseUrl(): string {
  return readStoredCustomUrl() || DEFAULT_API_BASE_URL;
}

export function isUsingCustomApiUrl(): boolean {
  const stored = readStoredCustomUrl();
  return Boolean(stored && stored !== DEFAULT_API_BASE_URL);
}

export function validateCustomApiUrl(
  rawInput: string,
  autoAppendApi = true
): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = rawInput.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Alamat URL server REST API tidak boleh kosong.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error:
        'Format URL tidak valid. Gunakan protokol lengkap http:// atau https:// (contoh: https://api.wahab.my.id/api).',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error: 'Protokol URL harus menggunakan http:// atau https://.',
    };
  }

  let normalized = trimmed;
  if (autoAppendApi && !normalized.endsWith('/api')) {
    normalized = `${normalized}/api`;
  }

  return {
    valid: true,
    normalizedUrl: normalized,
  };
}

export const apiClient = axios.create({
  baseURL: getActiveApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
  },
});

apiClient.interceptors.request.use((config) => {
  // Selalu arahkan ke baseURL backend Cloudflare Workers yang aktif (mencegah error 405 di cloudflare workers.dev)
  config.baseURL = getActiveApiBaseUrl();

  // Sertakan header otentikasi role untuk Cloudflare Worker backend JIBAS
  config.headers = config.headers || {};
  let currentRole = 'landlord';
  let currentUsername = 'landlord';
  let currentTingkat = '1';

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('jibas-auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        const u = parsed?.state?.user;
        if (u) {
          currentUsername = u.username || 'landlord';
          currentTingkat = String(u.tingkat || 1);
          currentRole =
            Number(u.tingkat) === 1 ? 'landlord' : u.username || 'landlord';
        }
      }
    } catch {
      // Abaikan jika parsing storage gagal
    }
  }

  config.headers['x-user-role'] = currentRole;
  config.headers['x-username'] = currentUsername;
  config.headers['x-tingkat'] = currentTingkat;
  config.headers['x-source'] = 'jibas-erp';

  return config;
});

function notifyApiUrlChanged(nextUrl: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(API_URL_CHANGED_EVENT, { detail: { baseUrl: nextUrl } })
    );
  }
}

export function setCustomApiBaseUrl(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, '') || DEFAULT_API_BASE_URL;
  if (typeof window !== 'undefined') {
    try {
      if (cleaned === DEFAULT_API_BASE_URL) {
        window.localStorage.removeItem(CUSTOM_API_URL_STORAGE_KEY);
      } else {
        window.localStorage.setItem(CUSTOM_API_URL_STORAGE_KEY, cleaned);
      }
    } catch {
      // Ignore storage quota / iframe privacy mode errors
    }
  }
  apiClient.defaults.baseURL = cleaned;
  notifyApiUrlChanged(cleaned);
  return cleaned;
}

export function resetCustomApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CUSTOM_API_URL_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  apiClient.defaults.baseURL = DEFAULT_API_BASE_URL;
  notifyApiUrlChanged(DEFAULT_API_BASE_URL);
  return DEFAULT_API_BASE_URL;
}

export async function testApiEndpointConnection(candidateBaseUrl: string): Promise<{
  latencyMs: number;
  resolvedUrl: string;
  detectedSchoolName?: string;
}> {
  const base = candidateBaseUrl.trim().replace(/\/+$/, '');
  const probeUrl = `${base}/jbsumum/identitas`;
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  const response = await axios.get(probeUrl, {
    timeout: 10000,
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  const endedAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const latencyMs = Math.max(1, Math.round(endedAt - startedAt));

  let detectedSchoolName: string | undefined;
  const payload = response.data as Record<string, unknown> | undefined;
  const rows = Array.isArray(payload?.data)
    ? (payload.data as Record<string, unknown>[])
    : Array.isArray(response.data)
    ? (response.data as Record<string, unknown>[])
    : [];

  for (const row of rows) {
    const nama = row?.nama ? String(row.nama).trim() : '';
    if (nama && nama !== 'null') {
      detectedSchoolName = nama;
      break;
    }
  }

  return {
    latencyMs,
    resolvedUrl: probeUrl,
    detectedSchoolName,
  };
}

export function extractApiErrorMessage(
  error: unknown,
  fallbackBaseUrl?: string
): string {
  const effectiveBase = (fallbackBaseUrl || getActiveApiBaseUrl()).replace(
    /\/+$/,
    ''
  );

  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<
      | {
          message?: string;
          pesan?: string;
          error?: string;
          detail?: string;
          keterangan?: string;
          code?: string;
        }
      | string
    >;

    const rawData = axiosErr.response?.data;
    const serverMsg =
      typeof rawData === 'string'
        ? rawData.trim()
        : rawData?.pesan ||
          rawData?.message ||
          rawData?.error ||
          rawData?.detail ||
          rawData?.keterangan;

    const errCode =
      typeof rawData === 'object' && rawData !== null ? rawData.code || '' : '';

    if (serverMsg) {
      const lowerMsg = serverMsg.toLowerCase();
      const isRawSqlFkConstraint =
        errCode === 'ER_ROW_IS_REFERENCED' ||
        errCode === 'ER_ROW_IS_REFERENCED_2' ||
        lowerMsg.includes('foreign key constraint') ||
        lowerMsg.includes('cannot delete or update a parent row');

      if (isRawSqlFkConstraint) {
        return 'Data jabatan tidak dapat dihapus karena masih dipakai oleh pegawai pada data kepegawaian. Silakan ubah atau alihkan jabatan pegawai terkait terlebih dahulu.';
      }

      return serverMsg;
    }

    const requestBase = (axiosErr.config?.baseURL || effectiveBase).replace(
      /\/+$/,
      ''
    );
    const requestPath = (axiosErr.config?.url || '').replace(/^\/+/, '');
    const fullUrl = requestPath
      ? /^https?:\/\//i.test(requestPath)
        ? requestPath
        : `${requestBase}/${requestPath}`
      : requestBase;

    if (axiosErr.response?.status === 401) {
      return 'Kredensial tidak valid. Periksa kembali Username/NIP dan Password Anda.';
    }

    if (axiosErr.response?.status === 403) {
      return 'Akun Anda tidak aktif atau tidak memiliki izin akses.';
    }

    if (axiosErr.response?.status === 404) {
      return `Data atau endpoint tidak ditemukan (404) pada URL: ${fullUrl}`;
    }

    if (axiosErr.response?.status === 409) {
      return 'Data tidak dapat dihapus atau diubah karena masih digunakan oleh rekaman pegawai lain (409 Conflict).';
    }

    if (axiosErr.code === 'ERR_NETWORK') {
      return `Tidak dapat terhubung ke server API (${effectiveBase}). Pastikan Cloudflare Workers (Hono) aktif dan kebijakan CORS mengizinkan origin aplikasi ini.`;
    }

    if (axiosErr.code === 'ECONNABORTED') {
      return 'Waktu koneksi ke server habis (timeout). Silakan coba sesaat lagi.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Terjadi kesalahan yang tidak diketahui saat memproses permintaan.';
}
