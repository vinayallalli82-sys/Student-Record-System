
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user
from flask_wtf.csrf import generate_csrf
from sqlalchemy import select
from werkzeug.security import check_password_hash

from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def user_to_dict(user):
    """Return the authenticated user's information for the dashboard."""
    result = {
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
    }

    if user.role == "Student":
        student = db.session.scalar(
            select(Student).where(Student.user_id == user.user_id)
        )
        result["student_id"] = (
            student.student_id if student is not None else None
        )

    return result


@auth_bp.get("/csrf")
def csrf_token():
    return jsonify({"csrf_token": generate_csrf()}), 200


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required."}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required."}), 400

    email = email.strip().lower()
    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = db.session.scalar(select(User).where(User.email == email))

    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "Invalid email or password."}), 401

    login_user(user)

    return jsonify({
        "message": "Login successful.",
        "user": user_to_dict(user),
    }), 200


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logout successful."}), 200


@auth_bp.get("/me")
@login_required
def me():
    return jsonify(user_to_dict(current_user)), 200
