"""FR-004: Semester GPA API."""

from flask import Blueprint, jsonify
from flask_login import current_user, login_required
from sqlalchemy import text

from backend.extensions import db
from backend.permissions import (
    can_access_student_for_any_assigned_subject,
)
from backend.services.gpa_service import calculate_semester_gpa

gpa_bp = Blueprint("gpa", __name__)


@gpa_bp.route(
    "/api/students/<int:student_id>/semesters/<int:semester_number>/gpa",
    methods=["GET"],
)
@login_required
def get_semester_gpa(student_id, semester_number):
    """Return a student's GPA and subject-wise grade details."""
    student = db.session.execute(
        text(
            "SELECT student_id, user_id FROM students "
            "WHERE student_id = :sid"
        ),
        {"sid": student_id},
    ).first()
    if student is None:
        return jsonify({"status": "error", "message": "Student not found"}), 404

    if current_user.role == "Student":
        if student.user_id != current_user.user_id:
            return jsonify({
                "status": "error",
                "message": "You can only view your own GPA",
            }), 403
    elif current_user.role == "Faculty":
        if not can_access_student_for_any_assigned_subject(student_id):
            return jsonify({
                "status": "error",
                "message": "You are not assigned to this student.",
            }), 403
    elif current_user.role != "Administrator":
        return jsonify({"status": "error", "message": "Access denied"}), 403

    semester = db.session.execute(
        text(
            "SELECT semester_id FROM semesters "
            "WHERE semester_number = :number"
        ),
        {"number": semester_number},
    ).first()
    if semester is None:
        return jsonify({"status": "error", "message": "Semester not found"}), 404

    faculty_subject_filter = ""
    query_parameters = {
        "sid": student_id,
        "semid": semester.semester_id,
    }
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
        text(
            f"""
            SELECT
                s.subject_id,
                s.subject_code,
                s.subject_name,
                s.credits,
                SUM(m.marks_obtained) AS total_obtained,
                SUM(m.max_marks) AS total_max
            FROM subjects s
            LEFT JOIN marks m
                ON m.subject_id = s.subject_id
                AND m.student_id = :sid
            WHERE s.semester_id = :semid
                {faculty_subject_filter}
            GROUP BY
                s.subject_id,
                s.subject_code,
                s.subject_name,
                s.credits
            ORDER BY s.subject_code
            """
        ),
        query_parameters,
    ).mappings().all()

    graded = []
    missing = []
    for row in rows:
        if row["total_max"] is None:
            missing.append(row["subject_code"])
        else:
            graded.append({
                "subject_id": row["subject_id"],
                "code": row["subject_code"],
                "subject_name": row["subject_name"],
                "marks": row["total_obtained"],
                "max_marks": row["total_max"],
                "credits": row["credits"],
            })

    if not graded:
        return jsonify({
            "status": "error",
            "message": "No marks entered for this student in this semester",
        }), 404

    try:
        result = calculate_semester_gpa(graded)
    except ValueError as error:
        return jsonify({"status": "error", "message": str(error)}), 422

    result_subjects = result["subjects"]
    names_by_code = {row["subject_code"]: row["subject_name"] for row in rows}
    for subject in result_subjects:
        code = subject.get("code") or subject.get("subject_code")
        if code in names_by_code:
            subject["subject_name"] = names_by_code[code]

    return jsonify({
        "status": "success",
        "student_id": student_id,
        "semester": semester_number,
        "gpa": result["gpa"],
        "total_credits": result["total_credits"],
        "subjects": result_subjects,
        "subjects_without_marks": missing,
    })
