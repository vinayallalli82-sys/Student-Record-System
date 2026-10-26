
from flask import Flask, jsonify
from flask_cors import CORS
from flask_login import LoginManager

from backend.config import Config
from backend.extensions import db, csrf
from backend.models.user import User
from backend.routes.auth import auth_bp
from backend.routes.student_dashboard import student_dashboard_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Allow the React/Vite frontend to send session cookies.
    CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
            ]
        }
    },
    supports_credentials=True,
    allow_headers=["Content-Type", "X-CSRFToken"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

    # Initialize database and CSRF protection.
    db.init_app(app)
    csrf.init_app(app)

    # Initialize Flask-Login.
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return db.session.get(User, int(user_id))
        except (ValueError, TypeError):
            return None

    # Register authentication and student dashboard routes.
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_dashboard_bp)

    # Health checks.
    @app.route("/")
    def home():
        return jsonify({
            "message": "Student Record System API is running"
        })

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @app.route("/api/db-health")
    def database_health():
        try:
            with db.engine.connect() as connection:
                connection.exec_driver_sql("SELECT 1")

            return jsonify({
                "status": "ok",
                "database": "connected",
            }), 200

        except Exception:
            app.logger.exception("Database health check failed")
            return jsonify({
                "status": "error",
                "database": "unavailable",
            }), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False
    )
