import { ApiError, avantGaiaApi } from "../api";
import type {
  AvantGaiaProfile,
  AvantGaiaRow,
  AvantGaiaVersementRow,
  ConsommationEntry,
  DebtorView,
  PaymentTranche,
} from "../types";
import { isoDay, txt } from "../shared/lib/format";
import { computeAvantSoldes, round2 } from "./accounting";

/* ------------------------------------------------------------------ */
/*  Search by N° abonné                                                */
/* ------------------------------------------------------------------ */

/**
 * Values shown by the Avant Gaïa search form. The form keeps its original
 * columns; a column that has no counterpart in `avant_gaia` stays blank.
 */
export interface AvantGaiaFormValues {
  numAbonne: string;
  nom: string;
  prenom: string;
  adresse: string;
  wilaya: string;
  commune: string;
  telephone: string;
  typeService: string;
  groupement: string;
  codePayeur: string;
  ccp: string;
  bimestre: string;
  ancienIndex: string;
  nouvelIndex: string;
  consommation: string;
}

export const EMPTY_AVANT_FORM: AvantGaiaFormValues = {
  numAbonne: "",
  nom: "",
  prenom: "",
  adresse: "",
  wilaya: "",
  commune: "",
  telephone: "",
  typeService: "",
  groupement: "",
  codePayeur: "",
  ccp: "",
  bimestre: "",
  ancienIndex: "",
  nouvelIndex: "",
  consommation: "",
};

/** Column mapping: form field ← avant_gaia column (blank when none exists). */
export function toAvantFormValues(p: AvantGaiaProfile): AvantGaiaFormValues {
  const i = p.informations_client;
  const latest = p.consommation_historique[0]; // most recent bimestre first
  return {
    numAbonne: txt(i.n_abonne),
    nom: txt(i.intitule), // avant_gaia has a single name column: intitule
    prenom: "", // no column
    adresse: [i.adresse_01, i.adresse_02].filter(Boolean).join(", "),
    wilaya: "", // no column
    commune: "", // no column
    telephone: "", // no column
    typeService: "", // no column
    groupement: txt(i.actel), // closest existing column
    codePayeur: txt(i.code_payeur),
    ccp: txt(i.n_ccp),
    bimestre: txt(i.bimestre),
    ancienIndex: txt(latest?.ancien_index), // derived by the backend from the previous bimestre
    nouvelIndex: txt(i.nouveau_index),
    consommation: txt(latest?.consommation),
  };
}

/** 404 (unknown N° abonné) is an expected outcome → `null`, any other failure is thrown. */
export async function findAvantGaiaClient(nAbonne: string, signal?: AbortSignal): Promise<AvantGaiaProfile | null> {
  const id = nAbonne.trim();
  if (!id) return null;
  try {
    return await avantGaiaApi.getClientProfile(id, signal);
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null;
    throw e;
  }
}

/** Adapts an avant_gaia profile to the shape shared by the detail / facture / mise en demeure screens. */
export function avantProfileToDebtor(p: AvantGaiaProfile): DebtorView {
  const i = p.informations_client;

  // avant_gaia_versement has no status and no agent: each row is a payment that took place.
  const historique: PaymentTranche[] = p.versements_historique
    .map((v) => ({ id: String(v.ref), montant: v.montant_versement ?? 0, date: isoDay(v.created_at), valide: true }))
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id));

  const consommationHistorique: ConsommationEntry[] = p.consommation_historique.map((c) => ({
    id: String(c.ref),
    bimestre: c.bimestre,
    ancienIndex: txt(c.ancien_index),
    nouvelIndex: txt(c.nouveau_index),
    consommation: c.consommation,
    date: "",
  }));

  const verse = historique.reduce((s, t) => s + t.montant, 0);
  return {
    kind: "avant",
    id: txt(i.n_abonne),
    idLabel: "N° Abonné",
    nom: txt(i.intitule),
    prenom: "",
    adresse: [i.adresse_01, i.adresse_02].filter(Boolean).join(", "),
    commune: "",
    wilaya: "",
    telephone: "",
    typeService: "",
    montantTotal: round2(p.solde_du + verse), // total billed = still due + already paid
    solde: p.solde_du,
    historique,
    consommationHistorique,
    dateRef: txt(i.bimestre),
    dateRefLabel: "Bimestre",
  };
}

/* ------------------------------------------------------------------ */
/*  "Base de données" screen                                           */
/* ------------------------------------------------------------------ */

export interface AvantGaiaDatabase {
  rows: AvantGaiaRow[];
  versements: AvantGaiaVersementRow[];
  /** n_abonne → solde dû (computed, see services/accounting.ts). */
  soldes: Map<string, number>;
}

export async function loadAvantGaiaDatabase(): Promise<AvantGaiaDatabase> {
  const [rows, versements] = await Promise.all([avantGaiaApi.listDatabase(), avantGaiaApi.listAllVersements()]);
  return { rows, versements, soldes: computeAvantSoldes(rows, versements) };
}
