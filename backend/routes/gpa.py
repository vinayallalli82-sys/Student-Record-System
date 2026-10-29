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
    """Return a student's GPA and subject-wise grade details."""
    student = db.session.execute(
        text("SELECT student_id FROM students WHERE student_id = :sid"),
        {"sid": student_id},
    ).first()
    if student is None:
        return jsonify({"status": "error", "message": "Student not found"}), 404

    semester = db.session.execute(
        text("SELECT semester_id FROM semesters WHERE semester_number = :number"),
        {"number": semester_number},
    ).first()
    if semester is None:
        return jsonify({"status": "error", "message": "Semester not found"}), 404

    rows = db.session.execute(
        text(
            """
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
            GROUP BY
                s.subject_id,
                s.subject_code,
                s.subject_name,
                s.credits
            ORDER BY s.subject_code
            """
        ),
        {"sid": student_id, "semid": semester.semester_id},
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
