import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api";
import { findApresGaiaClient, recordReglement, refuseReglement, searchApresGaiaClients, validateReglement } from "../services";
import type { ApresGaiaCandidate, ApresGaiaProfile } from "../types";
import type { LookupStatus } from "./useAvantGaiaLookup";
import { useRealtime } from "./useRealtime";

/**
 * "Search by n" behind the Après Gaïa form, plus the règlement workflow
 * (Encaisser / Valider / Refuser). Every mutating call returns `null` on
 * success or a user-facing error message, and refreshes the profile.
 */
export function useApresGaiaLookup() {
  const [profile, setProfile] = useState<ApresGaiaProfile | null>(null);
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** Several accounts match the typed key (old/current): the agent picks one with `pick`. */
  const [candidates, setCandidates] = useState<ApresGaiaCandidate[]>([]);
  const seq = useRef(0);
  const current = profile?.informations_client.n ?? null;

  const load = useCallback(async (n: string, id: number) => {
    const p = await findApresGaiaClient(n);
    if (id !== seq.current) return null;
    setCandidates([]);
    setProfile(p);
    setStatus(p ? "found" : "not_found");
    return p;
  }, []);

  /** Accepts an old key (4-8 digits) or a current key (14 digits). One match opens it, several → `candidates`. */
  const search = useCallback(async (q: string) => {
    const id = ++seq.current;
    setStatus("loading");
    setError(null);
    setCandidates([]);
    try {
      const found = await searchApresGaiaClients(q);
      if (id !== seq.current) return null;
      if (found.length > 1) {
        setProfile(null);
        setCandidates(found);
        setStatus("idle");
        return null;
      }
      // 0 match → "not_found" ; 1 match → open it
      return await load(found.length === 1 ? String(found[0].n) : q, id);
    } catch (e) {
      if (id !== seq.current) return null;
      setProfile(null);
      setError(errorMessage(e));
      setStatus("error");
      return null;
    }
  }, [load]);

  /** The agent chose one of the `candidates`. */
  const pick = useCallback(async (n: number) => {
    const id = ++seq.current;
    setStatus("loading");
    setError(null);
    try {
      return await load(String(n), id);
    } catch (e) {
      if (id !== seq.current) return null;
      setError(errorMessage(e));
      setStatus("error");
      return null;
    }
  }, [load]);

  const clear = useCallback(() => {
    seq.current++;
    setCandidates([]);
    setProfile(null);
    setStatus("idle");
    setError(null);
  }, []);

  /** Silent refresh of the account currently displayed. */
  const reload = useCallback(async () => {
    if (current === null) return;
    const id = ++seq.current;
    try {
      const p = await findApresGaiaClient(String(current));
      if (id === seq.current && p) setProfile(p);
    } catch {
      /* keep what is on screen */
    }
  }, [current]);

  // Another user (or tab) touched a règlement of this account → refresh.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useRealtime((msg) => {
    if (current === null || !msg.event.startsWith("apres_gaia_regelement.")) return;
    if (Number(msg.payload.n) !== current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void reload(), 200);
  });

  const mutate = useCallback(
    async (op: () => Promise<unknown>): Promise<string | null> => {
      try {
        await op();
        await reload();
        return null;
      } catch (e) {
        return errorMessage(e);
      }
    },
    [reload],
  );

  const encaisser = useCallback(
    (montant: number, lieu?: string, date?: string) => {
      if (current === null) return Promise.resolve("Aucun compte sélectionné.");
      return mutate(() => recordReglement(current, { montant, lieu, date: date || undefined }));
    },
    [current, mutate],
  );
  const valider = useCallback((ref: number | string) => mutate(() => validateReglement(ref)), [mutate]);
  const refuser = useCallback((ref: number | string) => mutate(() => refuseReglement(ref)), [mutate]);

  return { profile, status, error, candidates, search, pick, clear, reload, encaisser, valider, refuser };
}
