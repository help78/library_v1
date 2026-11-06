import { useCallback, useEffect, useState } from 'react';
import {
  API_URL_CHANGED_EVENT,
  apiClient,
  extractApiErrorMessage,
} from '../lib/api';
import { extractResponsePayload, resolveImageSrc } from '../lib/formatters';

export interface DigitalBookPreview {
  id: string;
  idpustaka: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: string;
  katalog: string;
  tipe: string;
  coverUrl: string | null;
  rawRecord: Record<string, unknown>;
}

interface DigitalBooksCache {
  books: DigitalBookPreview[];
}

let memoryCache: DigitalBooksCache | null = null;
let inflightRequest: Promise<DigitalBookPreview[]> | null = null;

function extractGoogleDriveFileId(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();

  const fileMatch = trimmed.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
  );
  if (fileMatch?.[1]) {
    return fileMatch[1];
  }

  const openMatch = trimmed.match(
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/
  );
  if (openMatch?.[1]) {
    return openMatch[1];
  }

  return null;
}

function cleanCatalogName(raw: unknown): string {
  if (!raw) return 'Koleksi Umum';
  const text = String(raw).trim();
  if (!text || text === 'null' || /^\(\s*\.+\s*\)$/.test(text)) {
    return 'Koleksi Umum';
  }
  return text;
}

function resolveBookCoverUrl(
  digitalRow: Record<string, unknown>,
  masterRow?: Record<string, unknown>
): string | null {
  const directCover =
    resolveImageSrc(digitalRow.cover) ??
    resolveImageSrc(digitalRow.foto) ??
    resolveImageSrc(digitalRow.gambar) ??
    (masterRow
      ? resolveImageSrc(masterRow.cover) ??
        resolveImageSrc(masterRow.foto) ??
        resolveImageSrc(masterRow.gambar)
      : null);

  if (directCover) {
    return directCover;
  }

  const fileUrl = String(
    digitalRow.file_url ?? masterRow?.file_url ?? ''
  ).trim();
  const driveId = extractGoogleDriveFileId(fileUrl);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}=w600`;
  }

  return null;
}

async function fetchDigitalBooksCatalog(force = false): Promise<DigitalBookPreview[]> {
  if (!force && memoryCache) {
    return memoryCache.books;
  }
  if (!force && inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = Promise.allSettled([
    apiClient.get('/jbsperpus/pustaka/digital'),
    apiClient.get('/jbsperpus/pustaka'),
  ])
    .then(([digitalRes, pustakaRes]) => {
      if (digitalRes.status === 'rejected') {
        throw digitalRes.reason;
      }

      const digitalExtracted = extractResponsePayload(digitalRes.value.data);
      const masterById = new Map<string, Record<string, unknown>>();

      if (pustakaRes.status === 'fulfilled') {
        const masterExtracted = extractResponsePayload(pustakaRes.value.data);
        for (const row of masterExtracted.rows) {
          const masterKey = String(
            row.id_pustaka ?? row.idpustaka ?? row.replid ?? ''
          ).trim();
          if (masterKey) {
            masterById.set(masterKey, row);
          }
        }
      }

      const mapped: DigitalBookPreview[] = digitalExtracted.rows.map(
        (row, idx) => {
          const idpustaka = String(
            row.idpustaka ?? row.id_pustaka ?? row.replid ?? idx + 1
          ).trim();
          const master = masterById.get(idpustaka);

          const judul = String(
            row.judul ?? master?.judul ?? `Buku Digital #${idpustaka}`
          ).trim();
          const penulisRaw = row.penulis ?? master?.penulis;
          const penerbitRaw = row.penerbit ?? master?.penerbit;
          const tahunRaw = row.tahun ?? master?.tahun;
          const katalog = cleanCatalogName(row.katalog ?? master?.katalog);
          const tipe = String(row.tipe ?? master?.format ?? 'PDF')
            .trim()
            .toUpperCase();

          const penulis =
            penulisRaw && String(penulisRaw).trim() && String(penulisRaw) !== 'null'
              ? String(penulisRaw).trim()
              : 'Koleksi Perpustakaan';
          const penerbit =
            penerbitRaw &&
            String(penerbitRaw).trim() &&
            String(penerbitRaw) !== 'null'
              ? String(penerbitRaw).trim()
              : '';
          const tahun =
            tahunRaw && String(tahunRaw).trim() && String(tahunRaw) !== 'null'
              ? String(tahunRaw).trim()
              : '';

          const coverUrl = resolveBookCoverUrl(row, master);

          return {
            id: String(row.id ? `${row.id}-${idx}` : `${idpustaka}-${idx}`),
            idpustaka,
            judul,
            penulis,
            penerbit,
            tahun,
            katalog,
            tipe,
            coverUrl,
            rawRecord: {
              ...master,
              ...row,
              idpustaka,
              judul,
              penulis,
              penerbit,
              tahun,
              katalog,
              tipe,
            },
          };
        }
      );

      memoryCache = { books: mapped };
      return mapped;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}

export function useDigitalBooks() {
  const [books, setBooks] = useState<DigitalBookPreview[]>(
    () => memoryCache?.books ?? []
  );
  const [loading, setLoading] = useState<boolean>(() => !memoryCache);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (force = true) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchDigitalBooksCatalog(force);
      setBooks(items);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitial = (forceFetch: boolean) => {
      if (!forceFetch && memoryCache) {
        setBooks(memoryCache.books);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      fetchDigitalBooksCatalog(forceFetch)
        .then((items) => {
          if (!active) return;
          setBooks(items);
          setLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          setBooks([]);
          setError(extractApiErrorMessage(err));
          setLoading(false);
        });
    };

    loadInitial(false);

    const handleApiUrlChanged = () => {
      memoryCache = null;
      inflightRequest = null;
      loadInitial(true);
    };

    window.addEventListener(API_URL_CHANGED_EVENT, handleApiUrlChanged);

    return () => {
      active = false;
      window.removeEventListener(API_URL_CHANGED_EVENT, handleApiUrlChanged);
    };
  }, []);

  return { books, loading, error, reload };
}
