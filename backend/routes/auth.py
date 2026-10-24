
from flask import Blueprint, current_app, jsonify, request, session
from werkzeug.security import check_password_hash

from backend.models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    email = email.strip().lower()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if (
        user is None
        or not user.is_active
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    session.clear()
    session["user_id"] = user.user_id
    session.permanent = True

    return jsonify({
        "message": "Login successful",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
        },
    }), 200


@auth_bp.post("/logout")
def logout():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    session.clear()
    return jsonify({"message": "Logout successful"}), 200


@auth_bp.get("/me")
def current_user():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = current_app.extensions["sqlalchemy"].session.get(User, user_id)

    if user is None or not user.is_active:
        session.clear()
        return jsonify({"error": "Authentication required"}), 401

    return jsonify({
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
    }), 200
