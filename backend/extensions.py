from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from sqlalchemy import select

db = SQLAlchemy()
login_manager = LoginManager()


@login_manager.user_loader
def load_user(user_id):
    from backend.models.user import User

    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None