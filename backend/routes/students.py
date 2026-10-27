
from functools import wraps

from flask import Blueprint, jsonify
from flask_login import current_user, login_required
from sqlalchemy import select

from backend.extensions import db
from backend.models.student import Student


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
        if current_user.role != "Faculty":
            return jsonify({"error": "Faculty access required."}), 403

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
