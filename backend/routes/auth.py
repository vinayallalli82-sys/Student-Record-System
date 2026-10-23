
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import select
from werkzeug.security import check_password_hash

from backend.extensions import db
from backend.models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "JSON body is required."}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required."}), 400

    user = db.session.scalar(
        select(User).where(User.email == email.strip().lower())
    )

    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "Invalid email or password."}), 401

    login_user(user)
    return jsonify({
        "message": "Login successful.",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
        },
    }), 200


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logout successful."}), 200


@auth_bp.get("/me")
@login_required
def me():
    return jsonify({
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role,
    }), 200
