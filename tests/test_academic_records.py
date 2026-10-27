"""Tests for FR-005: View Academic Records by Semester."""

import pytest

from tests.test_attendance import app, client, login


def test_academic_records_requires_login(client):
    """Unauthenticated users must not access academic records."""
    response = client.get("/api/academic-records/my?semester=1")

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required."


def test_academic_records_requires_semester(client):
    """A logged-in student must provide a semester number."""
    login_response = login(client, "student.a@example.com")
    assert login_response.status_code == 200

    response = client.get("/api/academic-records/my")

    assert response.status_code == 400
    assert "semester" in response.get_json()["error"].lower()


def test_academic_records_rejects_invalid_semester(client):
    """Zero is not a valid semester number."""
    login_response = login(client, "student.a@example.com")
    assert login_response.status_code == 200

    response = client.get("/api/academic-records/my?semester=0")

    assert response.status_code == 400


def test_academic_records_rejects_unknown_semester(client):
    """A semester that does not exist should return 404."""
    login_response = login(client, "student.a@example.com")
    assert login_response.status_code == 200

    response = client.get("/api/academic-records/my?semester=999")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Semester not found."


def test_academic_records_rejects_non_student(client):
    """Faculty accounts must not use the student-only endpoint."""
    login_response = login(
        client,
        "faculty@example.com",
        "FacultyTest123!",
    )
    assert login_response.status_code == 200

    response = client.get("/api/academic-records/my?semester=1")

    assert response.status_code == 403
    assert response.get_json()["error"] == (
        "This endpoint is for student accounts only."
    )


def test_student_can_view_own_semester_records(client):
    """A student can retrieve academic records for an existing semester."""
    login_response = login(client, "student.a@example.com")
    assert login_response.status_code == 200

    response = client.get("/api/academic-records/my?semester=1")

    assert response.status_code == 200

    data = response.get_json()
    assert data["status"] == "success"
    assert data["semester"] == 1
    assert "subjects" in data
    assert isinstance(data["subjects"], list)
