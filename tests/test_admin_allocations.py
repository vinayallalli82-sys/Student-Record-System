"""Tests for Administrator-managed faculty assignments and student allocations."""

from datetime import date

import pytest
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.attendance import Attendance
from backend.models.faculty_subject import FacultySubject
from backend.models.mark import Mark
from backend.models.semester import Semester
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.user import User
from tests.test_attendance import app, client, csrf_headers, login


def create_admin(app):
    with app.app_context():
        admin = User(
            email="allocation.admin@example.com",
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(admin)
        db.session.commit()


def admin_login(client):
    response = login(
        client,
        "allocation.admin@example.com",
        "AdminTest123!",
    )
    assert response.status_code == 200


def create_subject(app, subject_code, semester_id=None):
    with app.app_context():
        if semester_id is None:
            semester_id = Subject.query.first().semester_id
        subject = Subject(
            subject_code=subject_code,
            subject_name=f"{subject_code} Subject",
            credits=3.0,
            semester_id=semester_id,
        )
        db.session.add(subject)
        db.session.commit()
        return subject.subject_id


def create_faculty(app, email):
    with app.app_context():
        faculty = User(
            email=email,
            password_hash=generate_password_hash("FacultyTest123!"),
            role="Faculty",
            is_active=True,
        )
        db.session.add(faculty)
        db.session.commit()
        return faculty.user_id


def test_student_allocation_endpoints_require_administrator(client, app):
    response = client.get("/api/admin/student-allocations")
    assert response.status_code == 401

    assert login(client, "student.a@example.com").status_code == 200
    response = client.post(
        "/api/admin/student-allocations",
        json={
            "student_id": app.test_ids["student_a"],
            "subject_id": app.test_ids["subject"],
            "semester_id": 1,
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_admin_can_assign_faculty_for_subject_semester(client, app):
    create_admin(app)
    admin_login(client)
    subject_id = create_subject(app, "ALLOC101")
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        semester_id = subject.semester_id

    response = client.post(
        "/api/admin/faculty-assignments",
        json={
            "faculty_id": app.test_ids["faculty"],
            "subject_id": subject_id,
            "semester_id": semester_id,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.get_json()["semester_id"] == semester_id
    assignments = client.get("/api/admin/faculty-assignments").get_json()
    assert any(
        item["subject_id"] == subject_id
        and item["semester_id"] == semester_id
        for item in assignments
    )


def test_faculty_assignment_rejects_duplicates_and_mismatched_semester(
    client, app
):
    create_admin(app)
    admin_login(client)
    with app.app_context():
        subject = db.session.get(Subject, app.test_ids["subject"])
        semester = Semester(
            semester_number=2,
            academic_year="2026-2027",
        )
        db.session.add(semester)
        db.session.commit()
        semester_id = semester.semester_id
        subject_id = subject.subject_id
        subject_semester_id = subject.semester_id

    duplicate = client.post(
        "/api/admin/faculty-assignments",
        json={
            "faculty_id": app.test_ids["faculty"],
            "subject_id": subject_id,
            "semester_id": subject_semester_id,
        },
        headers=csrf_headers(client),
    )
    assert duplicate.status_code == 409

    mismatch = client.post(
        "/api/admin/faculty-assignments",
        json={
            "faculty_id": app.test_ids["faculty"],
            "subject_id": subject_id,
            "semester_id": semester_id,
        },
        headers=csrf_headers(client),
    )
    assert mismatch.status_code == 400


def test_admin_can_allocate_student_and_duplicate_is_rejected(client, app):
    create_admin(app)
    admin_login(client)
    new_student_subject_id = create_subject(app, "ALLOC201")
    with app.app_context():
        semester_id = db.session.get(
            Subject, new_student_subject_id
        ).semester_id
        student = Student(
            registration_number="ALLOC-STUDENT",
            first_name="Allocation",
            last_name="Student",
            course="Test Course",
            admission_year=2026,
        )
        db.session.add(student)
        db.session.add(FacultySubject(
            faculty_id=app.test_ids["faculty"],
            subject_id=new_student_subject_id,
        ))
        db.session.commit()
        student_id = student.student_id

    payload = {
        "student_id": student_id,
        "subject_id": new_student_subject_id,
        "semester_id": semester_id,
    }
    response = client.post(
        "/api/admin/student-allocations",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    allocation = response.get_json()["allocation"]
    assert allocation["faculty"][0]["faculty_id"] == app.test_ids["faculty"]
    assert allocation["semester_id"] == semester_id

    duplicate = client.post(
        "/api/admin/student-allocations",
        json=payload,
        headers=csrf_headers(client),
    )
    assert duplicate.status_code == 409

    listed = client.get(
        f"/api/admin/student-allocations?semester_id={semester_id}"
    )
    assert listed.status_code == 200
    assert any(item["student_id"] == student_id for item in listed.get_json())


def test_students_without_attendance_or_marks_are_listed_and_allocatable(client, app):
    create_admin(app)
    admin_login(client)
    with app.app_context():
        semester_id = db.session.get(
            Subject, app.test_ids["subject"]
        ).semester_id
        student = Student(
            registration_number="NO-HISTORY-001",
            first_name="No",
            last_name="History",
            course="Test Course",
            admission_year=2026,
        )
        db.session.add(student)
        db.session.commit()
        student_id = student.student_id
        assert Attendance.query.filter_by(student_id=student_id).count() == 0
        assert Mark.query.filter_by(student_id=student_id).count() == 0

    students_response = client.get("/api/admin/students")
    assert students_response.status_code == 200
    student_row = next(
        row for row in students_response.get_json()
        if row["student_id"] == student_id
    )
    assert student_row["registration_number"] == "NO-HISTORY-001"

    allocation_response = client.post(
        "/api/admin/student-allocations",
        json={
            "student_id": student_id,
            "subject_id": app.test_ids["subject"],
            "semester_id": semester_id,
        },
        headers=csrf_headers(client),
    )

    assert allocation_response.status_code == 201
    assert allocation_response.get_json()["allocation"]["student_id"] == student_id
    with app.app_context():
        assert Attendance.query.filter_by(student_id=student_id).count() == 0
        assert Mark.query.filter_by(student_id=student_id).count() == 0


@pytest.mark.parametrize(
    ("field", "value", "status"),
    [
        ("student_id", 999999, 404),
        ("subject_id", 999999, 404),
        ("semester_id", 999999, 404),
        ("student_id", True, 400),
    ],
)
def test_student_allocation_rejects_invalid_details(
    client, app, field, value, status
):
    create_admin(app)
    admin_login(client)
    payload = {
        "student_id": app.test_ids["student_a"],
        "subject_id": app.test_ids["subject"],
        "semester_id": 1,
    }
    payload[field] = value
    response = client.post(
        "/api/admin/student-allocations",
        json=payload,
        headers=csrf_headers(client),
    )
    assert response.status_code == status


def test_student_allocation_requires_an_active_faculty_assignment(client, app):
    create_admin(app)
    admin_login(client)
    subject_id = create_subject(app, "ALLOC-NO-FACULTY")
    with app.app_context():
        semester_id = db.session.get(Subject, subject_id).semester_id

    response = client.post(
        "/api/admin/student-allocations",
        json={
            "student_id": app.test_ids["student_a"],
            "subject_id": subject_id,
            "semester_id": semester_id,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 409


def test_student_reassignment_preserves_historical_academic_records(
    client, app
):
    create_admin(app)
    admin_login(client)
    student_id = app.test_ids["student_a"]
    source_subject_id = app.test_ids["subject"]
    target_subject_id = create_subject(app, "ALLOC301")

    with app.app_context():
        target = db.session.get(Subject, target_subject_id)
        db.session.add(FacultySubject(
            faculty_id=app.test_ids["faculty"],
            subject_id=target_subject_id,
        ))
        db.session.add(Attendance(
            student_id=student_id,
            subject_id=source_subject_id,
            attendance_date=date(2026, 10, 23),
            status="Present",
            recorded_by=app.test_ids["faculty"],
        ))
        db.session.add(Mark(
            student_id=student_id,
            subject_id=source_subject_id,
            assessment_name="Historical assessment",
            marks_obtained=25,
            max_marks=30,
            entered_by=app.test_ids["faculty"],
        ))
        db.session.commit()
        target_semester_id = target.semester_id

    response = client.put(
        f"/api/admin/student-allocations/{student_id}/{source_subject_id}",
        json={
            "new_subject_id": target_subject_id,
            "semester_id": target_semester_id,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    with app.app_context():
        assert db.session.get(
            StudentSubject, (student_id, source_subject_id)
        ) is None
        assert db.session.get(
            StudentSubject, (student_id, target_subject_id)
        ) is not None
        attendance = Attendance.query.filter_by(
            student_id=student_id,
            subject_id=source_subject_id,
        ).one()
        mark = Mark.query.filter_by(
            student_id=student_id,
            subject_id=source_subject_id,
        ).one()
        assert attendance.status == "Present"
        assert mark.assessment_name == "Historical assessment"


def test_student_reassignment_rejects_existing_target_without_changes(
    client, app
):
    create_admin(app)
    admin_login(client)
    student_id = app.test_ids["student_a"]
    source_subject_id = app.test_ids["subject"]
    target_subject_id = create_subject(app, "ALLOC-DUPLICATE")
    with app.app_context():
        target_semester_id = db.session.get(
            Subject, target_subject_id
        ).semester_id
        db.session.add(FacultySubject(
            faculty_id=app.test_ids["faculty"],
            subject_id=target_subject_id,
        ))
        db.session.add(StudentSubject(
            student_id=student_id,
            subject_id=target_subject_id,
        ))
        db.session.commit()

    response = client.put(
        f"/api/admin/student-allocations/{student_id}/{source_subject_id}",
        json={
            "new_subject_id": target_subject_id,
            "semester_id": target_semester_id,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    with app.app_context():
        assert db.session.get(
            StudentSubject, (student_id, source_subject_id)
        ) is not None
        assert db.session.get(
            StudentSubject, (student_id, target_subject_id)
        ) is not None


def test_student_reassignment_database_failure_rolls_back(client, app, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError

    create_admin(app)
    admin_login(client)
    student_id = app.test_ids["student_a"]
    source_subject_id = app.test_ids["subject"]
    target_subject_id = create_subject(app, "ALLOC-ROLLBACK")
    with app.app_context():
        target_semester_id = db.session.get(
            Subject, target_subject_id
        ).semester_id
        db.session.add(FacultySubject(
            faculty_id=app.test_ids["faculty"],
            subject_id=target_subject_id,
        ))
        db.session.commit()

    def fail_commit():
        raise SQLAlchemyError("forced database failure")

    monkeypatch.setattr(db.session, "commit", fail_commit)
    response = client.put(
        f"/api/admin/student-allocations/{student_id}/{source_subject_id}",
        json={
            "new_subject_id": target_subject_id,
            "semester_id": target_semester_id,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 500
    with app.app_context():
        assert db.session.get(
            StudentSubject, (student_id, source_subject_id)
        ) is not None
        assert db.session.get(
            StudentSubject, (student_id, target_subject_id)
        ) is None


def test_faculty_reassignment_preserves_student_allocations_and_records(
    client, app
):
    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]
    student_id = app.test_ids["student_a"]
    new_faculty_id = create_faculty(app, "replacement.faculty@example.com")
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        db.session.add(Attendance(
            student_id=student_id,
            subject_id=subject_id,
            attendance_date=date(2026, 10, 24),
            status="Absent",
            recorded_by=app.test_ids["faculty"],
        ))
        db.session.add(Mark(
            student_id=student_id,
            subject_id=subject_id,
            assessment_name="Faculty reassignment assessment",
            marks_obtained=20,
            max_marks=25,
            entered_by=app.test_ids["faculty"],
        ))
        db.session.commit()
        semester_id = subject.semester_id

    response = client.put(
        f"/api/admin/faculty-assignments/{app.test_ids['faculty']}/{subject_id}",
        json={
            "faculty_id": new_faculty_id,
            "semester_id": semester_id,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    with app.app_context():
        assert db.session.get(
            FacultySubject, (app.test_ids["faculty"], subject_id)
        ) is None
        assert db.session.get(
            FacultySubject, (new_faculty_id, subject_id)
        ) is not None
        assert db.session.get(
            StudentSubject, (student_id, subject_id)
        ) is not None
        assert Attendance.query.filter_by(
            student_id=student_id, subject_id=subject_id
        ).count() == 1
        assert Mark.query.filter_by(
            student_id=student_id, subject_id=subject_id
        ).count() == 1


def test_removing_student_allocation_keeps_academic_records(client, app):
    create_admin(app)
    admin_login(client)
    student_id = app.test_ids["student_a"]
    subject_id = app.test_ids["subject"]

    with app.app_context():
        db.session.add(Mark(
            student_id=student_id,
            subject_id=subject_id,
            assessment_name="Retained assessment",
            marks_obtained=10,
            max_marks=15,
            entered_by=app.test_ids["faculty"],
        ))
        db.session.commit()

    response = client.delete(
        f"/api/admin/student-allocations/{student_id}/{subject_id}",
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    with app.app_context():
        assert db.session.get(
            StudentSubject, (student_id, subject_id)
        ) is None
        assert Mark.query.filter_by(
            student_id=student_id,
            subject_id=subject_id,
            assessment_name="Retained assessment",
        ).one() is not None
