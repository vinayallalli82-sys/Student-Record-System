import os
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from unittest.mock import patch

import pytest
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.user import User
from backend.models.semester import Semester
from backend.models.subject import Subject
from backend.services.availability_service import (
    is_operating_time,
    record_health_check,
    calculate_availability,
)
from backend.routes.subjects import validate_subject_data
from tests.test_attendance import app, client, login, csrf_headers

IST = ZoneInfo("Asia/Kolkata")


def test_validate_subject_data_edge_cases():
    data, err = validate_subject_data("not a dict")
    assert err == "Request body must be a JSON object."

    data, err = validate_subject_data({"subject_code": "CS101"})
    assert "is required" in err

    data, err = validate_subject_data({"subject_code": " ", "subject_name": "CS", "credits": 4, "semester_id": 1})
    assert "subject_code must be a non-empty string" in err

    data, err = validate_subject_data({"subject_code": "X" * 25, "subject_name": "CS", "credits": 4, "semester_id": 1})
    assert "subject_code must be at most 20 characters" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": " ", "credits": 4, "semester_id": 1})
    assert "subject_name must be a non-empty string" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "X" * 155, "credits": 4, "semester_id": 1})
    assert "subject_name must be at most 150 characters" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": True, "semester_id": 1})
    assert "credits must be a positive number" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": "abc", "semester_id": 1})
    assert "credits must be a valid number" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": -1, "semester_id": 1})
    assert "credits must be greater than 0 and at most 999.9" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": 1000, "semester_id": 1})
    assert "credits must be greater than 0 and at most 999.9" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": "3.45", "semester_id": 1})
    assert "credits can have at most one decimal place" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": 4, "semester_id": True})
    assert "semester_id must be a positive integer" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": 4, "semester_id": -5})
    assert "semester_id must be a positive integer" in err

    data, err = validate_subject_data({"subject_code": "CS101", "subject_name": "CS", "credits": 4, "semester_id": "abc"})
    assert "semester_id must be a positive integer" in err


def test_availability_service_operating_time(app):
    with app.app_context():
        dt_monday_open = datetime(2026, 11, 9, 10, 0, tzinfo=IST)
        assert is_operating_time(dt_monday_open) is True

        dt_monday_early = datetime(2026, 11, 9, 7, 0, tzinfo=IST)
        assert is_operating_time(dt_monday_early) is False

        dt_monday_late = datetime(2026, 11, 9, 16, 0, tzinfo=IST)
        assert is_operating_time(dt_monday_late) is False

        dt_sunday = datetime(2026, 11, 8, 12, 0, tzinfo=IST)
        assert is_operating_time(dt_sunday) is False


def test_availability_service_record_and_calculate(app, tmp_path):
    temp_log = str(tmp_path / "test_avail.csv")
    with patch("backend.services.availability_service.get_log_path", return_value=temp_log):
        with app.app_context():
            res = calculate_availability()
            assert res["total_checks"] == 0
            assert res["target_met"] is False

            dt_sunday = datetime(2026, 11, 8, 12, 0, tzinfo=IST)
            assert record_health_check(True, dt_sunday) is False

            dt_monday = datetime(2026, 11, 9, 10, 0, tzinfo=IST)
            assert record_health_check(True, dt_monday) is True
            assert record_health_check(False, dt_monday) is True

            stats = calculate_availability()
            assert stats["total_checks"] == 2
            assert stats["successful_checks"] == 1
            assert stats["availability_percentage"] == 50.0
            assert stats["target_met"] is False


def test_subjects_api_permissions_and_crud(app, client):
    res = client.get("/api/subjects")
    assert res.status_code == 200

    login(client, "student.a@example.com")
    headers = csrf_headers(client)
    res = client.post("/api/subjects", json={
        "subject_code": "CS999",
        "subject_name": "Distributed Systems",
        "credits": 4.0,
        "semester_id": 1,
    }, headers=headers)
    assert res.status_code == 403

    with app.app_context():
        admin = User(
            email="admin_subj@example.com",
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(admin)
        db.session.commit()

    login(client, "admin_subj@example.com", "AdminTest123!")
    headers = csrf_headers(client)

    res = client.post("/api/subjects", json={
        "subject_code": "CS999",
        "subject_name": "Distributed Systems",
        "credits": 4.0,
        "semester_id": 1,
    }, headers=headers)
    assert res.status_code == 201
    subj_id = res.get_json()["subject_id"]

    res = client.post("/api/subjects", json={
        "subject_code": "CS999",
        "subject_name": "Duplicate Subject",
        "credits": 3.0,
        "semester_id": 1,
    }, headers=headers)
    assert res.status_code == 409

    res = client.get(f"/api/subjects/{subj_id}")
    assert res.status_code == 200
    assert res.get_json()["subject_code"] == "CS999"

    res = client.put(f"/api/subjects/{subj_id}", json={
        "subject_name": "Advanced Distributed Systems",
    }, headers=headers)
    assert res.status_code == 200
    assert res.get_json()["subject_name"] == "Advanced Distributed Systems"

    res = client.get("/api/subjects/999999")
    assert res.status_code == 404
