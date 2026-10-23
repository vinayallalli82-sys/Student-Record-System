
from flask import Flask, jsonify
from flask_wtf.csrf import CSRFProtect, generate_csrf

from backend.config import Config
from backend.extensions import db
from backend.routes.auth import auth_bp
from backend.routes.marks import marks_bp
from backend.routes.subjects import subjects_bp
import backend.models


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CSRFProtect(app)
    db.init_app(app)

    # Register API blueprints
    app.register_blueprint(marks_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(auth_bp)

    @app.route("/")
    def home():
        return jsonify({
            "message": "Student Record System API is running!",
            "status": "success",
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
                "status": "success",
            })
        except Exception:
            app.logger.exception("Database connection check failed")
            return jsonify({
                "database": "unavailable",
                "status": "error",
            }), 503

    @app.route("/api/auth/csrf", methods=["GET"])
    def csrf_token():
        return jsonify({"csrf_token": generate_csrf()})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
