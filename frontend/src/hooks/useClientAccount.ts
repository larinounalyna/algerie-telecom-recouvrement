import { useCallback } from "react";
import { errorMessage } from "../api";
import {
  apresProfileToDebtor,
  avantProfileToDebtor,
  deleteReglement,
  findApresGaiaClient,
  findAvantGaiaClient,
  recordReglement,
  refuseReglement,
  validateReglement,
} from "../services";
import { entrepriseToDebtor } from "../shared/lib/debtor";
import { generateTrancheId } from "../shared/lib/generators";
import { todayISO } from "../shared/lib/format";
import { useAppData } from "../store/AppData";
import type { DbKind, DebtorView } from "../types";
import { useAsyncResource } from "./useAsyncResource";
import { useRealtime } from "./useRealtime";

/** Every action resolves to `null` (ok) or a user-facing error message. */
type Action<A extends unknown[]> = (...args: A) => Promise<string | null>;

export interface ClientAccount {
  client: DebtorView | null;
  loading: boolean;
  error: string | null;
  /** `note` = lieu de versement (Après Gaïa) or agent (Entreprises). Absent when the database is read-only. */
  recordPayment?: Action<[montant: number, note?: string, date?: string]>;
  validate?: Action<[trancheId: string]>;
  refuse?: Action<[trancheId: string]>;
  /** Supprime définitivement un versement (Après Gaïa uniquement) — exige le mot de passe du serveur. */
  remove?: Action<[trancheId: string, password: string]>;
}

/**
 * One customer of any of the three databases, ready for the detail modal:
 *  - avant       → API, read only (no payment / validation endpoint exists)
 *  - apres       → API, with Encaisser / Valider / Refuser
 *  - entreprise  → local store
 */
export function useClientAccount(kind: DbKind, id: string): ClientAccount {
  const { entreprises, applyPayment, validateTranche } = useAppData();

  const avantLoader = useCallback(() => findAvantGaiaClient(id), [id]);
  const apresLoader = useCallback(() => findApresGaiaClient(id), [id]);
  const avant = useAsyncResource(kind === "avant" ? avantLoader : null);
  const apres = useAsyncResource(kind === "apres" ? apresLoader : null);

  const reloadApres = apres.reload;
  useRealtime((msg) => {
    if (kind !== "apres") return;
    const touchesThisClient = String(msg.payload.n) === id;
    if (touchesThisClient && (msg.event.startsWith("apres_gaia_regelement.") || msg.event.startsWith("apres_gaia_rappel."))) void reloadApres();
  });

  const mutateApres = useCallback(
    async (op: () => Promise<unknown>): Promise<string | null> => {
      try {
        await op();
        await reloadApres();
        return null;
      } catch (e) {
        return errorMessage(e);
      }
    },
    [reloadApres],
  );

  if (kind === "avant") {
    return { client: avant.data ? avantProfileToDebtor(avant.data) : null, loading: avant.loading, error: avant.error };
  }

  if (kind === "apres") {
    return {
      client: apres.data ? apresProfileToDebtor(apres.data) : null,
      loading: apres.loading,
      error: apres.error,
      recordPayment: (montant, lieu, date) => mutateApres(() => recordReglement(id, { montant, lieu, date: date || undefined })),
      validate: (ref) => mutateApres(() => validateReglement(ref)),
      refuse: (ref) => mutateApres(() => refuseReglement(ref)),
      remove: (ref, password) => mutateApres(() => deleteReglement(ref, password)),
    };
  }

  const c = entreprises.find((x) => x.numCompte === id);
  return {
    client: c ? entrepriseToDebtor(c) : null,
    loading: false,
    error: null,
    recordPayment: async (montant, agent, date) => {
      applyPayment(id, { id: generateTrancheId(), montant, date: date || todayISO(), agent: agent || undefined });
      return null;
    },
    validate: async (tid) => {
      validateTranche(id, tid);
      return null;
    },
  };
}
