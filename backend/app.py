from flask import Flask, jsonify
from backend.config import Config
from backend.extensions import db
from backend.models.user import User
from backend.routes.marks import marks_bp
from backend.models.semester import Semester
from backend.models.subject import Subject
from backend.models.student import Student


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    app.register_blueprint(marks_bp)

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
