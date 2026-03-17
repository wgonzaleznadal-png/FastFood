import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const safeStorage = {
  getItem: (name: string) => (typeof window !== "undefined" ? localStorage.getItem(name) : null),
  setItem: (name: string, value: string) => { if (typeof window !== "undefined") localStorage.setItem(name, value); },
  removeItem: (name: string) => { if (typeof window !== "undefined") localStorage.removeItem(name); },
};

export interface ShiftCollaborator {
  id: string;
  userId: string;
  user: { id: string; name: string; role: string };
}

export interface ActiveShift {
  id: string;
  openedAt: string;
  openedById: string;
  initialCash: number;
  status: "OPEN" | "CLOSED";
  openedBy: { id: string; name: string; role: string };
  collaborators?: ShiftCollaborator[];
  notes?: string;
  deliverySettlementAmount?: number;
}

interface ShiftState {
  activeShift: ActiveShift | null;
  setActiveShift: (shift: ActiveShift | null) => void;
  clearShift: () => void;
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set) => ({
      activeShift: null,
      setActiveShift: (shift) => set({ activeShift: shift }),
      clearShift: () => set({ activeShift: null }),
    }),
    { name: "gastrodash-shift", storage: createJSONStorage(() => safeStorage) }
  )
);
