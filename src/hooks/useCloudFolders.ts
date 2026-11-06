import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

export interface CloudFolderItem {
  path: string;
  name: string;
  isDir: boolean;
}

/**
 * Hook untuk memuat daftar folder secara dinamis dari API /api/files/list.
 * Tidak melakukan hardcode pada daftar folder, sehingga direktori baru
 * (seperti /users, folder tugas baru, folder dinamis lain) otomatis muncul.
 */
export function useCloudFolders(initialFolders: string[] = ['/']) {
  const [folders, setFolders] = useState<string[]>(initialFolders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/files/list', {
        params: { path: '/' },
      });
      const data = res.data;
      if (data && Array.isArray(data.data)) {
        const discovered = (
          data.data as Array<{
            path?: string;
            name?: string;
            isDir?: boolean;
            type?: string;
          }>
        )
          .filter(
            (item) =>
              Boolean(item) &&
              (Boolean(item.isDir) || item.type === 'directory')
          )
          .map((item) => {
            const rawPath = String(item.path || `/${item.name || ''}`).trim();
            return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
          })
          .filter((p) => Boolean(p) && p !== '/');

        // Pastikan '/' selalu ada pertama kali, diikuti folder terdeteksi dari API yang diurutkan
        const sorted = discovered.sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        const uniqueFolders = Array.from(new Set(['/', ...sorted]));
        setFolders(uniqueFolders);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal memuat daftar folder';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const addDiscoveredFolder = useCallback((folderPath: string) => {
    if (!folderPath) return;
    const clean = folderPath.trim();
    const formatted = clean.startsWith('/') ? clean : `/${clean}`;
    setFolders((prev) => {
      if (prev.includes(formatted)) return prev;
      const next = [...prev, formatted];
      const root = next.filter((p) => p === '/');
      const others = next
        .filter((p) => p !== '/')
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      return [...root, ...others];
    });
  }, []);

  return {
    folders,
    loading,
    error,
    refreshFolders: fetchFolders,
    addDiscoveredFolder,
  };
}
