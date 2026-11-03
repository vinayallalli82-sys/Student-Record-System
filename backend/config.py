
import os

from dotenv import load_dotenv
from sqlalchemy.engine import URL


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")

    if not SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is missing. Set it in your local .env file."
        )

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = (
        os.getenv("COOKIE_SECURE", "false").lower() == "true"
    )
    PERMANENT_SESSION_LIFETIME = 1800

    SQLALCHEMY_DATABASE_URI = URL.create(
        drivername="mysql+pymysql",
        username=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "student_record_system"),
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    COLLEGE_OPERATING_HOURS = {
        "monday": ("08:00", "15:15"),
        "tuesday": ("08:00", "12:20"),
        "wednesday": ("08:00", "12:20"),
        "thursday": ("08:00", "15:15"),
        "friday": ("08:00", "12:20"),
    }

