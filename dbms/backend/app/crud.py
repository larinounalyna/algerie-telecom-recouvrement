from __future__ import annotations

import re
from datetime import date

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from . import models, schemas


# --------------------------------------------------------------------- #
#  avant_gaia                                                            #
# --------------------------------------------------------------------- #
def list_avant_gaia(
    db: Session, n_abonne: str | None = None, actel: str | None = None, skip: int = 0, limit: int = 100
) -> list[models.AvantGaia]:
    stmt = select(models.AvantGaia)
    if n_abonne:
        stmt = stmt.where(models.AvantGaia.n_abonne == n_abonne)
    if actel:
        stmt = stmt.where(models.AvantGaia.actel == actel)
    stmt = stmt.order_by(models.AvantGaia.ref).offset(skip).limit(limit)
    return list(db.scalars(stmt))


def get_avant_gaia_rows_for_abonne(db: Session, n_abonne: str) -> list[models.AvantGaia]:
    """All bimestral rows for one subscriber, chronological order —
    the basis for both the "current" values and the consommation history."""
    stmt = (
        select(models.AvantGaia)
        .where(models.AvantGaia.n_abonne == n_abonne)
        .order_by(models.AvantGaia.annee_bimestre.asc().nulls_first(), models.AvantGaia.n_bimestre.asc().nulls_first(), models.AvantGaia.ref.asc())
    )
    return list(db.scalars(stmt))


def list_all_avant_gaia(db: Session) -> list[models.AvantGaia]:
    """Full, unpaginated dump of avant_gaia — for the "get the database"
    endpoint (GET /api/avant-gaia/database)."""
    stmt = select(models.AvantGaia).order_by(models.AvantGaia.ref)
    return list(db.scalars(stmt))


# --------------------------------------------------------------------- #
#  avant_gaia_versement — READ ONLY                                     #
# --------------------------------------------------------------------- #
def list_versements(
    db: Session, n_abonne: str | None = None, skip: int = 0, limit: int = 100
) -> list[models.AvantGaiaVersement]:
    stmt = select(models.AvantGaiaVersement)
    if n_abonne:
        stmt = stmt.where(models.AvantGaiaVersement.n_abonne == n_abonne)
    stmt = stmt.order_by(models.AvantGaiaVersement.ref).offset(skip).limit(limit)
    return list(db.scalars(stmt))


def get_versements_for_abonne(db: Session, n_abonne: str) -> list[models.AvantGaiaVersement]:
    stmt = (
        select(models.AvantGaiaVersement)
        .where(models.AvantGaiaVersement.n_abonne == n_abonne)
        .order_by(
            models.AvantGaiaVersement.annee_bimestre.desc().nulls_last(),
            models.AvantGaiaVersement.n_bimestre.desc().nulls_last(),
            models.AvantGaiaVersement.ref.desc(),
        )
    )
    return list(db.scalars(stmt))


# --------------------------------------------------------------------- #
#  Aggregated profile — GET /api/avant-gaia/client/{n_abonne}            #
# --------------------------------------------------------------------- #
def build_profile(db: Session, n_abonne: str) -> schemas.AvantGaiaProfile | None:
    rows = get_avant_gaia_rows_for_abonne(db, n_abonne)
    if not rows:
        return None

    latest = rows[-1]

    consommation: list[schemas.ConsommationHistoryItem] = []
    previous_nouveau: int | None = None
    for row in rows:
        ancien = previous_nouveau
        conso = None
        if ancien is not None and row.nouveau_index is not None:
            conso = row.nouveau_index - ancien
        consommation.append(
            schemas.ConsommationHistoryItem(
                ref=row.ref,
                bimestre=f"{row.n_bimestre}/{row.annee_bimestre}",
                n_bimestre=row.n_bimestre,
                annee_bimestre=row.annee_bimestre,
                ancien_index=ancien,
                nouveau_index=row.nouveau_index,
                consommation=conso,
            )
        )
        previous_nouveau = row.nouveau_index if row.nouveau_index is not None else previous_nouveau

    versements = get_versements_for_abonne(db, n_abonne)

    total_ttc = sum((float(r.ttc) for r in rows if r.ttc is not None), 0.0)
    total_verse = sum(
        (float(v.montant_versement) for v in versements if v.montant_versement is not None),
        0.0,
    )
    solde_du = max(0.0, round(total_ttc - total_verse, 2))

    return schemas.AvantGaiaProfile(
        informations_client=schemas.InformationsClient(
            n_abonne=latest.n_abonne,
            intitule=latest.intitule,
            adresse_01=latest.adresse_01,
            adresse_02=latest.adresse_02,
            actel=latest.actel,
            code_payeur=latest.code_payeur,
            n_ccp=latest.n_ccp,
            type_de_compte=latest.type_de_compte,
            dnpf=latest.dnpf,
            bimestre=f"{latest.n_bimestre}/{latest.annee_bimestre}",
            nouveau_index=latest.nouveau_index,
        ),
        details_facturation=schemas.DetailsFacturation(
            abonnement=latest.abonnement,
            montant_compteur=latest.montant_compteur,
            dus_anterieur=latest.dus_anterieur,
            nombre_ticket=latest.nombre_ticket,
            montant_ticket=latest.montant_ticket,
            credit=latest.credit,
            somme_ht=latest.somme_ht,
            tva=latest.tva,
            ttc=latest.ttc,
            avoir=latest.avoir,
        ),
        consommation_historique=list(reversed(consommation)),  # most recent first, like the mockup
        versements_historique=list(versements),
        solde_du=solde_du,
    )


# --------------------------------------------------------------------- #
#  apres_gaia                                                           #
# --------------------------------------------------------------------- #

def list_apres_gaia(
    db: Session,
    n: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.ApresGaia]:

    stmt = select(models.ApresGaia)

    # Search ONLY by apres_gaia.n
    if n is not None:
        stmt = stmt.where(models.ApresGaia.n == n)

    stmt = (
        stmt
        .order_by(models.ApresGaia.n)
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(stmt))


def create_apres_gaia_bulk(
    db: Session,
    rows: list[schemas.ApresGaiaCreate]
) -> list[models.ApresGaia]:

    objs = [
        models.ApresGaia(**row.model_dump())
        for row in rows
    ]

    db.add_all(objs)
    db.commit()

    for obj in objs:
        db.refresh(obj)

    return objs


def get_apres_gaia_by_n(
    db: Session,
    n: int
) -> models.ApresGaia | None:

    return db.get(models.ApresGaia, n)


def list_all_apres_gaia(
    db: Session
) -> list[models.ApresGaia]:

    """Full, unpaginated dump of apres_gaia."""

    stmt = (
        select(models.ApresGaia)
        .order_by(models.ApresGaia.n)
    )

    return list(db.scalars(stmt))


def find_apres_gaia_client(
    db: Session,
    identifiant: str
) -> models.ApresGaia | None:

    """
    Search for an Après Gaïa account using ONLY apres_gaia.n.

    n is the account identifier used by the application.
    n_client and n_appel are NOT used for searching.
    """

    try:
        n = int(identifiant)
    except (TypeError, ValueError):
        return None

    return get_apres_gaia_by_n(db, n)


# --------------------------------------------------------------------- #
#  apres_gaia_regelement                                                #
# --------------------------------------------------------------------- #

def list_reglements(
    db: Session,
    n: int | None = None,
    skip: int = 0,
    limit: int = 100
) -> list[models.ApresGaiaReglement]:

    stmt = select(models.ApresGaiaReglement)

    if n is not None:
        stmt = stmt.where(
            models.ApresGaiaReglement.n == n
        )

    stmt = (
        stmt
        .order_by(models.ApresGaiaReglement.ref)
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(stmt))


def create_reglement(
    db: Session,
    n: int,
    data: schemas.ApresGaiaReglementCreate
) -> models.ApresGaiaReglement:

    obj = models.ApresGaiaReglement(
        n=n,
        **data.model_dump()
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


def get_reglements_for_client(
    db: Session,
    n: int
) -> list[models.ApresGaiaReglement]:

    stmt = (
        select(models.ApresGaiaReglement)
        .where(
            models.ApresGaiaReglement.n == n
        )
        .order_by(
            models.ApresGaiaReglement.date_versement.desc().nulls_last(),
            models.ApresGaiaReglement.ref.desc()
        )
    )

    return list(db.scalars(stmt))


def get_reglement(
    db: Session,
    ref: int
) -> models.ApresGaiaReglement | None:

    return db.get(
        models.ApresGaiaReglement,
        ref
    )


def set_reglement_statut(
    db: Session,
    reglement: models.ApresGaiaReglement,
    statut: models.VersementStatut
) -> models.ApresGaiaReglement:

    reglement.statut = statut

    db.commit()
    db.refresh(reglement)

    return reglement


def delete_reglement(
    db: Session,
    ref: int
) -> bool:
    """Deletes one versement by its ref. Returns False if it didn't exist."""

    reglement = db.get(models.ApresGaiaReglement, ref)

    if reglement is None:
        return False

    db.delete(reglement)
    db.commit()

    return True


def delete_reglements_for_client(
    db: Session,
    n: int
) -> int:
    """Deletes every versement recorded for client n. Returns how many
    rows were removed (0 if the client had none — this does not check
    whether apres_gaia.n itself exists, callers do that first)."""

    stmt = delete(models.ApresGaiaReglement).where(models.ApresGaiaReglement.n == n)

    result = db.execute(stmt)
    db.commit()

    return result.rowcount or 0


# --------------------------------------------------------------------- #
#  apres_gaia_med — mises en demeure + état juridique (always BY n)     #
# --------------------------------------------------------------------- #

# (etat column, date column, value meaning "done", value meaning "not done")
_MED_STEPS = {
    "invitation_paiement": ("invitation_paiement_etat", "invitation_paiement_date", models.EnvoiEtat.ENVOYEE, models.EnvoiEtat.NON_ENVOYEE),
    "med_lettre": ("med_lettre_etat", "med_lettre_date", models.EnvoiEtat.ENVOYEE, models.EnvoiEtat.NON_ENVOYEE),
    "engagement": ("engagement_etat", "engagement_date", models.EngagementEtat.ENGAGE, models.EngagementEtat.NON_ENGAGE),
    "med_huissier": ("med_huissier_etat", "med_huissier_date", models.EnvoiEtat.ENVOYEE, models.EnvoiEtat.NON_ENVOYEE),
}

# Columns that are NOT NULL in the DB — a null sent in a PATCH is ignored.
_MED_NOT_NULL = {"invitation_paiement_etat", "med_lettre_etat", "engagement_etat", "med_huissier_etat", "etat_juridique"}


def list_med(
    db: Session,
    n: int | None = None,
    etat_juridique: models.EtatJuridique | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.ApresGaiaMed]:

    stmt = select(models.ApresGaiaMed)

    if n is not None:
        stmt = stmt.where(models.ApresGaiaMed.n == n)

    if etat_juridique is not None:
        stmt = stmt.where(models.ApresGaiaMed.etat_juridique == etat_juridique.value)

    stmt = stmt.order_by(models.ApresGaiaMed.n, models.ApresGaiaMed.id).offset(skip).limit(limit)

    return list(db.scalars(stmt))


def get_med(db: Session, n: int) -> models.ApresGaiaMed | None:
    """The (latest) apres_gaia_med row for client n, or None if nothing
    has been recorded yet."""

    stmt = (
        select(models.ApresGaiaMed)
        .where(models.ApresGaiaMed.n == n)
        .order_by(models.ApresGaiaMed.id.desc())
        .limit(1)
    )

    return db.scalars(stmt).first()


def med_or_default(db: Session, n: int) -> schemas.ApresGaiaMedOut:
    """What GET /{n}/med returns: the stored row, or the table defaults
    (id=None) when no row exists yet — a GET never writes."""

    row = get_med(db, n)

    if row is None:
        return schemas.ApresGaiaMedOut(n=n)

    return schemas.ApresGaiaMedOut.model_validate(row)


def get_or_create_med(db: Session, n: int) -> models.ApresGaiaMed:
    row = get_med(db, n)

    if row is None:
        row = models.ApresGaiaMed(n=n)
        db.add(row)
        db.flush()

    return row


def _touch(db: Session, row: models.ApresGaiaMed) -> models.ApresGaiaMed:
    row.updated_at = func.now()
    db.commit()
    db.refresh(row)
    return row


def update_med(
    db: Session,
    n: int,
    data: schemas.ApresGaiaMedUpdate,
) -> models.ApresGaiaMed:
    """Partial update — only the fields present in the request body.

    Convenience: switching an etat to its "done" value without sending a
    date stamps today's date (if there is none yet); switching it back to
    the "not done" value without sending a date clears the date."""

    row = get_or_create_med(db, n)

    changes = data.model_dump(exclude_unset=True)

    for field, value in changes.items():
        if value is None and field in _MED_NOT_NULL:
            continue

        if hasattr(value, "value"):  # enum -> plain string for the DB
            value = value.value

        setattr(row, field, value)

    for etat_col, date_col, done, not_done in _MED_STEPS.values():
        if etat_col in changes and date_col not in changes and changes[etat_col] is not None:
            if changes[etat_col] == done:
                if getattr(row, date_col) is None:
                    setattr(row, date_col, date.today())
            else:
                setattr(row, date_col, None)

    return _touch(db, row)


def mark_med_step(
    db: Session,
    n: int,
    step: str,
    when: date | None = None,
) -> models.ApresGaiaMed:
    """The "Envoyer" / "Engager" buttons: flips one step to its done
    state and stamps the date (today unless given)."""

    etat_col, date_col, done, _ = _MED_STEPS[step]

    row = get_or_create_med(db, n)

    setattr(row, etat_col, done.value)
    setattr(row, date_col, when or date.today())

    return _touch(db, row)


def is_med_step_done(row: models.ApresGaiaMed | None, step: str) -> bool:
    if row is None:
        return False

    etat_col, _, done, _ = _MED_STEPS[step]

    return getattr(row, etat_col) == done.value


def set_med_huissier(
    db: Session,
    n: int,
    nom: str | None,
    prenom: str | None,
    when: date | None = None,
) -> models.ApresGaiaMed:

    row = get_or_create_med(db, n)

    if nom is not None:
        row.med_huissier_nom = nom

    if prenom is not None:
        row.med_huissier_prenom = prenom

    row.med_huissier_etat = models.EnvoiEtat.ENVOYEE.value
    row.med_huissier_date = when or date.today()

    return _touch(db, row)


def set_etat_juridique(
    db: Session,
    n: int,
    etat: models.EtatJuridique,
) -> models.ApresGaiaMed:

    row = get_or_create_med(db, n)

    row.etat_juridique = etat.value

    return _touch(db, row)


def set_cas_particulier(
    db: Session,
    n: int,
    label: str,
    commentaire: str | None,
    when: date | None = None,
) -> models.ApresGaiaMed:
    """Records or edits the cas particulier tied to a client's engagement.
    Independent of engagement_etat — a special case can be noted whether
    or not the client is otherwise ENGAGE / NON_ENGAGE."""

    row = get_or_create_med(db, n)

    row.cas_particulier = label
    row.cas_particulier_commentaire = commentaire
    row.cas_particulier_date = when or date.today()

    return _touch(db, row)


def clear_cas_particulier(
    db: Session,
    n: int,
) -> models.ApresGaiaMed:

    row = get_or_create_med(db, n)

    row.cas_particulier = None
    row.cas_particulier_commentaire = None
    row.cas_particulier_date = None

    return _touch(db, row)


# --------------------------------------------------------------------- #
#  Solde helpers — single source of truth (profile + rappels)           #
# --------------------------------------------------------------------- #

def compute_montant_ttc(client: models.ApresGaia) -> float:
    total = sum(
        (v for v in (client.abonnement, client.dus_ant, client.montant_compteur) if v is not None),
        0,
    )
    return float(total) if total else 0.0


def compute_solde_du(client: models.ApresGaia, reglements: list[models.ApresGaiaReglement]) -> float:
    """montant_ttc - somme des règlements dont statut='valide' (jamais < 0)."""
    total_verse = sum(
        (
            float(r.somme_versement)
            for r in reglements
            if r.statut == models.VersementStatut.valide and r.somme_versement is not None
        ),
        0.0,
    )
    return max(0.0, round(compute_montant_ttc(client) - total_verse, 2))


# --------------------------------------------------------------------- #
#  apres_gaia_rappel — lecture / statut (la création est dans rappels.py)#
# --------------------------------------------------------------------- #

def list_rappels(
    db: Session,
    n: int | None = None,
    statut: models.RappelStatut | None = None,
    actifs_only: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> list[models.ApresGaiaRappel]:

    stmt = select(models.ApresGaiaRappel)

    if n is not None:
        stmt = stmt.where(models.ApresGaiaRappel.n == n)

    if statut is not None:
        stmt = stmt.where(models.ApresGaiaRappel.statut == statut.value)
    elif actifs_only:
        stmt = stmt.where(models.ApresGaiaRappel.statut != models.RappelStatut.resolu.value)

    stmt = stmt.order_by(models.ApresGaiaRappel.created_at.desc(), models.ApresGaiaRappel.id.desc()).offset(skip).limit(limit)

    return list(db.scalars(stmt))


def get_rappel(db: Session, rappel_id: int) -> models.ApresGaiaRappel | None:
    return db.get(models.ApresGaiaRappel, rappel_id)


def get_rappel_actif(db: Session, n: int) -> models.ApresGaiaRappel | None:
    """Le rappel non résolu le plus récent du client n (None si aucun)."""

    stmt = (
        select(models.ApresGaiaRappel)
        .where(
            models.ApresGaiaRappel.n == n,
            models.ApresGaiaRappel.statut != models.RappelStatut.resolu.value,
        )
        .order_by(models.ApresGaiaRappel.id.desc())
        .limit(1)
    )

    return db.scalars(stmt).first()


def count_rappels(db: Session) -> schemas.RappelCount:
    nouveau = models.RappelStatut.nouveau.value
    resolu = models.RappelStatut.resolu.value

    non_lus = db.scalar(select(func.count()).select_from(models.ApresGaiaRappel).where(models.ApresGaiaRappel.statut == nouveau)) or 0
    actifs = db.scalar(select(func.count()).select_from(models.ApresGaiaRappel).where(models.ApresGaiaRappel.statut != resolu)) or 0

    return schemas.RappelCount(non_lus=non_lus, actifs=actifs)


def mark_rappel_lu(db: Session, rappel: models.ApresGaiaRappel) -> models.ApresGaiaRappel:
    if rappel.statut == models.RappelStatut.nouveau.value:
        rappel.statut = models.RappelStatut.lu.value
        rappel.read_at = func.now()
        db.commit()
        db.refresh(rappel)

    return rappel


def mark_all_rappels_lus(db: Session) -> int:
    result = db.execute(
        update(models.ApresGaiaRappel)
        .where(models.ApresGaiaRappel.statut == models.RappelStatut.nouveau.value)
        .values(statut=models.RappelStatut.lu.value, read_at=func.now())
    )
    db.commit()

    return result.rowcount or 0


# --------------------------------------------------------------------- #
#  Aggregated profile — GET /api/apres-gaia/client/{n}                 #
# --------------------------------------------------------------------- #

def build_apres_gaia_profile(
    db: Session,
    identifiant: str
) -> schemas.ApresGaiaProfile | None:

    # Search ONLY by apres_gaia.n
    client = find_apres_gaia_client(
        db,
        identifiant
    )

    if client is None:
        return None

    montant_ttc = compute_montant_ttc(client)

    tva = round(
        montant_ttc * 19 / 119,
        2
    )

    montant_ht = round(
        montant_ttc - tva,
        2
    )

    reglements = get_reglements_for_client(
        db,
        client.n
    )

    solde_du = compute_solde_du(client, reglements)

    return schemas.ApresGaiaProfile(
        informations_client=schemas.InformationsClientApresGaia(
            n=client.n,
            n_client=client.n_client,
            n_appel=client.n_appel,
            intitule=client.intitule,
            adresse=client.adresse,
            commune=client.commune,
            code_postal=client.code_postal,
            codetat=client.codetat,
            motif_res=client.motif_res,
            type_de_compte=client.type_de_compte,
        ),

        details_facturation=schemas.DetailsFacturationApresGaia(
            montant_ttc=round(
                montant_ttc,
                2
            ),
            tva=tva,
            montant_ht=montant_ht,
        ),

        reglements_historique=list(
            reglements
        ),

        med=med_or_default(
            db,
            client.n
        ),

        rappel_actif=(
            schemas.ApresGaiaRappelOut.model_validate(rappel)
            if (rappel := get_rappel_actif(db, client.n)) is not None
            else None
        ),

        solde_du=solde_du,
    )
# --------------------------------------------------------------------- #
#  Corporate AR (entreprises)                                            #
# --------------------------------------------------------------------- #
CORPORATE_CODE_PREFIX = "CAR-"
_CORPORATE_CODE_RE = re.compile(r"^CAR-(\d+)$", re.IGNORECASE)


def _corporate_files_by_client(db: Session, codes: list[str] | None = None) -> dict[str, list[models.CorporateArFile]]:
    """Métadonnées des fichiers, SANS les octets (colonnes ciblées)."""

    F = models.CorporateArFile
    stmt = select(F.id, F.client_code, F.name, F.content_type, F.size).order_by(F.id)
    if codes is not None:
        stmt = stmt.where(F.client_code.in_(codes))

    out: dict[str, list] = {}
    for row in db.execute(stmt):
        out.setdefault(row.client_code, []).append(schemas.CorporateArFileOut(id=row.id, name=row.name, content_type=row.content_type, size=row.size))
    return out


def _corporate_out(client: models.CorporateArClient, files: list) -> schemas.CorporateArClientOut:
    out = schemas.CorporateArClientOut.model_validate(client)
    out.files = files
    return out


def list_corporate_clients(db: Session) -> list[schemas.CorporateArClientOut]:
    clients = list(db.scalars(select(models.CorporateArClient).order_by(models.CorporateArClient.name, models.CorporateArClient.code)))
    files = _corporate_files_by_client(db)
    return [_corporate_out(c, files.get(c.code, [])) for c in clients]


def get_corporate_client(db: Session, code: str) -> models.CorporateArClient | None:
    return db.get(models.CorporateArClient, code)


def corporate_client_out(db: Session, client: models.CorporateArClient) -> schemas.CorporateArClientOut:
    return _corporate_out(client, _corporate_files_by_client(db, [client.code]).get(client.code, []))


def _clean_optional(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _corporate_values(data: schemas.CorporateArClientIn) -> dict:
    return {
        "name": data.name.strip(),
        "creance": data.creance,
        "numero_facture": _clean_optional(data.numero_facture),
        "date_facture": data.date_facture,
        "designation": data.designation.strip(),
        "observation": data.observation.strip(),
    }


def allocate_corporate_codes(db: Session, count: int) -> list[str]:
    """Réserve `count` codes CAR-xxxxxx. Le compteur ne fait que monter (le code
    d'un client supprimé n'est jamais réattribué) et reste au-dessus de tout code
    CAR-xxxxxx déjà présent (ex. arrivé par un import). Ne commit pas : la
    réservation fait partie de la transaction de l'appelant."""

    if count <= 0:
        return []

    counter = db.scalars(select(models.CorporateArCounter).where(models.CorporateArCounter.id == 1).with_for_update()).first()
    if counter is None:
        counter = models.CorporateArCounter(id=1, last_number=0)
        db.add(counter)
        db.flush()

    max_existing = 0
    for (code,) in db.execute(select(models.CorporateArClient.code).where(models.CorporateArClient.code.like(f"{CORPORATE_CODE_PREFIX}%"))):
        m = _CORPORATE_CODE_RE.match(code)
        if m:
            max_existing = max(max_existing, int(m.group(1)))

    start = max(counter.last_number or 0, max_existing) + 1
    counter.last_number = start + count - 1
    return [f"{CORPORATE_CODE_PREFIX}{start + i:06d}" for i in range(count)]


def create_corporate_client(db: Session, data: schemas.CorporateArClientIn) -> models.CorporateArClient:
    [code] = allocate_corporate_codes(db, 1)
    obj = models.CorporateArClient(code=code, **_corporate_values(data))
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_corporate_client(db: Session, obj: models.CorporateArClient, data: schemas.CorporateArClientIn) -> models.CorporateArClient:
    for key, value in _corporate_values(data).items():
        setattr(obj, key, value)
    obj.updated_at = func.now()
    db.commit()
    db.refresh(obj)
    return obj


def delete_corporate_client(db: Session, obj: models.CorporateArClient) -> None:
    # Les fichiers partent avec lui (ON DELETE CASCADE) ; on les supprime aussi
    # explicitement pour que ce soit vrai même sans les contraintes (SQLite de test).
    db.execute(delete(models.CorporateArFile).where(models.CorporateArFile.client_code == obj.code))
    db.delete(obj)
    db.commit()


def import_corporate_clients(db: Session, rows: list[schemas.CorporateArImportRow]) -> schemas.CorporateArImportResult:
    """Import CSV. Une ligne avec un code déjà connu met à jour ce client (ses
    documents sont conservés) ; une ligne sans code reçoit un code généré. Le
    même code deux fois dans le fichier : la dernière ligne gagne. Tout ou rien."""

    keyed: dict[str, schemas.CorporateArImportRow] = {}
    keyless: list[schemas.CorporateArImportRow] = []
    for r in rows:
        code = (r.code or "").strip()
        if code:
            keyed[code] = r
        else:
            keyless.append(r)

    existing = set(db.scalars(select(models.CorporateArClient.code).where(models.CorporateArClient.code.in_(list(keyed)))) if keyed else [])

    for code, r in keyed.items():
        values = _corporate_values(r)
        obj = db.get(models.CorporateArClient, code)
        if obj is None:
            db.add(models.CorporateArClient(code=code, **values))
        else:
            for k, v in values.items():
                setattr(obj, k, v)
            obj.updated_at = func.now()
    db.flush()  # les codes importés existent avant d'allouer les nouveaux : aucune collision

    for code, r in zip(allocate_corporate_codes(db, len(keyless)), keyless):
        db.add(models.CorporateArClient(code=code, **_corporate_values(r)))

    db.commit()
    return schemas.CorporateArImportResult(
        added=(len(keyed) - len(existing)) + len(keyless),
        updated=len(existing),
        generated=len(keyless),
    )


def add_corporate_file(db: Session, code: str, name: str, content_type: str, data: bytes) -> models.CorporateArFile:
    obj = models.CorporateArFile(client_code=code, name=name, content_type=content_type, size=len(data), data=data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_corporate_file(db: Session, code: str, file_id: int) -> models.CorporateArFile | None:
    obj = db.get(models.CorporateArFile, file_id)
    return obj if obj is not None and obj.client_code == code else None


def delete_corporate_file(db: Session, obj: models.CorporateArFile) -> None:
    db.delete(obj)
    db.commit()
