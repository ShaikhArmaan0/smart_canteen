"""
admin_model.py – Admin action audit log.
"""
from datetime import datetime
from ..extensions import db


class AdminLog(db.Model):
    __tablename__ = "admin_logs"

    id         = db.Column(db.Integer, primary_key=True)
    admin_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action     = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    admin = db.relationship("User")

    def to_dict(self):
        return {
            "id":         self.id,
            "admin_id":   self.admin_id,
            "admin_name": self.admin.name if self.admin else None,
            "action":     self.action,
            "created_at": self.created_at.isoformat(),
        }
