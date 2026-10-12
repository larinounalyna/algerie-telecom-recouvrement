from __future__ import annotations

import os
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import get_settings
from .models import Base

settings = get_settings()


def _database_url() -> str:
    return os.getenv("DATABASE_URL") or settings.database_url


def _engine_kwargs():
    database_url = _database_url()
    if database_url.startswith("sqlite://"):
        return {"connect_args": {"check_same_thread": False}}
    return {}


engine = create_engine(_database_url(), **_engine_kwargs())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Iterator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
