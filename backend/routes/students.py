
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from backend.extensions import db
from backend.models.semester import Semester
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.user import User
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

    user = db.session.get(User, student.user_id) if student.user_id else None
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
        "email": user.email if user else None,
    }), 200


@students_bp.get("/me")
@login_required
def get_own_student_profile():
    """Return only the authenticated student's profile and enrollments."""
    if current_user.role != "Student":
        return jsonify({"error": "This endpoint is for student accounts only."}), 403

    student = db.session.scalar(
        select(Student).where(Student.user_id == current_user.user_id)
    )
    if student is None:
        return jsonify({"error": "Student profile not found."}), 404

    semester_id, error = requested_semester_id()
    if error:
        return jsonify({"error": error}), 400

    rows = (
        db.session.query(Subject, Semester)
        .join(StudentSubject, StudentSubject.subject_id == Subject.subject_id)
        .join(Semester, Semester.semester_id == Subject.semester_id)
        .filter(StudentSubject.student_id == student.student_id)
        .order_by(Semester.semester_number, Subject.subject_code)
    )
    if semester_id is not None:
        rows = rows.filter(Subject.semester_id == semester_id)
    rows = rows.all()
    subjects = [
        {
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "credits": float(subject.credits),
            "semester_id": semester.semester_id,
            "semester_number": semester.semester_number,
            "academic_year": semester.academic_year,
        }
        for subject, semester in rows
    ]

    return jsonify({
        "student_id": student.student_id,
        "registration_number": student.registration_number,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "date_of_birth": (
            student.date_of_birth.isoformat()
            if student.date_of_birth else None
        ),
        "course": student.course,
        "admission_year": student.admission_year,
        "email": current_user.email,
        "subjects": subjects,
    }), 200


def requested_semester_id():
    """Validate an optional semester filter supplied to a student endpoint."""
    raw_value = request.args.get("semester_id")
    if raw_value is None:
        return None, None

    try:
        semester_id = int(raw_value)
    except (TypeError, ValueError):
        return None, "semester_id must be a positive integer."

    if str(semester_id) != raw_value or semester_id <= 0:
        return None, "semester_id must be a positive integer."

    return semester_id, None


@students_bp.get("/me/semesters")
@login_required
def get_own_semesters():
    """Return semesters with subjects allocated to the authenticated student."""
    if current_user.role != "Student":
        return jsonify({"error": "This endpoint is for student accounts only."}), 403

    student = db.session.scalar(
        select(Student).where(Student.user_id == current_user.user_id)
    )
    if student is None:
        return jsonify({"error": "Student profile not found."}), 404

    semesters = (
        db.session.query(Semester)
        .order_by(Semester.semester_number, Semester.academic_year)
        .all()
    )
    latest = (
        db.session.query(Semester.semester_id)
        .join(Subject, Subject.semester_id == Semester.semester_id)
        .join(StudentSubject, StudentSubject.subject_id == Subject.subject_id)
        .filter(StudentSubject.student_id == student.student_id)
        .order_by(
            StudentSubject.enrolled_at.desc(),
            Semester.semester_number.desc(),
            Semester.semester_id.desc(),
        )
        .first()
    )

    return jsonify({
        "semesters": [
            {
                "semester_id": semester.semester_id,
                "semester_number": semester.semester_number,
                "academic_year": semester.academic_year,
            }
            for semester in semesters
        ],
        "latest_semester_id": latest[0] if latest else None,
    }), 200
