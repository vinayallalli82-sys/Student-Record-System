
import pytest

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student
from backend.models.subject import Subject
from backend.models.semester import Semester
from backend.models.attendance import Attendance
from backend.models.student_subject import StudentSubject
from werkzeug.security import generate_password_hash

@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "pytest-test-secret-key")
    monkeypatch.setenv("DB_USER", "test")
    monkeypatch.setenv("DB_PASSWORD", "")
    monkeypatch.setenv("DB_HOST", "localhost")
    monkeypatch.setenv("DB_PORT", "3306")
    monkeypatch.setenv("DB_NAME", "test_db")

    from backend.config import Config

    monkeypatch.setattr(
        Config,
        "SQLALCHEMY_DATABASE_URI",
        "sqlite://",
    )
    monkeypatch.setattr(
        Config,
        "SECRET_KEY",
        "pytest-test-secret-key",
    )

    app = create_app()
    app.config.update(TESTING=True)

    with app.app_context():
        db.create_all()

        faculty = User(
            email="faculty@example.com",
            password_hash=generate_password_hash("FacultyTest123!"),
            role="Faculty",
            is_active=True,
        )
        student_a_user = User(
            email="student.a@example.com",
            password_hash=generate_password_hash("StudentTest123!"),
            role="Student",
            is_active=True,
        )
        student_b_user = User(
            email="student.b@example.com",
            password_hash=generate_password_hash("StudentTest123!"),
            role="Student",
            is_active=True,
        )

        db.session.add_all([faculty, student_a_user, student_b_user])
        db.session.flush()

        student_a = Student(
            user_id=student_a_user.user_id,
            registration_number="TEST-A",
            first_name="Student",
            last_name="A",
            course="Test Course",
            admission_year=2026,
        )
        student_b = Student(
            user_id=student_b_user.user_id,
            registration_number="TEST-B",
            first_name="Student",
            last_name="B",
            course="Test Course",
            admission_year=2026,
        )
        semester = Semester(
            semester_number=1,
            academic_year="2026-2027",
        )

        db.session.add_all([student_a, student_b, semester])
        db.session.flush()

        subject = Subject(
            subject_code="TEST101",
            subject_name="Test Subject",
            credits=3.0,
            semester_id=semester.semester_id,
        )
        db.session.add(subject)
        db.session.flush()

        db.session.add_all([
            StudentSubject(
                student_id=student_a.student_id,
                subject_id=subject.subject_id,
            ),
            StudentSubject(
                student_id=student_b.student_id,
                subject_id=subject.subject_id,
            ),
        ])
        db.session.commit()

        app.test_ids = {
            "faculty": faculty.user_id,
            "student_a_user": student_a_user.user_id,
            "student_b_user": student_b_user.user_id,
            "student_a": student_a.student_id,
            "student_b": student_b.student_id,
            "subject": subject.subject_id,
        }

        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, email, password="StudentTest123!"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


def test_protected_attendance_requires_login(client):
    response = client.get("/api/attendance/my")
    assert response.status_code == 401


def test_student_cannot_view_another_students_percentage(client, app):
    login(client, "student.a@example.com")
    ids = app.test_ids

    response = client.get(
        f"/api/attendance/percentage/{ids['student_b']}/{ids['subject']}"
    )

    assert response.status_code == 403


def test_student_cannot_create_attendance(client, app):
    login(client, "student.a@example.com")
    ids = app.test_ids

    response = client.post(
        "/api/attendance",
        json={
            "student_id": ids["student_a"],
            "subject_id": ids["subject"],
            "attendance_date": "2026-10-23",
            "status": "Present",
        },
    )

    assert response.status_code == 403


def test_faculty_can_record_attendance(client, app):
    login(client, "faculty@example.com", "FacultyTest123!")
    ids = app.test_ids

    response = client.post(
        "/api/attendance",
        json={
            "student_id": ids["student_a"],
            "subject_id": ids["subject"],
            "attendance_date": "2026-10-23",
            "status": "Present",
        },
    )

    assert response.status_code == 201
    assert response.get_json()["status"] == "Present"


def test_unenrolled_student_cannot_receive_attendance(client, app):
    login(client, "faculty@example.com", "FacultyTest123!")
    ids = app.test_ids

    with app.app_context():
        enrollment = db.session.get(
            StudentSubject, (ids["student_b"], ids["subject"])
        )
        db.session.delete(enrollment)
        db.session.commit()

    response = client.post(
        "/api/attendance",
        json={
            "student_id": ids["student_b"],
            "subject_id": ids["subject"],
            "attendance_date": "2026-10-23",
            "status": "Present",
        },
    )

    assert response.status_code == 400


def test_zero_attendance_percentage_is_zero(client, app):
    login(client, "student.a@example.com")
    ids = app.test_ids

    response = client.get(
        f"/api/attendance/percentage/{ids['student_a']}/{ids['subject']}"
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["total_classes"] == 0
    assert result["classes_attended"] == 0
    assert result["attendance_percentage"] == 0.0


def test_attendance_update_recalculates_percentage(client, app):
    login(client, "faculty@example.com", "FacultyTest123!")
    ids = app.test_ids

    created = client.post(
        "/api/attendance",
        json={
            "student_id": ids["student_a"],
            "subject_id": ids["subject"],
            "attendance_date": "2026-10-23",
            "status": "Present",
        },
    )
    assert created.status_code == 201

    attendance_id = created.get_json()["attendance_id"]
    updated = client.put(
        f"/api/attendance/{attendance_id}",
        json={"status": "Absent"},
    )
    assert updated.status_code == 200

    login(client, "student.a@example.com")
    percentage = client.get(
        f"/api/attendance/percentage/{ids['student_a']}/{ids['subject']}"
    )

    assert percentage.status_code == 200
    assert percentage.get_json()["attendance_percentage"] == 0.0


def test_logout_blocks_protected_access(client):
    login(client, "student.a@example.com")

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200

    response = client.get("/api/attendance/my")
    assert response.status_code == 401
