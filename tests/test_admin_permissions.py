"""Authorization tests for ADMIN-002 administrator account management."""

import pytest
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.subject import Subject
from backend.models.user import User
from tests.test_attendance import app, client, login, csrf_headers


def create_admin(app, email="admin@example.com"):
    with app.app_context():
        user = User(
            email=email,
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
        return user.user_id


def admin_login(client):
    response = login(client, "admin@example.com", "AdminTest123!")
    assert response.status_code == 200


def test_admin_user_list_requires_authentication(client):
    response = client.get("/api/admin/users")
    assert response.status_code == 401


def test_student_cannot_list_or_create_users(client):
    assert login(client, "student.a@example.com").status_code == 200

    assert client.get("/api/admin/users").status_code == 403
    response = client.post(
        "/api/admin/users",
        json={
            "email": "attacker@example.com",
            "password": "Password123!",
            "role": "Administrator",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_faculty_cannot_change_roles(client, app):
    with app.app_context():
        target = User(
            email="target@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(target)
        db.session.commit()
        target_id = target.user_id

    assert login(client, "faculty@example.com", "FacultyTest123!").status_code == 200
    response = client.patch(
        f"/api/admin/users/{target_id}",
        json={"role": "Administrator"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_admin_can_create_user_and_assign_role(client, app):
    create_admin(app)
    admin_login(client)

    response = client.post(
        "/api/admin/users",
        json={
            "email": "newfaculty@example.com",
            "password": "FacultyPass123!",
            "role": "Faculty",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201
    assert response.get_json()["user"]["role"] == "Faculty"


def test_admin_can_update_user_role_and_activation(client, app):
    create_admin(app)
    with app.app_context():
        target = User(
            email="target@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(target)
        db.session.commit()
        target_id = target.user_id

    admin_login(client)
    response = client.patch(
        f"/api/admin/users/{target_id}",
        json={"role": "Faculty", "is_active": False},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "Faculty"
    assert response.get_json()["user"]["is_active"] is False


def test_admin_rejects_invalid_role(client, app):
    create_admin(app)
    admin_login(client)
    response = client.post(
        "/api/admin/users",
        json={
            "email": "invalidrole@example.com",
            "password": "Password123!",
            "role": "Superuser",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 400


def subject_update_payload(app, subject_id, **overrides):
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        payload = {
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "credits": str(subject.credits),
            "semester_id": subject.semester_id,
        }
    payload.update(overrides)
    return payload


def test_admin_can_update_subject_validly(client, app):
    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]

    response = client.put(
        f"/api/subjects/{subject_id}",
        json=subject_update_payload(
            app,
            subject_id,
            subject_name="Updated Test Subject",
            credits="4.0",
        ),
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == "Updated Test Subject"
        assert str(subject.credits) == "4.0"


def test_subject_update_rejects_nonexistent_semester_without_changes(
    client, app
):
    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]
    original = subject_update_payload(app, subject_id)
    response = client.put(
        f"/api/subjects/{subject_id}",
        json={
            **original,
            "subject_name": "Invalid Semester Change",
            "semester_id": 999999,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == original["subject_name"]
        assert subject.semester_id == original["semester_id"]


def test_subject_update_duplicate_code_preserves_existing_subjects(
    client, app
):
    create_admin(app)
    admin_login(client)
    ids = app.test_ids
    with app.app_context():
        semester_id = db.session.get(
            Subject, ids["subject"]
        ).semester_id
        duplicate = Subject(
            subject_code="OTHER101",
            subject_name="Other Subject",
            credits=2.0,
            semester_id=semester_id,
        )
        db.session.add(duplicate)
        db.session.commit()

    original = subject_update_payload(app, ids["subject"])
    response = client.put(
        f"/api/subjects/{ids['subject']}",
        json={
            **original,
            "subject_code": "OTHER101",
            "subject_name": "Conflicting Update",
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    with app.app_context():
        subject = db.session.get(Subject, ids["subject"])
        duplicate_subject = Subject.query.filter_by(
            subject_code="OTHER101"
        ).one()
        assert subject.subject_code == original["subject_code"]
        assert subject.subject_name == original["subject_name"]
        assert duplicate_subject.subject_name == "Other Subject"


def test_subject_update_database_failure_rolls_back(
    client, app, monkeypatch
):
    from sqlalchemy.exc import SQLAlchemyError

    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]
    payload = subject_update_payload(
        app, subject_id, subject_name="Failed Update"
    )

    def fail_commit():
        raise SQLAlchemyError("forced database failure")

    monkeypatch.setattr(db.session, "commit", fail_commit)
    response = client.put(
        f"/api/subjects/{subject_id}",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 500
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == "Test Subject"


def test_faculty_cannot_update_subject(client, app):
    assert login(
        client, "faculty@example.com", "FacultyTest123!"
    ).status_code == 200
    subject_id = app.test_ids["subject"]
    response = client.put(
        f"/api/subjects/{subject_id}",
        json=subject_update_payload(
            app, subject_id, subject_name="Unauthorized Update"
        ),
        headers=csrf_headers(client),
    )

    assert response.status_code == 403
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == "Test Subject"
