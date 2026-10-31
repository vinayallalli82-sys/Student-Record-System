from sqlalchemy import select

from backend.extensions import db
from backend.models.attendance import Attendance
from backend.models.notification import Notification
from backend.models.subject import Subject


THRESHOLD = 75.0


def synchronize_attendance_notification(student_id, subject_id):
    """Create, update, or remove the low-attendance notification."""
    subject = db.session.get(Subject, subject_id)
    records = db.session.scalars(
        select(Attendance).where(
            Attendance.student_id == student_id,
            Attendance.subject_id == subject_id,
        )
    ).all()

    if not records:
        return {
            "notification_triggered": False,
            "attendance_percentage": None,
            "message": "No attendance records available.",
        }

    classes_attended = sum(
        record.status == "Present" for record in records
    )
    percentage = round(classes_attended / len(records) * 100, 2)

    notification = db.session.scalar(
        select(Notification).where(
            Notification.student_id == student_id,
            Notification.subject_id == subject_id,
        )
    )

    if percentage >= THRESHOLD:
        if notification is not None:
            db.session.delete(notification)
        return {
            "notification_triggered": False,
            "attendance_percentage": percentage,
            "message": "Attendance meets the minimum threshold.",
        }

    message = (
        f"Low attendance alert for {subject.subject_name}: "
        f"your attendance is {percentage}%, below the "
        f"required {THRESHOLD:.0f}%."
    )

    if notification is None:
        notification = Notification(
            student_id=student_id,
            subject_id=subject_id,
            attendance_percentage=percentage,
            message=message,
        )
        db.session.add(notification)
    else:
        notification.attendance_percentage = percentage
        notification.message = message

    return {
        "notification_triggered": True,
        "attendance_percentage": percentage,
        "threshold": THRESHOLD,
        "message": message,
    }
