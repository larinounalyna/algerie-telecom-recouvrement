"""
Tests des rappels de versement (clients ENGAGÉS sans versement depuis un mois).

    cd backend && pip install pytest httpx && pytest -q

Utilise une base SQLite jetable (aucune connexion à ton PostgreSQL) et
désactive le planificateur automatique ; le contrôle est déclenché à la main.
"""
import os
import tempfile
from datetime import date, timedelta

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["REMINDER_SCHEDULER_ENABLED"] = "false"
os.environ["REMINDER_DELAY_DAYS"] = "30"
os.environ["REMINDER_COUNT_PENDING"] = "true"
os.environ["DELETE_VERSEMENT_PASSWORD"] = "test-password"

import pytest
from fastapi.testclient import TestClient

from app import rappels
from app.database import Base, SessionLocal, engine
from app.main import app


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def days_ago(d: int) -> str:
    return (date.today() - timedelta(days=d)).isoformat()


def make_client(c, abonnement=1000.0, dus_ant=0.0, montant_compteur=0.0, intitule="Client Test") -> int:
    r = c.post("/api/apres-gaia", json={"intitule": intitule, "abonnement": abonnement, "dus_ant": dus_ant, "montant_compteur": montant_compteur})
    assert r.status_code == 201, r.text
    return r.json()["rows"][0]["n"]


def engage(c, n, since_days: int):
    r = c.patch(f"/api/apres-gaia/{n}/med", json={"engagement_etat": "ENGAGE", "engagement_date": days_ago(since_days)})
    assert r.status_code == 200, r.text


def verifier(c):
    r = c.post("/api/apres-gaia/rappels/verifier")
    assert r.status_code == 200, r.text
    return r.json()


def test_engaged_client_without_payment_for_a_month_gets_a_rappel(client):
    n = make_client(client)
    engage(client, n, since_days=40)

    res = verifier(client)

    assert res["clients_engages_controles"] == 1
    assert len(res["crees"]) == 1
    r = res["crees"][0]
    assert r["n"] == n and r["statut"] == "nouveau"
    assert r["jours_ecoules"] == 40 and r["mois_impayes"] == 1
    assert r["reference_source"] == "engagement"
    assert r["solde_du"] == 1000.0
    assert f"n° {n}" in r["message"] and "Client Test" in r["message"]

    assert client.get("/api/apres-gaia/rappels/count").json() == {"non_lus": 1, "actifs": 1}


def test_engaged_less_than_a_month_ago_gets_nothing(client):
    n = make_client(client)
    engage(client, n, since_days=29)
    assert verifier(client)["crees"] == []


def test_not_engaged_client_gets_nothing(client):
    make_client(client)  # jamais engagé (pas de ligne med)
    n2 = make_client(client)
    client.patch(f"/api/apres-gaia/{n2}/med", json={"engagement_etat": "NON_ENGAGE", "invitation_paiement_date": days_ago(90)})
    res = verifier(client)
    assert res["clients_engages_controles"] == 0 and res["crees"] == []


def test_recent_payment_resets_the_clock_even_if_still_pending(client):
    n = make_client(client)
    engage(client, n, since_days=90)
    client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 100, "date_versement": days_ago(5)})
    assert verifier(client)["crees"] == []


def test_refused_payment_does_not_count(client):
    n = make_client(client)
    engage(client, n, since_days=90)
    ref = client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 100, "date_versement": days_ago(5)}).json()["ref"]
    client.post(f"/api/apres-gaia/reglements/{ref}/refuser")  # re-contrôle immédiat
    verifier(client)
    rappels_ = client.get(f"/api/apres-gaia/{n}/rappels").json()
    assert len(rappels_) == 1 and rappels_[0]["reference_source"] == "engagement"


def test_clock_restarts_from_last_payment_date(client):
    n = make_client(client)
    engage(client, n, since_days=200)
    client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 100, "date_versement": days_ago(35)})
    verifier(client)  # (le POST du règlement a déjà lancé le contrôle de ce client)
    rappels_ = client.get(f"/api/apres-gaia/{n}/rappels").json()
    assert len(rappels_) == 1
    assert rappels_[0]["reference_source"] == "versement" and rappels_[0]["jours_ecoules"] == 35


def test_running_the_check_twice_does_not_duplicate(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    assert len(verifier(client)["crees"]) == 1
    assert verifier(client)["crees"] == []
    assert len(client.get("/api/apres-gaia/rappels").json()) == 1


def test_new_payment_resolves_the_rappel_immediately(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    verifier(client)
    assert client.get(f"/api/apres-gaia/client/{n}").json()["rappel_actif"] is not None

    client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 100, "date_versement": days_ago(0)})

    assert client.get("/api/apres-gaia/rappels/count").json() == {"non_lus": 0, "actifs": 0}
    assert client.get(f"/api/apres-gaia/client/{n}").json()["rappel_actif"] is None
    assert client.get(f"/api/apres-gaia/{n}/rappels").json()[0]["statut"] == "resolu"


def test_second_missed_month_replaces_the_first_rappel(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    verifier(client)

    with SessionLocal() as db:  # on « avance » le calendrier de 25 jours
        res = rappels.run_check(db, today=date.today() + timedelta(days=25))
        assert len(res.crees) == 1 and res.crees[0].mois_impayes == 2
        assert len(res.resolus) == 1 and res.resolus[0].mois_impayes == 1

    actifs = client.get("/api/apres-gaia/rappels", params={"actifs": True}).json()
    assert len(actifs) == 1 and actifs[0]["mois_impayes"] == 2


def test_no_rappel_when_solde_is_zero(client):
    n = make_client(client, abonnement=100)
    engage(client, n, since_days=60)
    ref = client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 100, "date_versement": days_ago(45)}).json()["ref"]
    client.post(f"/api/apres-gaia/reglements/{ref}/valider")
    assert verifier(client)["crees"] == []


def test_rappel_resolved_when_client_is_no_longer_engaged(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    verifier(client)
    client.patch(f"/api/apres-gaia/{n}/med", json={"engagement_etat": "NON_ENGAGE"})
    res = verifier(client)
    assert len(res["resolus"]) == 1
    assert client.get("/api/apres-gaia/rappels/count").json()["actifs"] == 0


def test_mark_read_and_mark_all_read(client):
    ns = [make_client(client) for _ in range(3)]
    for n in ns:
        engage(client, n, since_days=45)
    verifier(client)
    assert client.get("/api/apres-gaia/rappels/count").json()["non_lus"] == 3

    rid = client.get("/api/apres-gaia/rappels").json()[0]["id"]
    r = client.post(f"/api/apres-gaia/rappels/{rid}/lu").json()
    assert r["statut"] == "lu" and r["read_at"] is not None
    assert client.get("/api/apres-gaia/rappels/count").json() == {"non_lus": 2, "actifs": 3}

    assert client.post("/api/apres-gaia/rappels/lu").json()["deleted"] == 2
    assert client.get("/api/apres-gaia/rappels/count").json() == {"non_lus": 0, "actifs": 3}
    assert client.post("/api/apres-gaia/rappels/99999/lu").status_code == 404
    assert client.get("/api/apres-gaia/99999/rappels").status_code == 404


def test_rappel_is_pushed_over_websocket(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    with client.websocket_connect("/ws") as ws:
        verifier(client)
        import json

        msg = json.loads(ws.receive_text())
    assert msg["event"] == "apres_gaia_rappel.created"
    assert msg["payload"]["n"] == n and msg["payload"]["statut"] == "nouveau"


def test_deleting_a_payment_brings_the_rappel_back(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    verifier(client)
    ref = client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 50, "date_versement": days_ago(0)}).json()["ref"]
    assert client.get("/api/apres-gaia/rappels/count").json()["actifs"] == 0

    assert client.delete(f"/api/apres-gaia/reglements/{ref}", headers={"X-Delete-Password": "test-password"}).status_code == 204

    # le DELETE a lui-même relancé le contrôle : le rappel est déjà de retour (rouvert, pas dupliqué)
    assert client.get("/api/apres-gaia/rappels/count").json() == {"non_lus": 1, "actifs": 1}
    assert len(client.get(f"/api/apres-gaia/{n}/rappels").json()) == 1
    assert verifier(client)["crees"] == []


def test_refusing_a_pending_payment_brings_the_rappel_back(client):
    n = make_client(client)
    engage(client, n, since_days=40)
    ref = client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 50, "date_versement": days_ago(0)}).json()["ref"]
    assert client.get("/api/apres-gaia/rappels/count").json()["actifs"] == 0
    client.post(f"/api/apres-gaia/reglements/{ref}/refuser")
    assert client.get("/api/apres-gaia/rappels/count").json()["actifs"] == 1


def test_cas_particulier_roundtrip(client):
    n = make_client(client)
    r = client.put(f"/api/apres-gaia/{n}/med/engagement/cas-particulier", json={"label": "Situation médicale", "commentaire": "Échéancier sur 12 mois"})
    assert r.status_code == 200 and r.json()["cas_particulier"] == "Situation médicale"
    assert client.get(f"/api/apres-gaia/{n}/med").json()["cas_particulier_commentaire"] == "Échéancier sur 12 mois"
    assert client.delete(f"/api/apres-gaia/{n}/med/engagement/cas-particulier").json()["cas_particulier"] is None


def test_solde_du_unchanged_by_refactor(client):
    n = make_client(client, abonnement=1500, dus_ant=1000, montant_compteur=499.99)
    p = client.get(f"/api/apres-gaia/client/{n}").json()
    assert p["details_facturation"]["montant_ttc"] == 2999.99 and p["solde_du"] == 2999.99
    ref = client.post(f"/api/apres-gaia/{n}/reglements", json={"somme_versement": 2000}).json()["ref"]
    assert client.get(f"/api/apres-gaia/client/{n}").json()["solde_du"] == 2999.99  # en_attente ne compte pas
    client.post(f"/api/apres-gaia/reglements/{ref}/valider")
    assert client.get(f"/api/apres-gaia/client/{n}").json()["solde_du"] == 999.99
