
from datetime import date

from sqlalchemy import Integer, String, Date, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.extensions import db


class Semester(db.Model):
    __tablename__ = "semesters"

    semester_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    semester_number: Mapped[int] = mapped_column(
        Integer, nullable=False, unique=True
    )
    academic_year: Mapped[str] = mapped_column(
        String(9), nullable=False
    )
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)

    __table_args__ = (
        CheckConstraint(
            "semester_number BETWEEN 1 AND 12",
            name="check_semester_number",
        ),
    )
