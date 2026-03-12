import { create } from "zustand";
import { persist } from "zustand/middleware";

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
    { name: "gastrodash-shift" }
  )
);
