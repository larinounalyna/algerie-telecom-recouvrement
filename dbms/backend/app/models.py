"""
ORM models mapped column-for-column onto YOUR real DDL
(sql/001_schema_avant_gaia.sql, sql/003_schema_apres_gaia.sql). The one
deliberate addition is `ApresGaiaReglement.statut`
(sql/005_add_apres_gaia_regelement_statut.sql) — required for the
"Valider"/"Refuser" workflow you asked to move onto Après Gaïa; see
backend/README.md for why this one column stays despite "don't add
anything that doesn't exist".

Column names with spaces ("dus Anterieur") are mapped to a normal Python
attribute name (`dus_anterieur`) via `mapped_column("dus Anterieur", ...)` —
the space only ever appears in the raw SQL, never in Python/JSON.
"""
from __future__ import annotations

import enum

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class VersementStatut(str, enum.Enum):
    en_attente = "en_attente"
    valide = "valide"
    refuse = "refuse"


class EnvoiEtat(str, enum.Enum):
    """Used by invitation_paiement_etat, med_lettre_etat, med_huissier_etat."""

    ENVOYEE = "ENVOYEE"
    NON_ENVOYEE = "NON_ENVOYEE"


class EngagementEtat(str, enum.Enum):
    ENGAGE = "ENGAGE"
    NON_ENGAGE = "NON_ENGAGE"


class EtatJuridique(str, enum.Enum):
    """Must match chk_etat_juridique in sql/006_schema_apres_gaia_med.sql
    character for character (the dash is an en dash, U+2013)."""

    PROCEDURE_EN_COURS = "Procédure en cours"
    ENTREPRISE_GAGNANTE_1 = "Entreprise gagnante – première décision"
    CLIENT_GAGNANT_1 = "Client gagnant – première décision"
    ENTREPRISE_GAGNANTE_RECOURS = "Entreprise gagnante – après recours"
    CLIENT_GAGNANT_RECOURS = "Client gagnant – après recours"
    DOSSIER_CLOTURE = "Dossier clôturé"


class RappelStatut(str, enum.Enum):
    """nouveau = jamais ouvert · lu = vu par un agent · resolu = plus d'actualité
    (le client a versé, n'est plus engagé, ou un rappel plus récent l'a remplacé)."""

    nouveau = "nouveau"
    lu = "lu"
    resolu = "resolu"


class AvantGaia(Base):
    """One row = one bimestral billing snapshot for one `n_abonne`.
    There is intentionally no uniqueness constraint on `n_abonne` — a
    subscriber has one row per bimestre (see README for how history and
    the "current" values are derived from this)."""

    __tablename__ = "avant_gaia"

    ref: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    actel: Mapped[str | None] = mapped_column(String(255))
    n_abonne: Mapped[str | None] = mapped_column(String(50), index=True)
    intitule: Mapped[str | None] = mapped_column(String(255))
    adresse_01: Mapped[str | None] = mapped_column(String(255))
    adresse_02: Mapped[str | None] = mapped_column(String(255))

    dnpf: Mapped[int | None] = mapped_column()
    type_de_compte: Mapped[int | None] = mapped_column()
    abonnement: Mapped[float | None] = mapped_column(Numeric(12, 2))

    dus_anterieur: Mapped[float | None] = mapped_column("dus Anterieur", Numeric(12, 2))
    montant_compteur: Mapped[float | None] = mapped_column(Numeric(12, 2))

    nombre_ticket: Mapped[int | None] = mapped_column()
    montant_ticket: Mapped[float | None] = mapped_column(Numeric(12, 2))

    credit: Mapped[float | None] = mapped_column(Numeric(12, 2))
    code_payeur: Mapped[int | None] = mapped_column()

    n_ccp: Mapped[int | None] = mapped_column(BigInteger)

    somme_ht: Mapped[float | None] = mapped_column(Numeric(12, 2))
    ttc: Mapped[float | None] = mapped_column(Numeric(12, 2))
    tva: Mapped[float | None] = mapped_column(Numeric(12, 2))

    nouveau_index: Mapped[int | None] = mapped_column()
    avoir: Mapped[float | None] = mapped_column(Numeric(12, 2))

    n_bimestre: Mapped[int | None] = mapped_column()
    annee_bimestre: Mapped[int | None] = mapped_column()
    n_s_t: Mapped[int | None] = mapped_column()

    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class AvantGaiaVersement(Base):
    __tablename__ = "avant_gaia_versement"

    ref: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    actel: Mapped[str | None] = mapped_column(String(255))
    n_abonne: Mapped[str | None] = mapped_column(String(50), index=True)

    montant_versement: Mapped[float | None] = mapped_column(Numeric(12, 2))

    n_bimestre: Mapped[int | None] = mapped_column()
    annee_bimestre: Mapped[int | None] = mapped_column()
    n_versement: Mapped[int | None] = mapped_column()

    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class ApresGaia(Base):
    """One row = one résilié account (sql/003_schema_apres_gaia.sql).
    Unlike avant_gaia, there is ONE row per client here — not one per
    bimestre — so there is no history to derive; "current" values ARE
    the row."""

    __tablename__ = "apres_gaia"

    n: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    codetat: Mapped[int | None] = mapped_column()
    codsit: Mapped[int | None] = mapped_column()
    cg: Mapped[int | None] = mapped_column()

    n_appel: Mapped[str | None] = mapped_column(String(50), index=True)

    intitule: Mapped[str | None] = mapped_column(String(255))
    adresse: Mapped[str | None] = mapped_column(String(255))

    code_postal: Mapped[int | None] = mapped_column()

    type_de_compte: Mapped[int | None] = mapped_column()

    abonnement: Mapped[float | None] = mapped_column(Numeric(12, 2))
    dus_ant: Mapped[float | None] = mapped_column(Numeric(12, 2))
    montant_compteur: Mapped[float | None] = mapped_column(Numeric(12, 2))

    nbre_ticket: Mapped[int | None] = mapped_column()
    ticket: Mapped[float | None] = mapped_column(Numeric(12, 2))
    credit: Mapped[float | None] = mapped_column(Numeric(12, 2))

    code_payeur: Mapped[int | None] = mapped_column()

    ccp: Mapped[int | None] = mapped_column(BigInteger)

    date_vigueur_abt: Mapped[object | None] = mapped_column(Date)
    date_derniere_modif: Mapped[object | None] = mapped_column(Date)

    cod_cpt: Mapped[int | None] = mapped_column()

    nouvel_index: Mapped[int | None] = mapped_column()
    ancien_index: Mapped[int | None] = mapped_column()

    date_rnp: Mapped[object | None] = mapped_column(Date)
    dnpf: Mapped[object | None] = mapped_column(Date)

    repere: Mapped[str | None] = mapped_column(String(100))
    actel: Mapped[str | None] = mapped_column(String(255))

    n_client: Mapped[int | None] = mapped_column(BigInteger, index=True)

    commune: Mapped[str | None] = mapped_column(String(255))
    bat: Mapped[str | None] = mapped_column(String(50))
    esc: Mapped[str | None] = mapped_column(String(50))
    etage: Mapped[str | None] = mapped_column(String(50))
    porte: Mapped[str | None] = mapped_column(String(50))

    ccat: Mapped[int | None] = mapped_column()
    ndos: Mapped[int | None] = mapped_column()

    nvdi: Mapped[str | None] = mapped_column(String(100))

    motif_res: Mapped[str | None] = mapped_column("motif res", String(255))

    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class ApresGaiaReglement(Base):
    """A payment against one apres_gaia client. `n` is a real foreign key
    to apres_gaia.n (see sql/004_schema_apres_gaia_regelement.sql for why
    this table has its own `ref` PK instead of reusing `n` as one).

    `statut` (sql/005_add_apres_gaia_regelement_statut.sql) gates whether
    a règlement counts towards `solde_du` — mirrors the workflow that used
    to live on avant_gaia_versement, now moved here."""

    __tablename__ = "apres_gaia_regelement"

    ref: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    n: Mapped[int] = mapped_column(Integer, ForeignKey("apres_gaia.n", ondelete="CASCADE"), index=True)

    somme_versement: Mapped[float | None] = mapped_column(Numeric(12, 2))
    date_versement: Mapped[object | None] = mapped_column(Date)
    lieu_versement: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # --- Added by sql/005_add_apres_gaia_regelement_statut.sql (required for Valider/Refuser) ---
    statut: Mapped[VersementStatut] = mapped_column(String(20), default=VersementStatut.en_attente)


class ApresGaiaMed(Base):
    """Mises en demeure + état juridique d'un client (sql/006_schema_apres_gaia_med.sql).

    `n` is a foreign key to apres_gaia.n. The API always addresses this
    table BY n and treats it as ONE row per client (created lazily the
    first time something is written, see crud.get_or_create_med)."""

    __tablename__ = "apres_gaia_med"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    n: Mapped[int] = mapped_column(Integer, ForeignKey("apres_gaia.n", ondelete="CASCADE"), index=True)

    invitation_paiement_date: Mapped[object | None] = mapped_column(Date)
    invitation_paiement_etat: Mapped[str] = mapped_column(String(20), default=EnvoiEtat.NON_ENVOYEE.value, server_default="NON_ENVOYEE")

    med_lettre_date: Mapped[object | None] = mapped_column(Date)
    med_lettre_etat: Mapped[str] = mapped_column(String(20), default=EnvoiEtat.NON_ENVOYEE.value, server_default="NON_ENVOYEE")

    engagement_date: Mapped[object | None] = mapped_column(Date)
    engagement_etat: Mapped[str] = mapped_column(String(20), default=EngagementEtat.NON_ENGAGE.value, server_default="NON_ENGAGE")

    med_huissier_nom: Mapped[str | None] = mapped_column(String(100))
    med_huissier_prenom: Mapped[str | None] = mapped_column(String(100))
    med_huissier_date: Mapped[object | None] = mapped_column(Date)
    med_huissier_etat: Mapped[str] = mapped_column(String(20), default=EnvoiEtat.NON_ENVOYEE.value, server_default="NON_ENVOYEE")

    # --- Added by sql/007_add_apres_gaia_med_cas_particulier.sql ---
    # A client whose engagement doesn't fit the normal schedule (social /
    # medical situation, exceptional payment plan, etc). Free label +
    # comment — kept independent of engagement_etat so a "cas particulier"
    # can be recorded whether or not the client is otherwise ENGAGE.
    cas_particulier: Mapped[str | None] = mapped_column(String(100))
    cas_particulier_date: Mapped[object | None] = mapped_column(Date)
    cas_particulier_commentaire: Mapped[str | None] = mapped_column(Text)

    etat_juridique: Mapped[str] = mapped_column(String(100), default=EtatJuridique.PROCEDURE_EN_COURS.value, server_default="Procédure en cours")

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class ApresGaiaRappel(Base):
    """Notification « client engagé sans versement depuis un mois »
    (sql/008_schema_apres_gaia_rappel.sql). Créée automatiquement par
    app/rappels.py — jamais saisie à la main."""

    __tablename__ = "apres_gaia_rappel"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    n: Mapped[int] = mapped_column(Integer, ForeignKey("apres_gaia.n", ondelete="CASCADE"), index=True)

    type: Mapped[str] = mapped_column(String(50), default="versement_mensuel", server_default="versement_mensuel")

    reference_date: Mapped[object] = mapped_column(Date)
    reference_source: Mapped[str] = mapped_column(String(20))
    echeance_date: Mapped[object] = mapped_column(Date)
    mois_impayes: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    jours_ecoules: Mapped[int] = mapped_column(Integer)

    solde_du: Mapped[float | None] = mapped_column(Numeric(12, 2))
    message: Mapped[str] = mapped_column(Text)

    statut: Mapped[str] = mapped_column(String(20), default=RappelStatut.nouveau.value, server_default="nouveau", index=True)

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    read_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))


# --------------------------------------------------------------------- #
#  Corporate AR (entreprises) — sql/009_schema_corporate_ar.sql          #
# --------------------------------------------------------------------- #
class CorporateArClient(Base):
    """Une entreprise cliente. `code` (CAR-000001…) est la clé primaire."""

    __tablename__ = "corporate_ar_client"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)

    name: Mapped[str] = mapped_column(String(255), index=True)
    creance: Mapped[float] = mapped_column(Numeric(14, 2), default=0, server_default="0")

    numero_facture: Mapped[str | None] = mapped_column(String(100))
    date_facture: Mapped[object | None] = mapped_column(Date, index=True)

    designation: Mapped[str] = mapped_column(String(255))
    observation: Mapped[str] = mapped_column(String(255))

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class CorporateArFile(Base):
    """Document joint (PDF / image). `data` est différé : lister les fichiers
    d'un client ne charge jamais les octets, seul le téléchargement les lit."""

    __tablename__ = "corporate_ar_file"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    client_code: Mapped[str] = mapped_column(String(50), ForeignKey("corporate_ar_client.code", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)

    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class CorporateArCounter(Base):
    """Une seule ligne (id = 1) : dernier numéro CAR-xxxxxx attribué."""

    __tablename__ = "corporate_ar_counter"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    last_number: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

