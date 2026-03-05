"""
enquiry_model.py – Contact form submissions
"""
from datetime import datetime
from ..extensions import db


class Enquiry(db.Model):
    __tablename__ = "enquiries"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    email      = db.Column(db.String(100), nullable=False)
    phone      = db.Column(db.String(20), nullable=True)
    type       = db.Column(db.String(50), default="general")  # general | bulk_order | feedback | complaint
    message    = db.Column(db.Text, nullable=False)
    is_read    = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "email":      self.email,
            "phone":      self.phone or "",
            "type":       self.type,
            "message":    self.message,
            "is_read":    self.is_read,
            "created_at": self.created_at.isoformat(),
        }