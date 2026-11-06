/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Halaman Landing & Login Publik: Jika sudah login otomatis diarahkan ke /dashboard */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Rute Terproteksi: Mendukung navigasi URL langsung per modul & proteksi hakakses */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/akademik" element={<DashboardPage />} />
          <Route path="/keuangan" element={<DashboardPage />} />
          <Route path="/sdm" element={<DashboardPage />} />
          <Route path="/umum" element={<DashboardPage />} />
          <Route path="/perpustakaan" element={<DashboardPage />} />
          <Route path="/pengguna" element={<DashboardPage />} />
          <Route path="/mobile" element={<DashboardPage />} />
          <Route path="/siswa/:sub" element={<DashboardPage />} />
          <Route path="/calon/:sub" element={<DashboardPage />} />
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
