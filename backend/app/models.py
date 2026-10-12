"""Compatibility data models for the raw-SQL migration.

This project previously used SQLAlchemy ORM table declarations. Those have been
removed so the backend can use schema-defined raw SQL access instead.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum


class VersementStatut(str, Enum):
    en_attente = "en_attente"
    valide = "valide"
    refuse = "refuse"


class EnvoiEtat(str, Enum):
    ENVOYEE = "ENVOYEE"
    NON_ENVOYEE = "NON_ENVOYEE"


class EngagementEtat(str, Enum):
    ENGAGE = "ENGAGE"
    NON_ENGAGE = "NON_ENGAGE"


class EtatJuridique(str, Enum):
    PROCEDURE_EN_COURS = "Procédure en cours"
    ENTREPRISE_GAGNANTE_1 = "Entreprise gagnante – première décision"
    CLIENT_GAGNANT_1 = "Client gagnant – première décision"
    ENTREPRISE_GAGNANTE_RECOURS = "Entreprise gagnante – après recours"
    CLIENT_GAGNANT_RECOURS = "Client gagnant – après recours"
    DOSSIER_CLOTURE = "Dossier clôturé"


class RappelStatut(str, Enum):
    nouveau = "nouveau"
    lu = "lu"
    resolu = "resolu"


@dataclass
class AvantGaia:
    __tablename__ = "avant_gaia"
    ref: int | None = None
    actel: str | None = None
    n_abonne: str | None = None
    intitule: str | None = None
    adresse_01: str | None = None
    adresse_02: str | None = None
    dnpf: int | None = None
    type_de_compte: int | None = None
    abonnement: float | None = None
    dus_anterieur: float | None = None
    montant_compteur: float | None = None
    nombre_ticket: int | None = None
    montant_ticket: float | None = None
    credit: float | None = None
    code_payeur: int | None = None
    n_ccp: int | None = None
    somme_ht: float | None = None
    ttc: float | None = None
    tva: float | None = None
    nouveau_index: int | None = None
    avoir: float | None = None
    n_bimestre: int | None = None
    annee_bimestre: int | None = None
    n_s_t: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class AvantGaiaVersement:
    __tablename__ = "avant_gaia_versement"
    ref: int | None = None
    actel: str | None = None
    n_abonne: str | None = None
    montant_versement: float | None = None
    n_bimestre: int | None = None
    annee_bimestre: int | None = None
    n_versement: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ApresGaia:
    __tablename__ = "apres_gaia"
    n: int | None = None
    codetat: int | None = None
    codsit: int | None = None
    cg: int | None = None
    n_appel: str | None = None
    intitule: str | None = None
    adresse: str | None = None
    code_postal: int | None = None
    type_de_compte: int | None = None
    abonnement: float | None = None
    dus_ant: float | None = None
    montant_compteur: float | None = None
    nbre_ticket: int | None = None
    ticket: float | None = None
    credit: float | None = None
    code_payeur: int | None = None
    ccp: int | None = None
    date_vigueur_abt: date | None = None
    date_derniere_modif: date | None = None
    cod_cpt: int | None = None
    nouvel_index: int | None = None
    ancien_index: int | None = None
    date_rnp: date | None = None
    dnpf: date | None = None
    repere: str | None = None
    actel: str | None = None
    n_client: int | None = None
    commune: str | None = None
    bat: str | None = None
    esc: str | None = None
    etage: str | None = None
    porte: str | None = None
    ccat: int | None = None
    ndos: int | None = None
    nvdi: str | None = None
    motif_res: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ApresGaiaReglement:
    __tablename__ = "apres_gaia_regelement"
    id: int | None = None
    n: int | None = None
    montant: float | None = None
    date_reglement: date | None = None
    reference: str | None = None
    statut: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ApresGaiaMed:
    __tablename__ = "apres_gaia_med"
    id: int | None = None
    n: int | None = None
    invitation_paiement_date: date | None = None
    invitation_paiement_etat: str | None = None
    med_lettre_date: date | None = None
    med_lettre_etat: str | None = None
    engagement_date: date | None = None
    engagement_etat: str | None = None
    med_huissier_nom: str | None = None
    med_huissier_prenom: str | None = None
    med_huissier_date: date | None = None
    med_huissier_etat: str | None = None
    cas_particulier: str | None = None
    cas_particulier_date: date | None = None
    cas_particulier_commentaire: str | None = None
    etat_juridique: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ApresGaiaRappel:
    __tablename__ = "apres_gaia_rappel"
    id: int | None = None
    n: int | None = None
    type: str | None = None
    reference_date: date | None = None
    reference_source: str | None = None
    echeance_date: date | None = None
    mois_impayes: int | None = None
    jours_ecoules: int | None = None
    solde_du: float | None = None
    message: str | None = None
    statut: str | None = None
    created_at: datetime | None = None
    read_at: datetime | None = None
    resolved_at: datetime | None = None


@dataclass
class CorporateArClient:
    __tablename__ = "corporate_ar_client"
    code: str | None = None
    name: str | None = None
    creance: float | None = None
    numero_facture: str | None = None
    date_facture: date | None = None
    date_remis_saj: date | None = None
    date_remis_client: date | None = None
    designation: str | None = None
    observation: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class CorporateArFile:
    __tablename__ = "corporate_ar_file"
    id: int | None = None
    client_code: str | None = None
    name: str | None = None
    content_type: str | None = None
    size: int | None = None
    data: bytes | None = None
    created_at: datetime | None = None


@dataclass
class CorporateArCounter:
    __tablename__ = "corporate_ar_counter"
    id: int | None = None
    last_number: int | None = None


@dataclass
class ProjectArProject:
    __tablename__ = "project_ar_project"
    id: int | None = None
    project_name: str | None = None
    contract_number: str | None = None
    amendment_numbers: list[int] = field(default_factory=list)
    launch_date: date | None = None
    pieces_remises: list[str] = field(default_factory=list)
    end_date: date | None = None
    estimated_amount: float | None = None
    final_invoice_amount: float | None = None
    payment_date: date | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ProjectArFile:
    __tablename__ = "project_ar_file"
    id: int | None = None
    project_id: int | None = None
    name: str | None = None
    content_type: str | None = None
    size: int | None = None
    data: bytes | None = None
    created_at: datetime | None = None
