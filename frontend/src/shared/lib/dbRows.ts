import { ApresGaiaRow, AvantGaiaRow, DbKind, EntrepriseClient, StadeJuridique } from "../../types";
import { StoredJuridique, lastMED } from "./juridique";

/* ------------------------------------------------------------------ */
/*  Normalised row shared by the three databases                       */
/* ------------------------------------------------------------------ */

export interface DbRow {
  key: string; // `${kind}:${id}` — one per customer (also the key of the état juridique)
  rowKey: string; // unique per displayed row (avant_gaia has several rows per customer)
  /** false for the older bimestre rows of an avant_gaia customer; always true elsewhere. */
  isLatest: boolean;
  kind: DbKind;
  id: string;
  numClient: string;
  nom: string;
  prenom: string;
  displayName: string;
  adresse: string;
  commune: string;
  wilaya: string;
  telephone: string;
  typeService: string;
  statut: string;
  montant: number;
  solde: number;
  dateRefISO: string;
  derniereVersementISO: string; // "" if never paid
  // Real tables (avant_gaia / apres_gaia) — "" when the table has no such column
  actel: string;
  typeCompte: string;
  codetat: string;
  motifRes: string;
  bimestre: string;
  // Entreprises only
  formeJuridique: string;
  secteur: string;
  nif: string;
  // Legal
  stade: StadeJuridique;
  nbMed: number;
  derniereMedISO: string;
  // Fast text search
  searchText: string;
  /** The source record: a row of avant_gaia / apres_gaia (exact column names) or an Entreprise. */
  raw: AvantGaiaRow | ApresGaiaRow | EntrepriseClient;
}

/* ------------------------------------------------------------------ */
/*  Filters                                                            */
/* ------------------------------------------------------------------ */

export interface FilterState {
  search: string;
  wilaya: string;
  commune: string;
  typeService: string;
  statut: string;
  soldeMode: "tous" | "du" | "solde";
  soldeMin: string;
  soldeMax: string;
  dateFrom: string;
  dateTo: string;
  sansVersementJours: string;
  med: "tous" | "jamais" | "deja";
  stade: "" | StadeJuridique;
  requireAdresse: boolean;
  requireTelephone: boolean;
  // Real tables
  actel: string;
  typeCompte: string;
  codetat: string;
  motifRes: string;
  bimestre: string;
  // Entreprises
  formeJuridique: string;
  secteur: string;
  requireNif: boolean;
}

export const emptyFilters: FilterState = {
  search: "",
  wilaya: "",
  commune: "",
  typeService: "",
  statut: "",
  soldeMode: "tous",
  soldeMin: "",
  soldeMax: "",
  dateFrom: "",
  dateTo: "",
  sansVersementJours: "",
  med: "tous",
  stade: "",
  requireAdresse: false,
  requireTelephone: false,
  actel: "",
  typeCompte: "",
  codetat: "",
  motifRes: "",
  bimestre: "",
  formeJuridique: "",
  secteur: "",
  requireNif: false,
};

/** Number of filters currently narrowing the list (used for the badge). */
export function countActive(f: FilterState, ignore: (keyof FilterState)[] = []): number {
  let n = 0;
  (Object.keys(emptyFilters) as (keyof FilterState)[]).forEach((k) => {
    if (ignore.includes(k)) return;
    if (f[k] !== emptyFilters[k]) n++;
  });
  return n;
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function applyFilters(rows: DbRow[], f: FilterState, now: Date = new Date()): DbRow[] {
  const q = f.search.trim().toLowerCase();
  const min = num(f.soldeMin);
  const max = num(f.soldeMax);
  const sansV = num(f.sansVersementJours);
  const limitISO =
    sansV !== null ? new Date(now.getTime() - sansV * 86400000).toISOString().slice(0, 10) : null;

  return rows.filter((r) => {
    if (q && !r.searchText.includes(q)) return false;
    if (f.wilaya && r.wilaya !== f.wilaya) return false;
    if (f.commune && r.commune !== f.commune) return false;
    if (f.typeService && r.typeService !== f.typeService) return false;
    if (f.statut && r.statut !== f.statut) return false;
    if (f.actel && r.actel !== f.actel) return false;
    if (f.typeCompte && r.typeCompte !== f.typeCompte) return false;
    if (f.codetat && r.codetat !== f.codetat) return false;
    if (f.motifRes && r.motifRes !== f.motifRes) return false;
    if (f.bimestre && r.bimestre !== f.bimestre) return false;
    if (f.formeJuridique && r.formeJuridique !== f.formeJuridique) return false;
    if (f.secteur && r.secteur !== f.secteur) return false;
    if (f.soldeMode === "du" && !(r.solde > 0)) return false;
    if (f.soldeMode === "solde" && r.solde > 0) return false;
    if (min !== null && r.solde < min) return false;
    if (max !== null && r.solde > max) return false;
    if (f.dateFrom && (!r.dateRefISO || r.dateRefISO < f.dateFrom)) return false;
    if (f.dateTo && (!r.dateRefISO || r.dateRefISO > f.dateTo)) return false;
    // "no payment for N days" — customers who never paid also match
    if (limitISO !== null && r.derniereVersementISO && r.derniereVersementISO > limitISO) return false;
    if (f.med === "jamais" && r.nbMed > 0) return false;
    if (f.med === "deja" && r.nbMed === 0) return false;
    if (f.stade && r.stade !== f.stade) return false;
    if (f.requireAdresse && !r.adresse.trim()) return false;
    if (f.requireTelephone && !r.telephone.trim()) return false;
    if (f.requireNif && !r.nif.trim()) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Monthly extraction                                                 */
/* ------------------------------------------------------------------ */

export type ExtractionOrder = "solde_desc" | "anciennete" | "numero";

export const ORDER_LABELS: Record<ExtractionOrder, string> = {
  solde_desc: "Plus gros solde dû d'abord",
  anciennete: "Plus ancien abonnement d'abord",
  numero: "Ordre de la base (N° croissant)",
};

export interface ExtractionResult {
  selected: DbRow[];
  /** Customers that pass every rule (may exceed the requested limit). */
  eligibleCount: number;
  totalScanned: number;
  excluded: {
    dejaMED: number; // already sent a mise en demeure (or further in the procedure)
    soldeNul: number; // nothing owed
    horsCriteres: number; // rejected by the user's filters
  };
  montantSelectionne: number;
}

/**
 * Builds the list of customers to send a mise en demeure to this month:
 *   1. never sent a mise en demeure (hard rule, cannot be disabled)
 *   2. something is actually owed (hard rule)
 *   3. every user filter (région, service, solde mini, données complètes…)
 *   4. sorted, then cut to the first `limit`.
 */
export function extractMonthly(
  rows: DbRow[],
  f: FilterState,
  limit: number,
  order: ExtractionOrder,
): ExtractionResult {
  let dejaMED = 0;
  let soldeNul = 0;

  const neverSent: DbRow[] = [];
  for (const r of rows) {
    if (r.nbMed > 0 || r.stade !== "aucune") dejaMED++;
    else neverSent.push(r);
  }
  const owing: DbRow[] = [];
  for (const r of neverSent) {
    if (r.solde > 0) owing.push(r);
    else soldeNul++;
  }
  // The two hard rules are already applied — neutralise their filter counterparts.
  const eligible = applyFilters(owing, { ...f, med: "tous", stade: "", soldeMode: "tous" });
  const horsCriteres = owing.length - eligible.length;

  const sorted = [...eligible];
  if (order === "solde_desc") sorted.sort((a, b) => b.solde - a.solde || a.id.localeCompare(b.id));
  else if (order === "anciennete")
    sorted.sort((a, b) => (a.dateRefISO || "9999").localeCompare(b.dateRefISO || "9999") || a.id.localeCompare(b.id));
  else sorted.sort((a, b) => a.id.localeCompare(b.id));

  const selected = Number.isFinite(limit) && limit >= 0 ? sorted.slice(0, limit) : sorted;
  return {
    selected,
    eligibleCount: eligible.length,
    totalScanned: rows.length,
    excluded: { dejaMED, soldeNul, horsCriteres },
    montantSelectionne: Math.round(selected.reduce((s, r) => s + r.solde, 0) * 100) / 100,
  };
}

/** Distinct, sorted values of one column (for the filter drop-downs). */
export function distinct(rows: DbRow[], pick: (r: DbRow) => string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = pick(r);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Flat rows for CSV export: every field of the record + its legal status. */
export function toExportRows(rows: DbRow[], store: Record<string, StoredJuridique>): Record<string, unknown>[] {
  return rows.map((r) => {
    const j = store[r.key];
    const last = lastMED(j);
    return {
      ...(r.raw as unknown as Record<string, unknown>),
      // computed columns (not in the tables): ignored when a file is re-imported
      ...(r.kind === "entreprise" ? {} : { solde_du_calcule: r.solde }),
      etatJuridique: r.stade,
      nbMisesEnDemeure: r.nbMed,
      derniereMiseEnDemeure: last?.date ?? "",
      numeroDerniereMED: last?.numero ?? "",
    };
  });
}
