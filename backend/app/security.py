"""Protection par mot de passe de la suppression des versements.

Le mot de passe vit dans le fichier .env du backend (DELETE_VERSEMENT_PASSWORD) ;
il n'est jamais écrit dans le frontend ni renvoyé par l'API. Le navigateur
l'envoie dans l'en-tête `X-Delete-Password` avec la requête DELETE, encodé en
pourcentage (encodeURIComponent) : un en-tête HTTP ne peut pas porter d'accents
ou de caractères arabes tels quels.

  - non défini côté serveur  -> 503 (suppression désactivée, message explicite)
  - en-tête absent / vide    -> 401 « Mot de passe requis. »
  - mauvais mot de passe     -> 403 « Mot de passe incorrect. » (+ essais restants)
  - trop d'essais ratés      -> 429 avec le temps d'attente (blocage par adresse IP)
"""
from __future__ import annotations

import secrets
import time
from collections import defaultdict, deque
from urllib.parse import unquote

from fastapi import Header, HTTPException, Request

from .config import get_settings

# adresse IP -> horodatages (monotonic) des essais ratés encore dans la fenêtre
_failures: dict[str, deque[float]] = defaultdict(deque)


def reset_attempts() -> None:
    """Vide le compteur d'essais (utilisé par les tests)."""

    _failures.clear()


def _client_id(request: Request) -> str:
    return request.client.host if request.client else "inconnu"


def _recent_failures(client_id: str, window: float) -> deque[float]:
    now = time.monotonic()
    q = _failures[client_id]
    while q and now - q[0] > window:
        q.popleft()
    return q


def require_delete_password(request: Request, x_delete_password: str | None = Header(default=None)) -> None:
    """Dépendance FastAPI à placer sur toute route qui supprime des versements."""

    settings = get_settings()
    expected = settings.DELETE_VERSEMENT_PASSWORD

    if not expected:
        raise HTTPException(
            503,
            "Suppression désactivée : définissez DELETE_VERSEMENT_PASSWORD dans le fichier .env du backend, puis redémarrez-le.",
        )

    window = settings.DELETE_PASSWORD_LOCK_MINUTES * 60
    client_id = _client_id(request)
    failures = _recent_failures(client_id, window)

    if len(failures) >= settings.DELETE_PASSWORD_MAX_ATTEMPTS:
        wait = max(1, int(window - (time.monotonic() - failures[0])))
        minutes, seconds = divmod(wait, 60)
        delay = f"{minutes} min {seconds:02d} s" if minutes else f"{seconds} s"
        raise HTTPException(429, f"Trop de tentatives incorrectes. Réessayez dans {delay}.")

    if not x_delete_password:
        raise HTTPException(401, "Mot de passe requis pour supprimer un versement.")

    given = unquote(x_delete_password)

    # compare_digest sur des octets : temps constant, accepte les accents
    if not secrets.compare_digest(given.encode("utf-8"), expected.encode("utf-8")):
        failures.append(time.monotonic())
        left = settings.DELETE_PASSWORD_MAX_ATTEMPTS - len(failures)
        hint = f" ({left} essai(s) restant(s))" if left > 0 else " Accès bloqué temporairement."
        raise HTTPException(403, f"Mot de passe incorrect.{hint}")

    failures.clear()
