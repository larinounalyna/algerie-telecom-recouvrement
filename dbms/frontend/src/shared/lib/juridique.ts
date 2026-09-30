import { CanalMED, EtatJuridique, EtatJuridiqueMed, JuridiqueEvent, MiseEnDemeureRecord, StadeJuridique } from "../../types";

export interface StadeInfo {
  id: StadeJuridique;
  label: string;
  /** Short label for table badges */
  court: string;
  badge: string; // tailwind classes
  description: string;
}

/** Ordered pipeline: the recovery procedure goes top to bottom. */
export const STADES: StadeInfo[] = [
  {
    id: "aucune",
    label: "Aucune procédure",
    court: "Aucune",
    badge: "bg-gray-100 text-gray-600",
    description: "Aucune démarche juridique engagée.",
  },
  {
    id: "med_envoyee",
    label: "Mise en demeure envoyée",
    court: "MED envoyée",
    badge: "bg-amber-100 text-amber-800",
    description: "Le courrier de mise en demeure a été émis, le délai de 8 jours court.",
  },
  {
    id: "med_notifiee",
    label: "Mise en demeure notifiée (huissier)",
    court: "MED notifiée",
    badge: "bg-orange-100 text-orange-800",
    description: "La mise en demeure a été notifiée par huissier de justice.",
  },
  {
    id: "contentieux",
    label: "Contentieux — instance en cours",
    court: "Contentieux",
    badge: "bg-red-100 text-red-700",
    description: "Une action en justice est engagée devant le tribunal.",
  },
  {
    id: "jugement",
    label: "Jugement rendu",
    court: "Jugement",
    badge: "bg-purple-100 text-purple-700",
    description: "Une décision de justice a été prononcée.",
  },
  {
    id: "execution",
    label: "Exécution du jugement",
    court: "Exécution",
    badge: "bg-fuchsia-100 text-fuchsia-700",
    description: "Le jugement est en cours d'exécution (saisie, recouvrement forcé).",
  },
  {
    id: "cloture",
    label: "Dossier clôturé",
    court: "Clôturé",
    badge: "bg-green-100 text-green-700",
    description: "Le dossier juridique est clos.",
  },
];

export const stadeInfo = (id: StadeJuridique): StadeInfo => STADES.find((s) => s.id === id) ?? STADES[0];

/** Days a debtor has to pay after a mise en demeure. */
export const DELAI_MED_JOURS = 8;

export const emptyJuridique = (): EtatJuridique => ({
  stade: "aucune",
  mises: [],
  evenements: [],
  numDossier: "",
  tribunal: "",
  huissier: "",
  avocat: "",
  dateAudience: "",
  montantReclame: 0,
  fraisJustice: 0,
  observations: "",
});

/**
 * Only non-default fields are kept in the store / localStorage: a monthly
 * batch can flag 10 000 customers and every byte counts.
 */
export type StoredJuridique = Partial<EtatJuridique>;

export const withDefaults = (p?: StoredJuridique): EtatJuridique => ({ ...emptyJuridique(), ...(p ?? {}) });

export function isEmptyJuridique(p: StoredJuridique): boolean {
  const d = withDefaults(p);
  const e = emptyJuridique();
  return (
    d.stade === e.stade &&
    d.mises.length === 0 &&
    d.evenements.length === 0 &&
    !d.numDossier &&
    !d.tribunal &&
    !d.huissier &&
    !d.avocat &&
    !d.dateAudience &&
    !d.montantReclame &&
    !d.fraisJustice &&
    !d.observations
  );
}

export const lastMED = (j: { mises?: MiseEnDemeureRecord[] } | undefined): MiseEnDemeureRecord | undefined => {
  const m = j?.mises;
  return m && m.length ? m[m.length - 1] : undefined;
};

/** A customer is eligible for a (new) mise en demeure only if none was ever sent. */
export const jamaisMisEnDemeure = (j: StoredJuridique | undefined): boolean =>
  !j || ((!j.mises || j.mises.length === 0) && (!j.stade || j.stade === "aucune"));

export const makeMED = (numero: string, date: string, canal: CanalMED, lot?: string): MiseEnDemeureRecord => ({
  numero,
  date,
  canal,
  ...(lot ? { lot } : {}),
});

export const makeEvent = (label: string, date: string, note?: string): JuridiqueEvent => ({
  id: `EV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  date,
  label,
  ...(note ? { note } : {}),
});

/** Sequential MED number used for batches: MED-2026-09-000123 */
export const batchMEDNumber = (yyyymm: string, seq: number) => `MED-${yyyymm}-${String(seq).padStart(6, "0")}`;

export interface LotSummary {
  lot: string;
  /** yyyy-mm the batch was extracted for, parsed from the lot id */
  mois: string;
  date: string;
  count: number;
}

export function summarizeLots(store: Record<string, StoredJuridique>): LotSummary[] {
  const map = new Map<string, LotSummary>();
  for (const j of Object.values(store)) {
    for (const m of j.mises ?? []) {
      if (!m.lot) continue;
      const cur = map.get(m.lot);
      if (cur) cur.count++;
      else map.set(m.lot, { lot: m.lot, mois: m.lot.slice(4, 11), date: m.date, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || b.lot.localeCompare(a.lot));
}

/* ------------------------------------------------------------------ */
/*  Après Gaïa (clients particuliers) — apres_gaia_med                 */
/*  État juridique réel (backend, table apres_gaia_med) — distinct du  */
/*  StadeJuridique local ci-dessus (Avant Gaïa / Entreprises).         */
/*  Même palette de couleurs que STADES, pour rester cohérent visuellement. */
/* ------------------------------------------------------------------ */

export interface EtatJuridiqueMedInfo {
  value: EtatJuridiqueMed;
  /** Short label for chips / tab badges */
  court: string;
  badge: string; // tailwind classes — même famille que STADES
}

export const ETATS_JURIDIQUES_MED: EtatJuridiqueMedInfo[] = [
  { value: "Procédure en cours", court: "En cours", badge: "bg-amber-100 text-amber-800" },
  { value: "Entreprise gagnante – première décision", court: "Entreprise gagnante (1re)", badge: "bg-purple-100 text-purple-700" },
  { value: "Client gagnant – première décision", court: "Client gagnant (1re)", badge: "bg-orange-100 text-orange-800" },
  { value: "Entreprise gagnante – après recours", court: "Entreprise gagnante (recours)", badge: "bg-fuchsia-100 text-fuchsia-700" },
  { value: "Client gagnant – après recours", court: "Client gagnant (recours)", badge: "bg-red-100 text-red-700" },
  { value: "Dossier clôturé", court: "Clôturé", badge: "bg-green-100 text-green-700" },
];

export const etatJuridiqueMedInfo = (v: EtatJuridiqueMed | undefined): EtatJuridiqueMedInfo =>
  ETATS_JURIDIQUES_MED.find((e) => e.value === v) ?? ETATS_JURIDIQUES_MED[0];
