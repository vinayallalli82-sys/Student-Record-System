import pytest

@pytest.fixture
def app(attendance_app_fixture):
    return attendance_app_fixture


@pytest.fixture
def client(attendance_client_fixture):
    return attendance_client_fixture

from test_attendance import (
    app as attendance_app_fixture,
    client as attendance_client_fixture,
    faculty_login,
    login,
)
from backend.extensions import db
from backend.models.mark import Mark


def test_faculty_can_view_student_profile(client, app):
    faculty_login(client)

    student_id = app.test_ids["student_a"]
    response = client.get(f"/api/students/{student_id}")

    assert response.status_code == 200
    data = response.get_json()
    assert data["student_id"] == student_id
    assert data["registration_number"] == "TEST-A"
    assert data["first_name"] == "Student"
    assert data["last_name"] == "A"
    assert data["course"] == "Test Course"


def test_unknown_student_profile_returns_404(client):
    faculty_login(client)

    response = client.get("/api/students/999999")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Student not found."


def test_student_cannot_view_student_profile(client, app):
    login(client, "student.a@example.com")

    student_id = app.test_ids["student_a"]
    response = client.get(f"/api/students/{student_id}")

    assert response.status_code == 403


def test_view_student_profile_requires_login(client, app):
    student_id = app.test_ids["student_a"]

    response = client.get(f"/api/students/{student_id}")

    assert response.status_code == 401


def test_student_can_view_only_own_profile_and_allocations(client, app):
    login(client, "student.a@example.com")

    response = client.get("/api/students/me")

    assert response.status_code == 200
    data = response.get_json()
    assert data["student_id"] == app.test_ids["student_a"]
    assert data["registration_number"] == "TEST-A"
    assert data["email"] == "student.a@example.com"
    assert len(data["subjects"]) == 1
    subject = data["subjects"][0]
    assert subject["subject_id"] == app.test_ids["subject"]
    assert subject["subject_code"] == "TEST101"
    assert subject["subject_name"] == "Test Subject"
    assert subject["credits"] == 3.0
    assert subject["semester_number"] == 1
    assert subject["academic_year"] == "2026-2027"
    assert "TEST-B" not in str(data)


def test_student_self_profile_requires_login(client):
    response = client.get("/api/students/me")

    assert response.status_code == 401


def test_non_student_cannot_use_student_self_profile(client):
    faculty_login(client)

    response = client.get("/api/students/me")

    assert response.status_code == 403


def test_student_academic_records_use_own_marks_and_report_gpa(client, app):
    with app.app_context():
        db.session.add(Mark(
            student_id=app.test_ids["student_a"],
            subject_id=app.test_ids["subject"],
            assessment_name="ISA 1",
            marks_obtained=80,
            max_marks=100,
        ))
        db.session.add(Mark(
            student_id=app.test_ids["student_b"],
            subject_id=app.test_ids["subject"],
            assessment_name="ISA 1",
            marks_obtained=40,
            max_marks=100,
        ))
        db.session.commit()

    login(client, "student.a@example.com")
    response = client.get("/api/academic-records/my?semester=1")

    assert response.status_code == 200
    data = response.get_json()
    assert data["registration_number"] == "TEST-A"
    assert data["gpa"]["gpa"] == 9.0
    assert data["subjects_without_marks"] == []
    assert len(data["subjects"]) == 1
    assert data["subjects"][0]["total_marks_obtained"] == 80.0
    assert data["subjects"][0]["percentage"] == 80.0
    assert data["subjects"][0]["assessments"][0]["assessment_name"] == "ISA 1"


def test_student_academic_records_preserve_historical_assessment_name(client, app):
    with app.app_context():
        db.session.add(Mark(
            student_id=app.test_ids["student_a"],
            subject_id=app.test_ids["subject"],
            assessment_name="Midterm Exam",
            marks_obtained=70,
            max_marks=100,
        ))
        db.session.commit()

    login(client, "student.a@example.com")
    response = client.get("/api/academic-records/my?semester=1")

    assert response.status_code == 200
    data = response.get_json()
    assert data["subjects"][0]["assessments"][0]["assessment_name"] == "Midterm Exam"
    assert data["gpa"]["gpa"] == 8.0


def test_student_academic_records_keep_allocated_subjects_without_marks(client):
    login(client, "student.a@example.com")

    response = client.get("/api/academic-records/my?semester=1")

    assert response.status_code == 200
    data = response.get_json()
    assert data["gpa"] is None
    assert data["subjects_without_marks"] == ["TEST101"]
    assert len(data["subjects"]) == 1
    assert data["subjects"][0]["assessments"] == []
