"""
Tests de l'API Corporate AR (entreprises, documents joints, import CSV).

    cd backend && pip install pytest httpx && pytest -q tests

Base SQLite jetable — aucune connexion à ton PostgreSQL.
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmp.name}")
os.environ["REMINDER_SCHEDULER_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app

BASE = "/api/corporate-ar"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def payload(**over):
    body = {"name": "Sonatrach", "creance": 1500.5, "designation": "Maintenance", "observation": "Non payé"}
    body.update(over)
    return body


def create(c, **over):
    r = c.post(f"{BASE}/clients", json=payload(**over))
    assert r.status_code == 201, r.text
    return r.json()


def test_codes_are_generated_and_sequential(client):
    assert create(client)["code"] == "CAR-000001"
    assert create(client, name="B")["code"] == "CAR-000002"


def test_deleted_code_is_never_reused(client):
    a = create(client)
    assert client.delete(f"{BASE}/clients/{a['code']}").status_code == 204
    assert create(client)["code"] == "CAR-000002"


def test_create_read_update_delete(client):
    c = create(client, numero_facture="F-12", date_facture="2025-01-31")
    assert c["creance"] == 1500.5 and c["numero_facture"] == "F-12" and c["date_facture"] == "2025-01-31" and c["files"] == []

    got = client.get(f"{BASE}/clients/{c['code']}").json()
    assert got["name"] == "Sonatrach"

    r = client.put(f"{BASE}/clients/{c['code']}", json=payload(name="Sonelgaz", creance=0, numero_facture="", date_facture=None))
    assert r.status_code == 200
    assert r.json()["name"] == "Sonelgaz" and r.json()["numero_facture"] is None and r.json()["date_facture"] is None

    assert client.delete(f"{BASE}/clients/{c['code']}").status_code == 204
    assert client.get(f"{BASE}/clients/{c['code']}").status_code == 404
    assert client.put(f"{BASE}/clients/{c['code']}", json=payload()).status_code == 404
    assert client.delete(f"{BASE}/clients/{c['code']}").status_code == 404


def test_validation(client):
    assert client.post(f"{BASE}/clients", json=payload(name="")).status_code == 422
    assert client.post(f"{BASE}/clients", json=payload(creance=-1)).status_code == 422
    assert client.post(f"{BASE}/clients", json=payload(designation="")).status_code == 422
    assert client.post(f"{BASE}/clients", json=payload(observation="")).status_code == 422


def test_list_is_sorted_by_name_and_carries_files(client):
    b = create(client, name="B corp")
    create(client, name="A corp")
    client.post(f"{BASE}/clients/{b['code']}/files", files={"file": ("f.pdf", b"%PDF-1.4 x", "application/pdf")})

    rows = client.get(f"{BASE}/clients").json()
    assert [r["name"] for r in rows] == ["A corp", "B corp"]
    assert rows[0]["files"] == []
    assert rows[1]["files"][0]["name"] == "f.pdf" and rows[1]["files"][0]["size"] == 10
    assert "data" not in rows[1]["files"][0]


def test_file_upload_download_delete(client):
    code = create(client)["code"]
    content = b"\x89PNG\r\n\x1a\n" + bytes(range(256))
    r = client.post(f"{BASE}/clients/{code}/files", files={"file": ("scan é.png", content, "image/png")})
    assert r.status_code == 201, r.text
    meta = r.json()
    assert meta["content_type"] == "image/png" and meta["size"] == len(content)

    d = client.get(f"{BASE}/clients/{code}/files/{meta['id']}")
    assert d.status_code == 200 and d.content == content
    assert d.headers["content-type"] == "image/png"
    assert d.headers["content-disposition"].startswith("inline")

    assert client.delete(f"{BASE}/clients/{code}/files/{meta['id']}").status_code == 204
    assert client.get(f"{BASE}/clients/{code}/files/{meta['id']}").status_code == 404
    assert client.get(f"{BASE}/clients/{code}").json()["files"] == []


def test_file_rules(client):
    code = create(client)["code"]
    other = create(client, name="Autre")["code"]

    bad = client.post(f"{BASE}/clients/{code}/files", files={"file": ("a.txt", b"hello", "text/plain")})
    assert bad.status_code == 415
    empty = client.post(f"{BASE}/clients/{code}/files", files={"file": ("a.pdf", b"", "application/pdf")})
    assert empty.status_code == 422
    assert client.post(f"{BASE}/clients/CAR-999999/files", files={"file": ("a.pdf", b"x", "application/pdf")}).status_code == 404

    ok = client.post(f"{BASE}/clients/{code}/files", files={"file": ("a.pdf", b"x", "application/pdf")}).json()
    # un fichier n'est joignable que par son propre client
    assert client.get(f"{BASE}/clients/{other}/files/{ok['id']}").status_code == 404
    assert client.delete(f"{BASE}/clients/{other}/files/{ok['id']}").status_code == 404


def test_deleting_a_client_deletes_its_files(client):
    from sqlalchemy import func, select

    from app import models
    from app.database import SessionLocal

    code = create(client)["code"]
    client.post(f"{BASE}/clients/{code}/files", files={"file": ("a.pdf", b"x", "application/pdf")})
    client.delete(f"{BASE}/clients/{code}")
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(models.CorporateArFile)) == 0


def test_import_generates_codes_updates_known_ones_and_keeps_files(client):
    existing = create(client, name="Ancien")
    client.post(f"{BASE}/clients/{existing['code']}/files", files={"file": ("a.pdf", b"x", "application/pdf")})

    rows = [
        {**payload(name="Ancien renommé", creance=10), "code": existing["code"]},
        {**payload(name="Sans code 1")},
        {**payload(name="Sans code 2")},
        {**payload(name="Code perso v1"), "code": "ABC-1"},
        {**payload(name="Code perso v2"), "code": "ABC-1"},  # doublon : la dernière ligne gagne
    ]
    r = client.post(f"{BASE}/clients/import", json={"rows": rows})
    assert r.status_code == 201, r.text
    assert r.json() == {"added": 3, "updated": 1, "generated": 2}

    by_code = {c["code"]: c for c in client.get(f"{BASE}/clients").json()}
    assert by_code[existing["code"]]["name"] == "Ancien renommé"
    assert len(by_code[existing["code"]]["files"]) == 1
    assert by_code["ABC-1"]["name"] == "Code perso v2"
    assert {"CAR-000002", "CAR-000003"} <= set(by_code)
    assert len(by_code) == 4


def test_imported_car_code_pushes_the_counter_up(client):
    client.post(f"{BASE}/clients/import", json={"rows": [{**payload(), "code": "CAR-000050"}]})
    assert create(client, name="Suivant")["code"] == "CAR-000051"


def test_import_is_all_or_nothing(client):
    r = client.post(f"{BASE}/clients/import", json={"rows": [payload(), payload(name="")]})
    assert r.status_code == 422
    assert client.get(f"{BASE}/clients").json() == []


def test_websocket_push_on_change(client):
    with client.websocket_connect("/ws") as ws:
        code = create(client)["code"]
        msg = ws.receive_json()
    assert msg == {"event": "corporate_ar.changed", "payload": {"action": "created", "code": code}}
