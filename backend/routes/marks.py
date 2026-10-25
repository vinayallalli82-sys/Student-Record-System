
from decimal import Decimal, InvalidOperation
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from backend.extensions import db
from backend.models.mark import Mark


marks_bp = Blueprint("marks", __name__, url_prefix="/api/marks")


def faculty_required(view_function):
    """Allow only authenticated faculty to manage marks."""

    @wraps(view_function)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "Faculty":
            return jsonify({"error": "Faculty access required."}), 403
        return view_function(*args, **kwargs)

    return wrapped


def parse_marks(data):
    """Validate and parse the marks request data."""
    required = (
        "student_id",
        "subject_id",
        "assessment_name",
        "marks_obtained",
        "max_marks",
    )

    if not isinstance(data, dict):
        return None, "Request body must be a JSON object."

    missing = [field for field in required if field not in data]
    if missing:
        return None, f"Missing required fields: {', '.join(missing)}"

    ids = (data["student_id"], data["subject_id"])
    if any(
        isinstance(value, bool) or not isinstance(value, int)
        for value in ids
    ):
        return None, "Student ID and subject ID must be integers."

    student_id, subject_id = ids
    if student_id <= 0 or subject_id <= 0:
        return None, "Student ID and subject ID must be positive integers."

    assessment_name = data["assessment_name"]
    if not isinstance(assessment_name, str) or not assessment_name.strip():
        return None, "Assessment name cannot be empty."

    assessment_name = assessment_name.strip()
    if len(assessment_name) > 100:
        return None, "Assessment name cannot exceed 100 characters."

    try:
        obtained = Decimal(str(data["marks_obtained"]))
        maximum = Decimal(str(data["max_marks"]))
    except (ValueError, TypeError, InvalidOperation):
        return None, "Marks must be valid numbers."

    if not obtained.is_finite() or not maximum.is_finite():
        return None, "Marks must be finite numbers."

    if obtained < 0:
        return None, "Marks obtained cannot be negative."

    if maximum <= 0:
        return None, "Maximum marks must be greater than zero."

    if obtained > maximum:
        return None, "Marks obtained cannot exceed maximum marks."

    if (
        obtained.as_tuple().exponent < -2
        or maximum.as_tuple().exponent < -2
    ):
        return None, "Marks can have at most two decimal places."

    if obtained >= Decimal("10000") or maximum >= Decimal("10000"):
        return None, "Marks must be less than 10000."

    return {
        "student_id": student_id,
        "subject_id": subject_id,
        "assessment_name": assessment_name,
        "marks_obtained": obtained,
        "max_marks": maximum,
    }, None


def mark_to_dict(mark):
    """Convert a marks record into a JSON-compatible dictionary."""
    return {
        "mark_id": mark.mark_id,
        "student_id": mark.student_id,
        "subject_id": mark.subject_id,
        "assessment_name": mark.assessment_name,
        "marks_obtained": float(mark.marks_obtained),
        "max_marks": float(mark.max_marks),
        "entered_by": mark.entered_by,
        "updated_at": (
            mark.updated_at.isoformat() if mark.updated_at else None
        ),
    }


@marks_bp.post("/")
@faculty_required
def create_mark():
    data, error = parse_marks(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    mark = Mark(
        **data,
        entered_by=current_user.user_id,
    )

    try:
        db.session.add(mark)
        db.session.commit()
        return jsonify(mark_to_dict(mark)), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": (
                "Student or subject does not exist, or marks for "
                "this assessment already exist."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to create marks")
        return jsonify({"error": "Unable to save marks."}), 500


@marks_bp.put("/<int:mark_id>")
@faculty_required
def update_mark(mark_id):
    data, error = parse_marks(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    mark = db.session.get(Mark, mark_id)
    if mark is None:
        return jsonify({"error": "Marks record not found."}), 404

    try:
        for field, value in data.items():
            setattr(mark, field, value)

        # Keep the original faculty member recorded in entered_by.
        db.session.commit()
        return jsonify(mark_to_dict(mark)), 200

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": (
                "Student or subject does not exist, or another record "
                "already uses this assessment."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to update marks")
        return jsonify({"error": "Unable to update marks."}), 500
