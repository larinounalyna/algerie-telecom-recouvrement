import { useCallback, useRef, useState } from "react";
import { errorMessage } from "../api";
import { findAvantGaiaClient } from "../services";
import type { AvantGaiaProfile } from "../types";

export type LookupStatus = "idle" | "loading" | "found" | "not_found" | "error";

/** "Search by N° abonné" behind the Avant Gaïa form (read only). */
export function useAvantGaiaLookup() {
  const [profile, setProfile] = useState<AvantGaiaProfile | null>(null);
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const search = useCallback(async (nAbonne: string) => {
    const id = ++seq.current;
    setStatus("loading");
    setError(null);
    try {
      const p = await findAvantGaiaClient(nAbonne);
      if (id !== seq.current) return null;
      setProfile(p);
      setStatus(p ? "found" : "not_found");
      return p;
    } catch (e) {
      if (id !== seq.current) return null;
      setProfile(null);
      setError(errorMessage(e));
      setStatus("error");
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    seq.current++;
    setProfile(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { profile, status, error, search, clear };
}
