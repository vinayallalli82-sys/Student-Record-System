"""FR-005: View and FR-015: Download a student's academic records."""

from flask import Blueprint, jsonify, request, send_file
from flask_login import current_user, login_required
from sqlalchemy import case, func

from backend.extensions import db
from backend.models.attendance import Attendance
from backend.models.mark import Mark
from backend.models.semester import Semester
from backend.models.student import Student
from backend.models.subject import Subject
from backend.services.gpa_service import marks_to_grade
from backend.services.academic_records_pdf import (
    generate_academic_records_pdf,
)


academic_records_bp = Blueprint(
    "academic_records",
    __name__,
    url_prefix="/api/academic-records",
)


def get_student_academic_records():
    """Build academic records for the logged-in student and semester."""

    if current_user.role != "Student":
        return None, ({
            "error": "This endpoint is for student accounts only."
        }, 403)

    student = Student.query.filter_by(
        user_id=current_user.user_id
    ).first()

    if student is None:
        return None, ({
            "error": "Student profile not found."
        }, 404)

    semester_value = request.args.get("semester", type=int)

    if semester_value is None or semester_value <= 0:
        return None, ({
            "error": "A positive semester number is required."
        }, 400)

    semester = Semester.query.filter_by(
        semester_number=semester_value
    ).first()

    if semester is None:
        return None, ({
            "error": "Semester not found."
        }, 404)

    subjects = (
        Subject.query
        .filter_by(semester_id=semester.semester_id)
        .order_by(Subject.subject_code)
        .all()
    )

    records = []

    for subject in subjects:
        marks = (
            Mark.query
            .filter_by(
                student_id=student.student_id,
                subject_id=subject.subject_id,
            )
            .order_by(Mark.assessment_name)
            .all()
        )

        total_obtained = sum(
            (mark.marks_obtained for mark in marks),
            start=0,
        )

        total_max = sum(
            (mark.max_marks for mark in marks),
            start=0,
        )

        assessments = []

        for mark in marks:
            grade, grade_point = marks_to_grade(
                mark.marks_obtained,
                mark.max_marks,
            )

            percentage = (
                float(mark.marks_obtained / mark.max_marks * 100)
                if mark.max_marks
                else 0.0
            )

            assessments.append({
                "assessment_name": mark.assessment_name,
                "marks_obtained": float(mark.marks_obtained),
                "max_marks": float(mark.max_marks),
                "percentage": round(percentage, 2),
                "grade": grade,
                "grade_point": float(grade_point),
            })

        attendance_counts = db.session.query(
            func.count(Attendance.attendance_id),
            func.sum(
                case(
                    (Attendance.status == "Present", 1),
                    else_=0,
                )
            ),
        ).filter_by(
            student_id=student.student_id,
            subject_id=subject.subject_id,
        ).one()

        total_classes = int(attendance_counts[0] or 0)
        classes_attended = int(attendance_counts[1] or 0)

        attendance_percentage = (
            round(classes_attended / total_classes * 100, 2)
            if total_classes
            else 0.0
        )

        records.append({
            "subject_id": subject.subject_id,
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "credits": float(subject.credits),
            "assessments": assessments,
            "total_marks_obtained": float(total_obtained),
            "total_max_marks": float(total_max),
            "attendance": {
                "total_classes": total_classes,
                "classes_attended": classes_attended,
                "percentage": attendance_percentage,
            },
        })

    has_records = bool(records)

    message = (
        "Academic records retrieved successfully."
        if has_records
        else "No subjects found for this semester."
    )

    return {
        "status": "success",
        "student_id": student.student_id,
        "semester": semester.semester_number,
        "academic_year": semester.academic_year,
        "message": message,
        "subjects": records,
    }, None


@academic_records_bp.get("/my")
@login_required
def my_academic_records():
    """Return the logged-in student's academic records for a semester."""

    data, error = get_student_academic_records()

    if error:
        return jsonify(error[0]), error[1]

    return jsonify(data), 200


@academic_records_bp.get("/download")
@login_required
def download_academic_records():
    """Download the logged-in student's academic records as a PDF."""

    data, error = get_student_academic_records()

    if error:
        return jsonify(error[0]), error[1]

    pdf_buffer = generate_academic_records_pdf(data)

    filename = (
        f"academic_records_semester_{data['semester']}.pdf"
    )

    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )