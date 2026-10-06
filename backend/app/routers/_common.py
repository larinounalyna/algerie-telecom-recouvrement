"""Petits utilitaires partagés par les routes « insérer en masse » / « tout supprimer »."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError


def as_list(data) -> list:
    """Un objet seul ou une liste d'objets -> toujours une liste."""

    return data if isinstance(data, list) else [data]


def require_rows(data) -> list:
    rows = as_list(data)

    if not rows:
        raise HTTPException(400, "Liste vide")

    return rows


def db_error(exc: SQLAlchemyError) -> HTTPException:
    """Traduit une erreur SQL d'insertion (rien n'a été écrit : tout ou rien)."""

    if isinstance(exc, IntegrityError):
        return HTTPException(409, f"Insertion refusée par la base (contrainte non respectée) : {str(exc.orig)[:300]}")

    return HTTPException(500, f"Erreur base de données : {str(exc)[:300]}")


def preview(values, limit: int = 10) -> str:
    values = list(values)
    shown = ", ".join(str(v) for v in values[:limit])

    return shown + (f" … (+{len(values) - limit})" if len(values) > limit else "")
