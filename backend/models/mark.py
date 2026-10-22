
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.extensions import db


class Mark(db.Model):
    __tablename__ = "marks"

    mark_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )

    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("students.student_id"),
        nullable=False,
    )

    subject_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("subjects.subject_id"),
        nullable=False,
    )

    assessment_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    marks_obtained: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )

    max_marks: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False
    )

    entered_by: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=True,
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        CheckConstraint(
            "marks_obtained >= 0",
            name="check_marks_obtained_nonnegative",
        ),
        CheckConstraint(
            "max_marks > 0",
            name="check_max_marks_positive",
        ),
        CheckConstraint(
            "marks_obtained <= max_marks",
            name="check_marks_not_above_max",
        ),
        UniqueConstraint(
            "student_id",
            "subject_id",
            "assessment_name",
            name="unique_student_subject_assessment",
        ),
    )
