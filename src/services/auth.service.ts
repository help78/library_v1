import { apiClient } from '../lib/api';
import type { LoginPayload, LoginResponse, UserData } from '../types/auth';

export const authService = {
  /**
   * Autentikasi 3 Peran ke endpoint POST /api/jbsuser/login:
   * - nip: Pegawai / Guru / Landlord ({ nip, password })
   * - nis: Siswa Aktif ({ status: 'siswa', nis, pin })
   * - nopendaftaran: Calon Siswa PPDB ({ status: 'calon', nopendaftaran, pinsiswa })
   */
  async login(payload: LoginPayload): Promise<UserData> {
    const cleanId = payload.identifier.trim();
    let requestBody: Record<string, string>;

    if (payload.roleMode === 'nis') {
      requestBody = {
        status: 'siswa',
        nis: cleanId,
        pin: payload.secret,
      };
    } else if (payload.roleMode === 'nopendaftaran') {
      requestBody = {
        status: 'calon',
        nopendaftaran: cleanId,
        pinsiswa: payload.secret,
      };
    } else {
      requestBody = {
        nip: cleanId,
        password: payload.secret,
      };
    }

    const response = await apiClient.post<LoginResponse>(
      '/jbsuser/login',
      requestBody
    );

    const body = response.data;

    if (!body.success || !body.data) {
      throw new Error(
        body.message ||
          body.error ||
          'Autentikasi gagal. Periksa kembali identitas akun dan kata sandi/PIN Anda.'
      );
    }

    return {
      username: body.data.username,
      nama: body.data.nama,
      foto: body.data.foto ?? null,
      tingkat: Number(body.data.tingkat),
      hakakses: Array.isArray(body.data.hakakses) ? body.data.hakakses : [],
      departemen: body.data.departemen,
      bagian: body.data.bagian,
      kelas: body.data.kelas,
    };
  },
};
