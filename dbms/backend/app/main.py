"""
Run with:
    uvicorn app.main:app --reload --port 8000

Unlike a from-scratch project, the schema here is NOT created by
SQLAlchemy — it's created by running the raw SQL files in backend/sql/
(your real DDL + one additive migration) against Postgres first. See
backend/README.md for the exact commands.
"""
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import rappels as rappels_service
from .config import get_settings
from .routers import apres_gaia, avant_gaia, corporate_ar, rappels, ws

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Démarre le contrôle automatique des rappels de versement (clients engagés
    sans versement depuis un mois) : une fois au démarrage, puis toutes les
    REMINDER_CHECK_INTERVAL_HOURS heures."""

    task = None
    if settings.REMINDER_SCHEDULER_ENABLED:
        task = asyncio.create_task(rappels_service.scheduler_loop())

    yield

    if task is not None:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="AT Recouvrement — API",
    description="Backend for the Gestion des Factures frontend, built on the real avant_gaia / avant_gaia_versement schema.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(avant_gaia.router)
app.include_router(apres_gaia.router)
app.include_router(rappels.router)
app.include_router(corporate_ar.router)
app.include_router(ws.router)


@app.get("/api/health", tags=["Santé"])
def health():
    return {"status": "ok"}
