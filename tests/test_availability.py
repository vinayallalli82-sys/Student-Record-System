from datetime import datetime

from backend.app import create_app
from backend.config import Config


def test_college_operating_hours_are_configured():
    expected_hours = {
        "monday": ("08:00", "15:15"),
        "tuesday": ("08:00", "12:20"),
        "wednesday": ("08:00", "12:20"),
        "thursday": ("08:00", "15:15"),
        "friday": ("08:00", "12:20"),
    }

    assert Config.COLLEGE_OPERATING_HOURS == expected_hours


def test_weekend_is_not_in_operating_schedule():
    hours = Config.COLLEGE_OPERATING_HOURS

    assert "saturday" not in hours
    assert "sunday" not in hours


def test_availability_endpoint_returns_healthy_status():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.get_json()["status"] == "healthy"
    assert response.get_json()["database"] == "connected"


def test_operating_hours_use_valid_24_hour_times():
    for start, end in Config.COLLEGE_OPERATING_HOURS.values():
        start_time = datetime.strptime(start, "%H:%M")
        end_time = datetime.strptime(end, "%H:%M")

        assert start_time < end_time