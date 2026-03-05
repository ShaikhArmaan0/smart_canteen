"""
menu_model.py – Canteen, Category, TimeSlot, MenuDay, MenuItem, MenuSchedule
"""
from datetime import datetime
from ..extensions import db


class Canteen(db.Model):
    __tablename__ = "canteens"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    location   = db.Column(db.String(255))
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    categories = db.relationship("Category", back_populates="canteen", lazy=True)
    menu_items = db.relationship("MenuItem",  back_populates="canteen", lazy=True)
    orders     = db.relationship("Order",     back_populates="canteen", lazy=True)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name,
            "location": self.location, "is_active": self.is_active,
        }


class Category(db.Model):
    __tablename__ = "categories"

    id         = db.Column(db.Integer, primary_key=True)
    canteen_id = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    canteen    = db.relationship("Canteen",  back_populates="categories")
    menu_items = db.relationship("MenuItem", back_populates="category", lazy=True)

    def to_dict(self):
        return {"id": self.id, "canteen_id": self.canteen_id, "name": self.name}


class TimeSlot(db.Model):
    __tablename__ = "time_slots"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(50), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time   = db.Column(db.Time, nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name,
            "start_time": str(self.start_time), "end_time": str(self.end_time),
        }


class MenuDay(db.Model):
    __tablename__ = "menu_days"

    id       = db.Column(db.Integer, primary_key=True)
    day_name = db.Column(db.String(20), nullable=False)

    def to_dict(self):
        return {"id": self.id, "day_name": self.day_name}


class MenuItem(db.Model):
    __tablename__ = "menu_items"

    id               = db.Column(db.Integer, primary_key=True)
    canteen_id       = db.Column(db.Integer, db.ForeignKey("canteens.id"), nullable=False)
    category_id      = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    name             = db.Column(db.String(150), nullable=False)
    description      = db.Column(db.Text)
    price            = db.Column(db.Numeric(10, 2), nullable=False)
    preparation_time = db.Column(db.Integer, default=10)
    image_url        = db.Column(db.String(255))
    is_available     = db.Column(db.Boolean, default=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    canteen     = db.relationship("Canteen",  back_populates="menu_items")
    category    = db.relationship("Category", back_populates="menu_items")
    order_items = db.relationship("OrderItem",   back_populates="menu_item", lazy=True)
    schedules   = db.relationship("MenuSchedule", back_populates="menu_item", lazy=True)

    def to_dict(self):
        return {
            "id":               self.id,
            "canteen_id":       self.canteen_id,
            "category_id":      self.category_id,
            "category_name":    self.category.name if self.category else None,
            "name":             self.name,
            "description":      self.description,
            "price":            float(self.price),
            "preparation_time": self.preparation_time,
            "image_url":        self.image_url,
            "is_available":     self.is_available,
            "created_at":       self.created_at.isoformat(),
        }


class MenuSchedule(db.Model):
    __tablename__ = "menu_schedule"

    id                  = db.Column(db.Integer, primary_key=True)
    menu_item_id        = db.Column(db.Integer, db.ForeignKey("menu_items.id"), nullable=False)
    day_id              = db.Column(db.Integer, db.ForeignKey("menu_days.id"),  nullable=False)
    time_slot_id        = db.Column(db.Integer, db.ForeignKey("time_slots.id"), nullable=False)
    stock_quantity      = db.Column(db.Integer, default=50)
    low_stock_threshold = db.Column(db.Integer, default=5)
    is_active           = db.Column(db.Boolean, default=True)

    menu_item = db.relationship("MenuItem",  back_populates="schedules")
    day       = db.relationship("MenuDay")
    time_slot = db.relationship("TimeSlot")

    def to_dict(self):
        return {
            "id": self.id,
            "menu_item_id": self.menu_item_id,
            "day_id": self.day_id,
            "time_slot_id": self.time_slot_id,
            "stock_quantity": self.stock_quantity,
            "low_stock_threshold": self.low_stock_threshold,
            "is_active": self.is_active,
        }
