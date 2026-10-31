
from werkzeug.security import generate_password_hash

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User

app = create_app()

with app.app_context():
    email = "student.a@example.com"

    existing_user = db.session.scalar(
        db.select(User).where(User.email == email)
    )

    if existing_user:
        print(f"User already exists: {email}")
    else:
        user = User(
            email=email,
            password_hash=generate_password_hash("StudentTest123!"),
            role="Student",
            is_active=True,
        )

        db.session.add(user)
        db.session.commit()
        print(f"Development user created: {email}")
