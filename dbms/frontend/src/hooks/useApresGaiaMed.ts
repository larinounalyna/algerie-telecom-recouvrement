import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api";
import {
  defaultMed,
  engagerEngagement,
  envoyerInvitationPaiement,
  envoyerMedHuissier as envoyerMedHuissierSvc,
  envoyerMedLettre as envoyerMedLettreSvc,
  changeEtatJuridique as changeEtatJuridiqueSvc,
  setCasParticulier as setCasParticulierSvc,
  clearCasParticulier as clearCasParticulierSvc,
} from "../services";
import type { ApresGaiaMedRow, EtatJuridiqueMed } from "../types";
import { useRealtime } from "./useRealtime";

/** Every action resolves to `null` (ok) or a user-facing error message. */
type Action<A extends unknown[]> = (...args: A) => Promise<string | null>;

export interface ApresGaiaMedController {
  med: ApresGaiaMedRow | null;
  busy: boolean;
  error: string | null;
  envoyerInvitation: Action<[dateEnvoi?: string]>;
  envoyerMedLettre: Action<[dateEnvoi?: string]>;
  engager: Action<[dateEnvoi?: string]>;
  envoyerMedHuissier: Action<[nom?: string, prenom?: string, dateEnvoi?: string]>;
  changeEtatJuridique: Action<[etat: EtatJuridiqueMed]>;
  /** Enregistre ou modifie le cas particulier + commentaire de l'engagement (`label` obligatoire). */
  setCasParticulier: Action<[input: { label: string; commentaire?: string; date?: string }]>;
  clearCasParticulier: Action<[]>;
}

/**
 * Owns the état MED / juridique of one Après Gaïa (clients particuliers)
 * account, seeded from the profile already loaded by useClientAccount and
 * kept in sync with every action's response (each endpoint returns the
 * full, updated row — no extra round-trip needed).
 *
 * `n` is `null` for every other kind (avant / entreprise) — the hook is
 * then an inert no-op so it can still be called unconditionally.
 */
export function useApresGaiaMed(n: string | null, initial: ApresGaiaMedRow | null | undefined): ApresGaiaMedController {
  const [med, setMed] = useState<ApresGaiaMedRow | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync when the parent reloads the client (e.g. after a règlement) or
  // when a different client is opened.
  useEffect(() => {
    setMed(initial ?? (n ? defaultMed(n) : null));
  }, [initial, n]);

  useRealtime((msg) => {
    if (n && msg.event === "apres_gaia_med.updated" && String(msg.payload.n) === n && msg.payload.action !== undefined) {
      // Another tab/agent changed this client's dossier — nothing to merge
      // locally (we don't know the new values), so leave the current view
      // as-is; the next open of this fiche will fetch it fresh.
    }
  });

  const run = useCallback(
    async (fn: () => Promise<ApresGaiaMedRow>): Promise<string | null> => {
      setBusy(true);
      setError(null);
      try {
        const row = await fn();
        setMed(row);
        return null;
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        return msg;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return {
    med,
    busy,
    error,
    envoyerInvitation: (dateEnvoi) => {
      if (!n) return Promise.resolve(null);
      return run(() => envoyerInvitationPaiement(n, dateEnvoi));
    },
    envoyerMedLettre: (dateEnvoi) => {
      if (!n) return Promise.resolve(null);
      return run(() => envoyerMedLettreSvc(n, dateEnvoi));
    },
    engager: (dateEnvoi) => {
      if (!n) return Promise.resolve(null);
      return run(() => engagerEngagement(n, dateEnvoi));
    },
    envoyerMedHuissier: (nom, prenom, dateEnvoi) => {
      if (!n) return Promise.resolve(null);
      return run(() => envoyerMedHuissierSvc(n, nom, prenom, dateEnvoi));
    },
    changeEtatJuridique: (etat) => {
      if (!n) return Promise.resolve(null);
      return run(() => changeEtatJuridiqueSvc(n, etat));
    },
    setCasParticulier: (input) => {
      if (!n) return Promise.resolve(null);
      return run(() => setCasParticulierSvc(n, input));
    },
    clearCasParticulier: () => {
      if (!n) return Promise.resolve(null);
      return run(() => clearCasParticulierSvc(n));
    },
  };
}
