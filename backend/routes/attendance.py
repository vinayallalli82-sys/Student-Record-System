
"""Attendance management and student attendance records."""

from datetime import date
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from backend.extensions import db
from backend.models.attendance import Attendance
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.faculty_subject import FacultySubject
from backend.permissions import subject_permission_error


attendance_bp = Blueprint(
    "attendance", __name__, url_prefix="/api/attendance"
)


def roles_required(*allowed_roles):
    """Require login and an authorized role."""

    def decorator(view_function):
        @wraps(view_function)
        @login_required
        def wrapped(*args, **kwargs):
            if current_user.role not in allowed_roles:
                return jsonify({"error": "Permission denied."}), 403
            return view_function(*args, **kwargs)

        return wrapped

    return decorator


def parse_date(value):
    """Accept dates strictly in YYYY-MM-DD format."""

    if not isinstance(value, str):
        return None

    try:
        parsed = date.fromisoformat(value)
        return parsed if parsed.isoformat() == value else None
    except ValueError:
        return None


def attendance_to_dict(record, subject=None):
    """Convert an attendance record into a JSON-compatible dictionary."""

    if subject is None:
        subject = db.session.get(Subject, record.subject_id)

    return {
        "attendance_id": record.attendance_id,
        "student_id": record.student_id,
        "subject_id": record.subject_id,
        "subject_code": subject.subject_code if subject else None,
        "subject_name": subject.subject_name if subject else None,
        "attendance_date": record.attendance_date.isoformat(),
        "status": record.status,
        "recorded_by": record.recorded_by,
    }


def get_own_student():
    """Get the student profile linked to the logged-in account."""

    return Student.query.filter_by(
        user_id=current_user.user_id
    ).first()


def can_view_student(student_id):
    """Students can access only their own attendance records."""

    if current_user.role == "Student":
        student = get_own_student()
        return (
            student is not None
            and student.student_id == student_id
        )

    return current_user.role in ("Faculty", "Administrator")


@attendance_bp.get("/students")
@roles_required("Faculty", "Administrator")
def list_students():
    """List students enrolled in a subject and their attendance status."""

    subject_id = request.args.get("subject_id", type=int)
    date_value = request.args.get("date")

    if subject_id is None or subject_id <= 0:
        return jsonify({
            "error": "A positive subject_id is required."
        }), 400

    if db.session.get(Subject, subject_id) is None:
        return jsonify({"error": "Subject not found."}), 404

    permission_error = subject_permission_error(subject_id)
    if permission_error:
        return permission_error

    attendance_date = None
    if date_value is not None:
        attendance_date = parse_date(date_value)
        if attendance_date is None:
            return jsonify({
                "error": "date must use YYYY-MM-DD format."
            }), 400

    students = (
        Student.query
        .join(
            StudentSubject,
            StudentSubject.student_id == Student.student_id,
        )
        .filter(StudentSubject.subject_id == subject_id)
        .order_by(Student.student_id)
        .all()
    )

    result = []

    for student in students:
        item = {
            "student_id": student.student_id,
            "registration_number": student.registration_number,
            "first_name": student.first_name,
            "last_name": student.last_name,
        }

        if attendance_date is not None:
            record = Attendance.query.filter_by(
                student_id=student.student_id,
                subject_id=subject_id,
                attendance_date=attendance_date,
            ).first()

            item["attendance_status"] = (
                record.status if record else None
            )

        result.append(item)

    return jsonify(result), 200


@attendance_bp.get("/my")
@login_required
def my_attendance():
    """Return attendance belonging only to the logged-in student."""

    if current_user.role != "Student":
        return jsonify({
            "error": "This endpoint is for student accounts only."
        }), 403

    student = get_own_student()
    if student is None:
        return jsonify({"error": "Student profile not found."}), 404

    records = (
        db.session.query(Attendance, Subject)
        .join(Subject, Attendance.subject_id == Subject.subject_id)
        .filter(Attendance.student_id == student.student_id)
        .order_by(Attendance.attendance_date.desc())
        .all()
    )

    return jsonify([
        attendance_to_dict(record, subject)
        for record, subject in records
    ]), 200


@attendance_bp.get("")
@roles_required("Faculty", "Administrator")
def list_attendance():
    """List attendance with optional subject and date filters."""

    subject_id = request.args.get("subject_id", type=int)
    date_value = request.args.get("date")
    start_value = request.args.get("start_date")
    end_value = request.args.get("end_date")

    # Always query Attendance, even when joining faculty assignments.
    query = Attendance.query

    if current_user.role == "Faculty":
        query = query.join(
            FacultySubject,
            FacultySubject.subject_id == Attendance.subject_id,
        ).filter(
            FacultySubject.faculty_id == current_user.user_id
        )

    # Validate and apply an inclusive date range when supplied.
    start_date = (
        parse_date(start_value) if start_value is not None else None
    )
    end_date = (
        parse_date(end_value) if end_value is not None else None
    )

    if start_value is not None and start_date is None:
        return jsonify({
            "error": "start_date must use YYYY-MM-DD format."
        }), 400

    if end_value is not None and end_date is None:
        return jsonify({
            "error": "end_date must use YYYY-MM-DD format."
        }), 400

    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        return jsonify({
            "error": "start_date must not be after end_date."
        }), 400

    if start_date is not None:
        query = query.filter(
            Attendance.attendance_date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            Attendance.attendance_date <= end_date
        )

    if subject_id is not None:
        if subject_id <= 0:
            return jsonify({
                "error": "subject_id must be positive."
            }), 400

        if db.session.get(Subject, subject_id) is None:
            return jsonify({"error": "Subject not found."}), 404

        permission_error = subject_permission_error(subject_id)
        if permission_error:
            return permission_error

        # Explicitly filter Attendance, not the joined FacultySubject.
        query = query.filter(
            Attendance.subject_id == subject_id
        )

    if date_value is not None:
        attendance_date = parse_date(date_value)

        if attendance_date is None:
            return jsonify({
                "error": "date must use YYYY-MM-DD format."
            }), 400

        # Explicitly filter Attendance, not the joined FacultySubject.
        query = query.filter(
            Attendance.attendance_date == attendance_date
        )

    records = query.order_by(
        Attendance.attendance_date.desc()
    ).all()

    return jsonify([
        attendance_to_dict(record) for record in records
    ]), 200


@attendance_bp.post("")
@roles_required("Faculty", "Administrator")
def save_attendance():
    """Create an attendance record for an enrolled student."""

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Request body must be a JSON object."
        }), 400

    student_id = data.get("student_id")
    subject_id = data.get("subject_id")
    attendance_date = parse_date(data.get("attendance_date"))
    status = data.get("status")

    if (
        isinstance(student_id, bool)
        or not isinstance(student_id, int)
        or student_id <= 0
        or isinstance(subject_id, bool)
        or not isinstance(subject_id, int)
        or subject_id <= 0
    ):
        return jsonify({
            "error": (
                "student_id and subject_id must be positive integers."
            )
        }), 400

    if attendance_date is None:
        return jsonify({
            "error": "attendance_date must use YYYY-MM-DD format."
        }), 400

    if status not in ("Present", "Absent"):
        return jsonify({
            "error": "status must be Present or Absent."
        }), 400

    if db.session.get(Student, student_id) is None:
        return jsonify({"error": "Student not found."}), 404

    if db.session.get(Subject, subject_id) is None:
        return jsonify({"error": "Subject not found."}), 404

    # Faculty may record attendance only for assigned subjects.
    permission_error = subject_permission_error(subject_id)
    if permission_error:
        return permission_error

    enrollment = db.session.get(
        StudentSubject, (student_id, subject_id)
    )

    if enrollment is None:
        return jsonify({
            "error": "Student is not enrolled in this subject."
        }), 400

    existing = Attendance.query.filter_by(
        student_id=student_id,
        subject_id=subject_id,
        attendance_date=attendance_date,
    ).first()

    if existing is not None:
        return jsonify({
            "error": (
                "Attendance already exists for this student, subject "
                "and date. Use PUT to update it."
            )
        }), 409

    record = Attendance(
        student_id=student_id,
        subject_id=subject_id,
        attendance_date=attendance_date,
        status=status,
        recorded_by=current_user.user_id,
    )

    try:
        db.session.add(record)
        db.session.commit()
        return jsonify(attendance_to_dict(record)), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Attendance conflicts with an existing record."
        }), 409

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({
            "error": "Unable to save attendance."
        }), 500


@attendance_bp.put("/<int:attendance_id>")
@roles_required("Faculty", "Administrator")
def update_attendance(attendance_id):
    """Update an existing attendance status."""

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Request body must be a JSON object."
        }), 400

    status = data.get("status")

    if status not in ("Present", "Absent"):
        return jsonify({
            "error": "status must be Present or Absent."
        }), 400

    record = db.session.get(Attendance, attendance_id)

    if record is None:
        return jsonify({
            "error": "Attendance record not found."
        }), 404

    permission_error = subject_permission_error(record.subject_id)
    if permission_error:
        return permission_error

    try:
        record.status = status
        db.session.commit()
        return jsonify(attendance_to_dict(record)), 200

    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({
            "error": "Unable to update attendance."
        }), 500


@attendance_bp.get("/percentage/<int:student_id>/<int:subject_id>")
@login_required
def attendance_percentage(student_id, subject_id):
    """Calculate attendance percentage safely."""

    if not can_view_student(student_id):
        return jsonify({"error": "Permission denied."}), 403

    if db.session.get(Student, student_id) is None:
        return jsonify({"error": "Student not found."}), 404

    subject = db.session.get(Subject, subject_id)
    if subject is None:
        return jsonify({"error": "Subject not found."}), 404

    if current_user.role != "Student":
        permission_error = subject_permission_error(subject_id)
        if permission_error:
            return permission_error

    total_classes = Attendance.query.filter_by(
        student_id=student_id,
        subject_id=subject_id,
    ).count()

    classes_attended = Attendance.query.filter_by(
        student_id=student_id,
        subject_id=subject_id,
        status="Present",
    ).count()

    percentage = (
        round(classes_attended / total_classes * 100, 2)
        if total_classes > 0
        else 0.0
    )

    return jsonify({
        "student_id": student_id,
        "subject_id": subject_id,
        "subject_code": subject.subject_code,
        "subject_name": subject.subject_name,
        "total_classes": total_classes,
        "classes_attended": classes_attended,
        "attendance_percentage": percentage,
    }), 200
