"""
Rappels de versement — clients ENGAGÉS qui n'ont rien versé depuis un mois.

Règle
-----
Pour chaque client dont apres_gaia_med.engagement_etat = 'ENGAGE' :

  reference_date = la PLUS RÉCENTE entre
                     · engagement_date
                     · la date du dernier règlement (date_versement, sinon created_at)

  Si  aujourd'hui - reference_date >= REMINDER_DELAY_DAYS  (30 par défaut)
  ET  solde_du > 0
  →  un rappel est créé (statut 'nouveau'), poussé en temps réel par WebSocket
     (événement « apres_gaia_rappel.created ») et gardé en base pour que les
     agents le voient même s'ils n'étaient pas connectés à ce moment-là.

  Un mois de plus sans versement = un nouveau rappel (mois_impayes = 2, 3, …) ;
  il remplace le précédent, il ne s'empile pas.

Un rappel passe à 'resolu' tout seul dès que la situation change : le client a
versé, n'est plus ENGAGE, ou son solde est à 0.

Règlements pris en compte : 'valide' toujours ; 'en_attente' aussi si
REMINDER_COUNT_PENDING=true (défaut) — un versement saisi mais pas encore
validé ne déclenche pas de faux rappel. 'refuse' n'est jamais pris en compte.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .config import get_settings
from .database import SessionLocal
from .realtime import manager

logger = logging.getLogger("rappels")

RAPPEL_TYPE = "versement_mensuel"
_OPEN = (models.RappelStatut.nouveau.value, models.RappelStatut.lu.value)


@dataclass
class CheckResult:
    controles: int = 0
    crees: list[models.ApresGaiaRappel] = field(default_factory=list)
    resolus: list[models.ApresGaiaRappel] = field(default_factory=list)


# --------------------------------------------------------------------- #
#  Calcul                                                                #
# --------------------------------------------------------------------- #
def _counted_statuts() -> set[str]:
    statuts = {models.VersementStatut.valide.value}
    if get_settings().REMINDER_COUNT_PENDING:
        statuts.add(models.VersementStatut.en_attente.value)
    return statuts


def _reference(med: models.ApresGaiaMed, reglements: list[models.ApresGaiaReglement]) -> tuple[date, str] | None:
    """(date de départ du décompte, 'engagement' | 'versement')."""

    counted = _counted_statuts()
    candidates: list[tuple[date, str]] = []

    if med.engagement_date:
        candidates.append((med.engagement_date, "engagement"))

    for r in reglements:
        if r.statut not in counted:
            continue
        d = r.date_versement or (r.created_at.date() if r.created_at else None)
        if d:
            candidates.append((d, "versement"))

    if not candidates:
        # ENGAGE sans date d'engagement ni versement : on part de la dernière modif de la ligne MED
        fallback = med.updated_at or med.created_at
        return (fallback.date(), "engagement") if fallback else None

    return max(candidates, key=lambda c: c[0])


def _message(client: models.ApresGaia, jours: int, mois: int, ref: date, source: str, solde: float) -> str:
    depuis = "son engagement" if source == "engagement" else "son dernier versement"
    nom = f" ({client.intitule})" if client.intitule else ""
    return (
        f"Rappel : le client n° {client.n}{nom} est engagé mais n'a effectué aucun versement "
        f"depuis {depuis} du {ref:%d/%m/%Y} — {jours} jours écoulés"
        f"{f' ({mois} mois)' if mois > 1 else ''}. Solde dû : {solde:.2f}."
    )


def _resolve(db: Session, rappel: models.ApresGaiaRappel) -> None:
    rappel.statut = models.RappelStatut.resolu.value
    rappel.resolved_at = func.now()


# --------------------------------------------------------------------- #
#  Contrôle                                                              #
# --------------------------------------------------------------------- #
def run_check(db: Session, today: date | None = None, only_n: int | None = None) -> CheckResult:
    """Contrôle les clients engagés (tous, ou seulement `only_n`) + nettoie les
    rappels périmés. Commit à la fin."""

    settings = get_settings()
    delay = max(1, settings.REMINDER_DELAY_DAYS)
    today = today or date.today()
    result = CheckResult()

    # 1) Clients potentiellement engagés (on revérifie la DERNIÈRE ligne med de chacun)
    stmt_ns = select(models.ApresGaiaMed.n).where(
        models.ApresGaiaMed.engagement_etat == models.EngagementEtat.ENGAGE.value
    )
    if only_n is not None:
        stmt_ns = stmt_ns.where(models.ApresGaiaMed.n == only_n)

    candidate_ns = sorted(set(db.scalars(stmt_ns)))

    # 2) Tous leurs règlements en une seule requête
    reglements_by_n: dict[int, list[models.ApresGaiaReglement]] = {n: [] for n in candidate_ns}
    if candidate_ns:
        for r in db.scalars(select(models.ApresGaiaReglement).where(models.ApresGaiaReglement.n.in_(candidate_ns))):
            reglements_by_n[r.n].append(r)

    overdue: dict[int, date] = {}  # n -> reference_date des clients actuellement en retard

    for n in candidate_ns:
        med = crud.get_med(db, n)
        client = crud.get_apres_gaia_by_n(db, n)
        if med is None or client is None or med.engagement_etat != models.EngagementEtat.ENGAGE.value:
            continue

        result.controles += 1

        ref = _reference(med, reglements_by_n[n])
        if ref is None:
            continue
        ref_date, source = ref

        jours = (today - ref_date).days
        if jours < delay:
            continue

        solde = crud.compute_solde_du(client, reglements_by_n[n])
        if solde <= 0:
            continue

        overdue[n] = ref_date
        mois = jours // delay
        echeance = ref_date + timedelta(days=delay * mois)

        existing_open = list(
            db.scalars(
                select(models.ApresGaiaRappel).where(
                    models.ApresGaiaRappel.n == n,
                    models.ApresGaiaRappel.type == RAPPEL_TYPE,
                    models.ApresGaiaRappel.reference_date == ref_date,
                    models.ApresGaiaRappel.statut.in_(_OPEN),
                )
            )
        )

        already = db.scalars(
            select(models.ApresGaiaRappel).where(
                models.ApresGaiaRappel.n == n,
                models.ApresGaiaRappel.type == RAPPEL_TYPE,
                models.ApresGaiaRappel.echeance_date == echeance,
            )
        ).first()

        if already is not None:
            if already.statut == models.RappelStatut.resolu.value:
                # Ex. un versement a été supprimé/refusé après coup : le retard est de retour → on rouvre.
                already.statut = models.RappelStatut.nouveau.value
                already.resolved_at = None
                already.read_at = None
                already.jours_ecoules = jours
                already.solde_du = solde
                result.crees.append(already)
            else:
                # Déjà notifié pour cette échéance : pas de nouvelle notification, on rafraîchit juste les chiffres.
                already.jours_ecoules = jours
                already.solde_du = solde
            continue

        new = models.ApresGaiaRappel(
            n=n,
            type=RAPPEL_TYPE,
            reference_date=ref_date,
            reference_source=source,
            echeance_date=echeance,
            mois_impayes=mois,
            jours_ecoules=jours,
            solde_du=solde,
            message=_message(client, jours, mois, ref_date, source, solde),
            statut=models.RappelStatut.nouveau.value,
        )

        try:
            with db.begin_nested():  # savepoint : une course entre 2 workers ne casse pas tout le contrôle
                db.add(new)
                db.flush()
        except IntegrityError:
            continue  # un autre process vient de le créer

        # Le nouveau rappel remplace les anciens (mois précédents) de la même période
        for old in existing_open:
            _resolve(db, old)
            result.resolus.append(old)

        result.crees.append(new)

    # 3) Rappels ouverts devenus sans objet (versement fait, plus engagé, solde 0, ...)
    stmt_open = select(models.ApresGaiaRappel).where(
        models.ApresGaiaRappel.type == RAPPEL_TYPE,
        models.ApresGaiaRappel.statut.in_(_OPEN),
    )
    if only_n is not None:
        stmt_open = stmt_open.where(models.ApresGaiaRappel.n == only_n)

    open_rappels = list(db.scalars(stmt_open))
    for r in open_rappels:
        if r in result.resolus or r in result.crees:
            continue
        if overdue.get(r.n) != r.reference_date:
            _resolve(db, r)
            result.resolus.append(r)

    db.commit()

    for r in result.crees + result.resolus:
        db.refresh(r)

    return result


# --------------------------------------------------------------------- #
#  Temps réel + planificateur                                           #
# --------------------------------------------------------------------- #
def _payload(r: models.ApresGaiaRappel) -> dict:
    return schemas.ApresGaiaRappelOut.model_validate(r).model_dump(mode="json")


def _run_check_in_own_session() -> tuple[int, list[dict], list[dict]]:
    with SessionLocal() as db:
        result = run_check(db)
        return result.controles, [_payload(r) for r in result.crees], [_payload(r) for r in result.resolus]


async def check_and_broadcast() -> tuple[int, int, int]:
    """Lance un contrôle hors de la boucle asyncio (SQLAlchemy est synchrone) puis pousse les événements."""

    controles, crees, resolus = await asyncio.to_thread(_run_check_in_own_session)

    for p in crees:
        await manager.broadcast("apres_gaia_rappel.created", p)
    for p in resolus:
        await manager.broadcast("apres_gaia_rappel.resolved", p)

    logger.info("Contrôle des rappels : %s engagés, %s créés, %s résolus", controles, len(crees), len(resolus))

    return controles, len(crees), len(resolus)


async def scheduler_loop() -> None:
    """Contrôle au démarrage puis toutes les REMINDER_CHECK_INTERVAL_HOURS heures."""

    interval = max(0.01, get_settings().REMINDER_CHECK_INTERVAL_HOURS) * 3600

    while True:
        try:
            await check_and_broadcast()
        except asyncio.CancelledError:
            raise
        except Exception:  # un contrôle raté ne doit jamais tuer le planificateur
            logger.exception("Échec du contrôle des rappels")

        await asyncio.sleep(interval)
