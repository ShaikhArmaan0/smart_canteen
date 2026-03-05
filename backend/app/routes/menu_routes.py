"""
routes/menu_routes.py
  GET    /api/menu/canteens
  GET    /api/menu/categories
  GET    /api/menu/items          ?category_id= &canteen_id= &search= &available=1
  GET    /api/menu/items/<id>
  POST   /api/menu/items          (admin)
  PUT    /api/menu/items/<id>     (admin)
  DELETE /api/menu/items/<id>     (admin)
  GET    /api/menu/time-slots
"""
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity
from ..extensions import db
from ..models.menu_model import MenuItem, Category, Canteen, TimeSlot
from ..utils.helper_functions import (
    success_response, error_response, admin_required,
    log_admin_action, validate_required, get_request_data, get_current_user_id,
)

menu_bp = Blueprint("menu", __name__)


@menu_bp.route("/canteens", methods=["GET"])
def get_canteens():
    return success_response([c.to_dict() for c in Canteen.query.filter_by(is_active=True).all()])


@menu_bp.route("/categories", methods=["GET"])
def get_categories():
    q = Category.query
    cid = request.args.get("canteen_id", type=int)
    if cid:
        q = q.filter_by(canteen_id=cid)
    return success_response([c.to_dict() for c in q.all()])


@menu_bp.route("/items", methods=["GET"])
def get_items():
    q = MenuItem.query
    if cid := request.args.get("category_id", type=int):
        q = q.filter_by(category_id=cid)
    if cid := request.args.get("canteen_id", type=int):
        q = q.filter_by(canteen_id=cid)
    if request.args.get("available") == "1":
        q = q.filter_by(is_available=True)
    if s := request.args.get("search", ""):
        q = q.filter(MenuItem.name.ilike(f"%{s}%"))
    return success_response([i.to_dict() for i in q.all()])


@menu_bp.route("/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    item = MenuItem.query.get(item_id)
    if not item:
        return error_response("Item not found", 404)
    return success_response(item.to_dict())


@menu_bp.route("/items", methods=["POST"])
@admin_required
def add_item():
    data = get_request_data()
    missing = validate_required(data, ["canteen_id", "category_id", "name", "price"])
    if missing:
        return error_response(f"Missing fields: {missing}", 422)

    item = MenuItem(
        canteen_id=data["canteen_id"],
        category_id=data["category_id"],
        name=data["name"].strip(),
        description=data.get("description", ""),
        price=data["price"],
        preparation_time=data.get("preparation_time", 10),
        image_url=data.get("image_url", ""),
        is_available=data.get("is_available", True),
    )
    db.session.add(item)
    db.session.commit()
    log_admin_action(get_current_user_id(), f"Added menu item: {item.name}")
    return success_response(item.to_dict(), "Menu item added", 201)


@menu_bp.route("/items/<int:item_id>", methods=["PUT"])
@admin_required
def update_item(item_id):
    item = MenuItem.query.get(item_id)
    if not item:
        return error_response("Item not found", 404)
    data = get_request_data()
    for field in ["name", "description", "price", "preparation_time",
                  "image_url", "is_available", "category_id"]:
        if field in data:
            setattr(item, field, data[field])
    db.session.commit()
    log_admin_action(get_current_user_id(), f"Updated menu item ID {item_id}")
    return success_response(item.to_dict(), "Menu item updated")


@menu_bp.route("/items/<int:item_id>", methods=["DELETE"])
@admin_required
def delete_item(item_id):
    item = MenuItem.query.get(item_id)
    if not item:
        return error_response("Item not found", 404)
    db.session.delete(item)
    db.session.commit()
    log_admin_action(get_current_user_id(), f"Deleted menu item ID {item_id}")
    return success_response(None, "Menu item deleted")


@menu_bp.route("/time-slots", methods=["GET"])
def get_time_slots():
    return success_response([s.to_dict() for s in TimeSlot.query.all()])