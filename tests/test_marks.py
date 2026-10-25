
import pytest

from backend.extensions import db
from backend.models.mark import Mark

from test_attendance import (
    app as attendance_app_fixture,
    client as attendance_client_fixture,
    faculty_login,
    login,
    csrf_headers,
)


@pytest.fixture
def app(attendance_app_fixture):
    return attendance_app_fixture


@pytest.fixture
def client(attendance_client_fixture):
    return attendance_client_fixture


def marks_payload(ids, obtained=35, maximum=50):
    return {
        "student_id": ids["student_a"],
        "subject_id": ids["subject"],
        "assessment_name": "ISA 1",
        "marks_obtained": obtained,
        "max_marks": maximum,
    }


def test_create_marks_requires_login(client, app):
    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )
    assert response.status_code == 401


def test_student_cannot_create_marks(client, app):
    login(client, "student.a@example.com")

    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_student_cannot_update_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201
    mark_id = create_response.get_json()["mark_id"]

    client.post("/api/auth/logout", headers=csrf_headers(client))
    login(client, "student.a@example.com")

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=40),
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_faculty_can_create_marks(client, app):
    faculty_login(client)

    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["marks_obtained"] == 35.0
    assert data["max_marks"] == 50.0
    assert data["entered_by"] == app.test_ids["faculty"]


def test_faculty_can_update_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201

    mark_id = create_response.get_json()["mark_id"]

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=40),
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["marks_obtained"] == 40.0


def test_marks_above_maximum_are_rejected(client, app):
    faculty_login(client)

    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids, obtained=51, maximum=50),
        headers=csrf_headers(client),
    )

    assert response.status_code == 400


def test_invalid_update_preserves_existing_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=30),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201
    mark_id = create_response.get_json()["mark_id"]

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=60, maximum=50),
        headers=csrf_headers(client),
    )
    assert response.status_code == 400

    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert float(saved_mark.marks_obtained) == 30.0


def test_updating_nonexistent_mark_returns_404(client, app):
    faculty_login(client)

    response = client.put(
        "/api/marks/999999",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )
    assert response.status_code == 404
