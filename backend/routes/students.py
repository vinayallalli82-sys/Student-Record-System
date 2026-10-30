
from functools import wraps

from flask import Blueprint, jsonify
from flask_login import current_user, login_required
from sqlalchemy import select

from backend.extensions import db
from backend.models.student import Student
from backend.permissions import can_access_student_for_any_assigned_subject


students_bp = Blueprint(
    "students",
    __name__,
    url_prefix="/api/students",
)


def faculty_required(view_function):
    """Allow only authenticated faculty to view student profiles."""

    @wraps(view_function)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role not in ("Faculty", "Administrator"):
            return jsonify({"error": "Faculty or Administrator access required."}), 403

        return view_function(*args, **kwargs)

    return wrapped


@students_bp.get("/<int:student_id>")
@faculty_required
def get_student_profile(student_id):
    """Return a student's profile by their student ID."""

    student = db.session.scalar(
        select(Student).where(Student.student_id == student_id)
    )

    if student is None:
        return jsonify({"error": "Student not found."}), 404

    if current_user.role == "Faculty" and not can_access_student_for_any_assigned_subject(student_id):
        return jsonify({"error": "You are not assigned to this student."}), 403

    return jsonify({
        "student_id": student.student_id,
        "registration_number": student.registration_number,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "date_of_birth": (
            student.date_of_birth.isoformat()
            if student.date_of_birth
            else None
        ),
        "course": student.course,
        "admission_year": student.admission_year,
    }), 200
