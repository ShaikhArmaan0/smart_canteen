"""
user_model.py – Users table
"""
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db


class User(db.Model):
    __tablename__ = "users"

    id             = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(100), nullable=False)
    email          = db.Column(db.String(100), unique=True, nullable=False)
    password       = db.Column(db.String(255), nullable=False)
    role           = db.Column(db.String(20), default="student")   # student | admin
    phone          = db.Column(db.String(20), nullable=True)
    wallet_balance = db.Column(db.Numeric(10, 2), default=0.00)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    orders   = db.relationship("Order",   back_populates="user", lazy=True)
    payments = db.relationship("Payment", back_populates="user", lazy=True)

    def set_password(self, raw):
        self.password = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password, raw)

    def to_dict(self):
        return {
            "id":             self.id,
            "name":           self.name,
            "email":          self.email,
            "role":           self.role,
            "phone":          self.phone or "",
            "wallet_balance": float(self.wallet_balance or 0),
            "created_at":     self.created_at.isoformat(),
        }
