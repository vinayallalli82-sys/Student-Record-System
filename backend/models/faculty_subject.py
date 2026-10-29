"""Assignment of faculty users to subjects."""

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from backend.extensions import db


class FacultySubject(db.Model):
    __tablename__ = "faculty_subjects"

    faculty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True
    )
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subjects.subject_id", ondelete="CASCADE"), primary_key=True
    )
