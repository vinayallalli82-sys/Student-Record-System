
from decimal import Decimal

from sqlalchemy import Integer, String, Numeric, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.extensions import db


class Subject(db.Model):
    __tablename__ = "subjects"

    subject_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    subject_code: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True
    )
    subject_name: Mapped[str] = mapped_column(
        String(150), nullable=False
    )
    credits: Mapped[Decimal] = mapped_column(
        Numeric(4, 1), nullable=False
    )
    semester_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("semesters.semester_id"), nullable=False
    )

    __table_args__ = (
        CheckConstraint("credits > 0", name="check_subject_credits"),
    )
