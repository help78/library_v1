import { useEffect, useState } from 'react';
import { API_URL_CHANGED_EVENT, apiClient } from '../lib/api';
import { extractResponsePayload, resolveImageSrc } from '../lib/formatters';

export interface SchoolUnitIdentity {
  replid: string;
  nama: string;
  departemen: string;
  alamat: string;
  telepon: string;
  email: string;
  situs: string;
  logoRaw: unknown;
  logoSrc: string | null;
  raw: Record<string, unknown>;
}

export interface SchoolIdentityState {
  loading: boolean;
  primary: SchoolUnitIdentity;
  units: SchoolUnitIdentity[];
  rawRows: Record<string, unknown>[];
}

const DEFAULT_PRIMARY_IDENTITY: SchoolUnitIdentity = {
  replid: '0',
  nama: 'SD Islam Hidayatul Islamiyah',
  departemen: 'Yayasan',
  alamat: 'Sistem Informasi Manajemen Pendidikan Terpadu',
  telepon: '',
  email: '',
  situs: '',
  logoRaw: null,
  logoSrc: null,
  raw: {},
};

let memoryCache: {
  primary: SchoolUnitIdentity;
  units: SchoolUnitIdentity[];
  rawRows: Record<string, unknown>[];
} | null = null;

let inflightPromise: Promise<{
  primary: SchoolUnitIdentity;
  units: SchoolUnitIdentity[];
  rawRows: Record<string, unknown>[];
}> | null = null;

function mapRowToUnit(row: Record<string, unknown>, idx: number): SchoolUnitIdentity {
  const nama = String(row.nama ?? '').trim();
  const departemen = String(row.departemen ?? 'Sekolah').trim();
  const alamat = [row.alamat1, row.alamat2, row.alamat3, row.alamat4]
    .filter((v) => Boolean(v && String(v).trim() && String(v) !== 'null'))
    .map((v) => String(v).trim())
    .join(', ');
  const telepon = [row.telp1, row.telp2, row.telp3, row.telp4]
    .filter((v) => Boolean(v && String(v).trim() && String(v) !== 'null'))
    .map((v) => String(v).trim())
    .join(' / ');
  const email =
    row.email && String(row.email) !== 'null' ? String(row.email).trim() : '';
  const situs =
    row.situs && String(row.situs) !== 'null' ? String(row.situs).trim() : '';
  const logoSrc = resolveImageSrc(row.foto);

  return {
    replid: String(row.replid ?? idx),
    nama: nama || departemen || 'Unit Pendidikan',
    departemen,
    alamat,
    telepon,
    email,
    situs,
    logoRaw: row.foto ?? null,
    logoSrc,
    raw: row,
  };
}

function selectPrimaryUnit(units: SchoolUnitIdentity[]): SchoolUnitIdentity {
  if (!units.length) {
    return DEFAULT_PRIMARY_IDENTITY;
  }

  const yayasanWithLogo = units.find(
    (u) =>
      u.departemen.toLowerCase() === 'yayasan' &&
      Boolean(u.nama) &&
      Boolean(u.logoSrc)
  );
  if (yayasanWithLogo) return yayasanWithLogo;

  const schoolWithAddressAndLogo = units.find(
    (u) =>
      !u.nama.toLowerCase().includes('perpustakaan') &&
      Boolean(u.alamat) &&
      Boolean(u.logoSrc)
  );
  if (schoolWithAddressAndLogo) return schoolWithAddressAndLogo;

  const anyWithLogo = units.find(
    (u) => !u.nama.toLowerCase().includes('perpustakaan') && Boolean(u.logoSrc)
  );
  if (anyWithLogo) return anyWithLogo;

  return units[0];
}

async function fetchSchoolIdentityOnce() {
  if (memoryCache) {
    return memoryCache;
  }
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = apiClient
    .get('/jbsumum/identitas')
    .then((res) => {
      const extracted = extractResponsePayload(res.data);
      const validUnits = extracted.rows
        .map((r, idx) => mapRowToUnit(r, idx))
        .filter(
          (u) =>
            Boolean(u.raw.nama && String(u.raw.nama).trim() !== '') ||
            Boolean(u.logoSrc)
        );

      const primary = selectPrimaryUnit(validUnits);
      const displayUnits = validUnits.filter((u) =>
        Boolean(u.raw.nama && String(u.raw.nama).trim() !== '')
      );

      const result = {
        primary,
        units: displayUnits,
        rawRows: extracted.rows,
      };
      memoryCache = result;
      return result;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function useSchoolIdentity(): SchoolIdentityState {
  const [state, setState] = useState<SchoolIdentityState>(() =>
    memoryCache
      ? {
          loading: false,
          primary: memoryCache.primary,
          units: memoryCache.units,
          rawRows: memoryCache.rawRows,
        }
      : {
          loading: true,
          primary: DEFAULT_PRIMARY_IDENTITY,
          units: [],
          rawRows: [],
        }
  );

  useEffect(() => {
    let active = true;

    const loadIdentity = (forceFetch: boolean) => {
      if (!forceFetch && memoryCache) {
        setState({
          loading: false,
          primary: memoryCache.primary,
          units: memoryCache.units,
          rawRows: memoryCache.rawRows,
        });
        return;
      }

      setState((prev) => ({ ...prev, loading: true }));

      fetchSchoolIdentityOnce()
        .then((res) => {
          if (!active) return;
          setState({
            loading: false,
            primary: res.primary,
            units: res.units,
            rawRows: res.rawRows,
          });
        })
        .catch(() => {
          if (!active) return;
          setState({
            loading: false,
            primary: DEFAULT_PRIMARY_IDENTITY,
            units: [],
            rawRows: [],
          });
        });
    };

    loadIdentity(false);

    const handleApiUrlChanged = () => {
      memoryCache = null;
      inflightPromise = null;
      loadIdentity(true);
    };

    window.addEventListener(API_URL_CHANGED_EVENT, handleApiUrlChanged);

    return () => {
      active = false;
      window.removeEventListener(API_URL_CHANGED_EVENT, handleApiUrlChanged);
    };
  }, []);

  return state;
}
