"""Project records and document upload API tests (SQLite, no PostgreSQL needed)."""
import os
from pathlib import Path

database_path = Path(__file__).resolve().with_name("projects_test.sqlite3")
os.environ["DATABASE_URL"] = f"sqlite:///{database_path}"
os.environ["REMINDER_SCHEDULER_ENABLED"] = "false"

from fastapi.testclient import TestClient
import pytest

from app.database import Base, engine
from app.main import app

BASE = "/api/projects"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def payload(**overrides):
    body = {
        "project_name": "Fibre optique secteur Nord",
        "contract_number": "CP-2026-01",
        "amendment_numbers": [1, 2],
        "launch_date": "2026-01-15",
        "pieces_remises": ["Plan de dÃ©viation", "Attachements"],
        "end_date": None,
        "estimated_amount": 1250000.5,
        "final_invoice_amount": None,
        "payment_date": None,
    }
    body.update(overrides)
    return body


def test_create_list_update_delete_project(client):
    response = client.post(BASE, json=payload())
    assert response.status_code == 201, response.text
    project = response.json()
    assert project["amendment_numbers"] == [1, 2]
    assert project["pieces_remises"] == ["Plan de dÃ©viation", "Attachements"]
    assert project["estimated_amount"] == 1250000.5
    assert project["files"] == []

    listed = client.get(BASE)
    assert listed.status_code == 200 and listed.json()[0]["id"] == project["id"]
    assert client.get(f"{BASE}/{project['id']}").json()["contract_number"] == "CP-2026-01"

    updated = client.put(
        f"{BASE}/{project['id']}",
        json=payload(
            amendment_numbers=[1, 2, 3],
            end_date="2026-09-30",
            final_invoice_amount=1100000,
            payment_date="2026-10-10",
        ),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["amendment_numbers"] == [1, 2, 3]
    assert updated.json()["end_date"] == "2026-09-30"
    assert updated.json()["payment_date"] == "2026-10-10"

    assert client.delete(f"{BASE}/{project['id']}").status_code == 204
    assert client.get(f"{BASE}/{project['id']}").status_code == 404


def test_project_validation(client):
    assert client.post(BASE, json=payload(project_name="  ")).status_code == 422
    assert client.post(BASE, json=payload(amendment_numbers=[1, 1])).status_code == 422
    assert client.post(BASE, json=payload(amendment_numbers=[0])).status_code == 422
    assert client.post(BASE, json=payload(estimated_amount=-1)).status_code == 422
    assert client.post(BASE, json=payload(final_invoice_amount=-1)).status_code == 422


def test_project_documents_upload_download_and_delete(client):
    project = client.post(BASE, json=payload()).json()
    project_id = project["id"]

    uploaded = client.post(
        f"{BASE}/{project_id}/files",
        files={"file": ("plan.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    file_info = uploaded.json()
    assert file_info["name"] == "plan.pdf"

    got = client.get(f"{BASE}/{project_id}")
    assert got.json()["files"][0]["id"] == file_info["id"]
    download = client.get(f"{BASE}/{project_id}/files/{file_info['id']}")
    assert download.status_code == 200 and download.content == b"%PDF-1.4 test"

    assert client.get(f"{BASE}/999/files/{file_info['id']}").status_code == 404
    assert client.delete(f"{BASE}/{project_id}/files/{file_info['id']}").status_code == 204
    assert client.get(f"{BASE}/{project_id}").json()["files"] == []


def test_project_documents_validate_file_type_and_delete_with_project(client):
    project_id = client.post(BASE, json=payload()).json()["id"]
    assert client.post(
        f"{BASE}/{project_id}/files", files={"file": ("notes.txt", b"no", "text/plain")}
    ).status_code == 415
    client.post(f"{BASE}/{project_id}/files", files={"file": ("plan.pdf", b"x", "application/pdf")})
    assert client.delete(f"{BASE}/{project_id}").status_code == 204

    from sqlalchemy import func, select
    from app import models
    from app.database import SessionLocal

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(models.ProjectArFile)) == 0


def test_project_websocket_notifies_changes(client):
    with client.websocket_connect("/ws") as websocket:
        response = client.post(BASE, json=payload())
        assert response.status_code == 201
        event = websocket.receive_json()
    assert event == {
        "event": "project_ar.changed",
        "payload": {"action": "created", "project_id": response.json()["id"]},
    }


