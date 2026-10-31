from flask import Flask, jsonify, render_template
from flask_login import LoginManager
from flask_wtf.csrf import CSRFError, CSRFProtect
from sqlalchemy import text

from backend.config import Config
from backend.extensions import db
from backend.models.user import User
from backend.models.student import Student
from backend.models.semester import Semester
from backend.models.subject import Subject
from backend.models.student_subject import StudentSubject
from backend.models.mark import Mark
from backend.models.attendance import Attendance
from backend.models.faculty_subject import FacultySubject

from backend.routes.marks import marks_bp
from backend.routes.subjects import subjects_bp
from backend.routes.attendance import attendance_bp
from backend.routes.auth import auth_bp
from backend.routes.gpa import gpa_bp
from backend.routes.cgpa import cgpa_bp
from backend.routes.academic_records import academic_records_bp
from backend.routes.students import students_bp
from backend.routes.backups import backups_bp
from backend.routes.admin import admin_bp
from backend.routes.notifications import notifications_bp


csrf = CSRFProtect()


def create_app():
    app = Flask(
        __name__,
        template_folder="../frontend/templates",
        static_folder="../frontend/static",
    )
    app.config.from_object(Config)

    db.init_app(app)
    csrf.init_app(app)

    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({
            "error": "Authentication required."
        }), 401

    @app.errorhandler(CSRFError)
    def handle_csrf_error(error):
        return jsonify({
            "error": "CSRF validation failed.",
            "message": error.description,
        }), 400

    # Register all application API blueprints.
    app.register_blueprint(marks_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(gpa_bp)
    app.register_blueprint(cgpa_bp)
    app.register_blueprint(academic_records_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(backups_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(notifications_bp)

    # Serve the dashboard at the application home page.
    @app.route("/")
    def home():
        return render_template("dashboard.html")

    @app.route("/api/health")
    def health():
        return jsonify({
            "status": "healthy"
        })

    @app.route("/api/db-health")
    def database_health():
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify({
                "database": "connected",
                "status": "success",
            })
        except Exception:
            app.logger.exception("Database health check failed.")
            return jsonify({
                "database": "disconnected",
                "status": "error",
            }), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)