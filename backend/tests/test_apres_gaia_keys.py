"""Recherche Après Gaïa par ancienne clé (4-8 chiffres) ou clé actuelle (14 chiffres).

    cd backend && pytest -q tests/test_apres_gaia_keys.py
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmp.name}")
os.environ["REMINDER_SCHEDULER_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient

from app import keys
from app.database import Base, SessionLocal, engine
from app.main import app
from app import models

BASE = "/api/apres-gaia"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def seed(*rows):
    with SessionLocal() as db:
        for n, name in rows:
            db.add(models.ApresGaia(n=n, intitule=name, n_appel=f"021{n % 1000000:06d}"))
        db.commit()


def found(client, q):
    r = client.get(f"{BASE}/search", params={"q": q})
    assert r.status_code == 200, r.text
    return r.json()


# --- exemples réels fournis (clés actuelles normales et cabines) ---
NORMAL_6 = 10000000838231      # ancienne clé 838231 (ou 83823 + suffixe 1)
NORMAL_5 = 10000000904551
CABINE = 70093981100001        # 7 | 00 | 939811 | 00001
CABINE_2 = 70094333100001


def test_14_digit_key_is_found_exactly(client):
    seed((NORMAL_6, "Client A"), (CABINE, "Cabine B"))
    r = found(client, "10000000838231")
    assert [c["n"] for c in r] == [NORMAL_6]
    assert r[0]["correspondance"] == "exacte" and r[0]["cle_type"] == "normale"
    assert found(client, "70093981100001")[0]["cle_type"] == "cabine"


def test_14_digit_key_does_not_fit_in_32_bits(client):
    seed((CABINE, "Cabine B"))
    assert client.get(f"{BASE}/client/{CABINE}").status_code == 200


def test_old_key_finds_new_key_account(client):
    seed((NORMAL_6, "Client A"), (CABINE, "Cabine B"), (CABINE_2, "Cabine C"))
    assert [c["n"] for c in found(client, "939811")] == [CABINE]
    assert [c["n"] for c in found(client, "943331")] == [CABINE_2]
    assert found(client, "939811")[0]["correspondance"] == "ancienne_cle"
    # les deux lectures possibles de la clé normale sont proposées par la même saisie
    assert [c["n"] for c in found(client, "838231")] == [NORMAL_6]
    assert [c["n"] for c in found(client, "83823")] == [NORMAL_6]


def test_account_still_on_old_format_is_found(client):
    seed((112742, "Ancien format"))
    r = found(client, "112742")
    assert r[0]["n"] == 112742 and r[0]["cle_type"] == "ancienne" and r[0]["correspondance"] == "exacte"


def test_ambiguity_returns_all_candidates_exact_first(client):
    # 1 | 0000000 | 83823 | 1 (compte normal) et 7 | 0000000 | 83823 | 1 (cabine) et l'ancienne clé brute
    other = 70000000838231
    seed((83823, "Resté ancien format"), (NORMAL_6, "Normal"), (other, "Cabine"))
    r = found(client, "83823")
    assert [c["n"] for c in r][0] == 83823            # exacte d'abord
    assert {c["n"] for c in r} == {83823, NORMAL_6, other}


def test_real_leading_zero_is_not_silently_merged(client):
    # nouveau compte dont le bloc commence par un vrai 0 : même "radical" que 1234567, autre compte
    seed((10000001234567, "Ancien 1234567 migré"), (10000012345671, "Autre compte"))
    r = found(client, "1234567")
    assert {c["n"] for c in r} == {10000001234567, 10000012345671}  # les deux proposés, l'agent choisit


def test_no_match_and_bad_input(client):
    seed((NORMAL_6, "Client A"))
    assert found(client, "999999") == []
    assert client.get(f"{BASE}/search", params={"q": "abc"}).json() == []
    assert found(client, "123") == []  # trop court pour être une ancienne clé


def test_ranges_math():
    assert keys.key_kind(CABINE) == "cabine" and keys.key_kind(NORMAL_6) == "normale" and keys.key_kind(112742) == "ancienne"
    assert any(low <= CABINE <= high for low, high in keys.new_key_ranges("939811"))
    assert keys.new_key_ranges("12") == [] and keys.new_key_ranges("123456789") == []
