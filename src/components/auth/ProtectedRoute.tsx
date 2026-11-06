import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { hasAccess, type AppMenuConfigItem } from '../../lib/rbac';
import type { RoleTingkat } from '../../types/auth';

interface ProtectedRouteProps {
  allowedRoles?: RoleTingkat[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Memuat sesi pengguna...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.tingkat as RoleTingkat)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

interface RequireAuthProps {
  menu?: AppMenuConfigItem | null;
  req_modul?: string;
  children: React.ReactNode;
}

export function RequireAuth({ menu, req_modul, children }: RequireAuthProps) {
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!hasHydrated) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-sm text-slate-500">Memuat sesi pengguna...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const targetRule =
    menu ??
    (req_modul
      ? {
          allowed_tingkat: [1, 2],
          req_modul,
        }
      : null);

  if (targetRule && !hasAccess(user, targetRule)) {
    const moduleLabel =
      targetRule.req_modul ||
      ('label' in targetRule ? targetRule.label : 'Halaman Ini');

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-800 p-6 sm:p-8">
        <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl border border-red-200/80">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 [text-wrap:balance]">
            Akses Ditolak
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {menu?.landlordOnly ? (
              <>
                Manajemen Pengguna & Hak Akses hanya dapat dikelola oleh{' '}
                <strong className="text-slate-900">
                  Super Admin (Landlord / Jibas)
                </strong>
                .
              </>
            ) : (
              <>
                Anda tidak memiliki hak akses untuk modul{' '}
                <strong className="text-slate-900">{moduleLabel}</strong>.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, user, hasHydrated } = useAuthStore();

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Memuat sesi pengguna...</div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
