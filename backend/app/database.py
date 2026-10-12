from __future__ import annotations

import os
from contextlib import closing
from typing import Any, Iterator

from .config import get_settings

settings = get_settings()


class DatabaseSession:
    """Minimal raw-SQL compatibility layer.

    The project is now intentionally using SQL-defined tables and direct DB access;
    SQLAlchemy ORM models have been removed from the application layer.
    """

    def __init__(self, conn: Any | None = None):
        self._conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False

    def close(self):
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def execute(self, *args, **kwargs):
        raise RuntimeError("SQLAlchemy ORM execution has been removed. Use direct psycopg/sqlite queries instead.")

    def scalar(self, *args, **kwargs):
        raise RuntimeError("SQLAlchemy ORM execution has been removed. Use direct psycopg/sqlite queries instead.")

    def commit(self):
        if self._conn is not None:
            self._conn.commit()

    def rollback(self):
        if self._conn is not None:
            self._conn.rollback()


class Base:
    """Compatibility placeholder retained for import safety."""

    metadata = None


def _make_connection():
    database_url = os.getenv("DATABASE_URL") or settings.database_url
    if database_url.startswith("sqlite://"):
        import sqlite3

        db_path = database_url.replace("sqlite:///", "", 1)
        return sqlite3.connect(db_path)

    try:
        import psycopg

        return psycopg.connect(database_url)
    except Exception:
        return None


engine = _make_connection()
SessionLocal = DatabaseSession


def get_db() -> Iterator[DatabaseSession]:
    db = DatabaseSession(_make_connection())
    try:
        yield db
    finally:
        db.close()
