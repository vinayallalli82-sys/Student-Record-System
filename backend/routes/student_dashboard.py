
import logging

from flask import Blueprint, jsonify
from flask_login import current_user, login_required
from sqlalchemy import case, func

from backend.extensions import db
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.semester import Semester
from backend.models.attendance import Attendance
from backend.models.mark import Mark


logger = logging.getLogger(__name__)

student_dashboard_bp = Blueprint(
    "student_dashboard",
    __name__,
    url_prefix="/api/student",
)


@student_dashboard_bp.get("/dashboard")
@login_required
def dashboard():
    try:
        # Students may view only their own dashboard.
        if current_user.role != "Student":
            return jsonify({"error": "Student access required."}), 403

        student = Student.query.filter_by(
            user_id=current_user.user_id
        ).first()

        if student is None:
            return jsonify({"error": "Student profile not found."}), 404

        subjects = (
            db.session.query(Subject, Semester.semester_number)
            .join(
                StudentSubject,
                StudentSubject.subject_id == Subject.subject_id,
            )
            .join(
                Semester,
                Semester.semester_id == Subject.semester_id,
            )
            .filter(
                StudentSubject.student_id == student.student_id
            )
            .order_by(
                Semester.semester_number,
                Subject.subject_code,
            )
            .all()
        )

        subject_data = []
        total_classes = 0
        classes_attended = 0
        total_marks_records = 0
        marks_data = []

        for subject, semester_number in subjects:
            attendance_rows = (
                db.session.query(
                    func.count(Attendance.attendance_id),
                    func.sum(
                        case(
                            (Attendance.status == "Present", 1),
                            else_=0,
                        )
                    ),
                )
                .filter(
                    Attendance.student_id == student.student_id,
                    Attendance.subject_id == subject.subject_id,
                )
                .first()
            )

            subject_classes = attendance_rows[0] or 0
            subject_present = attendance_rows[1] or 0

            total_classes += subject_classes
            classes_attended += subject_present

            subject_attendance = (
                round(subject_present / subject_classes * 100, 2)
                if subject_classes
                else None
            )

            subject_marks = (
                Mark.query.filter_by(
                    student_id=student.student_id,
                    subject_id=subject.subject_id,
                )
                .order_by(Mark.assessment_name)
                .all()
            )

            for mark in subject_marks:
                total_marks_records += 1

                marks_obtained = float(mark.marks_obtained)
                max_marks = float(mark.max_marks)

                marks_data.append({
                    "mark_id": mark.mark_id,
                    "subject_id": subject.subject_id,
                    "subject_code": subject.subject_code,
                    "subject_name": subject.subject_name,
                    "assessment_name": mark.assessment_name,
                    "marks_obtained": marks_obtained,
                    "max_marks": max_marks,
                    "percentage": (
                        round(marks_obtained / max_marks * 100, 2)
                        if max_marks > 0
                        else None
                    ),
                })

            subject_data.append({
                "subject_id": subject.subject_id,
                "subject_code": subject.subject_code,
                "subject_name": subject.subject_name,
                "credits": float(subject.credits),
                "semester_number": semester_number,
                "attendance": {
                    "total_classes": subject_classes,
                    "classes_attended": subject_present,
                    "percentage": subject_attendance,
                },
                "assessment_count": len(subject_marks),
            })

        overall_attendance = (
            round(classes_attended / total_classes * 100, 2)
            if total_classes
            else None
        )

        return jsonify({
            "student": {
                "student_id": student.student_id,
                "user_id": current_user.user_id,
                "registration_number": student.registration_number,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "course": student.course,
                "admission_year": student.admission_year,
                "email": current_user.email,
            },
            "summary": {
                "attendance_percentage": overall_attendance,
                "classes_attended": classes_attended,
                "total_classes": total_classes,
                "subject_count": len(subject_data),
                "assessment_count": total_marks_records,
            },
            "subjects": subject_data,
            "marks": marks_data,
        }), 200


    except Exception as exc:
        logger.exception("Student dashboard failed")
        db.session.rollback()

        return jsonify({
            "error": str(exc),
            "exception_type": type(exc).__name__,
        }), 500
