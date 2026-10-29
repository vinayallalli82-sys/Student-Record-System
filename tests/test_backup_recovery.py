
import json
from datetime import date

import pytest

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student


@pytest.fixture
def app():
    """Create an isolated test app using the configured database."""
    application = create_app()
    application.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=False,
    )

    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def administrator(app):
    """Create a test administrator."""
    with app.app_context():
        user = User(
            email="backup-admin-test@example.com",
            password_hash="test-hash",
            role="Administrator",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
        user_id = user.user_id

    return user_id


def login_as(client, user_id):
    """Simulate a logged-in Flask-Login session."""
    with client.session_transaction() as session:
        session["_user_id"] = str(user_id)
        session["_fresh"] = True


def test_backup_requires_login(client):
    response = client.get("/api/backups")
    assert response.status_code == 401


def test_restore_requires_login(client):
    response = client.post(
        "/api/backups/restore",
        json={
            "format": "student-record-system-backup",
            "version": 1,
            "tables": {},
        },
    )
    assert response.status_code == 401


def test_backup_rejects_non_administrator(app, client):
    with app.app_context():
        user = User(
            email="backup-student-test@example.com",
            password_hash="test-hash",
            role="Student",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
        user_id = user.user_id

    login_as(client, user_id)
    response = client.get("/api/backups")
    assert response.status_code == 403


def test_backup_exports_student_records(app, client, administrator):
    with app.app_context():
        student = Student(
            student_id=910001,
            user_id=None,
            registration_number="BACKUP-TEST-910001",
            first_name="Backup",
            last_name="Student",
            date_of_birth=date(2004, 1, 2),
            course="CSE",
            admission_year=2023,
        )
        db.session.add(student)
        db.session.commit()

    login_as(client, administrator)
    response = client.get("/api/backups")

    assert response.status_code == 200
    assert "attachment" in response.headers.get(
        "Content-Disposition", ""
    )

    payload = json.loads(response.get_data(as_text=True))
    assert payload["format"] == "student-record-system-backup"
    assert payload["version"] == 1
    assert "students" in payload["tables"]

    exported = next(
        row for row in payload["tables"]["students"]
        if row["student_id"] == 910001
    )
    assert exported["registration_number"] == "BACKUP-TEST-910001"
    assert exported["first_name"] == "Backup"


def test_restore_rejects_invalid_backup(client, administrator):
    login_as(client, administrator)

    response = client.post(
        "/api/backups/restore",
        json={"format": "invalid-format", "version": 1, "tables": {}},
    )

    assert response.status_code == 400


def test_restore_rejects_invalid_record_structure(
    client, administrator
):
    login_as(client, administrator)

    response = client.post(
        "/api/backups/restore",
        json={
            "format": "student-record-system-backup",
            "version": 1,
            "tables": {
                "students": [{"first_name": "Missing ID"}]
            },
        },
    )

    assert response.status_code == 400


def test_restore_restores_missing_student(app, client, administrator):
    login_as(client, administrator)

    backup = {
        "format": "student-record-system-backup",
        "version": 1,
        "tables": {
            "students": [{
                "student_id": 910002,
                "user_id": None,
                "registration_number": "BACKUP-TEST-910002",
                "first_name": "Recovered",
                "last_name": "Student",
                "date_of_birth": "2003-05-06",
                "course": "CSE",
                "admission_year": 2022,
            }]
        },
    }

    response = client.post("/api/backups/restore", json=backup)
    assert response.status_code == 200
    assert response.get_json()["restored_records"] == 1

    with app.app_context():
        restored = db.session.get(Student, 910002)
        assert restored is not None
        assert restored.registration_number == "BACKUP-TEST-910002"
        assert restored.date_of_birth == date(2003, 5, 6)


def test_restore_does_not_overwrite_existing_student(
    app, client, administrator
):
    with app.app_context():
        db.session.add(Student(
            student_id=910003,
            user_id=None,
            registration_number="BACKUP-TEST-910003",
            first_name="Original",
            last_name="Student",
            date_of_birth=None,
            course="CSE",
            admission_year=2023,
        ))
        db.session.commit()

    login_as(client, administrator)

    backup = {
        "format": "student-record-system-backup",
        "version": 1,
        "tables": {
            "students": [{
                "student_id": 910003,
                "user_id": None,
                "registration_number": "BACKUP-TEST-910003",
                "first_name": "Overwritten",
                "last_name": "Student",
                "date_of_birth": None,
                "course": "ECE",
                "admission_year": 2024,
            }]
        },
    }

    response = client.post("/api/backups/restore", json=backup)
    assert response.status_code == 200
    assert response.get_json()["skipped_existing_records"] == 1

    with app.app_context():
        existing = db.session.get(Student, 910003)
        assert existing.first_name == "Original"
        assert existing.course == "CSE"
