
"""Tests for FR-015: Download Academic Records as PDF."""

from datetime import date

import pytest
from werkzeug.security import generate_password_hash

from backend.app import create_app
from backend.config import Config
from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student
from backend.models.semester import Semester
from backend.models.subject import Subject
from backend.models.mark import Mark
from backend.models.attendance import Attendance


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setattr(Config, "SQLALCHEMY_DATABASE_URI", "sqlite://")
    monkeypatch.setattr(Config, "SECRET_KEY", "pytest-test-secret-key")

    app = create_app()
    app.config.update(TESTING=True)

    with app.app_context():
        db.create_all()

        student_user = User(
            email="pdfstudent@example.com",
            password_hash=generate_password_hash("StudentTest123!"),
            role="Student",
        )
        db.session.add(student_user)
        db.session.flush()

        student = Student(
            user_id=student_user.user_id,
            registration_number="PDF-001",
            first_name="Test",
            last_name="Student",
            course="Computer Science",
            admission_year=2024,
        )
        db.session.add(student)
        db.session.flush()

        semester = Semester(
            semester_number=1,
            academic_year="2026-2027",
        )
        db.session.add(semester)
        db.session.flush()

        subject = Subject(
            subject_code="PDF101",
            subject_name="PDF Test Subject",
            credits=3.0,
            semester_id=semester.semester_id,
        )
        db.session.add(subject)
        db.session.flush()

        mark = Mark(
            student_id=student.student_id,
            subject_id=subject.subject_id,
            assessment_name="Internal Test",
            marks_obtained=80,
            max_marks=100,
        )
        db.session.add(mark)

        attendance = Attendance(
            student_id=student.student_id,
            subject_id=subject.subject_id,
            attendance_date=date(2026, 10, 20),
            status="Present",
            recorded_by=None,
        )
        db.session.add(attendance)

        db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()

def student_login(client):
    csrf_response = client.get("/api/auth/csrf")
    print("CSRF response:", csrf_response.status_code, csrf_response.get_json())

    return client.post(
        "/api/auth/login",
        json={
            "email": "pdfstudent@example.com",
            "password": "StudentTest123!",
        },
        headers={
            "X-CSRFToken": csrf_response.get_json()["csrf_token"],
        },
    )


def test_pdf_download_requires_login(client):
    response = client.get(
        "/api/academic-records/download?semester=1"
    )
    assert response.status_code == 401


def test_pdf_download_returns_pdf(client):
    login_response = student_login(client)
    assert login_response.status_code == 200

    response = client.get(
        "/api/academic-records/download?semester=1"
    )

    assert response.status_code == 200
    assert response.mimetype == "application/pdf"
    assert response.headers.get("Content-Disposition", "").startswith(
        "attachment;"
    )
    assert response.data.startswith(b"%PDF")


def test_pdf_download_rejects_missing_semester(client):
    student_login(client)

    response = client.get("/api/academic-records/download")

    assert response.status_code == 400


def test_pdf_download_rejects_invalid_semester(client):
    student_login(client)

    response = client.get(
        "/api/academic-records/download?semester=0"
    )

    assert response.status_code == 400


def test_pdf_download_rejects_unknown_semester(client):
    student_login(client)

    response = client.get(
        "/api/academic-records/download?semester=99"
    )

    assert response.status_code == 404
