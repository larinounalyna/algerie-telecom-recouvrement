from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


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


class Base(DeclarativeBase):
    pass


class AvantGaia(Base):
    __tablename__ = "avant_gaia"

    ref: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    n_abonne: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    intitule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    adresse_01: Mapped[str | None] = mapped_column(String(255), nullable=True)
    adresse_02: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dnpf: Mapped[int | None] = mapped_column(Integer, nullable=True)
    type_de_compte: Mapped[int | None] = mapped_column(Integer, nullable=True)
    abonnement: Mapped[float | None] = mapped_column(Float, nullable=True)
    dus_anterieur: Mapped[float | None] = mapped_column(Float, nullable=True)
    montant_compteur: Mapped[float | None] = mapped_column(Float, nullable=True)
    nombre_ticket: Mapped[int | None] = mapped_column(Integer, nullable=True)
    montant_ticket: Mapped[float | None] = mapped_column(Float, nullable=True)
    credit: Mapped[float | None] = mapped_column(Float, nullable=True)
    code_payeur: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n_ccp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    somme_ht: Mapped[float | None] = mapped_column(Float, nullable=True)
    ttc: Mapped[float | None] = mapped_column(Float, nullable=True)
    tva: Mapped[float | None] = mapped_column(Float, nullable=True)
    nouveau_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avoir: Mapped[float | None] = mapped_column(Float, nullable=True)
    n_bimestre: Mapped[int | None] = mapped_column(Integer, nullable=True)
    annee_bimestre: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n_s_t: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class AvantGaiaVersement(Base):
    __tablename__ = "avant_gaia_versement"

    ref: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    n_abonne: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    montant_versement: Mapped[float | None] = mapped_column(Float, nullable=True)
    n_bimestre: Mapped[int | None] = mapped_column(Integer, nullable=True)
    annee_bimestre: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n_versement: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class ApresGaia(Base):
    __tablename__ = "apres_gaia"

    n: Mapped[int] = mapped_column(Integer, primary_key=True)
    codetat: Mapped[int | None] = mapped_column(Integer, nullable=True)
    codsit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    n_appel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    intitule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    adresse: Mapped[str | None] = mapped_column(Text, nullable=True)
    code_postal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    type_de_compte: Mapped[int | None] = mapped_column(Integer, nullable=True)
    abonnement: Mapped[float | None] = mapped_column(Float, nullable=True)
    dus_ant: Mapped[float | None] = mapped_column(Float, nullable=True)
    montant_compteur: Mapped[float | None] = mapped_column(Float, nullable=True)
    nbre_ticket: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ticket: Mapped[float | None] = mapped_column(Float, nullable=True)
    credit: Mapped[float | None] = mapped_column(Float, nullable=True)
    code_payeur: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ccp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date_vigueur_abt: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_derniere_modif: Mapped[date | None] = mapped_column(Date, nullable=True)
    cod_cpt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nouvel_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ancien_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date_rnp: Mapped[date | None] = mapped_column(Date, nullable=True)
    dnpf: Mapped[date | None] = mapped_column(Date, nullable=True)
    repere: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    n_client: Mapped[int | None] = mapped_column(Integer, nullable=True)
    commune: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bat: Mapped[str | None] = mapped_column(String(50), nullable=True)
    esc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    etage: Mapped[str | None] = mapped_column(String(20), nullable=True)
    porte: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ccat: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ndos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nvdi: Mapped[str | None] = mapped_column(String(50), nullable=True)
    motif_res: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class ApresGaiaReglement(Base):
    __tablename__ = "apres_gaia_regelement"

    ref: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    n: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    montant: Mapped[float | None] = mapped_column(Float, nullable=True)
    somme_versement: Mapped[float | None] = mapped_column(Float, nullable=True)
    date_reglement: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_versement: Mapped[date | None] = mapped_column(Date, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lieu_versement: Mapped[str | None] = mapped_column(String(255), nullable=True)
    statut: Mapped[str | None] = mapped_column(String(30), nullable=True, default=VersementStatut.en_attente.value)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class ApresGaiaMed(Base):
    __tablename__ = "apres_gaia_med"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    n: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    invitation_paiement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    invitation_paiement_etat: Mapped[str | None] = mapped_column(String(30), nullable=True)
    med_lettre_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    med_lettre_etat: Mapped[str | None] = mapped_column(String(30), nullable=True)
    engagement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    engagement_etat: Mapped[str | None] = mapped_column(String(30), nullable=True)
    med_huissier_nom: Mapped[str | None] = mapped_column(String(100), nullable=True)
    med_huissier_prenom: Mapped[str | None] = mapped_column(String(100), nullable=True)
    med_huissier_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    med_huissier_etat: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cas_particulier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cas_particulier_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cas_particulier_commentaire: Mapped[str | None] = mapped_column(Text, nullable=True)
    etat_juridique: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class ApresGaiaRappel(Base):
    __tablename__ = "apres_gaia_rappel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    n: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    type: Mapped[str | None] = mapped_column("type", String(50), nullable=True)
    reference_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reference_source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    echeance_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    mois_impayes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    jours_ecoules: Mapped[int | None] = mapped_column(Integer, nullable=True)
    solde_du: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    statut: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CorporateArClient(Base):
    __tablename__ = "corporate_ar_client"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    creance: Mapped[float | None] = mapped_column(Float, nullable=True)
    numero_facture: Mapped[str | None] = mapped_column(String(100), nullable=True)
    date_facture: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_remis_saj: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_remis_client: Mapped[date | None] = mapped_column(Date, nullable=True)
    designation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class CorporateArFile(Base):
    __tablename__ = "corporate_ar_file"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)


class CorporateArCounter(Base):
    __tablename__ = "corporate_ar_counter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    last_number: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ProjectArProject(Base):
    __tablename__ = "project_ar_project"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amendment_numbers: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    launch_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pieces_remises: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimated_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_invoice_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class ProjectArFile(Base):
    __tablename__ = "project_ar_file"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("project_ar_project.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
