"""
routes/auth_routes.py
  POST /api/auth/register
  POST /api/auth/login
  GET  /api/auth/me
  PUT  /api/auth/profile      – update name/email/phone/password
  POST /api/auth/forgot-password
  POST /api/auth/reset-password
"""
import re, secrets
from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.auth_service import register_user, login_user
from ..models.user_model import User
from ..extensions import db
from ..utils.helper_functions import success_response, error_response, validate_required, get_request_data, get_current_user_id

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r'^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$')
PHONE_RE = re.compile(r'^\+?[\d\s\-]{7,15}$')
# In-memory store for reset tokens (production would use DB/Redis)
_reset_tokens = {}  # email -> token

@auth_bp.route("/register", methods=["POST"])
def register():
    data = get_request_data()
    missing = validate_required(data, ["name", "email", "password"])
    if missing:
        return error_response(f"Missing required fields: {missing}", 422)

    name = data["name"].strip()
    email = data["email"].strip().lower()
    pw = data["password"]

    if len(name) < 2:
        return error_response("Name must be at least 2 characters", 422)
    if not EMAIL_RE.match(email):
        return error_response("Invalid email address", 422)
    if len(pw) < 6:
        return error_response("Password must be at least 6 characters", 422)

    phone = data.get("phone", "").strip()
    if phone and not PHONE_RE.match(phone):
        return error_response("Invalid phone number", 422)

    role = data.get("role", "student")
    if role not in ("student",):
        role = "student"  # Admin accounts cannot be self-registered

    user, err = register_user(name=name, email=email, password=pw, role=role, phone=phone)
    if err:
        return error_response(err, 409)
    return success_response(user.to_dict(), "Registration successful", 201)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = get_request_data()
    missing = validate_required(data, ["email", "password"])
    if missing:
        return error_response(f"Missing required fields: {missing}", 422)

    email = data["email"].strip().lower()
    pw = data["password"]
    if not email or not pw:
        return error_response("Email and password are required", 422)

    user, token, err = login_user(email=email, password=pw)
    if err:
        return error_response(err, 401)
    return success_response({"token": token, "user": user.to_dict()}, "Login successful")


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(get_current_user_id())
    if not user:
        return error_response("User not found", 404)
    return success_response(user.to_dict())


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user = User.query.get(get_current_user_id())
    if not user:
        return error_response("User not found", 404)
    data = get_request_data()

    if "name" in data:
        name = data["name"].strip()
        if len(name) < 2:
            return error_response("Name must be at least 2 characters", 422)
        user.name = name

    if "email" in data:
        email = data["email"].strip().lower()
        if not EMAIL_RE.match(email):
            return error_response("Invalid email address", 422)
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return error_response("Email already in use", 409)
        user.email = email

    if "phone" in data:
        phone = data["phone"].strip()
        if phone and not PHONE_RE.match(phone):
            return error_response("Invalid phone number", 422)
        user.phone = phone

    if "current_password" in data and "new_password" in data:
        if not user.check_password(data["current_password"]):
            return error_response("Current password is incorrect", 401)
        if len(data["new_password"]) < 6:
            return error_response("New password must be at least 6 characters", 422)
        user.set_password(data["new_password"])

    db.session.commit()
    return success_response(user.to_dict(), "Profile updated successfully")


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = get_request_data()
    email = (data.get("email") or "").strip().lower()
    if not email:
        return error_response("Email is required", 422)

    user = User.query.filter_by(email=email).first()
    if not user:
        # Don't reveal whether email exists
        return success_response(None, "If that email exists, a reset link has been sent")

    token = secrets.token_urlsafe(32)
    _reset_tokens[email] = token
    # In production: send email. For demo, return token in response.
    return success_response(
        {"reset_token": token, "email": email},
        "Password reset token generated (check your email in production)"
    )


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = get_request_data()
    email = (data.get("email") or "").strip().lower()
    token = data.get("token", "")
    new_pw = data.get("new_password", "")

    if not email or not token or not new_pw:
        return error_response("email, token, and new_password are required", 422)
    if len(new_pw) < 6:
        return error_response("Password must be at least 6 characters", 422)

    stored = _reset_tokens.get(email)
    if not stored or stored != token:
        return error_response("Invalid or expired reset token", 400)

    user = User.query.filter_by(email=email).first()
    if not user:
        return error_response("User not found", 404)

    user.set_password(new_pw)
    db.session.commit()
    del _reset_tokens[email]
    return success_response(None, "Password reset successfully. Please login.")