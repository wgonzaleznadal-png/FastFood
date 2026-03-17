import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const safeStorage = {
  getItem: (name: string) => (typeof window !== "undefined" ? localStorage.getItem(name) : null),
  setItem: (name: string, value: string) => { if (typeof window !== "undefined") localStorage.setItem(name, value); },
  removeItem: (name: string) => { if (typeof window !== "undefined") localStorage.removeItem(name); },
};

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthTenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setAuth: (user: AuthUser, tenant: AuthTenant, token?: string, refreshToken?: string) => void;
  clearAuth: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      tenant: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setAuth: (user, tenant, token, refreshToken) =>
        set({ user, tenant, token: token ?? null, refreshToken: refreshToken ?? null, isAuthenticated: true }),
      clearAuth: () =>
        set({ token: null, refreshToken: null, user: null, tenant: null, isAuthenticated: false }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "gastrodash-auth",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ user: s.user, tenant: s.tenant }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
