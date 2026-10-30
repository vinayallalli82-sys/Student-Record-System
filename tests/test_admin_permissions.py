"""Authorization tests for ADMIN-002 administrator account management."""

import pytest
from werkzeug.security import generate_password_hash

from backend.extensions import db
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
