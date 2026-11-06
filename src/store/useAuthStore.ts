import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserData } from '../types/auth';

interface AuthState {
  user: UserData | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (userData: UserData) => void;
  updateUserPhoto: (foto: unknown) => void;
  logout: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

      login: (userData: UserData) =>
        set({
          user: userData,
          isAuthenticated: true,
        }),

      updateUserPhoto: (foto: unknown) =>
        set((state) => ({
          user: state.user ? { ...state.user, foto } : null,
        })),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),

      setHasHydrated: (hydrated: boolean) =>
        set({
          hasHydrated: hydrated,
        }),
    }),
    {
      name: 'jibas-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
