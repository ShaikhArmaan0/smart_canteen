"""
services/auth_service.py
"""
from flask_jwt_extended import create_access_token
from ..models.user_model import User
from ..extensions import db


def register_user(name, email, password, role="student", phone=""):
    if User.query.filter_by(email=email).first():
        return None, "Email already registered"
    if role not in ("student", "admin"):
        role = "student"
    user = User(name=name, email=email, role=role, phone=phone or None)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user, None


def login_user(email, password):
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return None, None, "Invalid email or password"
    token = create_access_token(identity=str(user.id))
    return user, token, None