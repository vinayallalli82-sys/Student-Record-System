
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from functools import wraps
from sqlalchemy.exc import IntegrityError

from backend.extensions import db
from backend.models.semester import Semester
from backend.models.subject import Subject

subjects_bp = Blueprint("subjects", __name__, url_prefix="/api/subjects")


def administrator_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "Administrator":
            return jsonify({"error": "Administrator access required."}), 403
        return view(*args, **kwargs)
    return wrapped


def subject_to_dict(subject):
    return {
        "subject_id": subject.subject_id,
        "subject_code": subject.subject_code,
        "subject_name": subject.subject_name,
        "credits": str(subject.credits),
        "semester_id": subject.semester_id,
    }


def validate_subject_data(data, existing=None):
    """Validate subject fields and return cleaned values or an error."""
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object."

    values = {}

    for field in ("subject_code", "subject_name", "credits", "semester_id"):
        if field in data:
            values[field] = data[field]
        elif existing is None:
            return None, f"{field} is required."

    code = values.get(
        "subject_code",
        existing.subject_code if existing else None,
    )
    name = values.get(
        "subject_name",
        existing.subject_name if existing else None,
    )
    raw_credits = values.get(
        "credits",
        existing.credits if existing else None,
    )
    raw_semester_id = values.get(
        "semester_id",
        existing.semester_id if existing else None,
    )

    if not isinstance(code, str) or not code.strip():
        return None, "subject_code must be a non-empty string."
    if len(code.strip()) > 20:
        return None, "subject_code must be at most 20 characters."

    if not isinstance(name, str) or not name.strip():
        return None, "subject_name must be a non-empty string."
    if len(name.strip()) > 150:
        return None, "subject_name must be at most 150 characters."

    if isinstance(raw_credits, bool):
        return None, "credits must be a positive number."

    try:
        credits = Decimal(str(raw_credits))
    except (InvalidOperation, ValueError, TypeError):
        return None, "credits must be a valid number."

    if not credits.is_finite() or credits <= 0 or credits > Decimal("999.9"):
        return None, "credits must be greater than 0 and at most 999.9."

    if credits.as_tuple().exponent < -1:
        return None, "credits can have at most one decimal place."

    if isinstance(raw_semester_id, bool):
        return None, "semester_id must be a positive integer."

    try:
        semester_id = int(raw_semester_id)
    except (ValueError, TypeError, OverflowError):
        return None, "semester_id must be a positive integer."

    if str(raw_semester_id).strip() != str(semester_id) or semester_id <= 0:
        return None, "semester_id must be a positive integer."

    if db.session.get(Semester, semester_id) is None:
        return None, "The specified semester does not exist."

    return {
        "subject_code": code.strip(),
        "subject_name": name.strip(),
        "credits": credits,
        "semester_id": semester_id,
    }, None


@subjects_bp.get("")
def list_subjects():
    subjects = Subject.query.order_by(Subject.subject_id).all()
    return jsonify([subject_to_dict(subject) for subject in subjects]), 200


@subjects_bp.get("/<int:subject_id>")
def get_subject(subject_id):
    subject = db.session.get(Subject, subject_id)

    if subject is None:
        return jsonify({"error": "Subject not found."}), 404

    return jsonify(subject_to_dict(subject)), 200


@subjects_bp.post("")
@administrator_required
def create_subject():
    data = request.get_json(silent=True)
    values, error = validate_subject_data(data)

    if error:
        return jsonify({"error": error}), 400

    duplicate = Subject.query.filter_by(
        subject_code=values["subject_code"]
    ).first()

    if duplicate:
        return jsonify({"error": "Subject code already exists."}), 409

    subject = Subject(**values)
    db.session.add(subject)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Could not create subject. Check the subject code and semester."
        }), 409

    return jsonify(subject_to_dict(subject)), 201


@subjects_bp.put("/<int:subject_id>")
@administrator_required
def update_subject(subject_id):
    subject = db.session.get(Subject, subject_id)

    if subject is None:
        return jsonify({"error": "Subject not found."}), 404

    data = request.get_json(silent=True)
    values, error = validate_subject_data(data, existing=subject)

    if error:
        return jsonify({"error": error}), 400

    duplicate = Subject.query.filter(
        Subject.subject_code == values["subject_code"],
        Subject.subject_id != subject_id,
    ).first()

    if duplicate:
        return jsonify({"error": "Subject code already exists."}), 409

    for field, value in values.items():
        setattr(subject, field, value)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Could not update subject. Check the subject code and semester."
        }), 409

    return jsonify(subject_to_dict(subject)), 200
