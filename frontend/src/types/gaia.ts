// Types of the two REAL database tables pairs (PostgreSQL) and of the
// aggregated payloads served by the FastAPI backend.
//
// Attribute names are the EXACT column names of the tables
//   avant_gaia, avant_gaia_versement, apres_gaia, apres_gaia_regelement
// (see backend/sql/*.sql). The backend serialises NULL as `null`.

/* ------------------------------------------------------------------ */
/*  avant_gaia  /  avant_gaia_versement   (read-only)                  */
/* ------------------------------------------------------------------ */

/** One row of `avant_gaia` = one bimestral billing snapshot of one subscriber. */
export interface AvantGaiaRow {
  ref: number;
  actel: string | null;
  n_abonne: string | null;
  intitule: string | null;
  adresse_01: string | null;
  adresse_02: string | null;
  dnpf: number | null;
  type_de_compte: number | null;
  abonnement: number | null;
  dus_anterieur: number | null; // SQL column "dus Anterieur"
  montant_compteur: number | null;
  nombre_ticket: number | null;
  montant_ticket: number | null;
  credit: number | null;
  code_payeur: number | null;
  n_ccp: number | null;
  somme_ht: number | null;
  ttc: number | null;
  tva: number | null;
  nouveau_index: number | null;
  avoir: number | null;
  n_bimestre: number | null;
  annee_bimestre: number | null;
  n_s_t: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** One row of `avant_gaia_versement`. */
export interface AvantGaiaVersementRow {
  ref: number;
  actel: string | null;
  n_abonne: string | null;
  montant_versement: number | null;
  n_bimestre: number | null;
  annee_bimestre: number | null;
  n_versement: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** GET /api/avant-gaia/client/{n_abonne} */
export interface AvantGaiaProfile {
  informations_client: {
    n_abonne: string | null;
    intitule: string | null;
    adresse_01: string | null;
    adresse_02: string | null;
    actel: string | null;
    code_payeur: number | null;
    n_ccp: number | null;
    type_de_compte: number | null;
    dnpf: number | null;
    bimestre: string | null; // "n_bimestre/annee_bimestre"
    nouveau_index: number | null;
  };
  details_facturation: {
    abonnement: number | null;
    montant_compteur: number | null;
    dus_anterieur: number | null;
    nombre_ticket: number | null;
    montant_ticket: number | null;
    credit: number | null;
    somme_ht: number | null;
    tva: number | null;
    ttc: number | null;
    avoir: number | null;
  };
  consommation_historique: {
    ref: number;
    bimestre: string;
    n_bimestre: number | null;
    annee_bimestre: number | null;
    ancien_index: number | null;
    nouveau_index: number | null;
    consommation: number | null;
  }[];
  versements_historique: AvantGaiaVersementRow[];
  solde_du: number;
  solde_du_note: string;
}

/* ------------------------------------------------------------------ */
/*  apres_gaia  /  apres_gaia_regelement                               */
/* ------------------------------------------------------------------ */

/** One row of `apres_gaia` = one résilié account. Dates are "yyyy-mm-dd". */
export interface ApresGaiaRow {
  n: number;
  codetat: number | null;
  codsit: number | null;
  cg: number | null;
  n_appel: string | null;
  intitule: string | null;
  adresse: string | null;
  code_postal: number | null;
  type_de_compte: number | null;
  abonnement: number | null;
  dus_ant: number | null;
  montant_compteur: number | null;
  nbre_ticket: number | null;
  ticket: number | null;
  credit: number | null;
  code_payeur: number | null;
  ccp: number | null;
  date_vigueur_abt: string | null;
  date_derniere_modif: string | null;
  cod_cpt: number | null;
  nouvel_index: number | null;
  ancien_index: number | null;
  date_rnp: string | null;
  dnpf: string | null;
  repere: string | null;
  actel: string | null;
  n_client: number | null;
  commune: string | null;
  bat: string | null;
  esc: string | null;
  etage: string | null;
  porte: string | null;
  ccat: number | null;
  ndos: number | null;
  nvdi: string | null;
  motif_res: string | null; // SQL column "motif res"
  created_at: string | null;
  updated_at: string | null;
}

/** Body of POST /api/apres-gaia (server-generated columns excluded). */
export type ApresGaiaInsert = Partial<Omit<ApresGaiaRow, "n" | "created_at" | "updated_at">>;

export type ReglementStatut = "en_attente" | "valide" | "refuse";

/** One row of `apres_gaia_regelement` (`statut` is the workflow column). */
export interface ApresGaiaReglementRow {
  ref: number;
  n: number;
  somme_versement: number | null;
  date_versement: string | null;
  lieu_versement: string | null;
  statut: ReglementStatut;
  created_at: string | null;
  updated_at: string | null;
}

/** Body of POST /api/apres-gaia/{n}/reglements */
export interface ReglementInsert {
  somme_versement: number;
  date_versement?: string;
  lieu_versement?: string;
}

/** GET /api/apres-gaia/client/{n} */
export interface ApresGaiaProfile {
  informations_client: {
    n: number | null;
    n_client: number | null;
    n_appel: string | null;
    intitule: string | null;
    adresse: string | null;
    commune: string | null;
    code_postal: number | null;
    codetat: number | null;
    motif_res: string | null;
    type_de_compte: number | null;
  };
  details_facturation: {
    montant_ttc: number | null;
    tva: number | null;
    montant_ht: number | null;
    montant_ttc_note: string;
  };
  reglements_historique: ApresGaiaReglementRow[];
  /** État MED / juridique du client (table apres_gaia_med) — présent même si aucune ligne n'a encore été créée. */
  med?: ApresGaiaMedRow;
  /** Rappel « engagé sans versement depuis un mois » en cours (null s'il n'y en a pas). */
  rappel_actif?: ApresGaiaRappel | null;
  solde_du: number;
  solde_du_note: string;
}

export interface ApresGaiaBulkResult {
  inserted: number;
  rows: ApresGaiaRow[];
}

/* ------------------------------------------------------------------ */
/*  apres_gaia_med — mises en demeure + état juridique                 */
/* ------------------------------------------------------------------ */

/** Used by invitation_paiement_etat, med_lettre_etat, med_huissier_etat. */
export type EnvoiEtat = "ENVOYEE" | "NON_ENVOYEE";

export type EngagementEtatMed = "ENGAGE" | "NON_ENGAGE";

/** The 6 values allowed by chk_etat_juridique (sql/006_schema_apres_gaia_med.sql). */
export type EtatJuridiqueMed =
  | "Procédure en cours"
  | "Entreprise gagnante – première décision"
  | "Client gagnant – première décision"
  | "Entreprise gagnante – après recours"
  | "Client gagnant – après recours"
  | "Dossier clôturé";

/** One row of `apres_gaia_med` — GET /api/apres-gaia/{n}/med (`id: null` when nothing was ever recorded). */
export interface ApresGaiaMedRow {
  id: number | null;
  n: number;
  invitation_paiement_date: string | null;
  invitation_paiement_etat: EnvoiEtat;
  med_lettre_date: string | null;
  med_lettre_etat: EnvoiEtat;
  engagement_date: string | null;
  engagement_etat: EngagementEtatMed;
  /** Cas particulier lié à l'engagement (situation sociale/médicale, échéancier hors barème…) + commentaire libre. */
  cas_particulier: string | null;
  cas_particulier_date: string | null;
  cas_particulier_commentaire: string | null;
  med_huissier_nom: string | null;
  med_huissier_prenom: string | null;
  med_huissier_date: string | null;
  med_huissier_etat: EnvoiEtat;
  etat_juridique: EtatJuridiqueMed;
  created_at: string | null;
  updated_at: string | null;
}

/** Body of PATCH /api/apres-gaia/{n}/med — correction manuelle, tout est optionnel. */
export type ApresGaiaMedUpdate = Partial<
  Omit<ApresGaiaMedRow, "id" | "n" | "created_at" | "updated_at">
>;

/** Body of PUT /api/apres-gaia/{n}/med/engagement/cas-particulier */
export interface CasParticulierInput {
  label: string;
  commentaire?: string;
  /** yyyy-mm-dd, défaut côté serveur : aujourd'hui. */
  cas_particulier_date?: string;
}

/* ------------------------------------------------------------------ */
/*  apres_gaia_rappel — client ENGAGÉ sans versement depuis un mois    */
/* ------------------------------------------------------------------ */

/** nouveau = jamais ouvert · lu = vu · resolu = plus d'actualité (versement fait, plus engagé, remplacé…). */
export type RappelStatut = "nouveau" | "lu" | "resolu";

/** One row of `apres_gaia_rappel` (created automatically by the backend, never by hand). */
export interface ApresGaiaRappel {
  id: number;
  n: number;
  type: string;
  reference_date: string;
  /** D'où part le décompte : la date d'engagement ou le dernier versement. */
  reference_source: "engagement" | "versement";
  echeance_date: string;
  mois_impayes: number;
  jours_ecoules: number;
  solde_du: number | null;
  message: string;
  statut: RappelStatut;
  created_at: string | null;
  read_at: string | null;
  resolved_at: string | null;
}

/** GET /api/apres-gaia/rappels/count — `non_lus` = pastille de la cloche. */
export interface RappelCount {
  non_lus: number;
  actifs: number;
}

/** POST /api/apres-gaia/rappels/verifier */
export interface RappelCheckResult {
  clients_engages_controles: number;
  crees: ApresGaiaRappel[];
  resolus: ApresGaiaRappel[];
}
