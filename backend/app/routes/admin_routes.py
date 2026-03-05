"""
routes/admin_routes.py
"""
from datetime import datetime, date, timedelta
from flask import Blueprint, request
from sqlalchemy import func
from ..extensions import db
from ..models.user_model  import User
from ..models.order_model import Order, OrderItem, Payment
from ..models.menu_model  import MenuItem, Category, Canteen
from ..models.admin_model import AdminLog
from ..utils.helper_functions import success_response, error_response, admin_required, log_admin_action, get_request_data, get_current_user_id
from flask_jwt_extended import get_jwt_identity

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/dashboard", methods=["GET"])
@admin_required
def dashboard():
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    total_users  = User.query.filter_by(role="student").count()
    total_orders = Order.query.count()
    today_orders = Order.query.filter(Order.order_time >= today_start).count()

    total_sales  = float(db.session.query(func.sum(Payment.amount))
                    .filter_by(payment_status="success").scalar() or 0)
    today_sales  = float(db.session.query(func.sum(Payment.amount))
                    .filter(Payment.payment_status == "success",
                            Payment.paid_at >= today_start).scalar() or 0)

    pending   = Order.query.filter_by(status="pending").count()
    preparing = Order.query.filter_by(status="preparing").count()
    ready     = Order.query.filter_by(status="ready").count()

    top_items = (
        db.session.query(MenuItem.name, func.sum(OrderItem.quantity).label("qty"))
        .join(OrderItem, MenuItem.id == OrderItem.menu_item_id)
        .group_by(MenuItem.id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(3).all()
    )

    recent = Order.query.order_by(Order.order_time.desc()).limit(10).all()

    return success_response({
        "total_users":      total_users,
        "total_orders":     total_orders,
        "today_orders":     today_orders,
        "total_sales":      total_sales,
        "today_sales":      today_sales,
        "pending_orders":   pending,
        "preparing_orders": preparing,
        "ready_orders":     ready,
        "top_items":        [{"name": t[0], "quantity": int(t[1])} for t in top_items],
        "most_ordered_item": {"name": top_items[0][0], "quantity": int(top_items[0][1])} if top_items else None,
        "recent_orders":    [o.to_dict(include_items=True) for o in recent],
    })


@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    q = User.query
    if role := request.args.get("role"):
        q = q.filter_by(role=role)
    users = q.order_by(User.created_at.desc()).all()
    # Get order counts in one query
    order_counts = dict(
        db.session.query(Order.user_id, func.count(Order.id))
        .group_by(Order.user_id).all()
    )
    result = []
    for u in users:
        d = u.to_dict()
        d["order_count"] = order_counts.get(u.id, 0)
        result.append(d)
    return success_response(result)


@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@admin_required
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)
    # Include order history
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.order_time.desc()).all()
    data = user.to_dict()
    data["orders"] = [o.to_dict(include_items=True) for o in orders]
    return success_response(data)


@admin_bp.route("/logs", methods=["GET"])
@admin_required
def admin_logs():
    logs = AdminLog.query.order_by(AdminLog.created_at.desc()).limit(100).all()
    return success_response([l.to_dict() for l in logs])


@admin_bp.route("/sales-report", methods=["GET"])
@admin_required
def sales_report():
    days = []
    for i in range(29, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        sales = float(
            db.session.query(func.sum(Payment.amount))
            .filter(Payment.payment_status == "success",
                    func.date(Payment.paid_at) == day)
            .scalar() or 0
        )
        orders_count = Order.query.filter(func.date(Order.order_time) == day).count()
        days.append({"date": str(day), "sales": sales, "orders": orders_count})
    return success_response(days)


@admin_bp.route("/refunds", methods=["GET"])
@admin_required
def admin_refunds():
    from ..models.order_model import RefundRequest
    refunds = RefundRequest.query.order_by(RefundRequest.requested_at.desc()).all()
    result = []
    for r in refunds:
        d = r.to_dict()
        d["otp"]        = r.otp
        d["user_name"]  = r.user.name  if r.user else "—"
        d["user_phone"] = r.user.phone if r.user else "—"
        d["user_email"] = r.user.email if r.user else "—"
        result.append(d)
    return success_response(result)


@admin_bp.route("/reviews", methods=["GET"])
@admin_required
def all_reviews():
    from ..models.review_model import Review
    reviews = Review.query.order_by(Review.created_at.desc()).all()
    return success_response([r.to_dict() for r in reviews])


@admin_bp.route("/categories", methods=["POST"])
@admin_required
def add_category():
    data = get_request_data()
    name = (data.get("name") or "").strip()
    canteen_id = data.get("canteen_id", 1)
    if not name:
        return error_response("Category name is required", 422)
    cat = Category(canteen_id=canteen_id, name=name)
    db.session.add(cat)
    db.session.commit()
    log_admin_action(get_current_user_id(), f"Added category: {name}")
    return success_response(cat.to_dict(), "Category added", 201)