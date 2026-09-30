from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.orm import Session

from .. import crud, models, rappels, schemas

from ..database import get_db

from ..realtime import manager


router = APIRouter(
    prefix="/api/apres-gaia",
    tags=["Après Gaïa"]
)


def _as_list(data) -> list:
    """Normalizes a single-object-or-list body into a list, always."""
    return data if isinstance(data, list) else [data]


async def _refresh_rappels(db: Session, n: int) -> None:
    """Re-contrôle les rappels après un règlement (résout ceux devenus sans objet)
    et pousse les événements. Ne doit jamais faire échouer l'écriture du règlement."""

    try:
        result = rappels.run_check(db, only_n=n)

        for r in result.crees:
            await manager.broadcast("apres_gaia_rappel.created", rappels._payload(r))
        for r in result.resolus:
            await manager.broadcast("apres_gaia_rappel.resolved", rappels._payload(r))
    except Exception:
        db.rollback()


# --------------------------------------------------------------------- #
# Raw table access
# --------------------------------------------------------------------- #

@router.get("", response_model=list[schemas.ApresGaiaOut])
def list_rows(
    n: int | None = Query(
        None,
        description="Filtrer sur le n° de compte exact"
    ),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """GET the raw apres_gaia table, optionally filtered by n."""

    return crud.list_apres_gaia(
        db,
        n=n,
        skip=skip,
        limit=limit
    )


@router.get(
    "/database",
    response_model=list[schemas.ApresGaiaOut]
)
def get_database(
    db: Session = Depends(get_db)
):
    """The WHOLE apres_gaia table, no pagination."""

    return crud.list_all_apres_gaia(db)


@router.post(
    "",
    response_model=schemas.ApresGaiaBulkResult,
    status_code=201
)
async def create_rows(
    data: schemas.ApresGaiaCreate | list[schemas.ApresGaiaCreate],
    db: Session = Depends(get_db)
):
    """Insert into apres_gaia.

    Accepts either ONE object or a LIST of objects.
    """

    rows = _as_list(data)

    if not rows:
        raise HTTPException(400, "Liste vide")

    created = crud.create_apres_gaia_bulk(
        db,
        rows
    )

    await manager.broadcast(
        "apres_gaia.created",
        {
            "count": len(created),
            "ns": [r.n for r in created]
        }
    )

    return {
        "inserted": len(created),
        "rows": created
    }


# --------------------------------------------------------------------- #
# Raw règlement (payment) table access
# --------------------------------------------------------------------- #

@router.get(
    "/reglements",
    response_model=list[schemas.ApresGaiaReglementOut]
)
def list_reglements(
    n: int | None = Query(
        None,
        description="Filtrer sur le n° de compte apres_gaia.n"
    ),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """List règlements, optionally filtered by apres_gaia.n."""

    return crud.list_reglements(
        db,
        n=n,
        skip=skip,
        limit=limit
    )


@router.post(
    "/{n}/reglements",
    response_model=schemas.ApresGaiaReglementOut,
    status_code=201
)
async def create_reglement(
    n: int,
    data: schemas.ApresGaiaReglementCreate,
    db: Session = Depends(get_db)
):
    """Records ONE payment against the Après Gaïa account number n.

    Every new règlement starts with statut='en_attente'.
    It does not count towards solde_du until it is validated.
    """

    client = crud.get_apres_gaia_by_n(
        db,
        n
    )

    if client is None:
        raise HTTPException(
            404,
            "Compte introuvable (apres_gaia.n)"
        )

    reglement = crud.create_reglement(
        db,
        n,
        data
    )

    await manager.broadcast(
        "apres_gaia_regelement.created",
        {
            "ref": reglement.ref,
            "n": n,
            "somme_versement": reglement.somme_versement
        }
    )

    # Le client vient de verser : son rappel « aucun versement depuis un mois » n'a plus lieu d'être.
    await _refresh_rappels(db, n)

    return reglement


@router.post(
    "/reglements/{ref}/valider",
    response_model=schemas.ApresGaiaReglementOut
)
async def valider_reglement(
    ref: int,
    db: Session = Depends(get_db)
):
    """Marks one règlement as validated.

    Only validated règlements are subtracted from solde_du.
    """

    r = crud.get_reglement(
        db,
        ref
    )

    if r is None:
        raise HTTPException(
            404,
            "Règlement introuvable"
        )

    r = crud.set_reglement_statut(
        db,
        r,
        models.VersementStatut.valide
    )

    await manager.broadcast(
        "apres_gaia_regelement.validated",
        {
            "ref": r.ref,
            "n": r.n
        }
    )

    await _refresh_rappels(db, r.n)

    return r


@router.post(
    "/reglements/{ref}/refuser",
    response_model=schemas.ApresGaiaReglementOut
)
async def refuser_reglement(
    ref: int,
    db: Session = Depends(get_db)
):
    """Marks one règlement as refused."""

    r = crud.get_reglement(
        db,
        ref
    )

    if r is None:
        raise HTTPException(
            404,
            "Règlement introuvable"
        )

    r = crud.set_reglement_statut(
        db,
        r,
        models.VersementStatut.refuse
    )

    await manager.broadcast(
        "apres_gaia_regelement.refused",
        {
            "ref": r.ref,
            "n": r.n
        }
    )

    await _refresh_rappels(db, r.n)

    return r


@router.delete(
    "/reglements/{ref}",
    status_code=204
)
async def delete_reglement(
    ref: int,
    db: Session = Depends(get_db)
):
    """Deletes ONE versement by its ref. Irreversible — if it was validated,
    solde_du recomputes as if it never happened."""

    r = crud.get_reglement(db, ref)

    if r is None:
        raise HTTPException(404, "Règlement introuvable")

    n = r.n
    crud.delete_reglement(db, ref)

    await manager.broadcast(
        "apres_gaia_regelement.deleted",
        {"ref": ref, "n": n}
    )

    # Supprimer un versement peut remettre le client en retard : re-contrôle immédiat.
    await _refresh_rappels(db, n)


@router.delete(
    "/{n}/reglements",
    response_model=schemas.DeletedCount
)
async def delete_reglements_for_client(
    n: int,
    db: Session = Depends(get_db)
):
    """Deletes EVERY versement recorded for client n (« supprimer les
    versements d'un client »). Irreversible. 404 if n itself doesn't exist
    in apres_gaia; deleting a client with zero versements is a no-op that
    returns {"deleted": 0}."""

    _require_client(db, n)

    count = crud.delete_reglements_for_client(db, n)

    await manager.broadcast(
        "apres_gaia_regelement.deleted",
        {"n": n, "count": count}
    )

    await _refresh_rappels(db, n)

    return {"deleted": count}


# --------------------------------------------------------------------- #
# Mises en demeure (MED) + état juridique — table apres_gaia_med, always
# addressed BY apres_gaia.n (the foreign key)
# --------------------------------------------------------------------- #

def _require_client(db: Session, n: int) -> None:
    if crud.get_apres_gaia_by_n(db, n) is None:
        raise HTTPException(404, "Compte introuvable (apres_gaia.n)")


async def _med_response(db: Session, n: int, action: str, row: models.ApresGaiaMed):
    out = schemas.ApresGaiaMedOut.model_validate(row)

    await manager.broadcast(
        "apres_gaia_med.updated",
        {"n": n, "action": action}
    )

    return out


async def _envoyer(
    step: str,
    action: str,
    already_msg: str,
    n: int,
    body: schemas.EnvoiBody | None,
    db: Session,
):
    _require_client(db, n)

    if crud.is_med_step_done(crud.get_med(db, n), step):
        raise HTTPException(409, already_msg)

    row = crud.mark_med_step(
        db,
        n,
        step,
        body.date_envoi if body else None
    )

    return await _med_response(db, n, action, row)


@router.get(
    "/med",
    response_model=list[schemas.ApresGaiaMedOut]
)
def list_med(
    n: int | None = Query(None, description="Filtrer sur apres_gaia.n"),
    etat_juridique: models.EtatJuridique | None = Query(
        None,
        description="Filtrer sur l'état juridique exact"
    ),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """Liste les lignes apres_gaia_med (une par client qui a un suivi)."""

    return crud.list_med(
        db,
        n=n,
        etat_juridique=etat_juridique,
        skip=skip,
        limit=limit
    )


@router.get("/med/etats-juridiques", response_model=list[str])
def list_etats_juridiques():
    """Les 6 valeurs autorisées de etat_juridique — pour alimenter la liste
    déroulante du frontend."""

    return [e.value for e in models.EtatJuridique]


@router.get(
    "/{n}/med",
    response_model=schemas.ApresGaiaMedOut
)
def get_med(
    n: int,
    db: Session = Depends(get_db)
):
    """Statut MED + état juridique du client n.

    Si aucune ligne n'existe encore, renvoie les valeurs par défaut
    (tout 'NON_ENVOYEE' / 'NON_ENGAGE', 'Procédure en cours', id = null).
    Un GET n'écrit jamais en base.
    """

    _require_client(db, n)

    return crud.med_or_default(db, n)


@router.patch(
    "/{n}/med",
    response_model=schemas.ApresGaiaMedOut
)
async def update_med(
    n: int,
    data: schemas.ApresGaiaMedUpdate,
    db: Session = Depends(get_db)
):
    """Mise à jour partielle (correction manuelle) : seuls les champs
    envoyés changent. Crée la ligne si elle n'existe pas encore."""

    _require_client(db, n)

    row = crud.update_med(db, n, data)

    return await _med_response(db, n, "patch", row)


@router.post(
    "/{n}/med/invitation-paiement/envoyer",
    response_model=schemas.ApresGaiaMedOut
)
async def envoyer_invitation_paiement(
    n: int,
    body: schemas.EnvoiBody | None = None,
    db: Session = Depends(get_db)
):
    """Bouton « Envoyer » — invitation de paiement. ENVOYEE + date (aujourd'hui
    par défaut). 409 si déjà envoyée (utiliser PATCH pour corriger)."""

    return await _envoyer(
        "invitation_paiement",
        "invitation_paiement.envoyee",
        "Invitation de paiement déjà envoyée",
        n, body, db
    )


@router.post(
    "/{n}/med/med-lettre/envoyer",
    response_model=schemas.ApresGaiaMedOut
)
async def envoyer_med_lettre(
    n: int,
    body: schemas.EnvoiBody | None = None,
    db: Session = Depends(get_db)
):
    """Bouton « Envoyer » — mise en demeure par lettre."""

    return await _envoyer(
        "med_lettre",
        "med_lettre.envoyee",
        "Mise en demeure par lettre déjà envoyée",
        n, body, db
    )


@router.post(
    "/{n}/med/engagement/engager",
    response_model=schemas.ApresGaiaMedOut
)
async def enregistrer_engagement(
    n: int,
    body: schemas.EnvoiBody | None = None,
    db: Session = Depends(get_db)
):
    """Bouton « Engagement » — le client s'est engagé : ENGAGE + date."""

    return await _envoyer(
        "engagement",
        "engagement.engage",
        "Engagement déjà enregistré",
        n, body, db
    )


@router.put(
    "/{n}/med/engagement/cas-particulier",
    response_model=schemas.ApresGaiaMedOut
)
async def enregistrer_cas_particulier(
    n: int,
    body: schemas.CasParticulierBody,
    db: Session = Depends(get_db)
):
    """Enregistre ou modifie le cas particulier lié à l'engagement d'un
    client (situation sociale/médicale, échéancier hors barème, etc.).

    Indépendant de `engagement_etat` : un cas particulier peut être noté
    que le client soit ENGAGE ou NON_ENGAGE. Renvoyer ce PUT avec de
    nouvelles valeurs modifie le cas existant (pas d'endpoint séparé pour
    "créer" vs "modifier" — un PUT fait les deux)."""

    _require_client(db, n)

    row = crud.set_cas_particulier(
        db,
        n,
        label=body.label,
        commentaire=body.commentaire,
        when=body.cas_particulier_date
    )

    return await _med_response(db, n, "cas_particulier.set", row)


@router.delete(
    "/{n}/med/engagement/cas-particulier",
    response_model=schemas.ApresGaiaMedOut
)
async def supprimer_cas_particulier(
    n: int,
    db: Session = Depends(get_db)
):
    """Efface le cas particulier (retour à un engagement standard)."""

    _require_client(db, n)

    row = crud.clear_cas_particulier(db, n)

    return await _med_response(db, n, "cas_particulier.cleared", row)


@router.post(
    "/{n}/med/med-huissier/envoyer",
    response_model=schemas.ApresGaiaMedOut
)
async def envoyer_med_huissier(
    n: int,
    body: schemas.MedHuissierEnvoiBody | None = None,
    db: Session = Depends(get_db)
):
    """Bouton « Envoyer » — mise en demeure par huissier. Enregistre aussi
    nom / prénom de l'huissier s'ils sont fournis."""

    _require_client(db, n)

    if crud.is_med_step_done(crud.get_med(db, n), "med_huissier"):
        raise HTTPException(409, "Mise en demeure par huissier déjà envoyée")

    row = crud.set_med_huissier(
        db,
        n,
        nom=body.nom if body else None,
        prenom=body.prenom if body else None,
        when=body.date_envoi if body else None
    )

    return await _med_response(db, n, "med_huissier.envoyee", row)


@router.put(
    "/{n}/med/etat-juridique",
    response_model=schemas.ApresGaiaMedOut
)
async def change_etat_juridique(
    n: int,
    body: schemas.EtatJuridiqueBody,
    db: Session = Depends(get_db)
):
    """Change l'état juridique du client (liste déroulante). Valeurs
    autorisées : GET /api/apres-gaia/med/etats-juridiques."""

    _require_client(db, n)

    row = crud.set_etat_juridique(db, n, body.etat_juridique)

    return await _med_response(db, n, "etat_juridique", row)


# --------------------------------------------------------------------- #
# Aggregated search by Après Gaïa account number
# --------------------------------------------------------------------- #

@router.get(
    "/client/{n}",
    response_model=schemas.ApresGaiaProfile
)
def get_client_profile(
    n: int,
    db: Session = Depends(get_db)
):
    """
    Returns the complete Après Gaïa profile.

    The search is performed ONLY using apres_gaia.n.

    This includes:
    - account information
    - facturation
    - règlement history
    - running solde dû
    """

    profile = crud.build_apres_gaia_profile(
        db,
        str(n)
    )

    if profile is None:
        raise HTTPException(
            404,
            "Compte introuvable (apres_gaia.n)"
        )

    return profile