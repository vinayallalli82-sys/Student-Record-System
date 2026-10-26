
import pytest

from backend.extensions import db
from backend.models.user import User
from werkzeug.security import generate_password_hash

from test_attendance import app as attendance_app


@pytest.fixture
def app(attendance_app):
    return attendance_app


@pytest.fixture
def client(app):
    return app.test_client()


def csrf_headers(client):
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    token = response.get_json()["csrf_token"]
    return {"X-CSRFToken": token}


def login(client, email, password="StudentTest123!"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers=csrf_headers(client),
    )


def test_login_with_valid_credentials(client):
    response = login(client, "student.a@example.com")

    assert response.status_code == 200
    assert response.get_json()["message"] == "Login successful."
    assert response.get_json()["user"]["role"] == "Student"


def test_login_with_invalid_credentials(client):
    response = login(
        client,
        "student.a@example.com",
        "WrongPassword123!",
    )

    assert response.status_code == 401


def test_current_user_after_login(client):
    login_response = login(client, "student.a@example.com")
    assert login_response.status_code == 200

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.get_json()["email"] == "student.a@example.com"


def test_current_user_requires_login(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_logout_invalidates_session(client):
    login_response = login(client, "student.a@example.com")
    assert login_response.status_code == 200

    logout_response = client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    )
    assert logout_response.status_code == 200

    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_logout_requires_login(client):
    response = client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    )

    assert response.status_code == 401


def test_login_rejects_missing_csrf_token(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "student.a@example.com",
            "password": "StudentTest123!",
        },
    )

    assert response.status_code == 400




def test_inactive_user_cannot_login(client, app):
    with app.app_context():
        user = db.session.scalar(
            db.select(User).where(
                User.email == "student.a@example.com"
            )
        )
        assert user is not None

        user.is_active = False
        db.session.commit()

        response = login(client, "student.a@example.com")

        assert response.status_code == 401
        assert response.get_json()["error"] == (
            "Invalid email or password."
        )



