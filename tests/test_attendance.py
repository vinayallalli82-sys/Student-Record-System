
import pytest

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student
from backend.models.subject import Subject
from backend.models.semester import Semester
from backend.models.attendance import Attendance
from backend.models.student_subject import StudentSubject
from backend.models.faculty_subject import FacultySubject
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

        # The default test faculty is explicitly assigned to the fixture subject.
        db.session.add(FacultySubject(
            faculty_id=faculty.user_id,
            subject_id=subject.subject_id,
        ))

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


def get_csrf_token(client):
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    return response.get_json()["csrf_token"]


def csrf_headers(client):
    return {"X-CSRFToken": get_csrf_token(client)}


def login(client, email, password="StudentTest123!"):
    token = get_csrf_token(client)
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers={"X-CSRFToken": token},
    )


def faculty_login(client):
    response = login(client, "faculty@example.com", "FacultyTest123!")
    assert response.status_code == 200


def attendance_payload(ids, date="2026-10-23", status="Present"):
    return {
        "student_id": ids["student_a"],
        "subject_id": ids["subject"],
        "attendance_date": date,
        "status": status,
    }


def test_protected_attendance_requires_login(client):
    response = client.get("/api/attendance/my")
    assert response.status_code == 401


def test_student_cannot_view_another_students_percentage(client, app):
    response = login(client, "student.a@example.com")
    assert response.status_code == 200

    ids = app.test_ids
    response = client.get(
        f"/api/attendance/percentage/{ids['student_b']}/{ids['subject']}"
    )

    assert response.status_code == 403


def test_student_cannot_create_attendance(client, app):
    response = login(client, "student.a@example.com")
    assert response.status_code == 200

    ids = app.test_ids
    response = client.post(
        "/api/attendance",
        json=attendance_payload(ids),
        headers=csrf_headers(client),
    )

    assert response.status_code == 403


def test_faculty_can_record_attendance(client, app):
    faculty_login(client)
    ids = app.test_ids

    response = client.post(
        "/api/attendance",
        json=attendance_payload(ids),
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.get_json()["status"] == "Present"


def test_unenrolled_student_cannot_receive_attendance(client, app):
    faculty_login(client)
    ids = app.test_ids

    with app.app_context():
        enrollment = db.session.get(
            StudentSubject, (ids["student_b"], ids["subject"])
        )
        db.session.delete(enrollment)
        db.session.commit()

    payload = {
        "student_id": ids["student_b"],
        "subject_id": ids["subject"],
        "attendance_date": "2026-10-23",
        "status": "Present",
    }

    response = client.post(
        "/api/attendance",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 400


def test_zero_attendance_percentage_is_zero(client, app):
    response = login(client, "student.a@example.com")
    assert response.status_code == 200

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
    faculty_login(client)
    ids = app.test_ids

    created = client.post(
        "/api/attendance",
        json=attendance_payload(ids),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201

    attendance_id = created.get_json()["attendance_id"]
    updated = client.put(
        f"/api/attendance/{attendance_id}",
        json={"status": "Absent"},
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200

    response = login(client, "student.a@example.com")
    assert response.status_code == 200

    percentage = client.get(
        f"/api/attendance/percentage/{ids['student_a']}/{ids['subject']}"
    )

    assert percentage.status_code == 200
    assert percentage.get_json()["attendance_percentage"] == 0.0


def test_logout_blocks_protected_access(client):
    response = login(client, "student.a@example.com")
    assert response.status_code == 200

    logout_response = client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    )
    assert logout_response.status_code == 200

    response = client.get("/api/attendance/my")
    assert response.status_code == 401


def test_duplicate_attendance_is_rejected(client, app):
    faculty_login(client)
    ids = app.test_ids
    payload = attendance_payload(ids)

    first = client.post(
        "/api/attendance",
        json=payload,
        headers=csrf_headers(client),
    )
    assert first.status_code == 201

    duplicate = client.post(
        "/api/attendance",
        json=payload,
        headers=csrf_headers(client),
    )
    assert duplicate.status_code == 409


@pytest.mark.parametrize("bad_date", ["23-10-2026", "not-a-date", "2026-02-30"])
def test_malformed_attendance_date_is_rejected(client, app, bad_date):
    faculty_login(client)
    ids = app.test_ids

    response = client.post(
        "/api/attendance",
        json=attendance_payload(ids, date=bad_date),
        headers=csrf_headers(client),
    )

    assert response.status_code == 400


@pytest.mark.parametrize("bad_status", ["Late", "Present-ish", "", None])
def test_invalid_attendance_status_is_rejected(client, app, bad_status):
    faculty_login(client)
    ids = app.test_ids

    response = client.post(
        "/api/attendance",
        json=attendance_payload(ids, status=bad_status),
        headers=csrf_headers(client),
    )

    assert response.status_code == 400


def test_updating_nonexistent_attendance_returns_404(client):
    faculty_login(client)

    response = client.put(
        "/api/attendance/999999",
        json={"status": "Absent"},
        headers=csrf_headers(client),
    )

    assert response.status_code == 404


def test_missing_csrf_token_is_rejected(client, app):
    faculty_login(client)
    ids = app.test_ids

    response = client.post(
        "/api/attendance",
        json=attendance_payload(ids),
    )

    assert response.status_code == 400


def test_invalid_login_credentials_are_rejected(client):
    response = login(
        client,
        "student.a@example.com",
        "WrongPassword123!",
    )
    assert response.status_code == 401


def test_attendance_filter_by_date_range(client, app):
    faculty_login(client)
    ids = app.test_ids

    for attendance_date, status in [
        ("2026-10-20", "Present"),
        ("2026-10-23", "Absent"),
        ("2026-10-27", "Present"),
    ]:
        response = client.post(
            "/api/attendance",
            json=attendance_payload(
                ids, date=attendance_date, status=status
            ),
            headers=csrf_headers(client),
        )
        assert response.status_code == 201

    response = client.get(
        "/api/attendance?start_date=2026-10-21&end_date=2026-10-25"
    )

    assert response.status_code == 200
    records = response.get_json()
    assert len(records) == 1
    assert records[0]["attendance_date"] == "2026-10-23"


def test_attendance_filter_by_subject_and_date_range(client, app):
    faculty_login(client)
    ids = app.test_ids

    created = client.post(
        "/api/attendance",
        json=attendance_payload(ids, date="2026-10-23"),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201

    response = client.get(
        f"/api/attendance?subject_id={ids['subject']}"
        "&start_date=2026-10-20&end_date=2026-10-25"
    )

    assert response.status_code == 200
    records = response.get_json()
    assert len(records) == 1
    assert records[0]["subject_id"] == ids["subject"]


def test_attendance_filter_rejects_reversed_date_range(client):
    faculty_login(client)

    response = client.get(
        "/api/attendance?start_date=2026-10-27&end_date=2026-10-20"
    )

    assert response.status_code == 400
    assert "start_date must not be after end_date" in response.get_json()["error"]


def test_attendance_filter_returns_empty_list_when_no_match(client):
    faculty_login(client)

    response = client.get(
        "/api/attendance?start_date=2026-11-01&end_date=2026-11-05"
    )

    assert response.status_code == 200
    assert response.get_json() == []

