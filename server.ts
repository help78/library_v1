import express from 'express';
import axios from 'axios';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

const CLOUD_URL = (
  process.env.VITE_API_CLOUD_URL ||
  process.env.vite_api_cloud_url ||
  'https://drive.sdn2balepanjang.sch.id'
)
  .trim()
  .replace(/\/+$/, '');

const FB_USER = process.env.FB_USER || 'users';
const FB_PASS = process.env.FB_PASS || 'users';

const BACKEND_API_BASE = (
  process.env.VITE_API_BASE_URL || 'https://api.wahab.my.id/api'
)
  .trim()
  .replace(/\/+$/, '');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache JWT token Filebrowser
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getFilebrowserToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  const res = await axios.post(
    `${CLOUD_URL}/api/login`,
    {
      username: FB_USER,
      password: FB_PASS,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );
  const token = typeof res.data === 'string' ? res.data : String(res.data);
  cachedToken = token;
  tokenExpiry = now + 60 * 60 * 1000; // 1 jam
  return token;
}

// 1. GET /api/files/list
app.get('/api/files/list', async (req, res) => {
  try {
    const rawPath = String(req.query.path || '/').trim();
    let targetPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (targetPath === '/') {
      targetPath = '';
    }

    const token = await getFilebrowserToken();
    const fbRes = await axios.get(
      `${CLOUD_URL}/api/resources${encodeURI(targetPath)}`,
      {
        headers: { 'X-Auth': token },
        timeout: 15000,
      }
    );

    const fbData = fbRes.data || {};
    const items = (fbData.items || []).map((item: any) => {
      const itemPath = String(item.path || '').trim();
      const isDir = Boolean(item.isDir);
      return {
        path: itemPath.startsWith('/') ? itemPath : `/${itemPath}`,
        name: item.name || '',
        size: item.size ?? 0,
        extension: item.extension ?? '',
        modified: item.modified ?? new Date().toISOString(),
        mode: item.mode,
        isDir,
        isSymlink: Boolean(item.isSymlink),
        type: item.type || (isDir ? 'directory' : 'file'),
        resolution: item.resolution,
      };
    });

    return res.json({
      status: 'sukses',
      pesan: `Berhasil memuat isi folder: ${rawPath}`,
      total_data: items.length,
      data: items,
    });
  } catch (err: any) {
    console.error('Error /api/files/list:', err.message);
    if (err.response?.status === 404) {
      return res.json({
        status: 'sukses',
        pesan: `Folder belum memiliki berkas`,
        total_data: 0,
        data: [],
      });
    }
    const statusCode = err.response?.status || 500;
    return res.status(statusCode).json({
      status: 'error',
      pesan:
        err.response?.data?.message ||
        err.message ||
        'Gagal memuat berkas dari Cloud Storage',
    });
  }
});

// Multer memory storage untuk upload file hingga 100MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// 2. POST /api/files/upload
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        pesan: 'Berkas (file) wajib dipilih untuk diunggah!',
      });
    }

    let folder = String(req.body.folder || '/').trim();
    if (!folder.startsWith('/') && folder !== '') {
      folder = `/${folder}`;
    }
    if (folder.length > 1 && folder.endsWith('/')) {
      folder = folder.replace(/\/+$/, '');
    }

    const token = await getFilebrowserToken();

    // Pastikan folder tujuan ada di Filebrowser jika bukan root
    if (folder !== '/' && folder !== '') {
      try {
        await axios.get(`${CLOUD_URL}/api/resources${encodeURI(folder)}`, {
          headers: { 'X-Auth': token },
          timeout: 5000,
        });
      } catch (checkErr: any) {
        if (checkErr.response?.status === 404) {
          try {
            await axios.post(
              `${CLOUD_URL}/api/resources${encodeURI(folder)}/`,
              null,
              {
                headers: { 'X-Auth': token },
                timeout: 5000,
              }
            );
          } catch {
            // Ignore jika folder sudah ada atau dibuat
          }
        }
      }
    }

    const originalName = req.file.originalname;
    const destPath =
      folder === '/' || folder === ''
        ? `/${originalName}`
        : `${folder}/${originalName}`;

    // Upload berkas langsung ke Filebrowser API dengan query override=true
    await axios.post(
      `${CLOUD_URL}/api/resources${encodeURI(destPath)}?override=true`,
      req.file.buffer,
      {
        headers: {
          'X-Auth': token,
          'Content-Type': req.file.mimetype || 'application/octet-stream',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000,
      }
    );

    const publicUrl = `${CLOUD_URL}/files${encodeURI(destPath)}`;

    return res.json({
      status: 'sukses',
      pesan: `File berhasil diupload ke folder ${folder || '/'}`,
      data: {
        nama_file: originalName,
        path: destPath,
        url_publik: publicUrl,
        url_internal: publicUrl,
        folder: folder || '/',
        size: req.file.size,
      },
    });
  } catch (err: any) {
    console.error('Error /api/files/upload:', err.message);
    const statusCode = err.response?.status || 500;
    return res.status(statusCode).json({
      status: 'error',
      pesan:
        err.response?.data?.message ||
        err.message ||
        'Gagal mengunggah berkas ke Cloud Storage',
    });
  }
});

// 3. DELETE /api/files/delete
app.delete('/api/files/delete', async (req, res) => {
  try {
    const rawPath = String(req.query.path || '').trim();
    if (!rawPath) {
      return res.status(400).json({
        status: 'error',
        pesan: 'Parameter path wajib diisi!',
      });
    }

    const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const token = await getFilebrowserToken();

    await axios.delete(
      `${CLOUD_URL}/api/resources${encodeURI(cleanPath)}`,
      {
        headers: { 'X-Auth': token },
        timeout: 10000,
      }
    );

    return res.json({
      status: 'sukses',
      pesan: `Berkas atau folder "${cleanPath}" berhasil dihapus`,
    });
  } catch (err: any) {
    console.error('Error /api/files/delete:', err.message);
    const statusCode = err.response?.status || 500;
    return res.status(statusCode).json({
      status: 'error',
      pesan:
        err.response?.data?.message ||
        err.message ||
        'Gagal menghapus berkas dari Cloud Storage',
    });
  }
});

// Proxy route fallback untuk seluruh endpoint /api selain /api/files
app.all('/api/*', async (req, res) => {
  try {
    const targetUrl = `${BACKEND_API_BASE}${req.path.replace(/^\/api/, '')}`;
    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        ...req.headers,
        host: new URL(BACKEND_API_BASE).host,
      },
      validateStatus: () => true,
    });
    return res
      .status(response.status)
      .set(response.headers)
      .send(response.data);
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      pesan: err.message || 'Gagal meneruskan request ke backend JIBAS',
    });
  }
});

// Mount Vite middleware (development) atau static dist (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server JIBAS ERP berjalan pada http://0.0.0.0:${PORT}`);
});
