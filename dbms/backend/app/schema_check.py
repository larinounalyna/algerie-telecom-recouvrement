"""
Startup schema check.

The schema here is created by hand-run SQL files (backend/sql/*.sql), not by
SQLAlchemy — so nothing stops the app from starting against a database that's
missing a later migration. When that happens the failure used to be a raw
`UndefinedColumn` / `UndefinedTable` psycopg traceback the first time someone
clicked the affected button (e.g. "cas particulier" needs `007`, the rappels
bell needs `008`), which looks like "it's just broken" rather than "run one
more migration".

This module runs a handful of read-only `information_schema` checks once at
startup and logs, in plain language, exactly which `sql/0NN_*.sql` file to
run for anything that's missing. It never raises and never blocks startup —
the rest of the API keeps working normally; only the specific
feature(s) tied to the missing piece would still fail until the migration is
applied. `missing_migrations()` is also used by `/api/health` so this can be
checked with a single `curl` instead of reading server logs.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger("app.schema_check")

# Each entry: (human label, migration file to run, SQL that returns 1 row if OK / 0 rows if missing)
_CHECKS: list[tuple[str, str, str]] = [
    (
        "apres_gaia_med.cas_particulier*",
        "sql/007_add_apres_gaia_med_cas_particulier.sql",
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apres_gaia_med' AND column_name = 'cas_particulier'
        """,
    ),
    (
        "apres_gaia_rappel table",
        "sql/008_schema_apres_gaia_rappel.sql",
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'apres_gaia_rappel'
        """,
    ),
    (
        "apres_gaia_med table",
        "sql/006_schema_apres_gaia_med.sql",
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'apres_gaia_med'
        """,
    ),
    (
        "apres_gaia_regelement.statut",
        "sql/005_add_apres_gaia_regelement_statut.sql",
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apres_gaia_regelement' AND column_name = 'statut'
        """,
    ),
]


def missing_migrations(engine: Engine) -> list[str]:
    """Returns the `sql/0NN_*.sql` file names for anything not yet applied.

    Read-only and defensive: any connection error is logged and treated as
    "can't tell" (returns `[]`) rather than crashing the caller.
    """
    missing: list[str] = []
    try:
        with engine.connect() as conn:
            for label, migration, query in _CHECKS:
                found = conn.execute(text(query)).first() is not None
                if not found:
                    missing.append(migration)
                    logger.warning("Schema check: %s not found — run `psql -d <db> -f %s`.", label, migration)
    except Exception:  # pragma: no cover - diagnostic only, never fatal
        logger.exception("Schema check could not run (DB unreachable?) — skipping.")
        return []
    return missing


def log_schema_check(engine: Engine) -> None:
    missing = missing_migrations(engine)
    if missing:
        logger.warning(
            "Schema check: %d migration(s) not yet applied: %s. "
            "The rest of the API will work; only the feature(s) tied to these will fail until you run them. "
            "Quickest fix: `bash sql/apply_all.sh <your db name>` (safe to re-run, nothing is dropped).",
            len(missing),
            ", ".join(missing),
        )
    else:
        logger.info("Schema check: all migrations present.")