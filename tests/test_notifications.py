
import pytest
from datetime import date, timedelta
from unittest.mock import Mock

from backend.app import create_app
from backend.extensions import db
from backend.models.semester import Semester
from backend.models.faculty_subject import FacultySubject
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.notification import Notification
from backend.models.user import User
from backend.models.attendance import Attendance
from sqlalchemy import select
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
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers=csrf_headers(client),
    )


def add_attendance(app, student_id, subject_id, present, total):
    with app.app_context():
        today = date(2026, 10, 1)
        records = [
            Attendance(
                student_id=student_id,
                subject_id=subject_id,
                attendance_date=today + timedelta(days=i),
                status="Present" if i < present else "Absent",
            )
            for i in range(total)
        ]
        db.session.add_all(records)
        db.session.commit()


def test_low_attendance_triggers_notification(client, app):
    ids = app.test_ids
    add_attendance(app, ids["student_a"], ids["subject"], 6, 10)

    assert login(client, "student.a@example.com").status_code == 200

    response = client.post(
        f"/api/notifications/check/{ids['student_a']}/{ids['subject']}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["notification_triggered"] is True
    assert response.get_json()["attendance_percentage"] == 60.0


@pytest.mark.parametrize("present,total", [(3, 4), (15, 20), (8, 10)])
def test_attendance_at_or_above_75_does_not_trigger(
    client, app, present, total
):
    ids = app.test_ids
    add_attendance(app, ids["student_a"], ids["subject"], present, total)
    assert login(client, "student.a@example.com").status_code == 200

    response = client.post(
        f"/api/notifications/check/{ids['student_a']}/{ids['subject']}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["notification_triggered"] is False

    with app.app_context():
        records = db.session.scalars(
            select(Notification).where(
                Notification.student_id == ids["student_a"],
                Notification.subject_id == ids["subject"],
            )
        ).all()
        assert records == []


def test_student_cannot_check_another_students_attendance(client, app):
    ids = app.test_ids
    assert login(client, "student.a@example.com").status_code == 200

    response = client.post(
        f"/api/notifications/check/{ids['student_b']}/{ids['subject']}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 403


def test_student_only_receives_their_own_notifications(client, app):
    ids = app.test_ids
    add_attendance(app, ids["student_a"], ids["subject"], 6, 10)
    add_attendance(app, ids["student_b"], ids["subject"], 5, 10)

    assert login(client, "student.a@example.com").status_code == 200

    response = client.post(
        f"/api/notifications/check/{ids['student_a']}/{ids['subject']}",
        headers=csrf_headers(client),
    )
    assert response.status_code == 200

    response = client.get("/api/notifications")
    assert response.status_code == 200
    own_notifications = response.get_json()
    assert len(own_notifications) == 1
    assert own_notifications[0]["subject_code"] == "TEST101"
    assert own_notifications[0]["subject_name"] == "Test Subject"

    with app.app_context():
        records = db.session.scalars(
            select(Notification).where(
                Notification.student_id == ids["student_b"]
            )
        ).all()
        assert records == []

    assert client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    ).status_code == 200
    assert login(client, "student.b@example.com").status_code == 200
    assert client.get("/api/notifications").get_json() == []


def test_repeated_check_does_not_create_duplicate_notification(
    client, app
):
    ids = app.test_ids
    add_attendance(app, ids["student_a"], ids["subject"], 6, 10)

    assert login(client, "student.a@example.com").status_code == 200

    url = (
        f"/api/notifications/check/"
        f"{ids['student_a']}/{ids['subject']}"
    )

    assert client.post(url, headers=csrf_headers(client)).status_code == 200
    assert client.post(url, headers=csrf_headers(client)).status_code == 200

    with app.app_context():
        records = db.session.scalars(
            select(Notification).where(
                Notification.student_id == ids["student_a"],
                Notification.subject_id == ids["subject"],
            )
        ).all()
        assert len(records) == 1


def test_faculty_can_synchronize_notification_for_assigned_subject(
    client, app
):
    ids = app.test_ids
    add_attendance(app, ids["student_a"], ids["subject"], 6, 10)

    with app.app_context():
        db.session.add(FacultySubject(
            faculty_id=ids["faculty"],
            subject_id=ids["subject"],
        ))
        db.session.commit()

    assert login(
        client, "faculty@example.com", "FacultyTest123!"
    ).status_code == 200
    response = client.post(
        f"/api/notifications/check/{ids['student_a']}/{ids['subject']}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["notification_triggered"] is True
    with app.app_context():
        assert Notification.query.filter_by(
            student_id=ids["student_a"],
            subject_id=ids["subject"],
        ).count() == 1


def test_faculty_cannot_synchronize_unassigned_subject_without_writes(
    client, app, monkeypatch
):
    ids = app.test_ids
    with app.app_context():
        semester = Semester.query.filter_by(semester_number=1).first()
        subject = Subject(
            subject_code="TEST-NOTIFY-UNASSIGNED",
            subject_name="Unassigned Notification Subject",
            credits=3.0,
            semester_id=semester.semester_id,
        )
        db.session.add(subject)
        db.session.flush()
        db.session.add(StudentSubject(
            student_id=ids["student_a"],
            subject_id=subject.subject_id,
        ))
        db.session.commit()
        subject_id = subject.subject_id

    add_attendance(app, ids["student_a"], subject_id, 6, 10)
    with app.app_context():
        notifications_before = Notification.query.count()

    sync = Mock(return_value={"notification_triggered": True})
    monkeypatch.setattr(
        "backend.routes.notifications.synchronize_attendance_notification",
        sync,
    )

    assert login(
        client, "faculty@example.com", "FacultyTest123!"
    ).status_code == 200
    response = client.post(
        f"/api/notifications/check/{ids['student_a']}/{subject_id}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 403
    sync.assert_not_called()
    with app.app_context():
        assert Notification.query.count() == notifications_before


def test_student_not_enrolled_cannot_synchronize_notification(
    client, app, monkeypatch
):
    with app.app_context():
        semester = Semester.query.filter_by(semester_number=1).first()
        subject = Subject(
            subject_code="TEST-NOTIFY-NO-ENROLLMENT",
            subject_name="Not Enrolled Subject",
            credits=3.0,
            semester_id=semester.semester_id,
        )
        db.session.add(subject)
        db.session.commit()
        student_id = app.test_ids["student_a"]
        subject_id = subject.subject_id
        notifications_before = Notification.query.count()

    sync = Mock(return_value={"notification_triggered": True})
    monkeypatch.setattr(
        "backend.routes.notifications.synchronize_attendance_notification",
        sync,
    )

    assert login(
        client, "student.a@example.com", "StudentTest123!"
    ).status_code == 200
    response = client.post(
        f"/api/notifications/check/{student_id}/{subject_id}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    sync.assert_not_called()
    with app.app_context():
        assert Notification.query.count() == notifications_before


def test_administrator_can_synchronize_notification(client, app):
    ids = app.test_ids
    add_attendance(app, ids["student_a"], ids["subject"], 6, 10)

    with app.app_context():
        admin = User(
            email="admin.notifications@example.com",
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(admin)
        db.session.commit()

    assert login(
        client,
        "admin.notifications@example.com",
        "AdminTest123!",
    ).status_code == 200
    response = client.post(
        f"/api/notifications/check/{ids['student_a']}/{ids['subject']}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["notification_triggered"] is True
    with app.app_context():
        assert Notification.query.filter_by(
            student_id=ids["student_a"],
            subject_id=ids["subject"],
        ).count() == 1
