"""Administrator account, faculty assignment, and student allocation APIs."""

from datetime import date
from functools import wraps
import re

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.faculty_subject import FacultySubject
from backend.models.semester import Semester
from backend.models.student import Student
from backend.models.student_subject import StudentSubject
from backend.models.subject import Subject
from backend.models.user import User

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")
VALID_ROLES = {"Student", "Faculty", "Administrator"}


def administrator_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "Administrator":
            return jsonify({"error": "Administrator access required."}), 403
        return view(*args, **kwargs)
    return wrapped


def user_to_dict(user):
    return {"user_id": user.user_id, "email": user.email, "role": user.role, "is_active": user.is_active}


def validate_student_profile(data, require_date_of_birth=False):
    profile = data.get("student_profile")
    if not isinstance(profile, dict):
        return None, "student_profile with registration_number, first_name, course, and admission_year is required."

    registration_number = profile.get("registration_number")
    first_name = profile.get("first_name")
    last_name = profile.get("last_name", "")
    course = profile.get("course")
    admission_year = profile.get("admission_year")
    raw_date_of_birth = profile.get("date_of_birth")

    if not isinstance(registration_number, str) or not registration_number.strip():
        return None, "A registration number is required."
    if not isinstance(first_name, str) or not first_name.strip():
        return None, "A first name is required."
    if not isinstance(last_name, str):
        return None, "Last name must be a string."
    if require_date_of_birth and not last_name.strip():
        return None, "A last name is required for Student accounts."
    if require_date_of_birth and not isinstance(raw_date_of_birth, str):
        return None, "A date of birth is required for Student accounts."
    if raw_date_of_birth in (None, ""):
        date_of_birth = None
    elif not isinstance(raw_date_of_birth, str):
        return None, "Date of birth must use YYYY-MM-DD format."
    else:
        try:
            date_of_birth = date.fromisoformat(raw_date_of_birth)
        except ValueError:
            return None, "Date of birth must be a valid date in YYYY-MM-DD format."
        if date_of_birth.isoformat() != raw_date_of_birth:
            return None, "Date of birth must use YYYY-MM-DD format."
        if date_of_birth > date.today():
            return None, "Date of birth cannot be in the future."
    if not isinstance(course, str) or not course.strip():
        return None, "A course or department is required."
    if (
        isinstance(admission_year, bool)
        or not isinstance(admission_year, int)
        or admission_year <= 0
    ):
        return None, "A positive admission year is required."

    registration_number = registration_number.strip()
    if len(registration_number) > 30:
        return None, "Registration number must be 30 characters or fewer."
    if len(first_name.strip()) > 100 or len(last_name.strip()) > 100:
        return None, "Student names must be 100 characters or fewer."
    if len(course.strip()) > 100:
        return None, "Course or department must be 100 characters or fewer."
    if Student.query.filter(
        func.lower(Student.registration_number) == registration_number.lower()
    ).first():
        return None, "Registration number already exists."

    return {
        "registration_number": registration_number,
        "first_name": first_name.strip(),
        "last_name": last_name.strip() or None,
        "date_of_birth": date_of_birth,
        "course": course.strip(),
        "admission_year": admission_year,
    }, None


def positive_integer(data, field):
    value = data.get(field)
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value


def validate_assignment_context(data):
    faculty_id = positive_integer(data, "faculty_id")
    subject_id = positive_integer(data, "subject_id")
    semester_id = positive_integer(data, "semester_id")
    if None in (faculty_id, subject_id, semester_id):
        return None, "faculty_id, subject_id, and semester_id must be positive integers.", 400

    faculty = db.session.get(User, faculty_id)
    if faculty is None:
        return None, "Faculty account not found.", 404
    if faculty.role != "Faculty" or not faculty.is_active:
        return None, "faculty_id must identify an active Faculty account.", 400

    subject = db.session.get(Subject, subject_id)
    if subject is None:
        return None, "Subject not found.", 404

    semester = db.session.get(Semester, semester_id)
    if semester is None:
        return None, "Semester not found.", 404
    if subject.semester_id != semester_id:
        return None, "The subject does not belong to the specified semester.", 400

    return {
        "faculty_id": faculty_id,
        "subject_id": subject_id,
        "semester_id": semester_id,
        "faculty": faculty,
        "subject": subject,
        "semester": semester,
    }, None, None


def validate_student_allocation_context(data):
    student_id = positive_integer(data, "student_id")
    subject_id = positive_integer(data, "subject_id")
    semester_id = positive_integer(data, "semester_id")
    if None in (student_id, subject_id, semester_id):
        return None, "student_id, subject_id, and semester_id must be positive integers.", 400

    student = db.session.get(Student, student_id)
    if student is None:
        return None, "Student not found.", 404

    subject = db.session.get(Subject, subject_id)
    if subject is None:
        return None, "Subject not found.", 404

    semester = db.session.get(Semester, semester_id)
    if semester is None:
        return None, "Semester not found.", 404
    if subject.semester_id != semester_id:
        return None, "The subject does not belong to the specified semester.", 400

    faculty_rows = (
        db.session.query(FacultySubject, User)
        .join(User, User.user_id == FacultySubject.faculty_id)
        .filter(
            FacultySubject.subject_id == subject_id,
            User.role == "Faculty",
            User.is_active.is_(True),
        )
        .order_by(User.email)
        .all()
    )
    if not faculty_rows:
        return None, "Assign an active Faculty account to this subject before allocating students.", 409

    return {
        "student_id": student_id,
        "subject_id": subject_id,
        "semester_id": semester_id,
        "student": student,
        "subject": subject,
        "semester": semester,
        "faculty": [user for _, user in faculty_rows],
    }, None, None


def student_allocation_to_dict(student, subject, semester, faculty):
    return {
        "student_id": student.student_id,
        "registration_number": student.registration_number,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "subject_id": subject.subject_id,
        "subject_code": subject.subject_code,
        "subject_name": subject.subject_name,
        "semester_id": semester.semester_id,
        "semester_number": semester.semester_number,
        "academic_year": semester.academic_year,
        "faculty": [
            {"faculty_id": user.user_id, "faculty_email": user.email}
            for user in faculty
        ],
    }


@admin_bp.get("/users")
@administrator_required
def list_users():
    return jsonify([user_to_dict(u) for u in User.query.order_by(User.user_id).all()]), 200


@admin_bp.get("/students")
@administrator_required
def list_students():
    students = (
        db.session.query(Student, User.email)
        .outerjoin(User, User.user_id == Student.user_id)
        .order_by(Student.registration_number, Student.student_id)
        .all()
    )
    return jsonify([
        {
            "student_id": student.student_id,
            "registration_number": student.registration_number,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": email,
            "course": student.course,
            "admission_year": student.admission_year,
            "date_of_birth": (
                student.date_of_birth.isoformat()
                if student.date_of_birth else None
            ),
        }
        for student, email in students
    ]), 200


@admin_bp.get("/students/orphan-accounts")
@administrator_required
def list_orphan_student_accounts():
    accounts = (
        db.session.query(User)
        .outerjoin(Student, Student.user_id == User.user_id)
        .filter(User.role == "Student", Student.student_id.is_(None))
        .order_by(User.email)
        .all()
    )
    return jsonify([
        {
            "user_id": user.user_id,
            "email": user.email,
            "is_active": user.is_active,
        }
        for user in accounts
    ]), 200


@admin_bp.post("/students/<int:user_id>/profile")
@administrator_required
def reconcile_student_profile(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "User account not found."}), 404
    if user.role != "Student":
        return jsonify({"error": "A Student account is required."}), 400
    if Student.query.filter_by(user_id=user_id).first() is not None:
        return jsonify({"error": "This Student account already has a profile."}), 409

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    profile, error = validate_student_profile({"student_profile": data})
    if error:
        return jsonify({"error": error}), 400

    student = Student(user_id=user.user_id, **profile)
    db.session.add(student)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "Student profile conflicts with an existing user or registration number."
        }), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to reconcile a Student profile")
        return jsonify({"error": "Unable to create the Student profile."}), 500

    return jsonify({
        "message": "Student profile created successfully.",
        "student": {
            "student_id": student.student_id,
            "user_id": student.user_id,
            "registration_number": student.registration_number,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": user.email,
            "course": student.course,
            "admission_year": student.admission_year,
        },
    }), 201


@admin_bp.get("/semesters")
@administrator_required
def list_semesters():
    semesters = Semester.query.order_by(
        Semester.academic_year, Semester.semester_number
    ).all()
    return jsonify([
        {
            "semester_id": semester.semester_id,
            "semester_number": semester.semester_number,
            "academic_year": semester.academic_year,
            "start_date": (
                semester.start_date.isoformat()
                if semester.start_date else None
            ),
            "end_date": (
                semester.end_date.isoformat()
                if semester.end_date else None
            ),
        }
        for semester in semesters
    ]), 200


@admin_bp.post("/semesters")
@administrator_required
def create_semester():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    semester_number = data.get("semester_number")
    academic_year = data.get("academic_year")
    if (
        isinstance(semester_number, bool)
        or not isinstance(semester_number, int)
        or not 1 <= semester_number <= 12
    ):
        return jsonify({
            "error": "Semester number must be a positive integer from 1 to 12."
        }), 400
    if not isinstance(academic_year, str) or not re.fullmatch(
        r"[0-9]{4}-[0-9]{4}", academic_year
    ):
        return jsonify({
            "error": "Academic year must use YYYY-YYYY format."
        }), 400

    dates = {}
    for field in ("start_date", "end_date"):
        value = data.get(field)
        if value in (None, ""):
            dates[field] = None
            continue
        if not isinstance(value, str):
            return jsonify({
                "error": f"{field.replace('_', ' ').capitalize()} must use YYYY-MM-DD format."
            }), 400
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            return jsonify({
                "error": f"{field.replace('_', ' ').capitalize()} must be a valid date in YYYY-MM-DD format."
            }), 400
        if parsed.isoformat() != value:
            return jsonify({
                "error": f"{field.replace('_', ' ').capitalize()} must use YYYY-MM-DD format."
            }), 400
        dates[field] = parsed

    if (
        dates["start_date"] is not None
        and dates["end_date"] is not None
        and dates["end_date"] <= dates["start_date"]
    ):
        return jsonify({
            "error": "End date must be later than start date."
        }), 400
    if Semester.query.filter_by(semester_number=semester_number).first():
        return jsonify({
            "error": f"Semester {semester_number} is already configured."
        }), 409

    semester = Semester(
        semester_number=semester_number,
        academic_year=academic_year,
        **dates,
    )
    db.session.add(semester)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": f"Semester {semester_number} is already configured."
        }), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to create a semester")
        return jsonify({"error": "Unable to create the semester."}), 500

    return jsonify({
        "message": "Semester created successfully.",
        "semester": {
            "semester_id": semester.semester_id,
            "semester_number": semester.semester_number,
            "academic_year": semester.academic_year,
            "start_date": (
                semester.start_date.isoformat()
                if semester.start_date else None
            ),
            "end_date": (
                semester.end_date.isoformat()
                if semester.end_date else None
            ),
        },
    }), 201


@admin_bp.post("/users")
@administrator_required
def create_user():
    data = request.get_json(silent=True) or {}
    email, password, role = data.get("email"), data.get("password"), data.get("role")
    if (
        not isinstance(email, str)
        or not email.strip()
        or "@" not in email
        or "." not in email.rsplit("@", 1)[-1]
        or any(character.isspace() for character in email)
    ):
        return jsonify({"error": "A valid email is required."}), 400
    if len(email.strip()) > 255:
        return jsonify({"error": "Email must be 255 characters or fewer."}), 400
    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"error": "Password must contain at least 8 characters."}), 400
    if role not in VALID_ROLES:
        return jsonify({"error": "Invalid role."}), 400
    profile = None
    if role == "Student":
        profile, error = validate_student_profile(
            data, require_date_of_birth=True
        )
        if error:
            return jsonify({"error": error}), 400
    email = email.strip().lower()
    if User.query.filter(func.lower(User.email) == email).first():
        return jsonify({"error": "Email already exists."}), 409
    user = User(email=email, password_hash=generate_password_hash(password), role=role, is_active=True)
    db.session.add(user)
    try:
        db.session.flush()
        if profile is not None:
            db.session.add(Student(user_id=user.user_id, **profile))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "error": "User or Student profile conflicts with an existing account or registration number."
        }), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to create a user account")
        return jsonify({"error": "Unable to create the user account."}), 500
    return jsonify({"message": "User created successfully.", "user": user_to_dict(user)}), 201


@admin_bp.patch("/users/<int:user_id>")
@administrator_required
def update_user(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"error": "User not found."}), 404
    data = request.get_json(silent=True) or {}
    if not data or not set(data).issubset({"role", "is_active"}):
        return jsonify({"error": "Provide role and/or is_active only."}), 400
    role = data.get("role", user.role)
    active = data.get("is_active", user.is_active)
    if role not in VALID_ROLES:
        return jsonify({"error": "Invalid role."}), 400
    if (
        role == "Student"
        and Student.query.filter_by(user_id=user.user_id).first() is None
    ):
        return jsonify({
            "error": "Create a Student account with profile details using the account creation form instead of changing an existing account's role."
        }), 409
    if not isinstance(active, bool):
        return jsonify({"error": "is_active must be true or false."}), 400
    if user.user_id == current_user.user_id and (role != "Administrator" or not active):
        return jsonify({"error": "You cannot remove or deactivate your own Administrator account."}), 400
    losing_admin = user.role == "Administrator" and user.is_active and (role != "Administrator" or not active)
    if losing_admin and User.query.filter_by(role="Administrator", is_active=True).count() <= 1:
        return jsonify({"error": "Cannot remove or deactivate the last active Administrator."}), 409
    user.role, user.is_active = role, active
    db.session.commit()
    return jsonify({"message": "User updated successfully.", "user": user_to_dict(user)}), 200


@admin_bp.get("/faculty-assignments")
@administrator_required
def list_faculty_assignments():
    rows = (db.session.query(FacultySubject, User, Subject, Semester)
            .join(User, User.user_id == FacultySubject.faculty_id)
            .join(Subject, Subject.subject_id == FacultySubject.subject_id)
            .join(Semester, Semester.semester_id == Subject.semester_id)
            .order_by(User.email, Subject.subject_code).all())
    return jsonify([{"faculty_id": fs.faculty_id, "faculty_email": user.email,
                     "subject_id": fs.subject_id, "subject_code": subject.subject_code,
                     "subject_name": subject.subject_name,
                     "semester_id": semester.semester_id,
                     "semester_number": semester.semester_number,
                     "academic_year": semester.academic_year}
                    for fs, user, subject, semester in rows]), 200


@admin_bp.post("/faculty-assignments")
@administrator_required
def assign_faculty():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    values, error, status = validate_assignment_context(data)
    if error:
        return jsonify({"error": error}), status

    faculty_id, subject_id = values["faculty_id"], values["subject_id"]
    if db.session.get(FacultySubject, (faculty_id, subject_id)) is not None:
        return jsonify({"error": "Faculty is already assigned to this subject."}), 409
    db.session.add(FacultySubject(faculty_id=faculty_id, subject_id=subject_id))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Faculty assignment conflicts with an existing assignment."}), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to assign faculty to a subject")
        return jsonify({"error": "Unable to assign faculty to the subject."}), 500
    return jsonify({
        "message": "Faculty assigned to subject.",
        "faculty_id": faculty_id,
        "subject_id": subject_id,
        "semester_id": values["semester_id"],
    }), 201


@admin_bp.put("/faculty-assignments/<int:faculty_id>/<int:subject_id>")
@administrator_required
def reassign_faculty(faculty_id, subject_id):
    assignment = db.session.get(FacultySubject, (faculty_id, subject_id))
    if assignment is None:
        return jsonify({"error": "Faculty assignment not found."}), 404

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    data = {**data, "subject_id": subject_id}
    values, error, status = validate_assignment_context(data)
    if error:
        return jsonify({"error": error}), status

    new_faculty_id = values["faculty_id"]
    if new_faculty_id == faculty_id:
        return jsonify({"error": "Choose a different Faculty account to reassign this subject."}), 400
    if db.session.get(FacultySubject, (new_faculty_id, subject_id)) is not None:
        return jsonify({"error": "The selected Faculty account is already assigned to this subject."}), 409

    try:
        db.session.add(FacultySubject(
            faculty_id=new_faculty_id, subject_id=subject_id
        ))
        db.session.flush()
        db.session.delete(assignment)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Faculty assignment conflicts with an existing assignment."}), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to reassign a subject")
        return jsonify({"error": "Unable to reassign the subject."}), 500

    return jsonify({
        "message": "Faculty assignment updated.",
        "faculty_id": new_faculty_id,
        "subject_id": subject_id,
        "semester_id": values["semester_id"],
    }), 200


@admin_bp.delete("/faculty-assignments/<int:faculty_id>/<int:subject_id>")
@administrator_required
def unassign_faculty(faculty_id, subject_id):
    assignment = db.session.get(FacultySubject, (faculty_id, subject_id))
    if assignment is None:
        return jsonify({"error": "Faculty assignment not found."}), 404

    other_assignments = (
        db.session.query(FacultySubject.faculty_id)
        .join(User, User.user_id == FacultySubject.faculty_id)
        .filter(
            FacultySubject.subject_id == subject_id,
            FacultySubject.faculty_id != faculty_id,
            User.role == "Faculty",
            User.is_active.is_(True),
        )
        .count()
    )
    enrollments = StudentSubject.query.filter_by(
        subject_id=subject_id
    ).count()
    if other_assignments == 0 and enrollments:
        return jsonify({
            "error": "Reassign students or assign another Faculty member before removing the last subject assignment."
        }), 409

    db.session.delete(assignment)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to remove a faculty assignment")
        return jsonify({"error": "Unable to remove the faculty assignment."}), 500
    return jsonify({"message": "Faculty assignment removed."}), 200


@admin_bp.get("/student-allocations")
@administrator_required
def list_student_allocations():
    filters = {}
    for field in ("student_id", "subject_id", "semester_id"):
        if field in request.args:
            value = request.args.get(field, type=int)
            if value is None or value <= 0:
                return jsonify({"error": f"{field} must be a positive integer."}), 400
            filters[field] = value

    query = (
        db.session.query(StudentSubject, Student, Subject, Semester, User)
        .join(Student, Student.student_id == StudentSubject.student_id)
        .join(Subject, Subject.subject_id == StudentSubject.subject_id)
        .join(Semester, Semester.semester_id == Subject.semester_id)
        .outerjoin(
            FacultySubject,
            FacultySubject.subject_id == StudentSubject.subject_id,
        )
        .outerjoin(User, User.user_id == FacultySubject.faculty_id)
    )
    if "student_id" in filters:
        query = query.filter(StudentSubject.student_id == filters["student_id"])
    if "subject_id" in filters:
        query = query.filter(StudentSubject.subject_id == filters["subject_id"])
    if "semester_id" in filters:
        query = query.filter(Subject.semester_id == filters["semester_id"])

    allocations = {}
    for enrollment, student, subject, semester, faculty in query.order_by(
        Student.registration_number, Subject.subject_code, User.email
    ).all():
        key = (enrollment.student_id, enrollment.subject_id)
        if key not in allocations:
            allocations[key] = student_allocation_to_dict(
                student, subject, semester, []
            )
        if faculty is not None:
            allocations[key]["faculty"].append({
                "faculty_id": faculty.user_id,
                "faculty_email": faculty.email,
            })

    return jsonify(list(allocations.values())), 200


@admin_bp.post("/student-allocations")
@administrator_required
def allocate_student():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    values, error, status = validate_student_allocation_context(data)
    if error:
        return jsonify({"error": error}), status

    key = (values["student_id"], values["subject_id"])
    if db.session.get(StudentSubject, key) is not None:
        return jsonify({"error": "Student is already allocated to this subject."}), 409

    db.session.add(StudentSubject(
        student_id=values["student_id"],
        subject_id=values["subject_id"],
    ))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Student allocation conflicts with an existing allocation."}), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to allocate a student to a subject")
        return jsonify({"error": "Unable to allocate the student."}), 500

    return jsonify({
        "message": "Student allocated to subject.",
        "allocation": student_allocation_to_dict(
            values["student"],
            values["subject"],
            values["semester"],
            values["faculty"],
        ),
    }), 201


@admin_bp.put("/student-allocations/<int:student_id>/<int:subject_id>")
@administrator_required
def reassign_student(student_id, subject_id):
    enrollment = db.session.get(StudentSubject, (student_id, subject_id))
    if enrollment is None:
        return jsonify({"error": "Student allocation not found."}), 404

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    target_data = {
        "student_id": student_id,
        "subject_id": data.get("new_subject_id"),
        "semester_id": data.get("semester_id"),
    }
    values, error, status = validate_student_allocation_context(target_data)
    if error:
        return jsonify({"error": error}), status
    if values["subject_id"] == subject_id:
        return jsonify({"error": "Choose a different subject to reassign this student."}), 400
    if db.session.get(
        StudentSubject, (student_id, values["subject_id"])
    ) is not None:
        return jsonify({"error": "Student is already allocated to the selected subject."}), 409

    try:
        db.session.add(StudentSubject(
            student_id=student_id,
            subject_id=values["subject_id"],
        ))
        db.session.flush()
        db.session.delete(enrollment)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Student allocation conflicts with an existing allocation."}), 409
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to reassign a student")
        return jsonify({"error": "Unable to reassign the student."}), 500

    return jsonify({
        "message": "Student allocation updated.",
        "allocation": student_allocation_to_dict(
            values["student"],
            values["subject"],
            values["semester"],
            values["faculty"],
        ),
    }), 200


@admin_bp.delete("/student-allocations/<int:student_id>/<int:subject_id>")
@administrator_required
def remove_student_allocation(student_id, subject_id):
    enrollment = db.session.get(StudentSubject, (student_id, subject_id))
    if enrollment is None:
        return jsonify({"error": "Student allocation not found."}), 404

    try:
        db.session.delete(enrollment)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to remove a student allocation")
        return jsonify({"error": "Unable to remove the student allocation."}), 500

    return jsonify({
        "message": "Student allocation removed. Existing academic records were preserved."
    }), 200
