from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import EngagementEtat, EnvoiEtat, EtatJuridique, RappelStatut, VersementStatut


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------- #
#  avant_gaia — raw table access                                        #
# --------------------------------------------------------------------- #
class AvantGaiaBase(BaseModel):
    actel: Optional[str] = None
    n_abonne: Optional[str] = None
    intitule: Optional[str] = None
    adresse_01: Optional[str] = None
    adresse_02: Optional[str] = None
    dnpf: Optional[int] = None
    type_de_compte: Optional[int] = None
    abonnement: Optional[float] = None
    dus_anterieur: Optional[float] = None
    montant_compteur: Optional[float] = None
    nombre_ticket: Optional[int] = None
    montant_ticket: Optional[float] = None
    credit: Optional[float] = None
    code_payeur: Optional[int] = None
    n_ccp: Optional[int] = None
    somme_ht: Optional[float] = None
    ttc: Optional[float] = None
    tva: Optional[float] = None
    nouveau_index: Optional[int] = None
    avoir: Optional[float] = None
    n_bimestre: Optional[int] = None
    annee_bimestre: Optional[int] = None
    n_s_t: Optional[int] = None


class AvantGaiaOut(AvantGaiaBase, ORMBase):
    ref: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --------------------------------------------------------------------- #
#  avant_gaia_versement — READ ONLY (no create/valider here anymore —   #
#  that workflow moved to apres_gaia_regelement, see README)            #
# --------------------------------------------------------------------- #
class AvantGaiaVersementBase(BaseModel):
    actel: Optional[str] = None
    n_abonne: Optional[str] = None
    montant_versement: Optional[float] = None
    n_bimestre: Optional[int] = None
    annee_bimestre: Optional[int] = None
    n_versement: Optional[int] = None


class AvantGaiaVersementOut(AvantGaiaVersementBase, ORMBase):
    ref: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --------------------------------------------------------------------- #
#  Aggregated "recherche par N° Abonné" — mirrors the screenshot         #
# --------------------------------------------------------------------- #
class InformationsClient(BaseModel):
    """Fields that DO exist in your real schema. Nom/Prénom (separate),
    Wilaya, Commune, Téléphone, Type de service and Groupement from the
    mockup have NO backing column in avant_gaia — see backend/README.md."""

    n_abonne: Optional[str] = None
    intitule: Optional[str] = None  # combined name/label, as stored
    adresse_01: Optional[str] = None
    adresse_02: Optional[str] = None
    actel: Optional[str] = None  # closest existing analogue to "Groupement"
    code_payeur: Optional[int] = None
    n_ccp: Optional[int] = None
    type_de_compte: Optional[int] = None  # raw code — no lookup table given
    dnpf: Optional[int] = None
    bimestre: Optional[str] = None  # "n_bimestre/annee_bimestre", e.g. "2/2024"
    nouveau_index: Optional[int] = None


class DetailsFacturation(BaseModel):
    abonnement: Optional[float] = None
    montant_compteur: Optional[float] = None
    dus_anterieur: Optional[float] = None
    nombre_ticket: Optional[int] = None
    montant_ticket: Optional[float] = None
    credit: Optional[float] = None
    somme_ht: Optional[float] = None
    tva: Optional[float] = None
    ttc: Optional[float] = None
    avoir: Optional[float] = None


class ConsommationHistoryItem(BaseModel):
    ref: int
    bimestre: str  # "n_bimestre/annee_bimestre"
    n_bimestre: Optional[int] = None
    annee_bimestre: Optional[int] = None
    ancien_index: Optional[int] = None  # derived: previous row's nouveau_index
    nouveau_index: Optional[int] = None
    consommation: Optional[int] = None  # derived: nouveau_index - ancien_index


class AvantGaiaProfile(BaseModel):
    """Response for GET /api/avant-gaia/client/{n_abonne}."""

    informations_client: InformationsClient
    details_facturation: DetailsFacturation
    consommation_historique: list[ConsommationHistoryItem]
    versements_historique: list[AvantGaiaVersementOut]
    solde_du: float
    solde_du_note: str = (
        "Calculé (somme des TTC de tous les bimestres moins la somme de "
        "tous les versements enregistrés dans avant_gaia_versement — plus "
        "de notion de validation ici, ce workflow vit maintenant côté "
        "Après Gaïa) — aucune colonne de solde n'existe dans le schéma "
        "fourni. Confirmez que cette formule correspond à votre règle "
        "métier."
    )


# --------------------------------------------------------------------- #
#  apres_gaia — raw table access                                        #
# --------------------------------------------------------------------- #
class ApresGaiaBase(BaseModel):
    codetat: Optional[int] = None
    codsit: Optional[int] = None
    cg: Optional[int] = None
    n_appel: Optional[str] = None
    intitule: Optional[str] = None
    adresse: Optional[str] = None
    code_postal: Optional[int] = None
    type_de_compte: Optional[int] = None
    abonnement: Optional[float] = None
    dus_ant: Optional[float] = None
    montant_compteur: Optional[float] = None
    nbre_ticket: Optional[int] = None
    ticket: Optional[float] = None
    credit: Optional[float] = None
    code_payeur: Optional[int] = None
    ccp: Optional[int] = None
    date_vigueur_abt: Optional[date] = None
    date_derniere_modif: Optional[date] = None
    cod_cpt: Optional[int] = None
    nouvel_index: Optional[int] = None
    ancien_index: Optional[int] = None
    date_rnp: Optional[date] = None
    dnpf: Optional[date] = None
    repere: Optional[str] = None
    actel: Optional[str] = None
    n_client: Optional[int] = None
    commune: Optional[str] = None
    bat: Optional[str] = None
    esc: Optional[str] = None
    etage: Optional[str] = None
    porte: Optional[str] = None
    ccat: Optional[int] = None
    ndos: Optional[int] = None
    nvdi: Optional[str] = None
    motif_res: Optional[str] = None


class ApresGaiaCreate(ApresGaiaBase):
    """Body for POST /api/apres-gaia. `n`, `created_at`, `updated_at` are
    set by the database, never sent by the client."""

    pass


class ApresGaiaOut(ApresGaiaBase, ORMBase):
    n: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ApresGaiaBulkResult(BaseModel):
    inserted: int
    rows: list[ApresGaiaOut]


# --------------------------------------------------------------------- #
#  apres_gaia_regelement — raw table access                             #
# --------------------------------------------------------------------- #
class ApresGaiaReglementBase(BaseModel):
    somme_versement: Optional[float] = None
    date_versement: Optional[date] = None
    lieu_versement: Optional[str] = None


class ApresGaiaReglementCreate(ApresGaiaReglementBase):
    """Body for POST /api/apres-gaia/{n}/reglements — `n` comes from the
    URL, not the body, so it can't be spoofed to another client. `statut`
    is not settable here — every new règlement starts `en_attente`; use
    POST /reglements/{ref}/valider (or /refuser) to change it."""

    pass


class ApresGaiaReglementOut(ApresGaiaReglementBase, ORMBase):
    ref: int
    n: int
    statut: VersementStatut
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ApresGaiaReglementBulkResult(BaseModel):
    inserted: int
    rows: list[ApresGaiaReglementOut]


# --------------------------------------------------------------------- #
#  apres_gaia_med — mises en demeure + état juridique                   #
# --------------------------------------------------------------------- #
class ApresGaiaMedOut(ORMBase):
    """État MED d'un client. Si aucune ligne n'existe encore pour ce `n`,
    l'API renvoie les valeurs par défaut de la table avec `id = null`."""

    id: Optional[int] = None
    n: int

    invitation_paiement_date: Optional[date] = None
    invitation_paiement_etat: EnvoiEtat = EnvoiEtat.NON_ENVOYEE

    med_lettre_date: Optional[date] = None
    med_lettre_etat: EnvoiEtat = EnvoiEtat.NON_ENVOYEE

    engagement_date: Optional[date] = None
    engagement_etat: EngagementEtat = EngagementEtat.NON_ENGAGE

    med_huissier_nom: Optional[str] = None
    med_huissier_prenom: Optional[str] = None
    med_huissier_date: Optional[date] = None
    med_huissier_etat: EnvoiEtat = EnvoiEtat.NON_ENVOYEE

    cas_particulier: Optional[str] = None
    cas_particulier_date: Optional[date] = None
    cas_particulier_commentaire: Optional[str] = None

    etat_juridique: EtatJuridique = EtatJuridique.PROCEDURE_EN_COURS

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ApresGaiaMedUpdate(BaseModel):
    """Body for PATCH /api/apres-gaia/{n}/med — every field optional, only
    the fields actually sent are changed. Correction manuelle (dates,
    remise à NON_ENVOYEE, etc.). Pour le flux normal, utilise les
    boutons /envoyer, /engager et /etat-juridique."""

    invitation_paiement_date: Optional[date] = None
    invitation_paiement_etat: Optional[EnvoiEtat] = None
    med_lettre_date: Optional[date] = None
    med_lettre_etat: Optional[EnvoiEtat] = None
    engagement_date: Optional[date] = None
    engagement_etat: Optional[EngagementEtat] = None
    med_huissier_nom: Optional[str] = Field(None, max_length=100)
    med_huissier_prenom: Optional[str] = Field(None, max_length=100)
    med_huissier_date: Optional[date] = None
    med_huissier_etat: Optional[EnvoiEtat] = None
    cas_particulier: Optional[str] = Field(None, max_length=100)
    cas_particulier_date: Optional[date] = None
    cas_particulier_commentaire: Optional[str] = None
    etat_juridique: Optional[EtatJuridique] = None


class EnvoiBody(BaseModel):
    """Optional body for the /envoyer and /engager buttons. `date_envoi`
    defaults to today."""

    date_envoi: Optional[date] = None


class MedHuissierEnvoiBody(EnvoiBody):
    nom: Optional[str] = Field(None, max_length=100)
    prenom: Optional[str] = Field(None, max_length=100)


class CasParticulierBody(BaseModel):
    """Body for PUT /{n}/med/engagement/cas-particulier — records or
    edits the special-case note tied to a client's engagement (a social /
    medical situation, a payment plan that doesn't fit the normal
    schedule, etc). Send it again with new values to modify it; `label`
    is required so an empty PUT can't silently wipe the comment."""

    label: str = Field(..., max_length=100, description="Court intitulé du cas particulier")
    commentaire: Optional[str] = None
    cas_particulier_date: Optional[date] = Field(None, description="Défaut : aujourd'hui")


class EtatJuridiqueBody(BaseModel):
    etat_juridique: EtatJuridique


class DeletedCount(BaseModel):
    """Response of DELETE /{n}/reglements — how many versements were removed."""

    deleted: int


# --------------------------------------------------------------------- #
#  Aggregated "recherche par N° Compte / N° Client" — mirrors the        #
#  screenshot                                                            #
# --------------------------------------------------------------------- #
class InformationsClientApresGaia(BaseModel):
    """Fields that DO exist in your real apres_gaia schema. Nom/Prénom
    (separate), Statut (as text), Wilaya, Téléphone fixe/GSM, Email and
    Type service from the mockup have NO backing column — see
    backend/README.md "Gaps" section for the honest mapping used below."""

    n: Optional[int] = None
    n_client: Optional[int] = None
    n_appel: Optional[str] = None
    intitule: Optional[str] = None  # combined name/label, as stored
    adresse: Optional[str] = None
    commune: Optional[str] = None
    code_postal: Optional[int] = None
    codetat: Optional[int] = None  # raw code — closest existing analogue to "Statut"
    motif_res: Optional[str] = None
    type_de_compte: Optional[int] = None  # raw code — no lookup table given


class DetailsFacturationApresGaia(BaseModel):
    montant_ttc: Optional[float] = None
    tva: Optional[float] = None
    montant_ht: Optional[float] = None
    montant_ttc_note: str = (
        "Calculé (abonnement + dus_ant + montant_compteur), TVA extraite à "
        "19% en supposant que ce total est déjà TTC — aucune colonne "
        "montant_ttc/tva/ht n'existe dans le schéma fourni. Confirmez que "
        "cette formule correspond à votre règle métier."
    )


class ApresGaiaRappelOut(ORMBase):
    """Une notification « engagé mais aucun versement depuis un mois »."""

    id: int
    n: int
    type: str
    reference_date: date
    reference_source: str  # 'engagement' | 'versement'
    echeance_date: date
    mois_impayes: int
    jours_ecoules: int
    solde_du: Optional[float] = None
    message: str
    statut: RappelStatut
    created_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class RappelCount(BaseModel):
    non_lus: int  # statut = 'nouveau' (pastille rouge de la cloche)
    actifs: int  # statut in ('nouveau', 'lu')


class RappelCheckResult(BaseModel):
    """Résultat d'un contrôle (automatique ou POST /rappels/verifier)."""

    clients_engages_controles: int
    crees: list[ApresGaiaRappelOut]
    resolus: list[ApresGaiaRappelOut]


class ApresGaiaProfile(BaseModel):
    """Response for GET /api/apres-gaia/client/{identifiant}."""

    informations_client: InformationsClientApresGaia
    details_facturation: DetailsFacturationApresGaia
    reglements_historique: list[ApresGaiaReglementOut]
    med: Optional[ApresGaiaMedOut] = None  # état MED / juridique (défauts si aucune ligne)
    rappel_actif: Optional[ApresGaiaRappelOut] = None  # rappel de versement en cours (None si aucun)
    solde_du: float
    solde_du_note: str = (
        "Calculé (montant_ttc - somme des règlements dont statut='valide') "
        "— un règlement fraîchement inséré est 'en_attente' et ne réduit "
        "le solde qu'une fois validé via POST /reglements/{ref}/valider, "
        "comme pour l'ancien workflow d'avant_gaia_versement."
    )
# --------------------------------------------------------------------- #
#  Corporate AR (entreprises)                                            #
# --------------------------------------------------------------------- #
class CorporateArFileOut(ORMBase):
    """Métadonnées d'un document joint (les octets se téléchargent à part)."""

    id: int
    name: str
    content_type: str
    size: int


class CorporateArClientIn(BaseModel):
    """Corps de POST / PUT. Le `code` n'y figure pas : il est généré par l'API."""

    name: str = Field(min_length=1, max_length=255)
    creance: float = Field(ge=0)
    numero_facture: Optional[str] = Field(default=None, max_length=100)
    date_facture: Optional[date] = None
    designation: str = Field(min_length=1, max_length=255)
    observation: str = Field(min_length=1, max_length=255)


class CorporateArClientOut(ORMBase):
    code: str
    name: str
    creance: float
    numero_facture: Optional[str] = None
    date_facture: Optional[date] = None
    designation: str
    observation: str
    files: list[CorporateArFileOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CorporateArImportRow(CorporateArClientIn):
    """Une ligne de CSV. Sans `code` : un code CAR-xxxxxx est généré."""

    code: Optional[str] = Field(default=None, max_length=50)


class CorporateArImportIn(BaseModel):
    rows: list[CorporateArImportRow] = Field(min_length=1)


class CorporateArImportResult(BaseModel):
    added: int
    updated: int
    generated: int
