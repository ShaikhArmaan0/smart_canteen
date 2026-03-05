"""
utils/helper_functions.py – Shared utilities, decorators, response builders.
"""
import json
from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request
from ..extensions import db


def get_request_data():
    """
    Robustly parse JSON body regardless of Content-Type header.
    Fixes CORS preflight stripping Content-Type which breaks get_json().
    Use this instead of request.get_json() in ALL routes.
    """
    # Try standard JSON parsing first
    data = request.get_json(silent=True, force=True)
    if data is not None:
        return data
    # Fallback: manually decode raw bytes
    try:
        return json.loads(request.data.decode('utf-8'))
    except Exception:
        pass
    # Last resort: try form data
    return request.form.to_dict() or {}


def success_response(data=None, message="Success", status_code=200):
    """Standardised success JSON envelope."""
    resp = {"success": True, "message": message}
    if data is not None:
        resp["data"] = data
    return jsonify(resp), status_code


def error_response(message="An error occurred", status_code=400):
    """Standardised error JSON envelope."""
    return jsonify({"success": False, "message": message}), status_code


def admin_required(fn):
    """Route decorator: JWT required AND role must be 'admin'."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        from ..models.user_model import User
        user = User.query.get(get_current_user_id())
        if not user or user.role != "admin":
            return error_response("Admin access required", 403)
        return fn(*args, **kwargs)
    return wrapper


def log_admin_action(admin_id, action):
    """Write one row to admin_logs. Silently ignores errors."""
    try:
        from ..models.admin_model import AdminLog
        db.session.add(AdminLog(admin_id=admin_id, action=action))
        db.session.commit()
    except Exception:
        db.session.rollback()


def generate_token_number():
    """Daily sequential token (resets each day, 1–999)."""
    from datetime import datetime, date
    from ..models.order_model import Order
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = Order.query.filter(Order.order_time >= today_start).count()
    return (count % 999) + 1


def get_current_user_id():
    """Return JWT identity as int. Works whether identity was stored as str or int."""
    from flask_jwt_extended import get_jwt_identity
    return int(get_jwt_identity())


def validate_required(data: dict, fields: list):
    """Return list of missing field names (only truly absent/None values)."""
    return [f for f in fields if data.get(f) is None]