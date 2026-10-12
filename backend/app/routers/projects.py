from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..realtime import manager

router = APIRouter(prefix="/api/projects", tags=["Projects"])
MAX_FILE_BYTES = 15 * 1024 * 1024


def _get_or_404(db: Session, project_id: int) -> models.ProjectArProject:
    project = crud.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Projet {project_id} introuvable.")
    return project


async def _notify(action: str, project_id: int | None = None) -> None:
    await manager.broadcast("project_ar.changed", {"action": action, "project_id": project_id})


@router.get("", response_model=list[schemas.ProjectArOut])
def list_projects(db: Session = Depends(get_db)):
    return crud.list_projects(db)


@router.get("/{project_id}", response_model=schemas.ProjectArOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    return crud.project_out(db, _get_or_404(db, project_id))


@router.post("", response_model=schemas.ProjectArOut, status_code=201)
async def create_project(body: schemas.ProjectArIn, db: Session = Depends(get_db)):
    project = crud.create_project(db, body)
    await _notify("created", project.id)
    return crud.project_out(db, project)


@router.put("/{project_id}", response_model=schemas.ProjectArOut)
async def update_project(project_id: int, body: schemas.ProjectArIn, db: Session = Depends(get_db)):
    project = crud.update_project(db, _get_or_404(db, project_id), body)
    await _notify("updated", project.id)
    return crud.project_out(db, project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    crud.delete_project(db, _get_or_404(db, project_id))
    await _notify("deleted", project_id)
    return Response(status_code=204)


@router.post("/{project_id}/files", response_model=schemas.ProjectArFileOut, status_code=201)
async def upload_file(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    _get_or_404(db, project_id)
    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf" and not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail=f"« {file.filename} » : seuls les PDF et les images sont acceptés.")

    data = await file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"« {file.filename} » dépasse {MAX_FILE_BYTES // (1024 * 1024)} Mo.")
    if not data:
        raise HTTPException(status_code=422, detail=f"« {file.filename} » est vide.")

    obj = crud.add_project_file(db, project_id, (file.filename or "document")[:255], content_type[:100], data)
    await _notify("updated", project_id)
    return obj


@router.get("/{project_id}/files/{file_id}")
def download_file(project_id: int, file_id: int, db: Session = Depends(get_db)):
    obj = crud.get_project_file(db, project_id, file_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    return Response(
        content=obj.data,
        media_type=obj.content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(obj.name)}"},
    )


@router.delete("/{project_id}/files/{file_id}", status_code=204)
async def delete_file(project_id: int, file_id: int, db: Session = Depends(get_db)):
    obj = crud.get_project_file(db, project_id, file_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    crud.delete_project_file(db, obj)
    await _notify("updated", project_id)
    return Response(status_code=204)
