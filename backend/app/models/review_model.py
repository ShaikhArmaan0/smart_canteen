"""
review_model.py – Reviews & Feedback
"""
from datetime import datetime
from ..extensions import db


class Review(db.Model):
    __tablename__ = "reviews"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    item_id    = db.Column(db.Integer, db.ForeignKey("menu_items.id"), nullable=True)
    order_id   = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=True)
    rating     = db.Column(db.Integer, nullable=False)   # 1-5
    comment    = db.Column(db.Text)
    review_type = db.Column(db.String(20), default="general")  # general | item | order
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")
    item = db.relationship("MenuItem")

    def to_dict(self):
        return {
            "id":          self.id,
            "user_id":     self.user_id,
            "user_name":   self.user.name if self.user else "Anonymous",
            "item_id":     self.item_id,
            "item_name":   self.item.name if self.item else None,
            "order_id":    self.order_id,
            "rating":      self.rating,
            "comment":     self.comment,
            "review_type": self.review_type,
            "created_at":  self.created_at.isoformat(),
        }
