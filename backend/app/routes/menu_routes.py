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


# ── Weekly Schedule Routes ───────────────────────────────────────────────────
from ..models.menu_model import MenuDay, MenuSchedule

DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

def _ensure_days():
    """Seed MenuDay rows if they don't exist."""
    for name in DAYS_ORDER:
        if not MenuDay.query.filter_by(day_name=name).first():
            db.session.add(MenuDay(day_name=name))
    db.session.commit()


@menu_bp.route("/schedule/days", methods=["GET"])
def get_schedule_days():
    """Return all 6 days with their scheduled items."""
    _ensure_days()
    days = MenuDay.query.all()
    # sort by DAYS_ORDER
    days_sorted = sorted(days, key=lambda d: DAYS_ORDER.index(d.day_name) if d.day_name in DAYS_ORDER else 99)
    result = []
    for day in days_sorted:
        items = (
            db.session.query(MenuItem)
            .join(MenuSchedule, MenuSchedule.menu_item_id == MenuItem.id)
            .filter(MenuSchedule.day_id == day.id)
            .all()
        )
        result.append({
            "day_id":   day.id,
            "day_name": day.day_name,
            "items":    [i.to_dict() for i in items],
        })
    return success_response(result)


@menu_bp.route("/schedule/today", methods=["GET"])
def get_today_menu():
    """Return items scheduled for today (Mon–Sat). Sunday → closed."""
    import datetime
    _ensure_days()
    today_num = datetime.datetime.now().weekday()  # 0=Mon … 6=Sun
    if today_num == 6:  # Sunday
        return success_response({"day": "Sunday", "closed": True, "items": []})
    day_name = DAYS_ORDER[today_num]
    day = MenuDay.query.filter_by(day_name=day_name).first()
    if not day:
        return success_response({"day": day_name, "closed": False, "items": []})

    items = (
        db.session.query(MenuItem)
        .join(MenuSchedule, MenuSchedule.menu_item_id == MenuItem.id)
        .filter(MenuSchedule.day_id == day.id)
        .all()
    )
    # If admin hasn't set up any schedule yet, fall back to all items
    if not items:
        items = MenuItem.query.filter_by(canteen_id=1).all()
        return success_response({"day": day_name, "closed": False, "items": [i.to_dict() for i in items], "fallback": True})

    return success_response({"day": day_name, "closed": False, "items": [i.to_dict() for i in items]})


@menu_bp.route("/schedule/day/<int:day_id>", methods=["PUT"])
@admin_required
def set_day_schedule(day_id):
    """Set the full list of items for a given day (replaces existing)."""
    data     = get_request_data()
    item_ids = data.get("item_ids", [])   # list of menu_item ids

    day = MenuDay.query.get(day_id)
    if not day:
        return error_response("Day not found", 404)

    # Delete old assignments for this day
    MenuSchedule.query.filter_by(day_id=day_id).delete()

    # Create new ones
    for mid in item_ids:
        item = MenuItem.query.get(mid)
        if item:
            db.session.add(MenuSchedule(
                menu_item_id=mid,
                day_id=day_id,
                time_slot_id=1,   # default slot
                is_active=True,
            ))
    db.session.commit()
    log_admin_action(get_current_user_id(), f"Updated schedule for day_id={day_id}: {len(item_ids)} items")
    return success_response(None, f"Schedule for {day.day_name} updated")


@menu_bp.route("/schedule/copy", methods=["POST"])
@admin_required
def copy_day_schedule():
    """Copy schedule from one day to another."""
    data     = get_request_data()
    from_id  = data.get("from_day_id")
    to_id    = data.get("to_day_id")
    if not from_id or not to_id:
        return error_response("from_day_id and to_day_id required", 422)

    src_schedules = MenuSchedule.query.filter_by(day_id=from_id).all()
    MenuSchedule.query.filter_by(day_id=to_id).delete()
    for s in src_schedules:
        db.session.add(MenuSchedule(
            menu_item_id=s.menu_item_id,
            day_id=to_id,
            time_slot_id=s.time_slot_id,
            is_active=s.is_active,
        ))
    db.session.commit()
    return success_response(None, "Schedule copied")