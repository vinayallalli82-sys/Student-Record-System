
import pytest

import pytest

from backend.extensions import db
from backend.models.mark import Mark

from test_attendance import (
    app as attendance_app_fixture,
    client as attendance_client_fixture,
    faculty_login,
    login,
    csrf_headers,
)


@pytest.fixture
def app(attendance_app_fixture):
    return attendance_app_fixture


@pytest.fixture
def client(attendance_client_fixture):
    return attendance_client_fixture


def marks_payload(ids, obtained=35, maximum=50):
    return {
        "student_id": ids["student_a"],
        "subject_id": ids["subject"],
        "assessment_name": "ISA 1",
        "marks_obtained": obtained,
        "max_marks": maximum,
    }


def test_create_marks_requires_login(client, app):
    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )
    assert response.status_code == 401


def test_student_cannot_create_marks(client, app):
    login(client, "student.a@example.com")

    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_student_cannot_update_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201
    mark_id = create_response.get_json()["mark_id"]

    client.post("/api/auth/logout", headers=csrf_headers(client))
    login(client, "student.a@example.com")

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=40),
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_faculty_can_create_marks(client, app):
    faculty_login(client)

    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["marks_obtained"] == 35.0
    assert data["max_marks"] == 50.0
    assert data["entered_by"] == app.test_ids["faculty"]


@pytest.mark.parametrize("assessment_name", ["ISA 1", "ISA 2", "ESA"])
def test_faculty_can_create_each_canonical_assessment(
    client, app, assessment_name
):
    faculty_login(client)
    payload = marks_payload(app.test_ids)
    payload["assessment_name"] = assessment_name

    response = client.post(
        "/api/marks/",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.get_json()["assessment_name"] == assessment_name


@pytest.mark.parametrize("assessment_name", ["Internal Test", "ISA 3", ""])
def test_create_marks_rejects_noncanonical_assessment(
    client, app, assessment_name
):
    faculty_login(client)
    payload = marks_payload(app.test_ids)
    payload["assessment_name"] = assessment_name

    response = client.post(
        "/api/marks/",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    expected_error = (
        "Assessment name cannot be empty."
        if not assessment_name
        else "Assessment name must be ISA 1, ISA 2, or ESA."
    )
    assert response.get_json()["error"] == expected_error


def test_faculty_can_update_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201

    mark_id = create_response.get_json()["mark_id"]

    payload = marks_payload(ids, obtained=40)
    payload["assessment_name"] = "ESA"
    response = client.put(
        f"/api/marks/{mark_id}",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["mark_id"] == mark_id
    assert response.get_json()["assessment_name"] == "ESA"
    assert response.get_json()["marks_obtained"] == 40.0
    listed = client.get(f"/api/marks/?subject_id={ids['subject']}").get_json()
    assert sum(mark["assessment_name"] == "ESA" for mark in listed) == 1


def test_marks_above_maximum_are_rejected(client, app):
    faculty_login(client)

    response = client.post(
        "/api/marks/",
        json=marks_payload(app.test_ids, obtained=51, maximum=50),
        headers=csrf_headers(client),
    )

    assert response.status_code == 400


def test_invalid_update_preserves_existing_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=30),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201
    mark_id = create_response.get_json()["mark_id"]

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=60, maximum=50),
        headers=csrf_headers(client),
    )
    assert response.status_code == 400

    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert float(saved_mark.marks_obtained) == 30.0


def test_update_rejects_noncanonical_assessment_without_changing_record(
    client, app
):
    faculty_login(client)
    ids = app.test_ids
    created = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=30),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    mark_id = created.get_json()["mark_id"]
    payload = marks_payload(ids, obtained=40)
    payload["assessment_name"] = "Historical assessment"

    response = client.put(
        f"/api/marks/{mark_id}",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert saved_mark.assessment_name == "ISA 1"
        assert float(saved_mark.marks_obtained) == 30.0


@pytest.mark.parametrize("assessment_name", ["Midterm Exam", "Quiz 1"])
def test_historical_assessment_records_cannot_be_modified(
    client, app, assessment_name
):
    faculty_login(client)
    ids = app.test_ids
    with app.app_context():
        historical_mark = Mark(
            student_id=ids["student_a"],
            subject_id=ids["subject"],
            assessment_name=assessment_name,
            marks_obtained=35,
            max_marks=50,
            entered_by=ids["faculty"],
        )
        db.session.add(historical_mark)
        db.session.commit()
        mark_id = historical_mark.mark_id

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=40),
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    assert response.get_json()["error"] == (
        "Historical assessment records cannot be modified."
    )
    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert saved_mark.assessment_name == assessment_name
        assert float(saved_mark.marks_obtained) == 35.0
        assert float(saved_mark.max_marks) == 50.0


@pytest.mark.parametrize(
    ("obtained", "maximum"),
    [(51, 50), (-1, 50), (10, 0), (10000, 10001)],
)
def test_invalid_marks_update_preserves_existing_record(
    client, app, obtained, maximum
):
    faculty_login(client)
    ids = app.test_ids
    created = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=30, maximum=50),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    mark_id = created.get_json()["mark_id"]

    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=obtained, maximum=maximum),
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert float(saved_mark.marks_obtained) == 30.0
        assert float(saved_mark.max_marks) == 50.0


@pytest.mark.parametrize("field", ["student_id", "subject_id"])
def test_marks_update_rejects_nonexistent_reference_without_changes(
    client, app, field
):
    faculty_login(client)
    ids = app.test_ids
    created = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=30),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    mark_id = created.get_json()["mark_id"]

    invalid_payload = marks_payload(ids, obtained=40)
    invalid_payload[field] = 999999
    response = client.put(
        f"/api/marks/{mark_id}",
        json=invalid_payload,
        headers=csrf_headers(client),
    )

    assert response.status_code in (403, 404)
    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert saved_mark.student_id == ids["student_a"]
        assert saved_mark.subject_id == ids["subject"]
        assert float(saved_mark.marks_obtained) == 30.0


def test_duplicate_mark_update_preserves_both_existing_records(client, app):
    faculty_login(client)
    ids = app.test_ids

    first_payload = marks_payload(ids, obtained=25)
    first_payload["assessment_name"] = "ISA 1"
    first = client.post(
        "/api/marks/",
        json=first_payload,
        headers=csrf_headers(client),
    )
    assert first.status_code == 201

    second_payload = marks_payload(ids, obtained=30)
    second_payload["assessment_name"] = "ISA 2"
    second = client.post(
        "/api/marks/",
        json=second_payload,
        headers=csrf_headers(client),
    )
    assert second.status_code == 201

    conflicting_payload = marks_payload(ids, obtained=40)
    conflicting_payload["assessment_name"] = "ISA 1"
    response = client.put(
        f"/api/marks/{second.get_json()['mark_id']}",
        json=conflicting_payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    with app.app_context():
        first_mark = db.session.get(Mark, first.get_json()["mark_id"])
        second_mark = db.session.get(Mark, second.get_json()["mark_id"])
        assert first_mark.assessment_name == "ISA 1"
        assert float(first_mark.marks_obtained) == 25.0
        assert second_mark.assessment_name == "ISA 2"
        assert float(second_mark.marks_obtained) == 30.0


def test_marks_update_database_failure_rolls_back(client, app, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError

    faculty_login(client)
    ids = app.test_ids
    created = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=30),
        headers=csrf_headers(client),
    )
    assert created.status_code == 201
    mark_id = created.get_json()["mark_id"]

    def fail_commit():
        raise SQLAlchemyError("forced database failure")

    monkeypatch.setattr(db.session, "commit", fail_commit)
    response = client.put(
        f"/api/marks/{mark_id}",
        json=marks_payload(ids, obtained=40),
        headers=csrf_headers(client),
    )

    assert response.status_code == 500
    with app.app_context():
        saved_mark = db.session.get(Mark, mark_id)
        assert float(saved_mark.marks_obtained) == 30.0


def test_updating_nonexistent_mark_returns_404(client, app):
    faculty_login(client)

    response = client.put(
        "/api/marks/999999",
        json=marks_payload(app.test_ids),
        headers=csrf_headers(client),
    )
    assert response.status_code == 404
def test_faculty_can_list_saved_marks(client, app):
    faculty_login(client)
    ids = app.test_ids

    create_response = client.post(
        "/api/marks/",
        json=marks_payload(ids, obtained=35, maximum=50),
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201

    response = client.get("/api/marks/")

    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(
        mark["student_id"] == ids["student_a"]
        and mark["subject_id"] == ids["subject"]
        and mark["assessment_name"] == "ISA 1"
        for mark in data
    )


def test_historical_assessment_records_remain_visible(client, app):
    faculty_login(client)
    ids = app.test_ids
    with app.app_context():
        db.session.add(Mark(
            student_id=ids["student_a"],
            subject_id=ids["subject"],
            assessment_name="Historical assessment",
            marks_obtained=30,
            max_marks=50,
        ))
        db.session.commit()

    marks_response = client.get(
        f"/api/marks/?subject_id={ids['subject']}"
    )
    summary_response = client.get(
        f"/api/marks/summary?subject_id={ids['subject']}"
    )

    assert marks_response.status_code == 200
    assert any(
        mark["assessment_name"] == "Historical assessment"
        for mark in marks_response.get_json()
    )
    assert summary_response.status_code == 200
    student = next(
        student for student in summary_response.get_json()["students"]
        if student["student_id"] == ids["student_a"]
    )
    assert any(
        assessment["assessment_name"] == "Historical assessment"
        for assessment in student["assessments"]
    )