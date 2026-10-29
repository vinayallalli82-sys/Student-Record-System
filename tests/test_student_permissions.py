"""Tests ensuring student accounts can access only their own academic data."""

from tests.test_attendance import app, client, login


def test_academic_records_requires_login(client):
    response = client.get("/api/academic-records/my?semester=1")
    assert response.status_code == 401


def test_student_can_view_own_academic_records(client):
    assert login(client, "student.a@example.com").status_code == 200
    response = client.get("/api/academic-records/my?semester=1")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["semester"] == 1
    assert isinstance(data["subjects"], list)


def test_student_cannot_use_student_only_endpoint_as_faculty(client):
    assert login(client, "faculty@example.com", "FacultyTest123!").status_code == 200
    response = client.get("/api/academic-records/my?semester=1")
    assert response.status_code == 403


def test_student_cannot_view_another_students_profile(client, app):
    assert login(client, "student.a@example.com").status_code == 200
    other_student_id = app.test_ids["student_b"]
    response = client.get(f"/api/students/{other_student_id}")
    assert response.status_code == 403


def test_student_cannot_view_another_students_attendance_percentage(client, app):
    assert login(client, "student.a@example.com").status_code == 200
    ids = app.test_ids
    response = client.get(
        f"/api/attendance/percentage/{ids['student_b']}/{ids['subject']}"
    )
    assert response.status_code == 403
