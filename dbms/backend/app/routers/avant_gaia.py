from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/avant-gaia", tags=["Avant Gaïa"])

# NOTE: avant_gaia and avant_gaia_versement are READ-ONLY through this API.
# There is no POST anywhere in this file — rows come from wherever your
# real data pipeline puts them, and this app only ever reads them back
# (list, history, aggregated profile). See backend/README.md.


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


# --------------------------------------------------------------------- #
#  Raw versement table access — READ ONLY                                #
# --------------------------------------------------------------------- #
@router.get("/versements", response_model=list[schemas.AvantGaiaVersementOut])
def list_versements(
    n_abonne: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    return crud.list_versements(db, n_abonne=n_abonne, skip=skip, limit=limit)


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
