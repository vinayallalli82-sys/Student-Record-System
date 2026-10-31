"""Tests ensuring faculty access is limited to assigned subjects/students."""

from backend.extensions import db
from backend.models.semester import Semester
from backend.models.subject import Subject
from tests.test_attendance import app, client, login, csrf_headers, faculty_login


def make_unassigned_subject(app):
    with app.app_context():
        semester = Semester.query.first()
        subject = Subject(
            subject_code="UNASG999",
            subject_name="Unassigned Test Subject",
            credits=3.0,
            semester_id=semester.semester_id,
        )
        db.session.add(subject)
        db.session.commit()
        return subject.subject_id


def test_faculty_cannot_view_marks_for_unassigned_subject(client, app):
    subject_id = make_unassigned_subject(app)
    faculty_login(client)

    response = client.get(f"/api/marks/?subject_id={subject_id}")
    assert response.status_code == 403


def test_faculty_cannot_record_attendance_for_unassigned_subject(client, app):
    subject_id = make_unassigned_subject(app)
    faculty_login(client)
    payload = {
        "student_id": app.test_ids["student_a"],
        "subject_id": subject_id,
        "attendance_date": "2026-10-23",
        "status": "Present",
    }
    response = client.post(
        "/api/attendance",
        json=payload,
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_faculty_can_access_assigned_subject_marks(client, app):
    faculty_login(client)
    subject_id = app.test_ids["subject"]
    response = client.get(f"/api/marks/?subject_id={subject_id}")
    assert response.status_code == 200


def test_faculty_cannot_access_student_outside_assigned_subjects(client, app):
    """Create a student with no enrollment in the faculty member's subject."""
    from backend.models.student import Student
    from backend.models.user import User
    from werkzeug.security import generate_password_hash

    with app.app_context():
        other_user = User(
            email="unassigned.student@example.com",
            password_hash=generate_password_hash("StudentTest123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(other_user)
        db.session.flush()
        other_student = Student(
            user_id=other_user.user_id,
            registration_number="TEST-UNASSIGNED",
            first_name="Unassigned",
            last_name="Student",
            course="Test Course",
            admission_year=2026,
        )
        db.session.add(other_student)
        db.session.commit()
        student_id = other_student.student_id

    faculty_login(client)
    response = client.get(f"/api/students/{student_id}")
    assert response.status_code == 403
