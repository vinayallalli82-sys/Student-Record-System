import time
import requests

from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Flask

from backend.config import Config
from backend.services.availability_service import (
    record_health_check,
    is_operating_time,
)

IST = ZoneInfo("Asia/Kolkata")
HEALTH_URL = "http://127.0.0.1:5000/api/health"
CHECK_INTERVAL = 60


def run_monitor():
    app = Flask(__name__)
    app.config.from_object(Config)

    print("Availability monitoring started.")
    print("Checks run every 60 seconds during college hours.")
    print("Press CTRL+C to stop.")

    while True:
        now = datetime.now(IST)

        with app.app_context():
            if is_operating_time(now):
                try:
                    response = requests.get(
                        HEALTH_URL,
                        timeout=10
                    )
                    available = response.status_code == 200

                except requests.RequestException:
                    available = False

                record_health_check(available, now)

                print(
                    now.isoformat(),
                    "AVAILABLE" if available else "UNAVAILABLE"
                )

            else:
                print(
                    now.isoformat(),
                    "Outside college operating hours"
                )

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    run_monitor()