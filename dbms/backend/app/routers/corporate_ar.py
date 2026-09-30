from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..realtime import manager

router = APIRouter(prefix="/api/corporate-ar", tags=["Corporate AR"])

# Documents joints : PDF ou images, 15 Mo maximum chacun.
MAX_FILE_BYTES = 15 * 1024 * 1024


def _get_or_404(db: Session, code: str) -> models.CorporateArClient:
    client = crud.get_corporate_client(db, code)
    if client is None:
        raise HTTPException(status_code=404, detail=f"Entreprise {code} introuvable.")
    return client


async def _notify(action: str, code: str | None = None) -> None:
    """Prévient les autres écrans ouverts (WebSocket) qu'ils doivent se rafraîchir."""

    await manager.broadcast("corporate_ar.changed", {"action": action, "code": code})


@router.get("/clients", response_model=list[schemas.CorporateArClientOut])
def list_clients(db: Session = Depends(get_db)):
    """Toute la table, non paginée (comme /database) : l'écran « Base de données »
    filtre, trie et exporte côté navigateur. Chaque client porte la liste (sans
    octets) de ses documents joints."""

    return crud.list_corporate_clients(db)


@router.get("/clients/{code}", response_model=schemas.CorporateArClientOut)
def get_client(code: str, db: Session = Depends(get_db)):
    return crud.corporate_client_out(db, _get_or_404(db, code))


@router.post("/clients", response_model=schemas.CorporateArClientOut, status_code=201)
async def create_client(body: schemas.CorporateArClientIn, db: Session = Depends(get_db)):
    """Crée une entreprise ; son code CAR-xxxxxx est généré ici, jamais saisi."""

    obj = crud.create_corporate_client(db, body)
    await _notify("created", obj.code)
    return crud.corporate_client_out(db, obj)


@router.put("/clients/{code}", response_model=schemas.CorporateArClientOut)
async def update_client(code: str, body: schemas.CorporateArClientIn, db: Session = Depends(get_db)):
    obj = crud.update_corporate_client(db, _get_or_404(db, code), body)
    await _notify("updated", code)
    return crud.corporate_client_out(db, obj)


@router.delete("/clients/{code}", status_code=204)
async def delete_client(code: str, db: Session = Depends(get_db)):
    """Supprime l'entreprise ET ses documents joints. Irréversible."""

    crud.delete_corporate_client(db, _get_or_404(db, code))
    await _notify("deleted", code)
    return Response(status_code=204)


@router.post("/clients/import", response_model=schemas.CorporateArImportResult, status_code=201)
async def import_clients(body: schemas.CorporateArImportIn, db: Session = Depends(get_db)):
    """Import CSV (déjà lu côté navigateur). Code connu → mise à jour (documents
    conservés) ; pas de code → un code est généré. Tout ou rien."""

    result = crud.import_corporate_clients(db, body.rows)
    await _notify("imported")
    return result


# --------------------------------------------------------------------- #
#  Documents joints                                                      #
# --------------------------------------------------------------------- #
@router.post("/clients/{code}/files", response_model=schemas.CorporateArFileOut, status_code=201)
async def upload_file(code: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    _get_or_404(db, code)

    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf" and not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail=f"« {file.filename} » : seuls les PDF et les images sont acceptés.")

    data = await file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"« {file.filename} » dépasse {MAX_FILE_BYTES // (1024 * 1024)} Mo.")
    if not data:
        raise HTTPException(status_code=422, detail=f"« {file.filename} » est vide.")

    obj = crud.add_corporate_file(db, code, (file.filename or "document")[:255], content_type[:100], data)
    await _notify("updated", code)
    return obj


@router.get("/clients/{code}/files/{file_id}")
def download_file(code: str, file_id: int, db: Session = Depends(get_db)):
    """Renvoie les octets, affichés directement par le navigateur (inline)."""

    obj = crud.get_corporate_file(db, code, file_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    return Response(
        content=obj.data,
        media_type=obj.content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(obj.name)}"},
    )


@router.delete("/clients/{code}/files/{file_id}", status_code=204)
async def delete_file(code: str, file_id: int, db: Session = Depends(get_db)):
    obj = crud.get_corporate_file(db, code, file_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    crud.delete_corporate_file(db, obj)
    await _notify("updated", code)
    return Response(status_code=204)
