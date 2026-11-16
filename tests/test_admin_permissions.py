"""Authorization tests for ADMIN-002 administrator account management."""

from datetime import date
from datetime import timedelta

import pytest
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.models.semester import Semester
from backend.models.subject import Subject
from backend.models.user import User
from tests.test_attendance import app, client, login, csrf_headers


def create_admin(app, email="admin@example.com"):
    with app.app_context():
        user = User(
            email=email,
            password_hash=generate_password_hash("AdminTest123!"),
            role="Administrator",
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
        return user.user_id


def admin_login(client):
    response = login(client, "admin@example.com", "AdminTest123!")
    assert response.status_code == 200


def test_admin_user_list_requires_authentication(client):
    response = client.get("/api/admin/users")
    assert response.status_code == 401


def test_student_cannot_list_or_create_users(client):
    assert login(client, "student.a@example.com").status_code == 200

    assert client.get("/api/admin/users").status_code == 403
    response = client.post(
        "/api/admin/users",
        json={
            "email": "attacker@example.com",
            "password": "Password123!",
            "role": "Administrator",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_faculty_cannot_change_roles(client, app):
    with app.app_context():
        target = User(
            email="target@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(target)
        db.session.commit()
        target_id = target.user_id

    assert login(client, "faculty@example.com", "FacultyTest123!").status_code == 200
    response = client.patch(
        f"/api/admin/users/{target_id}",
        json={"role": "Administrator"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_admin_can_create_user_and_assign_role(client, app):
    create_admin(app)
    admin_login(client)

    response = client.post(
        "/api/admin/users",
        json={
            "email": "newfaculty@example.com",
            "password": "FacultyPass123!",
            "role": "Faculty",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201
    assert response.get_json()["user"]["role"] == "Faculty"


def test_admin_can_create_semester_and_duplicate_is_rejected(client, app):
    create_admin(app)
    admin_login(client)
    payload = {
        "semester_number": 2,
        "academic_year": "2027-2028",
        "start_date": "2027-01-10",
        "end_date": "2027-05-20",
    }

    response = client.post(
        "/api/admin/semesters",
        json=payload,
        headers=csrf_headers(client),
    )
    assert response.status_code == 201
    result = response.get_json()["semester"]
    assert result["semester_number"] == 2
    assert result["academic_year"] == "2027-2028"
    assert result["start_date"] == "2027-01-10"
    assert result["end_date"] == "2027-05-20"

    with app.app_context():
        semester = db.session.get(Semester, result["semester_id"])
        assert semester is not None
        assert semester.academic_year == "2027-2028"

    assert any(
        item["semester_id"] == result["semester_id"]
        for item in client.get("/api/admin/semesters").get_json()
    )
    assert client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    ).status_code == 200
    assert login(client, "student.a@example.com").status_code == 200
    available_to_student = client.get("/api/students/me/semesters")
    assert available_to_student.status_code == 200
    assert any(
        item["semester_id"] == result["semester_id"]
        for item in available_to_student.get_json()["semesters"]
    )

    assert client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    ).status_code == 200
    admin_login(client)
    duplicate = client.post(
        "/api/admin/semesters",
        json={**payload, "academic_year": "2028-2029"},
        headers=csrf_headers(client),
    )
    assert duplicate.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"semester_number": 13, "academic_year": "2027-2028"},
        {"semester_number": 2, "academic_year": "2027/2028"},
        {
            "semester_number": 2,
            "academic_year": "2027-2028",
            "start_date": "2027-05-20",
            "end_date": "2027-05-20",
        },
        {
            "semester_number": 2,
            "academic_year": "2027-2028",
            "start_date": "2027-05-21",
            "end_date": "2027-05-20",
        },
    ],
)
def test_admin_semester_creation_validates_fields(client, app, payload):
    create_admin(app)
    admin_login(client)
    response = client.post(
        "/api/admin/semesters",
        json=payload,
        headers=csrf_headers(client),
    )
    assert response.status_code == 400


@pytest.mark.parametrize(
    "email,password",
    [
        ("student.a@example.com", "StudentTest123!"),
        ("faculty@example.com", "FacultyTest123!"),
    ],
)
def test_non_admin_cannot_create_semester(client, email, password):
    assert login(client, email, password).status_code == 200
    response = client.post(
        "/api/admin/semesters",
        json={"semester_number": 2, "academic_year": "2027-2028"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def student_user_payload(**overrides):
    profile = {
        "registration_number": "NEW-STUDENT-001",
        "first_name": "New",
        "last_name": "Student",
        "date_of_birth": "2004-05-06",
        "course": "Test Course",
        "admission_year": 2026,
    }
    profile.update(overrides.pop("student_profile", {}))
    return {
        "email": "newstudent@example.com",
        "password": "StudentPass123!",
        "role": "Student",
        "student_profile": profile,
        **overrides,
    }


def test_admin_student_creation_creates_linked_profile_and_lists_student(client, app):
    create_admin(app)
    admin_login(client)

    response = client.post(
        "/api/admin/users",
        json=student_user_payload(),
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    with app.app_context():
        user = User.query.filter_by(email="newstudent@example.com").one()
        from backend.models.student import Student
        student = Student.query.filter_by(user_id=user.user_id).one()
        assert student.registration_number == "NEW-STUDENT-001"
        assert student.first_name == "New"
        assert student.date_of_birth == date(2004, 5, 6)
        assert student.course == "Test Course"
        assert student.admission_year == 2026

    listed = client.get("/api/admin/students")
    assert listed.status_code == 200
    row = next(item for item in listed.get_json() if item["email"] == "newstudent@example.com")
    assert row["registration_number"] == "NEW-STUDENT-001"
    assert row["course"] == "Test Course"
    assert row["date_of_birth"] == "2004-05-06"

    orphan_accounts = client.get("/api/admin/students/orphan-accounts")
    assert orphan_accounts.status_code == 200
    assert all(item["email"] != "newstudent@example.com" for item in orphan_accounts.get_json())


def test_student_creation_requires_profile_details(client, app):
    create_admin(app)
    admin_login(client)

    response = client.post(
        "/api/admin/users",
        json={
            "email": "missingprofile@example.com",
            "password": "StudentPass123!",
            "role": "Student",
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    with app.app_context():
        assert User.query.filter_by(email="missingprofile@example.com").count() == 0


@pytest.mark.parametrize(
    "date_of_birth",
    [None, "not-a-date", (date.today() + timedelta(days=1)).isoformat()],
)
def test_student_creation_rejects_missing_invalid_or_future_dob(
    client, app, date_of_birth
):
    create_admin(app)
    admin_login(client)
    payload = student_user_payload()
    if date_of_birth is None:
        payload["student_profile"].pop("date_of_birth")
    else:
        payload["student_profile"]["date_of_birth"] = date_of_birth

    response = client.post(
        "/api/admin/users",
        json=payload,
        headers=csrf_headers(client),
    )
    assert response.status_code == 400
    with app.app_context():
        assert User.query.filter_by(email="newstudent@example.com").count() == 0


def test_new_student_can_log_in_and_view_saved_date_of_birth(client, app):
    create_admin(app)
    admin_login(client)
    response = client.post(
        "/api/admin/users",
        json=student_user_payload(),
        headers=csrf_headers(client),
    )
    assert response.status_code == 201

    assert client.post(
        "/api/auth/logout",
        headers=csrf_headers(client),
    ).status_code == 200
    assert login(client, "newstudent@example.com", "StudentPass123!").status_code == 200
    profile = client.get("/api/students/me")
    assert profile.status_code == 200
    assert profile.get_json()["date_of_birth"] == "2004-05-06"


def test_student_profile_creation_failure_rolls_back_user(client, app, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError

    create_admin(app)
    admin_login(client)

    def fail_commit():
        raise SQLAlchemyError("forced database failure")

    monkeypatch.setattr(db.session, "commit", fail_commit)
    response = client.post(
        "/api/admin/users",
        json=student_user_payload(),
        headers=csrf_headers(client),
    )

    assert response.status_code == 500
    with app.app_context():
        assert User.query.filter_by(email="newstudent@example.com").count() == 0
        from backend.models.student import Student
        assert Student.query.filter_by(registration_number="NEW-STUDENT-001").count() == 0


def test_duplicate_registration_number_rejects_student_creation(client, app):
    create_admin(app)
    admin_login(client)
    payload = student_user_payload()
    payload["student_profile"]["registration_number"] = "TEST-A"

    response = client.post(
        "/api/admin/users",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    with app.app_context():
        assert User.query.filter_by(email="newstudent@example.com").count() == 0


def test_admin_can_reconcile_existing_orphan_student_account(client, app):
    create_admin(app)
    with app.app_context():
        orphan = User(
            email="orphan@example.com",
            password_hash=generate_password_hash("StudentPass123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(orphan)
        db.session.commit()
        orphan_id = orphan.user_id

    admin_login(client)
    response = client.get("/api/admin/students/orphan-accounts")
    assert response.status_code == 200
    assert any(item["user_id"] == orphan_id for item in response.get_json())

    response = client.post(
        f"/api/admin/students/{orphan_id}/profile",
        json={
            "registration_number": "RECONCILED-001",
            "first_name": "Verified",
            "last_name": "Student",
            "course": "Test Course",
            "admission_year": 2025,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.get_json()["student"]["email"] == "orphan@example.com"
    with app.app_context():
        from backend.models.student import Student
        assert Student.query.filter_by(user_id=orphan_id).count() == 1
        assert User.query.filter_by(user_id=orphan_id).count() == 1


def test_student_cannot_reconcile_or_create_student_profiles(client, app):
    login(client, "student.a@example.com")
    response = client.post(
        "/api/admin/students/999/profile",
        json={
            "registration_number": "UNAUTHORIZED-001",
            "first_name": "Unauthorized",
            "course": "Test Course",
            "admission_year": 2026,
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_reconciliation_does_not_overwrite_existing_student_profile(client, app):
    create_admin(app)
    with app.app_context():
        from backend.models.student import Student
        account = User(
            email="existing.profile@example.com",
            password_hash=generate_password_hash("StudentPass123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(account)
        db.session.flush()
        profile = Student(
            user_id=account.user_id,
            registration_number="EXISTING-001",
            first_name="Existing",
            last_name="Profile",
            course="Original Course",
            admission_year=2024,
        )
        db.session.add(profile)
        db.session.commit()
        account_id = account.user_id

    admin_login(client)
    response = client.post(
        f"/api/admin/students/{account_id}/profile",
        json={
            "registration_number": "OVERWRITE-001",
            "first_name": "Changed",
            "last_name": "Name",
            "course": "New Course",
            "admission_year": 2026,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    with app.app_context():
        from backend.models.student import Student
        profile = Student.query.filter_by(user_id=account_id).one()
        assert profile.registration_number == "EXISTING-001"
        assert profile.first_name == "Existing"
        assert profile.course == "Original Course"


def test_role_change_cannot_create_student_without_profile(client, app):
    create_admin(app)
    with app.app_context():
        account = User(
            email="promote@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="Faculty",
            is_active=True,
        )
        db.session.add(account)
        db.session.commit()
        account_id = account.user_id

    admin_login(client)
    response = client.patch(
        f"/api/admin/users/{account_id}",
        json={"role": "Student"},
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    with app.app_context():
        account = db.session.get(User, account_id)
        assert account.role == "Faculty"


def test_admin_can_update_user_role_and_activation(client, app):
    create_admin(app)
    with app.app_context():
        target = User(
            email="target@example.com",
            password_hash=generate_password_hash("Password123!"),
            role="Student",
            is_active=True,
        )
        db.session.add(target)
        db.session.commit()
        target_id = target.user_id

    admin_login(client)
    response = client.patch(
        f"/api/admin/users/{target_id}",
        json={"role": "Faculty", "is_active": False},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "Faculty"
    assert response.get_json()["user"]["is_active"] is False


def test_admin_rejects_invalid_role(client, app):
    create_admin(app)
    admin_login(client)
    response = client.post(
        "/api/admin/users",
        json={
            "email": "invalidrole@example.com",
            "password": "Password123!",
            "role": "Superuser",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 400


def subject_update_payload(app, subject_id, **overrides):
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        payload = {
            "subject_code": subject.subject_code,
            "subject_name": subject.subject_name,
            "credits": str(subject.credits),
            "semester_id": subject.semester_id,
        }
    payload.update(overrides)
    return payload


def test_admin_can_update_subject_validly(client, app):
    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]

    response = client.put(
        f"/api/subjects/{subject_id}",
        json=subject_update_payload(
            app,
            subject_id,
            subject_name="Updated Test Subject",
            credits="4.0",
        ),
        headers=csrf_headers(client),
    )

    assert response.status_code == 200
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == "Updated Test Subject"
        assert str(subject.credits) == "4.0"


def test_subject_update_rejects_nonexistent_semester_without_changes(
    client, app
):
    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]
    original = subject_update_payload(app, subject_id)
    response = client.put(
        f"/api/subjects/{subject_id}",
        json={
            **original,
            "subject_name": "Invalid Semester Change",
            "semester_id": 999999,
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == original["subject_name"]
        assert subject.semester_id == original["semester_id"]


def test_subject_update_duplicate_code_preserves_existing_subjects(
    client, app
):
    create_admin(app)
    admin_login(client)
    ids = app.test_ids
    with app.app_context():
        semester_id = db.session.get(
            Subject, ids["subject"]
        ).semester_id
        duplicate = Subject(
            subject_code="OTHER101",
            subject_name="Other Subject",
            credits=2.0,
            semester_id=semester_id,
        )
        db.session.add(duplicate)
        db.session.commit()

    original = subject_update_payload(app, ids["subject"])
    response = client.put(
        f"/api/subjects/{ids['subject']}",
        json={
            **original,
            "subject_code": "OTHER101",
            "subject_name": "Conflicting Update",
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 409
    with app.app_context():
        subject = db.session.get(Subject, ids["subject"])
        duplicate_subject = Subject.query.filter_by(
            subject_code="OTHER101"
        ).one()
        assert subject.subject_code == original["subject_code"]
        assert subject.subject_name == original["subject_name"]
        assert duplicate_subject.subject_name == "Other Subject"


def test_subject_update_database_failure_rolls_back(
    client, app, monkeypatch
):
    from sqlalchemy.exc import SQLAlchemyError

    create_admin(app)
    admin_login(client)
    subject_id = app.test_ids["subject"]
    payload = subject_update_payload(
        app, subject_id, subject_name="Failed Update"
    )

    def fail_commit():
        raise SQLAlchemyError("forced database failure")

    monkeypatch.setattr(db.session, "commit", fail_commit)
    response = client.put(
        f"/api/subjects/{subject_id}",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 500
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == "Test Subject"


def test_faculty_cannot_update_subject(client, app):
    assert login(
        client, "faculty@example.com", "FacultyTest123!"
    ).status_code == 200
    subject_id = app.test_ids["subject"]
    response = client.put(
        f"/api/subjects/{subject_id}",
        json=subject_update_payload(
            app, subject_id, subject_name="Unauthorized Update"
        ),
        headers=csrf_headers(client),
    )

    assert response.status_code == 403
    with app.app_context():
        subject = db.session.get(Subject, subject_id)
        assert subject.subject_name == "Test Subject"
