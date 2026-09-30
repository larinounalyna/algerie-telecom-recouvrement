import type {
  ApresGaiaBulkResult,
  ApresGaiaRappel,
  CasParticulierInput,
  RappelCheckResult,
  RappelCount,
  RappelStatut,
  ApresGaiaInsert,
  ApresGaiaMedRow,
  ApresGaiaMedUpdate,
  ApresGaiaProfile,
  ApresGaiaReglementRow,
  ApresGaiaRow,
  EtatJuridiqueMed,
  ReglementInsert,
} from "../types";
import { fetchAllPages, request } from "./httpClient";

/** Après Gaïa — read + create règlements + validate/refuse them. The identifier is `apres_gaia.n`. */
export const apresGaiaApi = {
  /** Profile + règlements for one account number `n`. 404 → ApiError.isNotFound. */
  getClientProfile: (n: number | string, signal?: AbortSignal) =>
    request<ApresGaiaProfile>(`/api/apres-gaia/client/${encodeURIComponent(String(n))}`, { signal }),

  /** The whole `apres_gaia` table. */
  listDatabase: (signal?: AbortSignal) => request<ApresGaiaRow[]>("/api/apres-gaia/database", { signal }),

  /** The whole `apres_gaia_regelement` table (paged under the hood). */
  listAllReglements: () =>
    fetchAllPages((skip, limit) => request<ApresGaiaReglementRow[]>("/api/apres-gaia/reglements", { query: { skip, limit } })),

  /** "Encaisser": records one règlement (starts `en_attente`). */
  createReglement: (n: number, body: ReglementInsert) =>
    request<ApresGaiaReglementRow>(`/api/apres-gaia/${n}/reglements`, { method: "POST", body }),

  validerReglement: (ref: number) =>
    request<ApresGaiaReglementRow>(`/api/apres-gaia/reglements/${ref}/valider`, { method: "POST" }),

  refuserReglement: (ref: number) =>
    request<ApresGaiaReglementRow>(`/api/apres-gaia/reglements/${ref}/refuser`, { method: "POST" }),

  /** Supprime UN versement (204). Irréversible — s'il était validé, le solde dû se recalcule sans lui. */
  deleteReglement: (ref: number) => request<void>(`/api/apres-gaia/reglements/${ref}`, { method: "DELETE" }),

  /** Inserts one or many rows into `apres_gaia` (CSV import). */
  createRows: (rows: ApresGaiaInsert[]) =>
    request<ApresGaiaBulkResult>("/api/apres-gaia", { method: "POST", body: rows }),

  /* -------------------------------------------------------------- */
  /* apres_gaia_med — mises en demeure + état juridique, always by n */
  /* -------------------------------------------------------------- */

  /** Statut MED du client n (valeurs par défaut si rien n'a jamais été enregistré). */
  getMed: (n: number | string) => request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med`),

  /** Correction manuelle — seuls les champs envoyés changent. */
  updateMed: (n: number | string, body: ApresGaiaMedUpdate) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med`, { method: "PATCH", body }),

  envoyerInvitationPaiement: (n: number | string, dateEnvoi?: string) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/invitation-paiement/envoyer`, {
      method: "POST",
      body: dateEnvoi ? { date_envoi: dateEnvoi } : undefined,
    }),

  envoyerMedLettre: (n: number | string, dateEnvoi?: string) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/med-lettre/envoyer`, {
      method: "POST",
      body: dateEnvoi ? { date_envoi: dateEnvoi } : undefined,
    }),

  engagerEngagement: (n: number | string, dateEnvoi?: string) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/engagement/engager`, {
      method: "POST",
      body: dateEnvoi ? { date_envoi: dateEnvoi } : undefined,
    }),

  envoyerMedHuissier: (n: number | string, body: { nom?: string; prenom?: string; date_envoi?: string }) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/med-huissier/envoyer`, {
      method: "POST",
      body: Object.keys(body).length ? body : undefined,
    }),

  changeEtatJuridique: (n: number | string, etat: EtatJuridiqueMed) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/etat-juridique`, {
      method: "PUT",
      body: { etat_juridique: etat },
    }),

  /** Enregistre ou modifie le cas particulier (+ commentaire) de l'engagement — un seul PUT pour créer et modifier. */
  setCasParticulier: (n: number | string, body: CasParticulierInput) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/engagement/cas-particulier`, { method: "PUT", body }),

  clearCasParticulier: (n: number | string) =>
    request<ApresGaiaMedRow>(`/api/apres-gaia/${n}/med/engagement/cas-particulier`, { method: "DELETE" }),

  /** Les 6 valeurs autorisées, pour la liste déroulante. */
  listEtatsJuridiques: () => request<EtatJuridiqueMed[]>("/api/apres-gaia/med/etats-juridiques"),

  /* -------------------------------------------------------------- */
  /* apres_gaia_rappel — clients engagés sans versement depuis 1 mois */
  /* -------------------------------------------------------------- */

  listRappels: (query: { n?: number; statut?: RappelStatut; actifs?: boolean; limit?: number } = {}) =>
    request<ApresGaiaRappel[]>("/api/apres-gaia/rappels", { query }),

  countRappels: () => request<RappelCount>("/api/apres-gaia/rappels/count"),

  /** Lance le contrôle maintenant (le même que le contrôle quotidien automatique). */
  verifierRappels: () => request<RappelCheckResult>("/api/apres-gaia/rappels/verifier", { method: "POST" }),

  marquerRappelLu: (id: number) => request<ApresGaiaRappel>(`/api/apres-gaia/rappels/${id}/lu`, { method: "POST" }),

  /** « Tout marquer comme lu » — le backend renvoie `{ deleted: <nb> }` (nom de champ hérité de DeletedCount). */
  marquerTousRappelsLus: () => request<{ deleted: number }>("/api/apres-gaia/rappels/lu", { method: "POST" }),
};
