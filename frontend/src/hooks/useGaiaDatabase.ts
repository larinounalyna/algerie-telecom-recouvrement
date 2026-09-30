import { useCallback, useEffect, useRef } from "react";
import { loadApresGaiaDatabase, loadAvantGaiaDatabase } from "../services";
import { useAsyncResource } from "./useAsyncResource";
import { useRealtime } from "./useRealtime";

/** The whole avant_gaia + avant_gaia_versement tables (for the Base de données screen). */
export function useAvantGaiaDatabase(enabled = true) {
  const loader = useCallback(() => loadAvantGaiaDatabase(), []);
  return useAsyncResource(enabled ? loader : null);
}

/**
 * The whole apres_gaia + apres_gaia_regelement tables. Stays live: any write
 * pushed by the backend (new accounts, règlements, validations) reloads it.
 */
export function useApresGaiaDatabase(enabled = true) {
  const loader = useCallback(() => loadApresGaiaDatabase(), []);
  const res = useAsyncResource(enabled ? loader : null);
  const { reload } = res;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useRealtime((msg) => {
    if (!enabled || !msg.event.startsWith("apres_gaia")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void reload(), 500); // coalesce bursts (e.g. bulk import)
  });
  return res;
}
