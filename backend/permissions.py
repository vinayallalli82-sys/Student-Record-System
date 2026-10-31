"""Reusable server-side role and assignment checks for ADMIN-002."""

from flask import jsonify
from flask_login import current_user

from backend.extensions import db
from backend.models.faculty_subject import FacultySubject
from backend.models.student_subject import StudentSubject


def can_manage_subject(subject_id):
    if current_user.role == "Administrator":
        return True
    if current_user.role != "Faculty":
        return False
    return db.session.query(FacultySubject.faculty_id).filter_by(
        faculty_id=current_user.user_id, subject_id=subject_id
    ).first() is not None


def subject_permission_error(subject_id):
    if not can_manage_subject(subject_id):
        return jsonify({"error": "You are not authorized to access this subject."}), 403
    return None


def can_access_student_for_any_assigned_subject(student_id):
    if current_user.role == "Administrator":
        return True
    if current_user.role != "Faculty":
        return False
    return (
        db.session.query(StudentSubject.student_id)
        .join(FacultySubject, FacultySubject.subject_id == StudentSubject.subject_id)
        .filter(
            StudentSubject.student_id == student_id,
            FacultySubject.faculty_id == current_user.user_id,
        )
        .first() is not None
    )
