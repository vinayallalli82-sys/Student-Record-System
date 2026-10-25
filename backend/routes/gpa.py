"""FR-004: Semester GPA API."""
from flask import Blueprint, jsonify
from sqlalchemy import text

from backend.extensions import db
from backend.services.gpa_service import calculate_semester_gpa

gpa_bp = Blueprint("gpa", __name__)


@gpa_bp.route(
    "/api/students/<int:student_id>/semesters/<int:semester_number>/gpa",
    methods=["GET"],
)
def get_semester_gpa(student_id, semester_number):
    student = db.session.execute(
        text("SELECT student_id FROM students WHERE student_id = :sid"),
        {"sid": student_id},
    ).first()
    if student is None:
        return jsonify({"status": "error", "message": "Student not found"}), 404

    semester = db.session.execute(
        text("SELECT semester_id FROM semesters WHERE semester_number = :n"),
        {"n": semester_number},
    ).first()
    if semester is None:
        return jsonify({"status": "error", "message": "Semester not found"}), 404

    # One row per subject in the semester. Multiple assessments per subject
    # are combined: total marks obtained / total maximum marks.
    rows = db.session.execute(
        text("""
            SELECT s.subject_code,
                   s.credits,
                   SUM(m.marks_obtained) AS total_obtained,
                   SUM(m.max_marks)      AS total_max
            FROM subjects s
            LEFT JOIN marks m
                   ON m.subject_id = s.subject_id AND m.student_id = :sid
            WHERE s.semester_id = :semid
            GROUP BY s.subject_id, s.subject_code, s.credits
            ORDER BY s.subject_code
        """),
        {"sid": student_id, "semid": semester.semester_id},
    ).mappings().all()

    graded, missing = [], []
    for r in rows:
        if r["total_max"] is None:
            missing.append(r["subject_code"])
        else:
            graded.append({
                "code": r["subject_code"],
                "marks": r["total_obtained"],
                "max_marks": r["total_max"],
                "credits": r["credits"],
            })

    if not graded:
        return jsonify({
            "status": "error",
            "message": "No marks entered for this student in this semester",
        }), 404

    try:
        result = calculate_semester_gpa(graded)
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 422

    return jsonify({
        "status": "success",
        "student_id": student_id,
        "semester": semester_number,
        "gpa": result["gpa"],
        "total_credits": result["total_credits"],
        "subjects": result["subjects"],
        "subjects_without_marks": missing,
    })
