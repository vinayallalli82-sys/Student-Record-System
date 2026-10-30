import pytest

from backend.extensions import db
from backend.models.mark import Mark
from backend.models.semester import Semester
from backend.models.subject import Subject

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


def add_mark(student_id, subject_id, obtained, maximum, name="ISA 1"):
    db.session.add(
        Mark(
            student_id=student_id,
            subject_id=subject_id,
            assessment_name=name,
            marks_obtained=obtained,
            max_marks=maximum,
        )
    )


def test_cgpa_requires_login(client, app):
    response = client.get(
        f"/api/students/{app.test_ids['student_a']}/cgpa"
    )
    assert response.status_code == 401


def test_student_can_view_own_cgpa(client, app):
    ids = app.test_ids

    with app.app_context():
        add_mark(ids["student_a"], ids["subject"], 90, 100)
        db.session.commit()

    login(client, "student.a@example.com")

    response = client.get(f"/api/students/{ids['student_a']}/cgpa")

    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["cgpa"] == 10.0
    assert data["total_credits"] == 3.0


def test_student_cannot_view_another_students_cgpa(client, app):
    ids = app.test_ids
    login(client, "student.a@example.com")

    response = client.get(f"/api/students/{ids['student_b']}/cgpa")

    assert response.status_code == 403


def test_faculty_can_view_student_cgpa(client, app):
    ids = app.test_ids

    with app.app_context():
        add_mark(ids["student_a"], ids["subject"], 85, 100)
        db.session.commit()

    faculty_login(client)

    response = client.get(f"/api/students/{ids['student_a']}/cgpa")

    assert response.status_code == 200
    assert response.get_json()["cgpa"] == 9.0


def test_cgpa_is_weighted_by_subject_credits(client, app):
    ids = app.test_ids

    with app.app_context():
        semester = Semester(
            semester_number=2,
            academic_year="2026-2027",
        )
        db.session.add(semester)
        db.session.flush()

        second_subject = Subject(
            subject_code="TEST202",
            subject_name="Second Test Subject",
            credits=4.0,
            semester_id=semester.semester_id,
        )
        db.session.add(second_subject)
        db.session.flush()

        add_mark(ids["student_a"], ids["subject"], 90, 100)
        add_mark(ids["student_a"], second_subject.subject_id, 80, 100)
        db.session.commit()

    faculty_login(client)

    response = client.get(f"/api/students/{ids['student_a']}/cgpa")

    assert response.status_code == 200
    data = response.get_json()

    # (10 * 3 + 9 * 4) / (3 + 4) = 9.43
    assert data["cgpa"] == 9.43
    assert data["total_credits"] == 7.0
    assert data["subjects_count"] == 2

def test_multiple_assessments_are_aggregated(client, app):
    ids = app.test_ids

    with app.app_context():
        add_mark(ids["student_a"], ids["subject"], 40, 50, "ISA 1")
        add_mark(ids["student_a"], ids["subject"], 45, 50, "ISA 2")
        db.session.commit()

    faculty_login(client)

    response = client.get(f"/api/students/{ids['student_a']}/cgpa")

    assert response.status_code == 200
    assert response.get_json()["cgpa"] == 9.0



def test_student_without_marks_gets_not_found(client, app):
    ids = app.test_ids
    login(client, "student.a@example.com")

    response = client.get(f"/api/students/{ids['student_a']}/cgpa")

    assert response.status_code == 404
    assert response.get_json()["status"] == "error"


def test_nonexistent_student_returns_404(client):
    faculty_login(client)

    response = client.get("/api/students/999999/cgpa")

    assert response.status_code == 404


def test_administrator_can_view_student_cgpa(client, app):
    from werkzeug.security import generate_password_hash
    from backend.models.user import User

    ids = app.test_ids

    with app.app_context():
        admin = User(
            email="admin@example.com",
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(admin)
        db.session.commit()

    login(client, "admin@example.com", "AdminTest123!")

    response = client.get(f"/api/students/{ids['student_a']}/cgpa")

    assert response.status_code == 404
