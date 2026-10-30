
import pytest
from datetime import date
from werkzeug.security import generate_password_hash


from backend.app import create_app
from backend.config import Config
from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student
from backend.models.subject import Subject
from backend.models.semester import Semester
from backend.models.attendance import Attendance
from backend.models.student_subject import StudentSubject
from backend.models.faculty_subject import FacultySubject


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setattr(Config, "SQLALCHEMY_DATABASE_URI", "sqlite://")
    monkeypatch.setattr(Config, "SECRET_KEY", "pytest-test-secret-key")

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
            registration_number="REPORT-A",
            first_name="Student",
            last_name="A",
            course="Test Course",
            admission_year=2026,
        )
        student_b = Student(
            user_id=student_b_user.user_id,
            registration_number="REPORT-B",
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
            subject_code="REPORT101",
            subject_name="Report Test Subject",
            credits=3.0,
            semester_id=semester.semester_id,
        )
        db.session.add(subject)
        db.session.flush()

        db.session.add(
            FacultySubject(
                faculty_id=faculty.user_id,
                subject_id=subject.subject_id,
            )
        )

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


def faculty_login(client):
    token = client.get("/api/auth/csrf").get_json()["csrf_token"]
    response = client.post(
        "/api/auth/login",
        json={
            "email": "faculty@example.com",
            "password": "FacultyTest123!",
        },
        headers={"X-CSRFToken": token},
    )
    assert response.status_code == 200


def student_login(client):
    token = client.get("/api/auth/csrf").get_json()["csrf_token"]
    response = client.post(
        "/api/auth/login",
        json={
            "email": "student.a@example.com",
            "password": "StudentTest123!",
        },
        headers={"X-CSRFToken": token},
    )
    assert response.status_code == 200


def add_attendance(app, ids, student_id, attendance_date, status):
    with app.app_context():
        db.session.add(
            Attendance(
                student_id=student_id,
                subject_id=ids["subject"],
                attendance_date=date.fromisoformat(attendance_date),
                status=status,
                recorded_by=ids["faculty"],
            )
        )
        db.session.commit()

def test_class_report_requires_login(client):
    response = client.get("/api/attendance/class-report")
    assert response.status_code == 401


def test_class_report_returns_student_wise_summary(client, app):
    faculty_login(client)
    ids = app.test_ids

    add_attendance(app, ids, ids["student_a"], "2026-10-20", "Present")
    add_attendance(app, ids, ids["student_a"], "2026-10-21", "Absent")
    add_attendance(app, ids, ids["student_a"], "2026-10-22", "Present")
    add_attendance(app, ids, ids["student_b"], "2026-10-20", "Absent")

    response = client.get(
        f"/api/attendance/class-report?subject_id={ids['subject']}"
    )

    assert response.status_code == 200
    result = response.get_json()

    assert result["subject_id"] == ids["subject"]
    assert result["total_students"] == 2

    students = {
        item["student_id"]: item for item in result["students"]
    }

    student_a = students[ids["student_a"]]
    assert student_a["total_classes"] == 3
    assert student_a["present"] == 2
    assert student_a["absent"] == 1
    assert student_a["attendance_percentage"] == 66.67

    student_b = students[ids["student_b"]]
    assert student_b["total_classes"] == 1
    assert student_b["present"] == 0
    assert student_b["absent"] == 1
    assert student_b["attendance_percentage"] == 0.0


def test_class_report_includes_students_with_zero_attendance(client, app):
    faculty_login(client)
    ids = app.test_ids

    response = client.get(
        f"/api/attendance/class-report?subject_id={ids['subject']}"
    )

    assert response.status_code == 200
    result = response.get_json()

    assert result["total_students"] == 2

    for student in result["students"]:
        assert student["total_classes"] == 0
        assert student["present"] == 0
        assert student["absent"] == 0
        assert student["attendance_percentage"] == 0.0


def test_class_report_filters_by_date_range(client, app):
    faculty_login(client)
    ids = app.test_ids

    add_attendance(app, ids, ids["student_a"], "2026-10-20", "Present")
    add_attendance(app, ids, ids["student_a"], "2026-10-23", "Absent")
    add_attendance(app, ids, ids["student_a"], "2026-10-27", "Present")

    response = client.get(
        f"/api/attendance/class-report?subject_id={ids['subject']}"
        "&start_date=2026-10-21&end_date=2026-10-25"
    )

    assert response.status_code == 200
    result = response.get_json()

    student_a = next(
        item for item in result["students"]
        if item["student_id"] == ids["student_a"]
    )

    assert student_a["total_classes"] == 1
    assert student_a["present"] == 0
    assert student_a["absent"] == 1
    assert student_a["attendance_percentage"] == 0.0


def test_class_report_rejects_missing_subject_id(client):
    faculty_login(client)
    response = client.get("/api/attendance/class-report")
    assert response.status_code == 400


def test_class_report_rejects_invalid_date(client, app):
    faculty_login(client)
    ids = app.test_ids

    response = client.get(
        f"/api/attendance/class-report?subject_id={ids['subject']}"
        "&start_date=23-10-2026"
    )
    assert response.status_code == 400


def test_student_cannot_access_class_report(client):
    student_login(client)
    response = client.get("/api/attendance/class-report")
    assert response.status_code == 403
