
"""Tests for FR-014 subject-wise marks summary."""

import pytest

from backend.extensions import db
from backend.models.student_subject import StudentSubject
from tests.test_attendance import (
    app as attendance_app_fixture,
    client as attendance_client_fixture,
    faculty_login,
    login,
)


@pytest.fixture
def app(attendance_app_fixture):
    return attendance_app_fixture


@pytest.fixture
def client(attendance_client_fixture):
    return attendance_client_fixture


def test_summary_requires_login(client):
    response = client.get("/api/marks/summary?subject_id=1")
    assert response.status_code == 401


def test_student_cannot_access_faculty_summary(client):
    login(client, "student.a@example.com")
    response = client.get("/api/marks/summary?subject_id=1")
    assert response.status_code == 403


def test_summary_requires_positive_subject_id(client):
    faculty_login(client)
    response = client.get("/api/marks/summary?subject_id=0")
    assert response.status_code == 400


def test_summary_rejects_unknown_subject(client):
    faculty_login(client)
    response = client.get("/api/marks/summary?subject_id=999999")
    assert response.status_code == 404


def test_summary_includes_enrolled_students_without_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    with app.app_context():
        enrollment = db.session.get(
            StudentSubject,
            (ids["student_a"], ids["subject"]),
        )

        if enrollment is None:
            db.session.add(
                StudentSubject(
                    student_id=ids["student_a"],
                    subject_id=ids["subject"],
                )
            )
            db.session.commit()

    response = client.get(
        f"/api/marks/summary?subject_id={ids['subject']}"
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["subject"]["subject_id"] == ids["subject"]
    assert any(
        student["student_id"] == ids["student_a"]
        for student in data["students"]
    )
