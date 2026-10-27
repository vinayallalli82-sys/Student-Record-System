import pytest

@pytest.fixture
def app(attendance_app_fixture):
    return attendance_app_fixture


@pytest.fixture
def client(attendance_client_fixture):
    return attendance_client_fixture

from test_attendance import (
    app as attendance_app_fixture,
    client as attendance_client_fixture,
    faculty_login,
    login,
)


def test_faculty_can_view_student_profile(client, app):
    faculty_login(client)

    student_id = app.test_ids["student_a"]
    response = client.get(f"/api/students/{student_id}")

    assert response.status_code == 200
    data = response.get_json()
    assert data["student_id"] == student_id
    assert data["registration_number"] == "TEST-A"
    assert data["first_name"] == "Student"
    assert data["last_name"] == "A"
    assert data["course"] == "Test Course"


def test_unknown_student_profile_returns_404(client):
    faculty_login(client)

    response = client.get("/api/students/999999")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Student not found."


def test_student_cannot_view_student_profile(client, app):
    login(client, "student.a@example.com")

    student_id = app.test_ids["student_a"]
    response = client.get(f"/api/students/{student_id}")

    assert response.status_code == 403


def test_view_student_profile_requires_login(client, app):
    student_id = app.test_ids["student_a"]

    response = client.get(f"/api/students/{student_id}")

    assert response.status_code == 401
