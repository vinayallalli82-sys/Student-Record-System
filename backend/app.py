
from flask import Flask, jsonify
from flask_login import LoginManager

from backend.config import Config
from backend.extensions import db
from backend.models.user import User
from backend.models.semester import Semester
from backend.models.subject import Subject
from backend.models.student import Student

from backend.routes.marks import marks_bp
from backend.routes.subjects import subjects_bp
from backend.routes.attendance import attendance_bp
from backend.routes.auth import auth_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)

    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            return None

    # Register API blueprints
    app.register_blueprint(marks_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(auth_bp)

    @app.route("/")
    def home():
        return jsonify({
            "message": "Student Record System API is running!",
            "status": "success"
        })

    @app.route("/api/health")
    def health():
        return jsonify({"status": "healthy"})

    @app.route("/api/db-health")
    def database_health():
        from sqlalchemy import text

        try:
            db.session.execute(text("SELECT 1"))
            return jsonify({
                "database": "connected",
                "status": "success"
            })
        except Exception:
            app.logger.exception("Database connection check failed")
            return jsonify({
                "database": "unavailable",
                "status": "error"
            }), 503

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
