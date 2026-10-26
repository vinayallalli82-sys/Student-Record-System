
"""Authentication routes for the Student Record System."""

from flask import Blueprint, jsonify, request
from flask_login import (
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_wtf.csrf import generate_csrf
from sqlalchemy import select
from werkzeug.security import check_password_hash

from backend.extensions import db
from backend.models.student import Student
from backend.models.user import User


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth",
)


@auth_bp.get("/csrf")
def csrf_token():
    """Generate a CSRF token for protected requests."""
    return jsonify({
        "csrf_token": generate_csrf(),
    }), 200


@auth_bp.post("/login")
def login():
    """Authenticate a user and create a login session."""
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "A valid JSON request body is required.",
        }), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not email.strip():
        return jsonify({
            "error": "Email is required.",
        }), 400

    if not isinstance(password, str) or not password:
        return jsonify({
            "error": "Password is required.",
        }), 400

    email = email.strip().lower()

    user = db.session.scalar(
        select(User).where(User.email == email)
    )

    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({
            "error": "Invalid email or password.",
        }), 401

    login_user(user)

    # Resolve the linked student profile for student accounts.
    student = None

    if user.role == "Student":
        student = Student.query.filter_by(
            user_id=user.user_id
        ).first()

    return jsonify({
        "message": "Login successful.",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
            "student_id": (
                student.student_id if student else None
            ),
        },
    }), 200


@auth_bp.post("/logout")
@login_required
def logout():
    """End the current user's login session."""
    logout_user()

    return jsonify({
        "message": "Logout successful.",
    }), 200


@auth_bp.get("/me")
@login_required
def me():
    """Return the current user's session information."""
    student = None

    if current_user.role == "Student":
        student = Student.query.filter_by(
            user_id=current_user.user_id
        ).first()

    return jsonify({
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role,
        "student_id": (
            student.student_id if student else None
        ),
    }), 200
