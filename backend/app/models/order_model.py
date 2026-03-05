"""
order_model.py – Order, OrderItem, Payment, OrderStatusLog
"""
from datetime import datetime
from ..extensions import db


class Order(db.Model):
    __tablename__ = "orders"

    id                   = db.Column(db.Integer, primary_key=True)
    user_id              = db.Column(db.Integer, db.ForeignKey("users.id"),    nullable=False)
    canteen_id           = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=False)
    total_amount         = db.Column(db.Numeric(10, 2), nullable=False)
    status               = db.Column(db.String(30), default="pending")
    # pending | confirmed | preparing | ready | completed | cancelled
    token_number         = db.Column(db.Integer)
    estimated_ready_time = db.Column(db.DateTime)
    order_time           = db.Column(db.DateTime, default=datetime.utcnow)

    user        = db.relationship("User",    back_populates="orders")
    canteen     = db.relationship("Canteen", back_populates="orders")
    order_items = db.relationship("OrderItem",      back_populates="order",
                                  lazy=True, cascade="all, delete-orphan")
    payment     = db.relationship("Payment",        back_populates="order", uselist=False,
                                  cascade="all, delete-orphan")
    status_logs = db.relationship("OrderStatusLog", back_populates="order", lazy=True,
                                  cascade="all, delete-orphan")
    refund_requests = db.relationship("RefundRequest", back_populates="order", lazy=True,
                                      cascade="all, delete-orphan")

    def to_dict(self, include_items=False):
        is_refunded = any(
            r.status == "refunded" for r in (self.refund_requests or [])
        )
        data = {
            "id":                   self.id,
            "user_id":              self.user_id,
            "user_name":            self.user.name if self.user else None,
            "user_email":           self.user.email if self.user else None,
            "canteen_id":           self.canteen_id,
            "canteen_name":         self.canteen.name if self.canteen else None,
            "total_amount":         float(self.total_amount),
            "status":               self.status,
            "token_number":         self.token_number,
            "is_refunded":          is_refunded,
            "estimated_ready_time": self.estimated_ready_time.isoformat()
                                    if self.estimated_ready_time else None,
            "order_time":           self.order_time.isoformat(),
        }
        if include_items:
            data["items"] = [i.to_dict() for i in self.order_items]
        return data


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id                    = db.Column(db.Integer, primary_key=True)
    order_id              = db.Column(db.Integer, db.ForeignKey("orders.id"),     nullable=False)
    menu_item_id          = db.Column(db.Integer, db.ForeignKey("menu_items.id"), nullable=False)
    quantity              = db.Column(db.Integer, nullable=False, default=1)
    price                 = db.Column(db.Numeric(10, 2), nullable=False)
    item_preparation_time = db.Column(db.Integer)

    order     = db.relationship("Order",    back_populates="order_items")
    menu_item = db.relationship("MenuItem", back_populates="order_items")

    def to_dict(self):
        return {
            "id":           self.id,
            "order_id":     self.order_id,
            "menu_item_id": self.menu_item_id,
            "name":         self.menu_item.name if self.menu_item else None,
            "quantity":     self.quantity,
            "price":        float(self.price),
            "subtotal":     float(self.price) * self.quantity,
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id                  = db.Column(db.Integer, primary_key=True)
    order_id            = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    user_id             = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=False)
    payment_method      = db.Column(db.String(50))
    payment_status      = db.Column(db.String(30), default="pending")
    transaction_id      = db.Column(db.String(150))
    razorpay_order_id   = db.Column(db.String(150))
    razorpay_payment_id = db.Column(db.String(150))
    upi_id              = db.Column(db.String(100))
    amount              = db.Column(db.Numeric(10, 2), nullable=False)
    paid_at             = db.Column(db.DateTime)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    order = db.relationship("Order", back_populates="payment")
    user  = db.relationship("User",  back_populates="payments")

    def to_dict(self):
        return {
            "id":                  self.id,
            "order_id":            self.order_id,
            "user_id":             self.user_id,
            "payment_method":      self.payment_method,
            "payment_status":      self.payment_status,
            "transaction_id":      self.transaction_id,
            "razorpay_order_id":   self.razorpay_order_id,
            "razorpay_payment_id": self.razorpay_payment_id,
            "amount":              float(self.amount),
            "paid_at":             self.paid_at.isoformat() if self.paid_at else None,
            "created_at":          self.created_at.isoformat(),
        }


class OrderStatusLog(db.Model):
    __tablename__ = "order_status_logs"

    id         = db.Column(db.Integer, primary_key=True)
    order_id   = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    status     = db.Column(db.String(30), nullable=False)
    updated_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    order = db.relationship("Order", back_populates="status_logs")

    def to_dict(self):
        return {
            "id": self.id, "order_id": self.order_id,
            "status": self.status, "updated_by": self.updated_by,
            "updated_at": self.updated_at.isoformat(),
        }


class RefundRequest(db.Model):
    __tablename__ = "refund_requests"

    id              = db.Column(db.Integer, primary_key=True)
    order_id        = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"),  nullable=False)
    amount          = db.Column(db.Numeric(10, 2), nullable=False)
    status          = db.Column(db.String(30), default="pending")  # pending | otp_sent | claimed | refunded
    otp             = db.Column(db.String(6), nullable=True)
    otp_expires_at  = db.Column(db.DateTime, nullable=True)
    requested_at    = db.Column(db.DateTime, default=datetime.utcnow)
    claimed_at      = db.Column(db.DateTime, nullable=True)

    order = db.relationship("Order", back_populates="refund_requests")
    user  = db.relationship("User")

    def to_dict(self):
        return {
            "id":           self.id,
            "order_id":     self.order_id,
            "user_id":      self.user_id,
            "amount":       float(self.amount),
            "status":       self.status,
            "otp":          self.otp if self.status in ("otp_sent",) else None,  # admin only
            "requested_at": self.requested_at.isoformat(),
            "claimed_at":   self.claimed_at.isoformat() if self.claimed_at else None,
        }