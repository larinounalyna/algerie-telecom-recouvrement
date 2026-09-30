// Central domain types. Keeping these in one place (instead of scattered
// across components) makes the data model explicit and lets every
// component/hook import from a single source of truth.

export * from "./gaia";
import type { ApresGaiaMedRow, ApresGaiaRappel, ReglementStatut } from "./gaia";

export interface PaymentTranche {
  id: string;
  montant: number;
  date: string; // ISO date string (yyyy-mm-dd)
  agent?: string; // Entreprises (mock) only — no such column in the real tables
  lieu?: string; // apres_gaia_regelement.lieu_versement
  valide?: boolean; // once validated, the tranche's document becomes a Reçu instead of a Facture
  /**
   * Workflow status (apres_gaia_regelement.statut). `undefined` when the
   * source table has no status column (avant_gaia_versement, mock data).
   */
  statut?: ReglementStatut;
}

/**
 * One bimestral (2-month) meter-reading / consumption entry, as printed on
 * the "ETAT BIMESTRIEL D'UN ABONNE" Avant Gaïa screen (ANC.IND / NOUV.IND /
 * CONS per BIMESTRE).
 */
export interface ConsommationEntry {
  id: string;
  bimestre: string; // e.g. "02/2024"
  ancienIndex: string; // ANC.IND
  nouvelIndex: string; // NOUV.IND
  consommation: number | null; // NOUV.IND - ANC.IND (null when unknown)
  date: string; // ISO date the reading was recorded
}

/**
 * LEGACY account shape (French camelCase export columns). It is no longer
 * used by Avant / Après Gaïa — those now use the real table types in
 * ./gaia.ts — and only serves as the base of `EntrepriseClient`, whose data
 * is still local (no backend table for companies yet).
 *
 * Originally mirrored the column export used by the résiliés
 * extraction (N°, CODETAT, CODSIT, CG, N° d'Appel, Intitulé, Adresse,
 * Code postal, Type de compte, Abonnement, Dus Ant, Compteur, Nbre Ticket,
 * Ticket, Credit, code payeur, CCP, Date vigueur Abt, Date derniere Modif,
 * CODCPT, Nouvel Index, Ancien Index, Date RNP, DNPF, REPERE, Actel,
 * N° Client, Commune, BAT, ESC, Etage, Porte, CCAT, NDOS, INVOIE,
 * MOTIF RES).
 */
export interface LegacyAccountClient {
  numCompte: string;
  codeClient: string;
  numClient: string; // N° Client
  numAppel: string; // N° d'Appel
  codetat: string; // CODETAT
  codsit: string; // CODSIT
  cg: string; // CG
  intitule: string; // Intitulé
  nom: string;
  prenom: string;
  adresse: string;
  commune: string;
  wilaya: string;
  codePostal: string;
  telephoneFixe: string;
  gsm: string;
  email: string;
  typeService: string;
  typeCompte: string; // Type de compte
  debit: string;
  commentaire?: string;
  abonnement: number; // Abonnement
  dusAnterieurs: number; // Dus Ant
  compteur: string; // Compteur
  nbreTicket: number; // Nbre Ticket
  ticket: number; // Ticket
  credit: number; // Credit
  codePayeur: string; // code payeur
  ccp: string; // CCP
  dateVigueurAbt: string; // Date vigueur Abt
  dateDerniereModif: string; // Date derniere Modif
  codcpt: string; // CODCPT
  nouvelIndex: string; // Nouvel Index
  ancienIndex: string; // Ancien Index
  dateRNP: string; // Date RNP
  dnpf: string; // DNPF
  repere: string; // REPERE
  actel: string; // Actel
  bat: string; // BAT
  esc: string; // ESC
  etage: string; // Etage
  porte: string; // Porte
  ccat: string; // CCAT
  ndos: string; // NDOS
  invoie: string; // INVOIE
  motifRes: string; // MOTIF RES
  dateResiliation?: string;
  montantHT: number;
  tva: number;
  montantTTC: number;
  versements: number; // total des versements déjà encaissés
  solde: number;
  dateCreation: string;
  statut: string;
  historique?: PaymentTranche[]; // historique des versements
}

/**
 * Normalized "debtor" shape used by the client detail / tranche-payment /
 * mise-en-demeure UI, so that this UI does not need to know whether the
 * underlying record comes from avant_gaia, apres_gaia or the Entreprises data.
 */
export interface DebtorView {
  id: string;
  idLabel: string;
  nom: string;
  prenom: string;
  adresse: string;
  commune: string;
  wilaya: string;
  telephone: string;
  typeService: string;
  montantTotal: number;
  solde: number;
  historique: PaymentTranche[];
  consommationHistorique?: ConsommationEntry[];
  dateRef: string;
  dateRefLabel: string;
  /** Which database this debtor belongs to (used to key the état juridique). */
  kind: DbKind;
  /** Present only for kind === "apres" — état MED / juridique (table apres_gaia_med). */
  med?: ApresGaiaMedRow;
  /** Present only for kind === "apres" — rappel de versement en cours (client engagé sans versement depuis un mois). */
  rappel?: ApresGaiaRappel | null;
  /** Present only for corporate customers. */
  entreprise?: {
    formeJuridique: string;
    nif: string;
    rc: string;
    representant: string;
    fonctionRepresentant: string;
  };
}

export interface AccentTheme {
  bg: string;
  hover: string;
  light: string;
  hoverLight: string;
  border: string;
  text: string;
  filled: string;
  /** Soft highlighted card (border + background) */
  card: string;
  /** Text colours used inside `card` */
  cardLabel: string;
  cardValue: string;
  /** Border colour of a focused, empty input */
  focusBorder: string;
  /** Small pill / badge */
  badge: string;
  /** Selected tab / active chip */
  tabActive: string;
}

/* ------------------------------------------------------------------ */
/*  Entreprises — same account model as Après Gaïa, but the customer   */
/*  is a company (raison sociale, NIF, RC, représentant légal…).       */
/*  `nom` holds the raison sociale so every generic screen (search,    */
/*  facture, mise en demeure) keeps working unchanged.                 */
/* ------------------------------------------------------------------ */
export interface EntrepriseClient extends LegacyAccountClient {
  raisonSociale: string;
  formeJuridique: string; // SARL, EURL, SPA, SNC, EPE, EPIC…
  nif: string; // Numéro d'identification fiscale
  rc: string; // Registre de commerce
  nis: string; // Numéro d'identification statistique
  secteur: string; // Secteur d'activité
  representant: string; // Représentant légal (gérant, DG…)
  fonctionRepresentant: string;
}

/** The three customer databases the application manages. */
export type DbKind = "avant" | "apres" | "entreprise";

/* ------------------------------------------------------------------ */
/*  État juridique                                                     */
/* ------------------------------------------------------------------ */
export type StadeJuridique =
  | "aucune"
  | "med_envoyee"
  | "med_notifiee"
  | "contentieux"
  | "jugement"
  | "execution"
  | "cloture";

export type CanalMED = "Courrier" | "Huissier" | "Extraction mensuelle";

export interface MiseEnDemeureRecord {
  numero: string;
  date: string; // ISO yyyy-mm-dd
  canal: CanalMED;
  lot?: string; // batch id when sent through the monthly extraction
}

export interface JuridiqueEvent {
  id: string;
  date: string; // ISO
  label: string;
  note?: string;
}

export interface EtatJuridique {
  stade: StadeJuridique;
  mises: MiseEnDemeureRecord[];
  evenements: JuridiqueEvent[];
  numDossier: string;
  tribunal: string;
  huissier: string;
  avocat: string;
  dateAudience: string; // ISO
  montantReclame: number;
  fraisJustice: number;
  observations: string;
}

/* ------------------------------------------------------------------ */
/*  Facture / Reçu — the printable document shown by FactureModal.     */
/*  Lives here (not inside the component file) so any lib/feature can  */
/*  reference the shape without importing a component.                 */
/* ------------------------------------------------------------------ */
export interface FactureData {
  numFacture: string;
  dbLabel: string;
  billType: "partielle" | "globale";
  /** true once the underlying tranche has been "validée" — the document then
   * becomes a Reçu de Paiement instead of a Facture. */
  isReceipt?: boolean;
  numIdentifiant: string;
  identifiantLabel: string;
  nom: string;
  prenom: string;
  adresse: string;
  commune: string;
  wilaya: string;
  telephone: string;
  typeService: string;
  debit?: string;
  montantDu: number;
  montantVerse: number;
  reste: number;
  periode: string;
  datePaiement: string;
  agent: string;
  // Facturation block (N° Client / N° Abonnement / Date de résiliation / HT / TVA / TTC)
  numClient?: string;
  dateResiliation?: string;
  montantHT?: number;
  tvaRate?: number;
  /** TVA as an amount (real tables). Takes precedence over `tvaRate`. */
  tvaAmount?: number;
  montantTTC?: number;
  direction?: string;
  service?: string;
  actel?: string;
  extraFields?: { label: string; value: string }[];
}
