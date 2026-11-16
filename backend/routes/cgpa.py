"""FR-009: Student cumulative GPA API."""

from flask import Blueprint, jsonify
from flask_login import current_user, login_required
from sqlalchemy import text

from backend.extensions import db
from backend.permissions import (
    can_access_student_for_any_assigned_subject,
)
from backend.services.cgpa_service import calculate_cgpa

cgpa_bp = Blueprint("cgpa", __name__)


@cgpa_bp.get("/api/students/<int:student_id>/cgpa")
@login_required
def get_student_cgpa(student_id):
    student = db.session.execute(
        text("""
            SELECT student_id, user_id
            FROM students
            WHERE student_id = :sid
        """),
        {"sid": student_id},
    ).first()

    if student is None:
        return jsonify({
            "status": "error",
            "message": "Student not found",
        }), 404

    if current_user.role == "Student":
        if student.user_id != current_user.user_id:
            return jsonify({
                "status": "error",
                "message": "You can only view your own CGPA",
            }), 403
    elif current_user.role == "Faculty":
        if not can_access_student_for_any_assigned_subject(student_id):
            return jsonify({
                "status": "error",
                "message": "You are not assigned to this student.",
            }), 403
    elif current_user.role != "Administrator":
        return jsonify({
            "status": "error",
            "message": "Access denied",
        }), 403

    faculty_subject_filter = ""
    query_parameters = {"sid": student_id}
    if current_user.role == "Faculty":
        faculty_subject_filter = """
            AND EXISTS (
                SELECT 1
                FROM student_subjects ss
                JOIN faculty_subjects fs ON fs.subject_id = ss.subject_id
                WHERE ss.student_id = :sid
                    AND ss.subject_id = s.subject_id
                    AND fs.faculty_id = :faculty_id
            )
        """
        query_parameters["faculty_id"] = current_user.user_id

    rows = db.session.execute(
        text(f"""
            SELECT
                s.subject_code,
                s.credits,
                SUM(m.marks_obtained) AS total_obtained,
                SUM(m.max_marks) AS total_max
            FROM subjects s
            JOIN marks m ON m.subject_id = s.subject_id
            WHERE m.student_id = :sid
                {faculty_subject_filter}
            GROUP BY s.subject_id, s.subject_code, s.credits
            ORDER BY s.subject_code
        """),
        query_parameters,
    ).mappings().all()

    if not rows:
        return jsonify({
            "status": "error",
            "message": "No marks available to calculate CGPA",
        }), 404

    subjects = [
        {
            "code": row["subject_code"],
            "marks": row["total_obtained"],
            "max_marks": row["total_max"],
            "credits": row["credits"],
        }
        for row in rows
    ]

    try:
        result = calculate_cgpa(subjects)
    except (ValueError, TypeError, ArithmeticError) as error:
        return jsonify({
            "status": "error",
            "message": str(error),
        }), 422

    return jsonify({
        "status": "success",
        "student_id": student_id,
        "cgpa": result["cgpa"],
        "total_credits": result["total_credits"],
        "subjects_count": len(subjects),
        "subjects": [
            {
                "code": subject["code"],
                "credits": float(subject["credits"]),
            }
            for subject in subjects
        ],
    }), 200
