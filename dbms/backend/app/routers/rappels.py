from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import crud, models, rappels, schemas
from ..database import get_db
from ..realtime import manager

router = APIRouter(prefix="/api/apres-gaia", tags=["Rappels de versement"])

# Rappel = « ce client est ENGAGÉ mais n'a rien versé depuis un mois ».
# Créés automatiquement (contrôle quotidien, voir app/rappels.py) — il n'y a
# volontairement pas de POST pour en créer un à la main.


@router.get("/rappels", response_model=list[schemas.ApresGaiaRappelOut])
def list_rappels(
    n: int | None = Query(None, description="Filtrer sur apres_gaia.n"),
    statut: models.RappelStatut | None = Query(None, description="nouveau | lu | resolu"),
    actifs: bool = Query(False, description="true = seulement les rappels non résolus (nouveau + lu)"),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """Liste des notifications, la plus récente d'abord — alimente la cloche du frontend."""

    return crud.list_rappels(db, n=n, statut=statut, actifs_only=actifs, skip=skip, limit=limit)


@router.get("/rappels/count", response_model=schemas.RappelCount)
def count_rappels(db: Session = Depends(get_db)):
    """`non_lus` = pastille rouge de la cloche ; `actifs` = rappels encore à traiter."""

    return crud.count_rappels(db)


@router.post("/rappels/verifier", response_model=schemas.RappelCheckResult)
async def verifier_rappels(db: Session = Depends(get_db)):
    """Lance le contrôle MAINTENANT (le même que celui qui tourne automatiquement
    chaque jour). Utile après un import, pour tester, ou si le planificateur est
    désactivé (REMINDER_SCHEDULER_ENABLED=false)."""

    result = rappels.run_check(db)

    for r in result.crees:
        await manager.broadcast("apres_gaia_rappel.created", rappels._payload(r))
    for r in result.resolus:
        await manager.broadcast("apres_gaia_rappel.resolved", rappels._payload(r))

    return schemas.RappelCheckResult(
        clients_engages_controles=result.controles,
        crees=[schemas.ApresGaiaRappelOut.model_validate(r) for r in result.crees],
        resolus=[schemas.ApresGaiaRappelOut.model_validate(r) for r in result.resolus],
    )


@router.post("/rappels/lu", response_model=schemas.DeletedCount)
async def marquer_tout_lu(db: Session = Depends(get_db)):
    """« Tout marquer comme lu » — renvoie {"deleted": <nombre de rappels passés à 'lu'>}."""

    count = crud.mark_all_rappels_lus(db)

    await manager.broadcast("apres_gaia_rappel.read", {"count": count})

    return {"deleted": count}


@router.post("/rappels/{rappel_id}/lu", response_model=schemas.ApresGaiaRappelOut)
async def marquer_lu(rappel_id: int, db: Session = Depends(get_db)):
    """Marque UN rappel comme lu (sans effet s'il l'est déjà ou s'il est résolu)."""

    r = crud.get_rappel(db, rappel_id)

    if r is None:
        raise HTTPException(404, "Rappel introuvable")

    r = crud.mark_rappel_lu(db, r)

    await manager.broadcast("apres_gaia_rappel.read", {"id": r.id, "n": r.n})

    return r


@router.get("/{n}/rappels", response_model=list[schemas.ApresGaiaRappelOut])
def rappels_du_client(
    n: int,
    actifs: bool = Query(False, description="true = seulement les rappels non résolus"),
    db: Session = Depends(get_db),
):
    """Historique des rappels d'un client (pour sa fiche)."""

    if crud.get_apres_gaia_by_n(db, n) is None:
        raise HTTPException(404, "Compte introuvable (apres_gaia.n)")

    return crud.list_rappels(db, n=n, actifs_only=actifs, limit=1000)
