
import json
import logging
from datetime import date, datetime
from decimal import Decimal
from functools import wraps

from flask import Blueprint, current_app, jsonify, make_response, request
from flask_login import current_user, login_required
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

from backend.extensions import db

# Ensure all application models are registered in SQLAlchemy metadata.
from backend.models.user import User  # noqa: F401
from backend.models.student import Student  # noqa: F401
from backend.models.semester import Semester  # noqa: F401
from backend.models.subject import Subject  # noqa: F401
from backend.models.student_subject import StudentSubject  # noqa: F401
from backend.models.mark import Mark  # noqa: F401
from backend.models.attendance import Attendance  # noqa: F401


backups_bp = Blueprint(
    "backups",
    __name__,
    url_prefix="/api/backups",
)

logger = logging.getLogger(__name__)


def administrator_required(view_function):
    """Restrict backup and recovery operations to administrators."""

    @wraps(view_function)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "Administrator":
            return jsonify({
                "error": "Administrator access required."
            }), 403

        return view_function(*args, **kwargs)

    return wrapped


def json_default(value):
    """Convert database values into JSON-compatible values."""
    if isinstance(value, (date, datetime)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return str(value)

    raise TypeError(
        f"Unsupported value type: {type(value).__name__}"
    )


def application_tables():
    """Return application tables in foreign-key dependency order."""
    return list(db.metadata.sorted_tables)


def convert_row_for_database(table, row):
    """Convert ISO date/time and decimal strings back to DB values."""
    converted = {}

    for column_name, value in row.items():
        column = table.columns[column_name]

        if value is None:
            converted[column_name] = None
        elif isinstance(column.type, db.DateTime):
            converted[column_name] = datetime.fromisoformat(value)
        elif isinstance(column.type, db.Date):
            converted[column_name] = date.fromisoformat(value)
        elif isinstance(column.type, db.Numeric):
            converted[column_name] = Decimal(str(value))
        else:
            converted[column_name] = value

    return converted


@backups_bp.get("")
@administrator_required
def create_backup():
    """Export all registered application tables as a JSON backup."""
    try:
        tables_data = {}

        with db.engine.connect() as connection:
            for table in application_tables():
                result = connection.execute(
                    select(table)
                ).mappings()

                tables_data[table.name] = [
                    dict(row) for row in result
                ]

        payload = {
            "format": "student-record-system-backup",
            "version": 1,
            "created_at": datetime.now().astimezone().isoformat(),
            "tables": tables_data,
        }

        response = make_response(
            json.dumps(
                payload,
                default=json_default,
                indent=2,
            )
        )
        response.headers["Content-Type"] = "application/json"
        response.headers["Content-Disposition"] = (
            'attachment; filename="student-record-backup.json"'
        )
        return response

    except Exception:
        logger.exception("Backup creation failed")
        return jsonify({
            "error": "Backup creation failed."
        }), 500


@backups_bp.post("/restore")
@administrator_required
def restore_backup():
    """Restore missing records without overwriting existing primary keys."""
    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return jsonify({
            "error": "Provide a valid JSON backup."
        }), 400

    if (
        payload.get("format") != "student-record-system-backup"
        or payload.get("version") != 1
        or not isinstance(payload.get("tables"), dict)
        or not payload["tables"]
    ):
        return jsonify({
            "error": "Unsupported or invalid backup format."
        }), 400

    tables_by_name = {
        table.name: table for table in application_tables()
    }
    backup_tables = payload["tables"]

    # Validate the complete structure before making database changes.
    for table_name, rows in backup_tables.items():
        table = tables_by_name.get(table_name)

        if table is None or not isinstance(rows, list):
            return jsonify({
                "error": f"Invalid table or rows: {table_name}"
            }), 400

        if not table.primary_key.columns:
            return jsonify({
                "error": f"Table has no primary key: {table_name}"
            }), 400

        valid_columns = set(table.columns.keys())
        primary_keys = {
            column.name for column in table.primary_key.columns
        }

        for row in rows:
            if (
                not isinstance(row, dict)
                or not set(row).issubset(valid_columns)
                or not primary_keys.issubset(row)
                or any(row[key] is None for key in primary_keys)
            ):
                return jsonify({
                    "error": f"Invalid record in table: {table_name}"
                }), 400

    restored = 0
    skipped = 0

    try:
        # A single transaction makes the restoration all-or-nothing.
        with db.engine.begin() as connection:
            for table in application_tables():
                rows = backup_tables.get(table.name, [])

                for row in rows:
                    converted = convert_row_for_database(table, row)

                    conditions = [
                        column == converted[column.name]
                        for column in table.primary_key.columns
                    ]

                    existing = connection.execute(
                        select(table).where(and_(*conditions))
                    ).first()

                    # Never overwrite an existing record.
                    if existing is not None:
                        skipped += 1
                        continue

                    connection.execute(
                        table.insert().values(**converted)
                    )
                    restored += 1

        return jsonify({
            "message": "Backup restoration completed.",
            "restored_records": restored,
            "skipped_existing_records": skipped,
        }), 200

    except IntegrityError:
        logger.exception("Backup restoration encountered a conflict")
        return jsonify({
            "error": (
                "Restore failed because of a record conflict or "
                "foreign-key constraint. No changes were committed."
            )
        }), 409

    except (ValueError, TypeError, KeyError) as error:
        logger.warning("Invalid backup data: %s", error)
        return jsonify({
            "error": "Backup contains invalid data. No changes were committed."
        }), 400

    except Exception:
        logger.exception("Backup restoration failed")
        return jsonify({
            "error": "Restoration failed. No changes were committed."
        }), 500
