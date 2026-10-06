"""
Insertion en masse (POST) + suppression totale (DELETE) sur TOUTES les tables.

    cd backend && pytest -q tests

Base SQLite jetable — ne touche pas ton PostgreSQL.
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmp.name}")
os.environ["REMINDER_SCHEDULER_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient

from app import security
from app.config import get_settings
from app.database import Base, engine
from app.main import app

PW = {"X-Delete-Password": "S3cret-%C3%A9"}  # encodeURIComponent("S3cret-é")

AVANT = "/api/avant-gaia"
APRES = "/api/apres-gaia"
CAR = "/api/corporate-ar"

# toutes les routes « vider la table » (méthode DELETE, sans paramètre de chemin)
ALL_DELETE_ALL = [
    AVANT,
    f"{AVANT}/versements",
    APRES,
    f"{APRES}/reglements",
    f"{APRES}/med",
    f"{APRES}/rappels",
    f"{CAR}/clients",
    f"{CAR}/files",
]


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    monkeypatch.setenv("DELETE_VERSEMENT_PASSWORD", "S3cret-é")
    monkeypatch.setenv("DELETE_PASSWORD_MAX_ATTEMPTS", "50")
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


def make_apres(c, count=2):
    r = c.post(APRES, json=[{"intitule": f"Client {i}", "abonnement": 1000.0, "dus_ant": 200.0, "montant_compteur": 800.0} for i in range(count)])
    assert r.status_code == 201, r.text
    return [row["n"] for row in r.json()["rows"]]


def rappel_body(n, **over):
    body = {
        "n": n,
        "reference_date": "2026-08-01",
        "reference_source": "engagement",
        "echeance_date": "2026-08-31",
        "jours_ecoules": 31,
        "message": "Aucun versement depuis un mois",
    }
    body.update(over)
    return body


# --------------------------------------------------------------------- #
#  Protection : aucun « tout supprimer » sans mot de passe               #
# --------------------------------------------------------------------- #
@pytest.mark.parametrize("path", ALL_DELETE_ALL)
def test_every_delete_all_requires_the_password(client, path):
    assert client.delete(path).status_code == 401
    assert client.delete(path, headers={"X-Delete-Password": "faux"}).status_code == 403
    assert client.delete(path, headers=PW).status_code == 200


# --------------------------------------------------------------------- #
#  Avant Gaïa                                                            #
# --------------------------------------------------------------------- #
def test_avant_gaia_insert_one_then_many_then_delete_all(client):
    r = client.post(AVANT, json={"n_abonne": "A1", "intitule": "X", "ttc": 100.5, "dus_anterieur": 12.0, "n_bimestre": 1, "annee_bimestre": 2026})
    assert r.status_code == 201 and r.json() == {"inserted": 1}

    r = client.post(AVANT, json=[{"n_abonne": "A2", "ttc": 1.0}, {"n_abonne": "A3", "ttc": 2.0}])
    assert r.status_code == 201 and r.json() == {"inserted": 2}

    rows = client.get(f"{AVANT}/database").json()
    assert [x["n_abonne"] for x in rows] == ["A1", "A2", "A3"]
    assert rows[0]["dus_anterieur"] == 12.0 and rows[0]["ref"] and rows[0]["created_at"]

    # le profil agrégé lit bien ce qui vient d'être inséré
    assert client.get(f"{AVANT}/client/A1").json()["details_facturation"]["ttc"] == 100.5

    r = client.delete(AVANT, headers=PW)
    assert r.status_code == 200 and r.json()["deleted"] == 3 and r.json()["details"] == {"avant_gaia": 3}
    assert client.get(f"{AVANT}/database").json() == []

    # vider une table vide : 0, pas d'erreur
    assert client.delete(AVANT, headers=PW).json()["deleted"] == 0


def test_avant_gaia_empty_list_is_rejected_and_bad_type_is_422(client):
    assert client.post(AVANT, json=[]).status_code == 400
    assert client.post(AVANT, json={"ttc": "abc"}).status_code == 422
    assert client.get(f"{AVANT}/database").json() == []


def test_avant_gaia_bulk_is_chunked(client):
    rows = [{"n_abonne": f"N{i}", "ttc": float(i)} for i in range(2500)]  # > BULK_CHUNK
    r = client.post(AVANT, json=rows)
    assert r.status_code == 201 and r.json() == {"inserted": 2500}
    assert len(client.get(f"{AVANT}/database").json()) == 2500


def test_avant_gaia_versements_insert_and_delete_all_leave_avant_gaia_alone(client):
    client.post(AVANT, json={"n_abonne": "A1", "ttc": 100.0})
    r = client.post(f"{AVANT}/versements", json=[{"n_abonne": "A1", "montant_versement": 40.0}, {"n_abonne": "A1", "montant_versement": 10.0}])
    assert r.status_code == 201 and r.json() == {"inserted": 2}

    assert client.get(f"{AVANT}/client/A1").json()["solde_du"] == 50.0

    r = client.delete(f"{AVANT}/versements", headers=PW)
    assert r.json() == {"deleted": 2, "details": {"avant_gaia_versement": 2}}
    assert client.get(f"{AVANT}/versements").json() == []
    assert len(client.get(f"{AVANT}/database").json()) == 1
    assert client.get(f"{AVANT}/client/A1").json()["solde_du"] == 100.0


# --------------------------------------------------------------------- #
#  Après Gaïa                                                            #
# --------------------------------------------------------------------- #
def test_apres_gaia_delete_all_wipes_the_children_too(client):
    n1, n2 = make_apres(client)

    assert client.post(f"{APRES}/{n1}/reglements", json={"somme_versement": 10.0}).status_code == 201
    assert client.post(f"{APRES}/{n2}/reglements", json={"somme_versement": 20.0}).status_code == 201
    assert client.post(f"{APRES}/{n1}/med/engagement/engager").status_code == 200
    assert client.post(f"{APRES}/rappels", json=rappel_body(n1)).status_code == 201

    r = client.delete(APRES, headers=PW)
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"] == 2
    assert body["details"] == {"apres_gaia": 2, "apres_gaia_regelement": 2, "apres_gaia_med": 1, "apres_gaia_rappel": 1}

    assert client.get(f"{APRES}/database").json() == []
    assert client.get(f"{APRES}/reglements").json() == []
    assert client.get(f"{APRES}/med").json() == []
    assert client.get(f"{APRES}/rappels").json() == []

    # on peut réinsérer derrière
    assert len(make_apres(client, 3)) == 3
    assert len(client.get(f"{APRES}/database").json()) == 3


def test_reglements_bulk_insert_and_delete_all(client):
    n1, n2 = make_apres(client)

    r = client.post(
        f"{APRES}/reglements",
        json=[
            {"n": n1, "somme_versement": 100.0, "date_versement": "2026-09-01", "lieu_versement": "Alger"},
            {"n": n1, "somme_versement": 50.0, "statut": "valide"},
            {"n": n2, "somme_versement": 70.0},
        ],
    )
    assert r.status_code == 201 and r.json() == {"inserted": 3}

    rows = client.get(f"{APRES}/reglements").json()
    assert [x["statut"] for x in rows] == ["en_attente", "valide", "en_attente"]

    # seul le règlement validé réduit le solde : 2000 - 50
    assert client.get(f"{APRES}/client/{n1}").json()["solde_du"] == 1950.0

    # un seul objet (pas une liste) marche aussi
    assert client.post(f"{APRES}/reglements", json={"n": n2, "somme_versement": 1.0}).json() == {"inserted": 1}

    r = client.delete(f"{APRES}/reglements", headers=PW)
    assert r.json() == {"deleted": 4, "details": {"apres_gaia_regelement": 4}}
    assert client.get(f"{APRES}/reglements").json() == []
    assert len(client.get(f"{APRES}/database").json()) == 2  # les clients restent


def test_reglements_bulk_unknown_n_inserts_nothing(client):
    (n1, _) = make_apres(client)
    r = client.post(f"{APRES}/reglements", json=[{"n": n1, "somme_versement": 1.0}, {"n": 99999, "somme_versement": 2.0}])
    assert r.status_code == 404 and "99999" in r.json()["detail"]
    assert client.get(f"{APRES}/reglements").json() == []
    assert client.post(f"{APRES}/reglements", json=[]).status_code == 400
    assert client.post(f"{APRES}/reglements", json=[{"n": n1, "statut": "nimporte"}]).status_code == 422


def test_med_bulk_insert_rules_and_delete_all(client):
    n1, n2 = make_apres(client)

    r = client.post(
        f"{APRES}/med",
        json=[
            {"n": n1, "engagement_etat": "ENGAGE", "engagement_date": "2026-08-01", "etat_juridique": "Dossier clôturé"},
            {"n": n2},
        ],
    )
    assert r.status_code == 201 and r.json() == {"inserted": 2}

    m = client.get(f"{APRES}/{n1}/med").json()
    assert m["engagement_etat"] == "ENGAGE" and m["engagement_date"] == "2026-08-01" and m["etat_juridique"] == "Dossier clôturé"
    assert client.get(f"{APRES}/{n2}/med").json()["engagement_etat"] == "NON_ENGAGE"

    # une seule ligne par client : déjà existante -> 409, inconnu -> 404, doublon -> 409, valeur invalide -> 422
    assert client.post(f"{APRES}/med", json={"n": n1}).status_code == 409
    assert client.post(f"{APRES}/med", json={"n": 99999}).status_code == 404
    assert client.post(f"{APRES}/med", json=[{"n": n1}, {"n": n1}]).status_code == 409
    assert client.post(f"{APRES}/med", json={"n": n1, "etat_juridique": "n'importe quoi"}).status_code == 422
    assert len(client.get(f"{APRES}/med").json()) == 2

    r = client.delete(f"{APRES}/med", headers=PW)
    assert r.json() == {"deleted": 2, "details": {"apres_gaia_med": 2}}
    assert client.get(f"{APRES}/med").json() == []
    assert client.get(f"{APRES}/{n1}/med").json()["id"] is None  # retour aux valeurs par défaut
    assert len(client.get(f"{APRES}/database").json()) == 2


def test_rappels_bulk_insert_rules_and_delete_all(client):
    (n1, _) = make_apres(client)

    r = client.post(f"{APRES}/rappels", json=[rappel_body(n1), rappel_body(n1, echeance_date="2026-09-30", mois_impayes=2)])
    assert r.status_code == 201 and r.json() == {"inserted": 2}
    assert client.get(f"{APRES}/rappels/count").json()["non_lus"] == 2

    # doublon dans la requête / déjà en base -> 409 ; n inconnu -> 404 ; source invalide -> 422
    assert client.post(f"{APRES}/rappels", json=[rappel_body(n1, echeance_date="2026-01-01")] * 2).status_code == 409
    assert client.post(f"{APRES}/rappels", json=rappel_body(n1)).status_code == 409
    assert client.post(f"{APRES}/rappels", json=rappel_body(99999)).status_code == 404
    assert client.post(f"{APRES}/rappels", json=rappel_body(n1, reference_source="autre")).status_code == 422
    assert len(client.get(f"{APRES}/rappels").json()) == 2

    r = client.delete(f"{APRES}/rappels", headers=PW)
    assert r.json() == {"deleted": 2, "details": {"apres_gaia_rappel": 2}}
    assert client.get(f"{APRES}/rappels/count").json() == {"non_lus": 0, "actifs": 0}


def test_existing_single_row_endpoints_still_work(client):
    """Les routes déjà là ne sont pas masquées par les nouvelles."""

    (n1, _) = make_apres(client)
    assert client.post(f"{APRES}/{n1}/reglements", json={"somme_versement": 5.0}).status_code == 201
    assert client.get(f"{APRES}/{n1}/med").status_code == 200
    assert client.get(f"{APRES}/{n1}/rappels").status_code == 200
    assert client.get(f"{APRES}/rappels/count").status_code == 200
    ref = client.get(f"{APRES}/reglements").json()[0]["ref"]
    assert client.delete(f"{APRES}/reglements/{ref}", headers=PW).status_code == 204
    assert client.delete(f"{APRES}/{n1}/reglements", headers=PW).json()["deleted"] == 0


# --------------------------------------------------------------------- #
#  Corporate AR                                                          #
# --------------------------------------------------------------------- #
def new_company(c, name="Sonatrach"):
    r = c.post(f"{CAR}/clients", json={"name": name, "creance": 10, "designation": "D", "observation": "O"})
    assert r.status_code == 201, r.text
    return r.json()["code"]


def attach(c, code):
    r = c.post(f"{CAR}/clients/{code}/files", files={"file": ("f.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert r.status_code == 201, r.text


def test_corporate_delete_all_clients_removes_files_and_never_reuses_codes(client):
    a, b = new_company(client, "A"), new_company(client, "B")
    attach(client, a)
    attach(client, b)

    r = client.delete(f"{CAR}/clients", headers=PW)
    assert r.json() == {"deleted": 2, "details": {"corporate_ar_file": 2, "corporate_ar_client": 2}}
    assert client.get(f"{CAR}/clients").json() == []

    assert new_company(client) == "CAR-000003"  # le compteur n'est pas remis à zéro


def test_corporate_delete_all_files_keeps_the_companies(client):
    a = new_company(client)
    attach(client, a)
    attach(client, a)

    r = client.delete(f"{CAR}/files", headers=PW)
    assert r.json() == {"deleted": 2, "details": {"corporate_ar_file": 2}}

    got = client.get(f"{CAR}/clients/{a}").json()
    assert got["name"] == "Sonatrach" and got["files"] == []


def test_corporate_bulk_insert_is_the_existing_import(client):
    r = client.post(f"{CAR}/clients/import", json={"rows": [{"name": "A", "creance": 1, "designation": "D", "observation": "O"}, {"name": "B", "creance": 2, "designation": "D", "observation": "O"}]})
    assert r.status_code == 201 and r.json() == {"added": 2, "updated": 0, "generated": 2}
    assert client.delete(f"{CAR}/clients", headers=PW).json()["deleted"] == 2
