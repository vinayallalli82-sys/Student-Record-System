
from datetime import date

from sqlalchemy import Integer, String, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.extensions import db


class Student(db.Model):
    __tablename__ = "students"

    student_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.user_id", ondelete="SET NULL"),
        unique=True,
    )
    registration_number: Mapped[str] = mapped_column(
        String(30), nullable=False, unique=True
    )
    first_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    last_name: Mapped[str | None] = mapped_column(String(100))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    course: Mapped[str] = mapped_column(String(100), nullable=False)
    admission_year: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
