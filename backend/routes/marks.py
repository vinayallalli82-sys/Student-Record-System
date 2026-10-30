
""""Marks management and FR-014 subject-wise marks summary."""

from decimal import Decimal, InvalidOperation
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from backend.extensions import db
from backend.models.mark import Mark
from backend.models.student import Student
from backend.models.subject import Subject
from backend.models.student_subject import StudentSubject
from backend.models.faculty_subject import FacultySubject
from backend.permissions import subject_permission_error


marks_bp = Blueprint("marks", __name__, url_prefix="/api/marks")

def faculty_required(view_function):
    """Allow only authenticated faculty to manage and view marks."""

    @wraps(view_function)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role not in ("Faculty", "Administrator"):
            return jsonify({"error": "Faculty or Administrator access required."}), 403

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


def validate_enrollment(student_id, subject_id):
    """Check that a student exists and is enrolled in the subject."""

    student = db.session.get(Student, student_id)
    if student is None:
        return "Student not found.", 404

    subject = db.session.get(Subject, subject_id)
    if subject is None:
        return "Subject not found.", 404

    enrollment = (
        db.session.query(StudentSubject)
        .filter(
            StudentSubject.student_id == student_id,
            StudentSubject.subject_id == subject_id,
        )
        .first()
    )

    if enrollment is None:
        return "Student is not enrolled in this subject.", 400

    return None


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


@marks_bp.get("/")
@faculty_required
def list_marks():
    """List saved marks for faculty review."""

    student_id = request.args.get("student_id", type=int)
    subject_id = request.args.get("subject_id", type=int)

    query = (
        db.session.query(Mark, Student, Subject)
        .join(Student, Mark.student_id == Student.student_id)
        .join(Subject, Mark.subject_id == Subject.subject_id)
    )

    if current_user.role == "Faculty":
        query = query.join(
            FacultySubject, FacultySubject.subject_id == Mark.subject_id
        ).filter(FacultySubject.faculty_id == current_user.user_id)

    if student_id is not None:
        if student_id <= 0:
            return jsonify({"error": "student_id must be positive."}), 400

        query = query.filter(Mark.student_id == student_id)

    if subject_id is not None:
        permission_error = subject_permission_error(subject_id)
        if permission_error:
            return permission_error
        if subject_id <= 0:
            return jsonify({"error": "subject_id must be positive."}), 400

        query = query.filter(Mark.subject_id == subject_id)

    rows = query.order_by(Mark.mark_id.desc()).all()

    return jsonify([
        {
            **mark_to_dict(mark),
            "registration_number": student.registration_number,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
        }
        for mark, student, subject in rows
    ]), 200


@marks_bp.get("/summary")
@faculty_required
def subject_marks_summary():
    """Return a subject-wise summary, including enrolled students
    who do not yet have recorded marks.
    """

    subject_id = request.args.get("subject_id", type=int)

    if subject_id is None or subject_id <= 0:
        return jsonify({
            "error": "A positive subject_id is required."
        }), 400

    subject = db.session.get(Subject, subject_id)

    if subject is None:
        return jsonify({"error": "Subject not found."}), 404

    permission_error = subject_permission_error(subject_id)
    if permission_error:
        return permission_error

    # Start with enrollments so students without marks are included.
    rows = (
        db.session.query(Student, Mark)
        .join(
            StudentSubject,
            StudentSubject.student_id == Student.student_id,
        )
        .outerjoin(
            Mark,
            (Mark.student_id == Student.student_id)
            & (Mark.subject_id == subject_id),
        )
        .filter(StudentSubject.subject_id == subject_id)
        .order_by(
            Student.registration_number,
            Mark.assessment_name,
        )
        .all()
    )

    students = {}

    for student, mark in rows:
        student_record = students.setdefault(
            student.student_id,
            {
                "student_id": student.student_id,
                "registration_number": student.registration_number,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "assessments": [],
            },
        )

        if mark is not None:
            student_record["assessments"].append({
                "assessment_name": mark.assessment_name,
                "marks_obtained": float(mark.marks_obtained),
                "max_marks": float(mark.max_marks),
            })

    has_marks = any(
        record["assessments"] for record in students.values()
    )

    if not students:
        message = "No students are enrolled in this subject."
    elif not has_marks:
        message = "No marks are available for enrolled students."
    else:
        message = "Subject-wise marks summary retrieved successfully."

    return jsonify({
        "status": "success",
        "subject": {
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
        },
        "students": list(students.values()),
        "message": message,
    }), 200


@marks_bp.post("/")
@faculty_required
def create_mark():
    """Create marks for an enrolled student."""

    data, error = parse_marks(request.get_json(silent=True))

    if error:
        return jsonify({"error": error}), 400

    permission_error = subject_permission_error(data["subject_id"])
    if permission_error:
        return permission_error

    enrollment_error = validate_enrollment(
        data["student_id"],
        data["subject_id"],
    )

    if enrollment_error:
        message, status_code = enrollment_error
        return jsonify({"error": message}), status_code

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
                "Marks for this assessment already exist, or a database "
                "constraint was violated."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to create marks")

        return jsonify({"error": "Unable to save marks."}), 500


@marks_bp.put("/<int:mark_id>")
@faculty_required
def update_mark(mark_id):
    """Update marks for an enrolled student."""

    data, error = parse_marks(request.get_json(silent=True))

    if error:
        return jsonify({"error": error}), 400

    mark = db.session.get(Mark, mark_id)

    if mark is None:
        return jsonify({"error": "Marks record not found."}), 404

    permission_error = subject_permission_error(mark.subject_id)
    if permission_error:
        return permission_error

    permission_error = subject_permission_error(data["subject_id"])
    if permission_error:
        return permission_error

    enrollment_error = validate_enrollment(
        data["student_id"],
        data["subject_id"],
    )

    if enrollment_error:
        message, status_code = enrollment_error
        return jsonify({"error": message}), status_code

    try:
        for field, value in data.items():
            setattr(mark, field, value)

        # Keep the original faculty member in entered_by.
        db.session.commit()

        return jsonify(mark_to_dict(mark)), 200

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": (
                "Another record already uses this assessment, or a "
                "database constraint was violated."
            )
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to update marks")

        return jsonify({"error": "Unable to update marks."}), 500
