
from flask import Blueprint, current_app, jsonify
from flask_login import current_user, login_required
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from backend.extensions import db
from backend.models.notification import Notification
from backend.models.student import Student
from backend.models.subject import Subject
from backend.services.notification_service import (
    synchronize_attendance_notification,
)

notifications_bp = Blueprint(
    "notifications",
    __name__,
    url_prefix="/api/notifications",
)


@notifications_bp.post("/check/<int:student_id>/<int:subject_id>")
@login_required
def check_attendance(student_id, subject_id):
    """Create a notification only when attendance is below 75%."""
    student = db.session.get(Student, student_id)

    if student is None:
        return jsonify({"error": "Student not found."}), 404

    if current_user.role == "Student":
        if student.user_id != current_user.user_id:
            return jsonify({"error": "Permission denied."}), 403
    elif current_user.role not in ("Faculty", "Administrator"):
        return jsonify({"error": "Permission denied."}), 403

    subject = db.session.get(Subject, subject_id)

    if subject is None:
        return jsonify({"error": "Subject not found."}), 404

    try:
        result = synchronize_attendance_notification(
            student_id, subject_id
        )
        db.session.commit()
        return jsonify(result), 200
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to synchronize attendance notification"
        )
        return jsonify({
            "error": "Unable to update attendance notification."
        }), 500


@notifications_bp.get("")
@login_required
def get_notifications():
    """Return notifications belonging only to the logged-in student."""
    if current_user.role != "Student":
        return jsonify({"error": "Student access only."}), 403

    student = db.session.scalar(
        select(Student).where(
            Student.user_id == current_user.user_id
        )
    )

    if student is None:
        return jsonify({"error": "Student record not found."}), 404

    notifications = db.session.scalars(
        select(Notification)
        .where(Notification.student_id == student.student_id)
        .order_by(Notification.created_at.desc())
    ).all()

    return jsonify([
        {
            "notification_id": item.notification_id,
            "subject_id": item.subject_id,
            "attendance_percentage": item.attendance_percentage,
            "message": item.message,
            "created_at": item.created_at.isoformat(),
        }
        for item in notifications
    ]), 200
