from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..realtime import manager
from ..security import require_delete_password
from ._common import db_error, require_rows

router = APIRouter(prefix="/api/avant-gaia", tags=["Avant Gaïa"])

# Reads, plus — added on request — bulk insert (POST) and delete-all (DELETE)
# for BOTH tables (avant_gaia, avant_gaia_versement). Still no per-row
# update, and no valider/refuser here: that workflow lives on Après Gaïa.
# Every DELETE-all is protected by the X-Delete-Password header
# (DELETE_VERSEMENT_PASSWORD in .env), same as Après Gaïa's deletes.


# --------------------------------------------------------------------- #
#  Raw table access                                                      #
# --------------------------------------------------------------------- #
@router.get("", response_model=list[schemas.AvantGaiaOut])
def list_rows(
    n_abonne: str | None = Query(None, description="Filtrer sur un numéro d'abonné exact"),
    actel: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """GET the raw avant_gaia table (paginated, optionally filtered)."""
    return crud.list_avant_gaia(db, n_abonne=n_abonne, actel=actel, skip=skip, limit=limit)


@router.get("/database", response_model=list[schemas.AvantGaiaOut])
def get_database(db: Session = Depends(get_db)):
    """The WHOLE avant_gaia table, no pagination — for a frontend "base de
    données" screen that filters/exports locally. If this table grows very
    large, prefer `GET /api/avant-gaia` (paginated) instead."""
    return crud.list_all_avant_gaia(db)


@router.post("", response_model=schemas.BulkInsertResult, status_code=201)
async def create_rows(
    data: schemas.AvantGaiaCreate | list[schemas.AvantGaiaCreate],
    db: Session = Depends(get_db),
):
    """INSERT into avant_gaia — ONE object or a LIST of objects (tout ou rien).

    `ref`, `created_at`, `updated_at` are set by the database."""

    rows = require_rows(data)

    try:
        inserted = crud.create_avant_gaia_bulk(db, rows)
    except SQLAlchemyError as exc:
        raise db_error(exc)

    await manager.broadcast("avant_gaia.created", {"count": inserted})

    return {"inserted": inserted}


@router.delete(
    "",
    response_model=schemas.DeleteAllResult,
    dependencies=[Depends(require_delete_password)],
)
async def delete_all(db: Session = Depends(get_db)):
    """DELETE every row of avant_gaia. Irreversible.

    Does NOT touch avant_gaia_versement (no foreign key links them) — use
    DELETE /api/avant-gaia/versements for that.

    Protégé : en-tête `X-Delete-Password` = DELETE_VERSEMENT_PASSWORD (.env)."""

    details = crud.delete_all_avant_gaia(db)

    await manager.broadcast("avant_gaia.deleted_all", {"count": details["avant_gaia"]})

    return {"deleted": details["avant_gaia"], "details": details}


# --------------------------------------------------------------------- #
#  Raw versement table access                                            #
# --------------------------------------------------------------------- #
@router.get("/versements", response_model=list[schemas.AvantGaiaVersementOut])
def list_versements(
    n_abonne: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    return crud.list_versements(db, n_abonne=n_abonne, skip=skip, limit=limit)


@router.post("/versements", response_model=schemas.BulkInsertResult, status_code=201)
async def create_versements(
    data: schemas.AvantGaiaVersementCreate | list[schemas.AvantGaiaVersementCreate],
    db: Session = Depends(get_db),
):
    """INSERT into avant_gaia_versement — ONE object or a LIST of objects (tout ou rien)."""

    rows = require_rows(data)

    try:
        inserted = crud.create_avant_gaia_versement_bulk(db, rows)
    except SQLAlchemyError as exc:
        raise db_error(exc)

    await manager.broadcast("avant_gaia_versement.created", {"count": inserted})

    return {"inserted": inserted}


@router.delete(
    "/versements",
    response_model=schemas.DeleteAllResult,
    dependencies=[Depends(require_delete_password)],
)
async def delete_all_versements(db: Session = Depends(get_db)):
    """DELETE every row of avant_gaia_versement. Irreversible.

    Protégé : en-tête `X-Delete-Password` = DELETE_VERSEMENT_PASSWORD (.env)."""

    details = crud.delete_all_avant_gaia_versements(db)

    await manager.broadcast("avant_gaia_versement.deleted_all", {"count": details["avant_gaia_versement"]})

    return {"deleted": details["avant_gaia_versement"], "details": details}


# --------------------------------------------------------------------- #
#  Aggregated "recherche par N° Abonné" — mirrors the screenshot         #
# --------------------------------------------------------------------- #
@router.get("/client/{n_abonne}", response_model=schemas.AvantGaiaProfile)
def get_client_profile(n_abonne: str, db: Session = Depends(get_db)):
    """
    Everything the search box in the mockup needs in one call: client
    info + facturation details (from the most recent bimestre row),
    consommation history (derived across all rows for this abonné) and
    payment history — see schemas.AvantGaiaProfile for the exact shape,
    and its `solde_du_note` field for the caveat on how solde is computed.
    """
    profile = crud.build_profile(db, n_abonne)
    if profile is None:
        raise HTTPException(404, "Aucune donnée pour ce numéro d'abonné")
    return profile
