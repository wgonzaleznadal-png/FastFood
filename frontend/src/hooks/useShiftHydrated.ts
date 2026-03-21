"use client";

import { useEffect, useState } from "react";
import { useShiftStore } from "@/store/shiftStore";

/** Evita redirigir / perder turno antes de que zustand persist termine de leer localStorage */
export function useShiftHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const done = () => setReady(true);
    const unsub = useShiftStore.persist.onFinishHydration(done);
    if (useShiftStore.persist.hasHydrated()) done();
    return unsub;
  }, []);
  return ready;
}
