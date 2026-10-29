"""ADMIN-002 account and faculty-subject assignment management."""

from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.faculty_subject import FacultySubject
from backend.models.subject import Subject
from backend.models.user import User

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
VALID_ROLES = {"Student", "Faculty", "Administrator"}


def administrator_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "Administrator":
            return jsonify({"error": "Administrator access required."}), 403
        return view(*args, **kwargs)
    return wrapped


def user_to_dict(user):
    return {"user_id": user.user_id, "email": user.email, "role": user.role, "is_active": user.is_active}


@admin_bp.get("/users")
@administrator_required
def list_users():
    return jsonify([user_to_dict(u) for u in User.query.order_by(User.user_id).all()]), 200


@admin_bp.post("/users")
@administrator_required
def create_user():
    data = request.get_json(silent=True) or {}
    email, password, role = data.get("email"), data.get("password"), data.get("role")
    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "A valid email is required."}), 400
    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"error": "Password must contain at least 8 characters."}), 400
    if role not in VALID_ROLES:
        return jsonify({"error": "Invalid role."}), 400
    email = email.strip().lower()
    if User.query.filter(func.lower(User.email) == email).first():
        return jsonify({"error": "Email already exists."}), 409
    user = User(email=email, password_hash=generate_password_hash(password), role=role, is_active=True)
    db.session.add(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return jsonify({"message": "User created successfully.", "user": user_to_dict(user)}), 201


@admin_bp.patch("/users/<int:user_id>")
@administrator_required
def update_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "User not found."}), 404
    data = request.get_json(silent=True) or {}
    if not data or not set(data).issubset({"role", "is_active"}):
        return jsonify({"error": "Provide role and/or is_active only."}), 400
    role = data.get("role", user.role)
    active = data.get("is_active", user.is_active)
    if role not in VALID_ROLES:
        return jsonify({"error": "Invalid role."}), 400
    if not isinstance(active, bool):
        return jsonify({"error": "is_active must be true or false."}), 400
    if user.user_id == current_user.user_id and (role != "Administrator" or not active):
        return jsonify({"error": "You cannot remove or deactivate your own Administrator account."}), 400
    losing_admin = user.role == "Administrator" and user.is_active and (role != "Administrator" or not active)
    if losing_admin and User.query.filter_by(role="Administrator", is_active=True).count() <= 1:
        return jsonify({"error": "Cannot remove or deactivate the last active Administrator."}), 409
    user.role, user.is_active = role, active
    db.session.commit()
    return jsonify({"message": "User updated successfully.", "user": user_to_dict(user)}), 200


@admin_bp.get("/faculty-assignments")
@administrator_required
def list_faculty_assignments():
    rows = (db.session.query(FacultySubject, User, Subject)
            .join(User, User.user_id == FacultySubject.faculty_id)
            .join(Subject, Subject.subject_id == FacultySubject.subject_id)
            .order_by(User.email, Subject.subject_code).all())
    return jsonify([{"faculty_id": fs.faculty_id, "faculty_email": user.email,
                     "subject_id": fs.subject_id, "subject_code": subject.subject_code,
                     "subject_name": subject.subject_name}
                    for fs, user, subject in rows]), 200


@admin_bp.post("/faculty-assignments")
@administrator_required
def assign_faculty():
    data = request.get_json(silent=True) or {}
    faculty_id, subject_id = data.get("faculty_id"), data.get("subject_id")
    if (isinstance(faculty_id, bool) or not isinstance(faculty_id, int) or faculty_id <= 0
            or isinstance(subject_id, bool) or not isinstance(subject_id, int) or subject_id <= 0):
        return jsonify({"error": "faculty_id and subject_id must be positive integers."}), 400
    faculty = db.session.get(User, faculty_id)
    if faculty is None or faculty.role != "Faculty":
        return jsonify({"error": "faculty_id must identify an existing Faculty account."}), 400
    if db.session.get(Subject, subject_id) is None:
        return jsonify({"error": "Subject not found."}), 404
    if db.session.get(FacultySubject, (faculty_id, subject_id)) is not None:
        return jsonify({"error": "Faculty is already assigned to this subject."}), 409
    db.session.add(FacultySubject(faculty_id=faculty_id, subject_id=subject_id))
    db.session.commit()
    return jsonify({"message": "Faculty assigned to subject.", "faculty_id": faculty_id, "subject_id": subject_id}), 201


@admin_bp.delete("/faculty-assignments/<int:faculty_id>/<int:subject_id>")
@administrator_required
def unassign_faculty(faculty_id, subject_id):
    assignment = db.session.get(FacultySubject, (faculty_id, subject_id))
    if assignment is None:
        return jsonify({"error": "Faculty assignment not found."}), 404
    db.session.delete(assignment)
    db.session.commit()
    return jsonify({"message": "Faculty assignment removed."}), 200
