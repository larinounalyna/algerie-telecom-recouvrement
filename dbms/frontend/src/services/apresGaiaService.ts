import { ApiError, apresGaiaApi } from "../api";
import type {
  ApresGaiaInsert,
  ApresGaiaMedRow,
  ApresGaiaProfile,
  ApresGaiaReglementRow,
  ApresGaiaRow,
  DebtorView,
  EtatJuridiqueMed,
  PaymentTranche,
} from "../types";
import { isoDay, txt } from "../shared/lib/format";
import { computeApresSoldes } from "./accounting";

/* ------------------------------------------------------------------ */
/*  Search by n (N° compte)                                            */
/* ------------------------------------------------------------------ */

/**
 * Values shown by the Après Gaïa search form. The form keeps its original
 * columns; a column that has no counterpart in `apres_gaia` stays blank.
 */
export interface ApresGaiaFormValues {
  numCompte: string;
  numClient: string;
  statut: string;
  nom: string;
  prenom: string;
  adresse: string;
  wilaya: string;
  commune: string;
  codePostal: string;
  telephoneFixe: string;
  gsm: string;
  email: string;
  typeService: string;
  debit: string;
  motifRes: string;
}

export const EMPTY_APRES_FORM: ApresGaiaFormValues = {
  numCompte: "",
  numClient: "",
  statut: "",
  nom: "",
  prenom: "",
  adresse: "",
  wilaya: "",
  commune: "",
  codePostal: "",
  telephoneFixe: "",
  gsm: "",
  email: "",
  typeService: "",
  debit: "",
  motifRes: "",
};

/** Column mapping: form field ← apres_gaia column (blank when none exists). */
export function toApresFormValues(p: ApresGaiaProfile): ApresGaiaFormValues {
  const i = p.informations_client;
  return {
    numCompte: txt(i.n),
    numClient: txt(i.n_client),
    statut: "", // no text status column (codetat is a raw code, see the Base de données)
    nom: txt(i.intitule), // apres_gaia has a single name column: intitule
    prenom: "", // no column
    adresse: txt(i.adresse),
    wilaya: "", // no column
    commune: txt(i.commune),
    codePostal: txt(i.code_postal),
    telephoneFixe: txt(i.n_appel), // N° d'appel = the line's phone number
    gsm: "", // no column
    email: "", // no column
    typeService: "", // no column
    debit: "", // no column
    motifRes: txt(i.motif_res),
  };
}

/** Account numbers are integers: anything else can't exist, no need to ask the server. */
export const isValidAccountNumber = (raw: string) => /^\d+$/.test(raw.trim());

/** 404 (unknown n) is an expected outcome → `null`, any other failure is thrown. */
export async function findApresGaiaClient(n: string, signal?: AbortSignal): Promise<ApresGaiaProfile | null> {
  if (!isValidAccountNumber(n)) return null;
  try {
    return await apresGaiaApi.getClientProfile(n.trim(), signal);
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null;
    throw e;
  }
}

const toTranche = (g: ApresGaiaReglementRow): PaymentTranche => ({
  id: String(g.ref),
  montant: g.somme_versement ?? 0,
  date: g.date_versement ?? isoDay(g.created_at),
  lieu: g.lieu_versement ?? undefined,
  statut: g.statut,
  valide: g.statut === "valide",
});

/** The table default (no row yet) — mirrors the backend's own default, see backend/app/schemas.py ApresGaiaMedOut. */
export function defaultMed(n: number | string): ApresGaiaMedRow {
  return {
    id: null,
    n: Number(n),
    invitation_paiement_date: null,
    invitation_paiement_etat: "NON_ENVOYEE",
    med_lettre_date: null,
    med_lettre_etat: "NON_ENVOYEE",
    engagement_date: null,
    engagement_etat: "NON_ENGAGE",
    cas_particulier: null,
    cas_particulier_date: null,
    cas_particulier_commentaire: null,
    med_huissier_nom: null,
    med_huissier_prenom: null,
    med_huissier_date: null,
    med_huissier_etat: "NON_ENVOYEE",
    etat_juridique: "Procédure en cours",
    created_at: null,
    updated_at: null,
  };
}

/** Adapts an apres_gaia profile to the shape shared by the detail / facture / mise en demeure screens. */
export function apresProfileToDebtor(p: ApresGaiaProfile): DebtorView {
  const i = p.informations_client;
  return {
    kind: "apres",
    id: txt(i.n),
    med: p.med ?? defaultMed(i.n ?? 0),
    rappel: p.rappel_actif ?? null,
    idLabel: "N° Compte",
    nom: txt(i.intitule),
    prenom: "",
    adresse: txt(i.adresse),
    commune: txt(i.commune),
    wilaya: "",
    telephone: txt(i.n_appel),
    typeService: "",
    montantTotal: p.details_facturation.montant_ttc ?? 0,
    solde: p.solde_du,
    // oldest first — the screens reverse it to show the latest payment on top
    historique: p.reglements_historique.map(toTranche).sort((a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id)),
    dateRef: "",
    dateRefLabel: "Date de création",
  };
}

/* ------------------------------------------------------------------ */
/*  Règlements: Encaisser / Valider / Refuser                          */
/* ------------------------------------------------------------------ */

export interface NewReglement {
  montant: number;
  lieu?: string;
  /** yyyy-mm-dd, defaults to today on the server side when omitted. */
  date?: string;
}

export const recordReglement = (n: number | string, r: NewReglement) =>
  apresGaiaApi.createReglement(Number(n), {
    somme_versement: r.montant,
    date_versement: r.date,
    lieu_versement: r.lieu?.trim() || undefined,
  });

export const validateReglement = (ref: number | string) => apresGaiaApi.validerReglement(Number(ref));
export const refuseReglement = (ref: number | string) => apresGaiaApi.refuserReglement(Number(ref));
export const deleteReglement = (ref: number | string) => apresGaiaApi.deleteReglement(Number(ref));

/** Sum of the règlements still awaiting validation (they don't reduce `solde_du` yet). */
export const pendingTotal = (historique: PaymentTranche[]) =>
  Math.round(historique.filter((t) => t.statut === "en_attente").reduce((s, t) => s + t.montant, 0) * 100) / 100;

/* ------------------------------------------------------------------ */
/*  apres_gaia_med — mises en demeure + état juridique                 */
/* ------------------------------------------------------------------ */

export const envoyerInvitationPaiement = (n: number | string, dateEnvoi?: string) =>
  apresGaiaApi.envoyerInvitationPaiement(n, dateEnvoi);

export const envoyerMedLettre = (n: number | string, dateEnvoi?: string) =>
  apresGaiaApi.envoyerMedLettre(n, dateEnvoi);

export const engagerEngagement = (n: number | string, dateEnvoi?: string) =>
  apresGaiaApi.engagerEngagement(n, dateEnvoi);

export const envoyerMedHuissier = (n: number | string, nom?: string, prenom?: string, dateEnvoi?: string) =>
  apresGaiaApi.envoyerMedHuissier(n, { nom: nom?.trim() || undefined, prenom: prenom?.trim() || undefined, date_envoi: dateEnvoi });

export const changeEtatJuridique = (n: number | string, etat: EtatJuridiqueMed) =>
  apresGaiaApi.changeEtatJuridique(n, etat);

export const listEtatsJuridiques = () => apresGaiaApi.listEtatsJuridiques();

/** Cas particulier + commentaire de l'engagement (`label` obligatoire, le reste facultatif). */
export const setCasParticulier = (n: number | string, input: { label: string; commentaire?: string; date?: string }) =>
  apresGaiaApi.setCasParticulier(n, {
    label: input.label.trim(),
    commentaire: input.commentaire?.trim() || undefined,
    cas_particulier_date: input.date,
  });

export const clearCasParticulier = (n: number | string) => apresGaiaApi.clearCasParticulier(n);

/** Correction manuelle (dates, remise à NON_ENVOYEE...). */
export const updateMed = (n: number | string, patch: Parameters<typeof apresGaiaApi.updateMed>[1]) =>
  apresGaiaApi.updateMed(n, patch);

/* ------------------------------------------------------------------ */
/*  Rappels de versement (engagé sans versement depuis un mois)        */
/* ------------------------------------------------------------------ */

export const listRappelsActifs = () => apresGaiaApi.listRappels({ actifs: true, limit: 200 });
export const countRappels = () => apresGaiaApi.countRappels();
export const verifierRappels = () => apresGaiaApi.verifierRappels();
export const marquerRappelLu = (id: number) => apresGaiaApi.marquerRappelLu(id);
export const marquerTousRappelsLus = () => apresGaiaApi.marquerTousRappelsLus();

/* ------------------------------------------------------------------ */
/*  "Base de données" screen + CSV import                              */
/* ------------------------------------------------------------------ */

export interface ApresGaiaDatabase {
  rows: ApresGaiaRow[];
  reglements: ApresGaiaReglementRow[];
  /** n → solde dû (computed, see services/accounting.ts). */
  soldes: Map<number, number>;
}

export async function loadApresGaiaDatabase(): Promise<ApresGaiaDatabase> {
  const [rows, reglements] = await Promise.all([apresGaiaApi.listDatabase(), apresGaiaApi.listAllReglements()]);
  return { rows, reglements, soldes: computeApresSoldes(rows, reglements) };
}

/** Inserts rows in `apres_gaia` (in chunks, a CSV can hold thousands of lines); returns how many were created. */
export async function insertApresGaiaRows(rows: ApresGaiaInsert[], chunkSize = 2000): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    try {
      inserted += (await apresGaiaApi.createRows(rows.slice(i, i + chunkSize))).inserted;
    } catch (e) {
      const reason = e instanceof Error ? e.message : "erreur inconnue";
      throw new Error(`${inserted.toLocaleString("fr-FR")} ligne(s) insérée(s) avant l'échec : ${reason}`);
    }
  }
  return inserted;
}
