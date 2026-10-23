
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.extensions import db


class StudentSubject(db.Model):
    __tablename__ = "student_subjects"

    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("students.student_id"),
        primary_key=True,
    )
    subject_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("subjects.subject_id"),
        primary_key=True,
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
