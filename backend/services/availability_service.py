import csv
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import current_app


IST = ZoneInfo("Asia/Kolkata")
TARGET_AVAILABILITY = 99.0


def get_log_path():
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "availability_log.csv"
    )

def is_operating_time(check_time=None):
    check_time = check_time or datetime.now(IST)

    day = check_time.strftime("%A").lower()
    hours = current_app.config["COLLEGE_OPERATING_HOURS"]

    if day not in hours:
        return False

    start, end = hours[day]
    current = check_time.strftime("%H:%M")

    return start <= current < end


def record_health_check(is_available, check_time=None):
    check_time = check_time or datetime.now(IST)

    if not is_operating_time(check_time):
        return False

    log_path = get_log_path()
    file_exists = os.path.exists(log_path)

    with open(log_path, "a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        if not file_exists:
            writer.writerow(["timestamp", "available"])

        writer.writerow([
            check_time.isoformat(),
            int(bool(is_available))
        ])

    return True


def calculate_availability():
    log_path = get_log_path()

    if not os.path.exists(log_path):
        return {
            "total_checks": 0,
            "successful_checks": 0,
            "availability_percentage": 0.0,
            "target_percentage": TARGET_AVAILABILITY,
            "target_met": False,
        }

    total_checks = 0
    successful_checks = 0

    with open(log_path, "r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        for row in reader:
            total_checks += 1
            successful_checks += int(row["available"])

    percentage = (
        successful_checks / total_checks * 100
        if total_checks else 0.0
    )

    return {
        "total_checks": total_checks,
        "successful_checks": successful_checks,
        "availability_percentage": round(percentage, 2),
        "target_percentage": TARGET_AVAILABILITY,
        "target_met": (
            total_checks > 0 and percentage >= TARGET_AVAILABILITY
        ),
    }