import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CanalMED,
  DbKind,
  EntrepriseClient,
  EtatJuridique,
  PaymentTranche,
  StadeJuridique,
} from "../types";
import { entreprisesData } from "../data/entreprisesData";
import { generateDemoEntreprises, isDemoId } from "../shared/lib/demoData";
import { todayISO } from "../shared/lib/format";
import {
  StoredJuridique,
  batchMEDNumber,
  isEmptyJuridique,
  makeEvent,
  makeMED,
  stadeInfo,
  withDefaults,
} from "../shared/lib/juridique";

/**
 * Client-side state that has NO backend table (yet):
 *   - the Entreprises customers (local demo data),
 *   - the état juridique / mises en demeure (persisted in localStorage),
 *   - free-text comments (`commentaire` is not a column of avant_gaia / apres_gaia).
 *
 * Avant Gaïa and Après Gaïa data is NOT held here any more: it is fetched from
 * the API through src/services + src/hooks.
 */

export const keyOf = (kind: DbKind, id: string) => `${kind}:${id}`;

const STORAGE_KEY = "at-recouvrement:juridique:v1";

function loadJuridique(): Record<string, StoredJuridique> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export interface ImportResult {
  added: number;
  updated: number;
  ignored: number;
}

interface AppData {
  entreprises: EntrepriseClient[];
  juridique: Record<string, StoredJuridique>;

  // Entreprises (local data)
  applyPayment: (id: string, tranche: PaymentTranche) => void;
  validateTranche: (id: string, trancheId: string) => void;
  importRows: (rows: EntrepriseClient[]) => ImportResult;
  hasDemo: () => boolean;
  loadDemo: (count: number) => void;
  clearDemo: () => void;

  // Comments (all databases, not persisted server-side)
  commentaires: Record<string, string>;
  setCommentaire: (kind: DbKind, id: string, commentaire: string) => void;

  // État juridique (all databases)
  getJuridique: (kind: DbKind, id: string) => EtatJuridique;
  updateJuridique: (kind: DbKind, id: string, patch: Partial<EtatJuridique>) => void;
  changeStade: (kind: DbKind, id: string, stade: StadeJuridique) => void;
  addEvent: (kind: DbKind, id: string, label: string, note?: string, date?: string) => void;
  recordMED: (kind: DbKind, id: string, numero: string, canal: CanalMED) => void;
  markLot: (keys: string[], mois: string) => { lot: string; count: number };
  cancelLot: (lot: string) => void;
}

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside <AppDataProvider>");
  return v;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [entreprises, setEntreprises] = useState<EntrepriseClient[]>(entreprisesData);
  const [juridique, setJuridique] = useState<Record<string, StoredJuridique>>(loadJuridique);
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});

  // Persist the legal status: the "already sent a mise en demeure" flag must
  // survive a page reload, otherwise next month's extraction would pick the
  // same customers again.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(juridique));
    } catch {
      /* storage full or unavailable: keep working in memory */
    }
  }, [juridique]);

  /* ---------------- Entreprises (local data) ---------------- */

  const applyPayment = useCallback<AppData["applyPayment"]>(
    (id, tranche) =>
      setEntreprises((p) =>
        p.map((c) =>
          c.numCompte === id
            ? {
                ...c,
                solde: Math.max(0, Math.round((c.solde - tranche.montant) * 100) / 100),
                historique: [...(c.historique ?? []), tranche],
              }
            : c,
        ),
      ),
    [],
  );

  const validateTranche = useCallback<AppData["validateTranche"]>(
    (id, trancheId) =>
      setEntreprises((p) =>
        p.map((c) =>
          c.numCompte === id
            ? { ...c, historique: (c.historique ?? []).map((t) => (t.id === trancheId ? { ...t, valide: true } : t)) }
            : c,
        ),
      ),
    [],
  );

  const importRows = useCallback<AppData["importRows"]>(
    (rows) => {
      const index = new Map(entreprises.map((c, i) => [c.numCompte, i]));
      const next = [...entreprises];
      let added = 0;
      let updated = 0;
      let ignored = 0;
      for (const r of rows) {
        if (!r.numCompte) {
          ignored++;
          continue;
        }
        const at = index.get(r.numCompte);
        if (at !== undefined) {
          // keep the payment history we already have for this account
          next[at] = { ...r, historique: next[at].historique ?? [] };
          updated++;
        } else {
          index.set(r.numCompte, next.length);
          next.push(r);
          added++;
        }
      }
      setEntreprises(next);
      return { added, updated, ignored };
    },
    [entreprises],
  );

  const hasDemo = useCallback(() => entreprises.some((c) => isDemoId(c.numCompte)), [entreprises]);
  const loadDemo = useCallback<AppData["loadDemo"]>(
    (count) => setEntreprises((p) => [...p.filter((c) => !isDemoId(c.numCompte)), ...generateDemoEntreprises(count)]),
    [],
  );
  const clearDemo = useCallback(() => setEntreprises((p) => p.filter((c) => !isDemoId(c.numCompte))), []);

  const setCommentaire = useCallback<AppData["setCommentaire"]>(
    (kind, id, commentaire) => setCommentaires((p) => ({ ...p, [keyOf(kind, id)]: commentaire })),
    [],
  );

  /* ---------------- état juridique ---------------- */

  const put = (prev: Record<string, StoredJuridique>, key: string, value: StoredJuridique) => {
    const next = { ...prev };
    if (isEmptyJuridique(value)) delete next[key];
    else next[key] = value;
    return next;
  };

  const getJuridique = useCallback<AppData["getJuridique"]>(
    (kind, id) => withDefaults(juridique[keyOf(kind, id)]),
    [juridique],
  );

  const updateJuridique = useCallback<AppData["updateJuridique"]>((kind, id, patch) => {
    const key = keyOf(kind, id);
    setJuridique((prev) => put(prev, key, { ...withDefaults(prev[key]), ...patch }));
  }, []);

  const addEvent = useCallback<AppData["addEvent"]>((kind, id, label, note, date) => {
    const key = keyOf(kind, id);
    setJuridique((prev) => {
      const cur = withDefaults(prev[key]);
      return put(prev, key, { ...cur, evenements: [...cur.evenements, makeEvent(label, date || todayISO(), note)] });
    });
  }, []);

  const changeStade = useCallback<AppData["changeStade"]>((kind, id, stade) => {
    const key = keyOf(kind, id);
    setJuridique((prev) => {
      const cur = withDefaults(prev[key]);
      if (cur.stade === stade) return prev;
      return put(prev, key, {
        ...cur,
        stade,
        evenements: [...cur.evenements, makeEvent(`Étape : ${stadeInfo(stade).label}`, todayISO())],
      });
    });
  }, []);

  const recordMED = useCallback<AppData["recordMED"]>((kind, id, numero, canal) => {
    const key = keyOf(kind, id);
    setJuridique((prev) => {
      const cur = withDefaults(prev[key]);
      if (cur.mises.some((m) => m.numero === numero)) return prev; // already recorded
      return put(prev, key, {
        ...cur,
        stade: cur.stade === "aucune" ? "med_envoyee" : cur.stade,
        mises: [...cur.mises, makeMED(numero, todayISO(), canal)],
      });
    });
  }, []);

  const markLot = useCallback<AppData["markLot"]>((keys, mois) => {
    const lot = `LOT-${mois}-${Date.now().toString(36)}`;
    const today = todayISO();
    setJuridique((prev) => {
      const prefix = `MED-${mois}-`;
      let seq = 0;
      for (const j of Object.values(prev)) for (const m of j.mises ?? []) if (m.numero.startsWith(prefix)) seq++;
      const next = { ...prev };
      for (const key of keys) {
        const cur = withDefaults(prev[key]);
        seq++;
        next[key] = {
          ...prev[key],
          stade: cur.stade === "aucune" ? "med_envoyee" : cur.stade,
          mises: [...cur.mises, makeMED(batchMEDNumber(mois, seq), today, "Extraction mensuelle", lot)],
        };
      }
      return next;
    });
    return { lot, count: keys.length };
  }, []);

  const cancelLot = useCallback<AppData["cancelLot"]>((lot) => {
    setJuridique((prev) => {
      const next: Record<string, StoredJuridique> = {};
      for (const [key, j] of Object.entries(prev)) {
        const mises = (j.mises ?? []).filter((m) => m.lot !== lot);
        if (mises.length === (j.mises ?? []).length) {
          next[key] = j;
          continue;
        }
        const cur = withDefaults({ ...j, mises });
        // Undo the automatic stage change only if nothing else moved the file since.
        const stade = mises.length === 0 && cur.stade === "med_envoyee" ? "aucune" : cur.stade;
        const value = { ...j, mises, stade };
        if (!isEmptyJuridique(value)) next[key] = value;
      }
      return next;
    });
  }, []);

  const value = useMemo<AppData>(
    () => ({
      entreprises,
      juridique,
      applyPayment,
      validateTranche,
      importRows,
      hasDemo,
      loadDemo,
      clearDemo,
      commentaires,
      setCommentaire,
      getJuridique,
      updateJuridique,
      changeStade,
      addEvent,
      recordMED,
      markLot,
      cancelLot,
    }),
    [entreprises, juridique, applyPayment, validateTranche, importRows, hasDemo, loadDemo, clearDemo, commentaires, setCommentaire, getJuridique, updateJuridique, changeStade, addEvent, recordMED, markLot, cancelLot],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
