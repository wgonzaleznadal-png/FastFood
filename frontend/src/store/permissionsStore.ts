import { create } from "zustand";
import { api } from "@/lib/api";

interface PermissionsState {
  permissions: Record<string, boolean>;
  isLoaded: boolean;
  fetchPermissions: () => Promise<void>;
  clearPermissions: () => void;
  can: (moduleKey: string) => boolean;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: {},
  isLoaded: false,

  fetchPermissions: async () => {
    try {
      const res = await api.get("/api/config/permissions/me");
      set({ permissions: res.data, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  clearPermissions: () => set({ permissions: {}, isLoaded: false }),

  can: (moduleKey: string) => {
    const { permissions } = get();
    return permissions[moduleKey] ?? false;
  },
}));
