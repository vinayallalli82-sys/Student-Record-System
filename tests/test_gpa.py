import pytest
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.mark import Mark
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.user import User

from test_attendance import (
    app as attendance_app_fixture,
    client as attendance_client_fixture,
    faculty_login,
    login,
)


@pytest.fixture
def app(attendance_app_fixture):
    return attendance_app_fixture


@pytest.fixture
def client(attendance_client_fixture):
    return attendance_client_fixture


def add_mark(student_id, subject_id, obtained, maximum):
    db.session.add(
        Mark(
            student_id=student_id,
            subject_id=subject_id,
            assessment_name="ISA 1",
            marks_obtained=obtained,
            max_marks=maximum,
        )
    )


def test_semester_gpa_requires_login(client, app):
    student_id = app.test_ids["student_a"]
    response = client.get(
        f"/api/students/{student_id}/semesters/1/gpa"
    )
    assert response.status_code == 401


def test_student_can_view_own_semester_gpa(client, app):
    ids = app.test_ids
    with app.app_context():
        add_mark(ids["student_a"], ids["subject"], 90, 100)
        db.session.commit()

    login(client, "student.a@example.com")
    response = client.get(
        f"/api/students/{ids['student_a']}/semesters/1/gpa"
    )

    assert response.status_code == 200
    assert response.get_json()["gpa"] == 10.0
    assert response.get_json()["student_id"] == ids["student_a"]


def test_student_cannot_view_another_students_semester_gpa(client, app):
    ids = app.test_ids
    with app.app_context():
        add_mark(ids["student_b"], ids["subject"], 90, 100)
        db.session.commit()
        marks_before = Mark.query.count()

    login(client, "student.a@example.com")
    response = client.get(
        f"/api/students/{ids['student_b']}/semesters/1/gpa"
    )

    assert response.status_code == 403
    with app.app_context():
        assert Mark.query.count() == marks_before


def test_faculty_gpa_is_limited_to_assigned_subjects(client, app):
    ids = app.test_ids
    with app.app_context():
        second_subject = Subject(
            subject_code="TEST102",
            subject_name="Unassigned Test Subject",
            credits=4.0,
            semester_id=1,
        )
        db.session.add(second_subject)
        db.session.flush()
        db.session.add(StudentSubject(
            student_id=ids["student_a"],
            subject_id=second_subject.subject_id,
        ))
        add_mark(ids["student_a"], ids["subject"], 85, 100)
        add_mark(ids["student_a"], second_subject.subject_id, 0, 100)
        db.session.commit()

    faculty_login(client)
    response = client.get(
        f"/api/students/{ids['student_a']}/semesters/1/gpa"
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["gpa"] == 9.0
    assert [subject["code"] for subject in data["subjects"]] == ["TEST101"]


def test_faculty_cannot_view_student_with_no_assigned_subject(client, app):
    with app.app_context():
        user = User(
            email="unassigned.student@example.com",
            password_hash=generate_password_hash("StudentTest123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(user)
        db.session.flush()
        student = Student(
            user_id=user.user_id,
            registration_number="TEST-UNASSIGNED",
            first_name="Unassigned",
            course="Test Course",
            admission_year=2026,
        )
        db.session.add(student)
        db.session.flush()
        subject = Subject(
            subject_code="TEST103",
            subject_name="Unassigned Student Subject",
            credits=3.0,
            semester_id=1,
        )
        db.session.add(subject)
        db.session.flush()
        db.session.add(StudentSubject(
            student_id=student.student_id,
            subject_id=subject.subject_id,
        ))
        add_mark(student.student_id, subject.subject_id, 90, 100)
        db.session.commit()
        student_id = student.student_id
        marks_before = Mark.query.count()

    faculty_login(client)
    response = client.get(
        f"/api/students/{student_id}/semesters/1/gpa"
    )

    assert response.status_code == 403
    with app.app_context():
        assert Mark.query.count() == marks_before


def test_administrator_can_view_semester_gpa(client, app):
    ids = app.test_ids
    with app.app_context():
        admin = User(
            email="admin.gpa@example.com",
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(admin)
        add_mark(ids["student_a"], ids["subject"], 90, 100)
        db.session.commit()

    login(client, "admin.gpa@example.com", "AdminTest123!")
    response = client.get(
        f"/api/students/{ids['student_a']}/semesters/1/gpa"
    )

    assert response.status_code == 200
    assert response.get_json()["gpa"] == 10.0
