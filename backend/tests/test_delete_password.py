"""
Suppression d'un versement : protégée par DELETE_VERSEMENT_PASSWORD (.env).
Calcul TVA : 19 % incluse dans le TTC.

    cd backend && pytest -q tests
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["REMINDER_SCHEDULER_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient

from app import security
from app.config import get_settings
from app.database import Base, engine
from app.main import app

# le navigateur envoie encodeURIComponent(mot de passe) : « é » devient %C3%A9
PW = {"X-Delete-Password": "S3cret-%C3%A9"}


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    # fixé ici (et non à l'import) : les autres fichiers de test posent leurs propres variables
    monkeypatch.setenv("DELETE_VERSEMENT_PASSWORD", "S3cret-é")
    monkeypatch.setenv("DELETE_PASSWORD_MAX_ATTEMPTS", "3")
    monkeypatch.setenv("DELETE_PASSWORD_LOCK_MINUTES", "5")
    get_settings.cache_clear()
    security.reset_attempts()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    get_settings.cache_clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def make_client_with_versement(c, montant=500.0):
    r = c.post("/api/apres-gaia", json={"intitule": "Client", "abonnement": 1000.0, "dus_ant": 200.0, "montant_compteur": 800.0})
    n = r.json()["rows"][0]["n"]
    g = c.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": montant})
    assert g.status_code in (200, 201), g.text
    return n, g.json()["ref"]


def count(c, n):
    return len(c.get(f"/api/apres-gaia/client/{n}").json()["reglements_historique"])


def test_delete_without_password_is_refused(client):
    n, ref = make_client_with_versement(client)
    r = client.delete(f"/api/apres-gaia/reglements/{ref}")
    assert r.status_code == 401
    assert count(client, n) == 1


def test_delete_with_wrong_password_is_refused_and_counts_attempts(client):
    n, ref = make_client_with_versement(client)
    r = client.delete(f"/api/apres-gaia/reglements/{ref}", headers={"X-Delete-Password": "faux"})
    assert r.status_code == 403
    assert "incorrect" in r.json()["detail"].lower()
    assert "2 essai" in r.json()["detail"]
    assert count(client, n) == 1


def test_delete_with_right_password_works(client):
    n, ref = make_client_with_versement(client)
    r = client.delete(f"/api/apres-gaia/reglements/{ref}", headers=PW)
    assert r.status_code == 204
    assert count(client, n) == 0


def test_lockout_after_too_many_failures_even_with_right_password(client):
    n, ref = make_client_with_versement(client)
    for _ in range(3):
        assert client.delete(f"/api/apres-gaia/reglements/{ref}", headers={"X-Delete-Password": "faux"}).status_code == 403
    r = client.delete(f"/api/apres-gaia/reglements/{ref}", headers=PW)
    assert r.status_code == 429
    assert count(client, n) == 1


def test_right_password_resets_the_failure_counter(client):
    n, ref = make_client_with_versement(client)
    client.delete(f"/api/apres-gaia/reglements/{ref}", headers={"X-Delete-Password": "faux"})
    client.delete(f"/api/apres-gaia/reglements/{ref}", headers={"X-Delete-Password": "faux"})
    assert client.delete(f"/api/apres-gaia/reglements/{ref}", headers=PW).status_code == 204


def test_bulk_delete_for_a_client_is_protected_too(client):
    n, _ = make_client_with_versement(client)
    assert client.delete(f"/api/apres-gaia/{n}/reglements").status_code == 401
    assert client.delete(f"/api/apres-gaia/{n}/reglements", headers={"X-Delete-Password": "faux"}).status_code == 403
    assert count(client, n) == 1
    r = client.delete(f"/api/apres-gaia/{n}/reglements", headers=PW)
    assert r.status_code == 200 and r.json()["deleted"] == 1


def test_password_not_configured_disables_deletion(client, monkeypatch):
    n, ref = make_client_with_versement(client)
    monkeypatch.setenv("DELETE_VERSEMENT_PASSWORD", "")
    get_settings.cache_clear()
    r = client.delete(f"/api/apres-gaia/reglements/{ref}", headers=PW)
    assert r.status_code == 503
    assert "DELETE_VERSEMENT_PASSWORD" in r.json()["detail"]
    assert count(client, n) == 1


def test_tva_is_19_percent_included_in_ttc(client):
    n, _ = make_client_with_versement(client)
    f = client.get(f"/api/apres-gaia/client/{n}").json()["details_facturation"]
    assert f["montant_ttc"] == 2000.0
    assert f["tva"] == 319.33          # 2000 × 19 / 119
    assert f["montant_ht"] == 1680.67  # 2000 − 319.33
