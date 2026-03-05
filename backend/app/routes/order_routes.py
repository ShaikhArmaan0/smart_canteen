"""
routes/order_routes.py
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.order_service import place_order, update_order_status
from ..models.order_model import Order
from ..models.user_model import User
from ..utils.helper_functions import (
    success_response, error_response, admin_required, validate_required, get_request_data, get_current_user_id,
)

order_bp = Blueprint("orders", __name__)


@order_bp.route("", methods=["POST", "GET"])
@order_bp.route("/", methods=["POST", "GET"])
@jwt_required()
def orders_root():
    """
    POST → place new order
    GET  → my order history
    """
    if request.method == "GET":
        user_id = get_current_user_id()
        orders = (Order.query
                  .filter_by(user_id=user_id)
                  .order_by(Order.order_time.desc())
                  .all())
        return success_response([o.to_dict(include_items=True) for o in orders])

    # POST
    user_id = get_current_user_id()
    data    = get_request_data()

    print(f"[ORDER POST] user_id={user_id} data={data}")  # debug

    missing = validate_required(data, ["canteen_id", "items"])
    if missing:
        return error_response(f"Missing fields: {missing}", 422)

    order, err = place_order(user_id, data["canteen_id"], data["items"])
    if err:
        return error_response(err, 400)
    return success_response(order.to_dict(include_items=True), "Order placed successfully", 201)


@order_bp.route("/<int:order_id>", methods=["GET"])
@jwt_required()
def get_order(order_id):
    user_id = get_current_user_id()
    user    = User.query.get(user_id)
    order   = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", 404)
    if user.role != "admin" and order.user_id != user_id:
        return error_response("Access denied", 403)
    return success_response(order.to_dict(include_items=True))


@order_bp.route("/<int:order_id>/status", methods=["PUT"])
@jwt_required()
def change_status(order_id):
    user_id = get_current_user_id()
    from ..models.user_model import User
    user  = User.query.get(user_id)
    data  = get_request_data()
    new_status = data.get("status")

    if not new_status:
        return error_response("status field is required", 422)

    order = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", 404)

    # Students can only cancel their own orders that are pending/confirmed
    if user.role != "admin":
        if order.user_id != user_id:
            return error_response("Access denied", 403)
        if new_status != "cancelled":
            return error_response("Students can only cancel orders", 403)
        if order.status not in ("pending", "confirmed"):
            return error_response(f"Cannot cancel an order that is already '{order.status}'", 400)

    order_obj, err = update_order_status(order_id, new_status, user_id)
    if err:
        return error_response(err, 400)
    return success_response(order_obj.to_dict(), "Order status updated")


@order_bp.route("/all", methods=["GET"])
@admin_required
def all_orders():
    q = Order.query
    if s := request.args.get("status"):
        q = q.filter_by(status=s)
    if c := request.args.get("canteen_id", type=int):
        q = q.filter_by(canteen_id=c)
    orders = q.order_by(Order.order_time.desc()).all()
    return success_response([o.to_dict(include_items=True) for o in orders])


@order_bp.route("/<int:order_id>", methods=["DELETE"])
@jwt_required()
def delete_order(order_id):
    """
    Permanently delete a cancelled or refunded order log.
    Students can only delete their own cancelled/refunded orders.
    Admins can delete any cancelled/refunded order.
    """
    user_id = get_current_user_id()
    user    = User.query.get(user_id)
    order   = Order.query.get(order_id)

    if not order:
        return error_response("Order not found", 404)

    # Access check
    if user.role != "admin" and order.user_id != user_id:
        return error_response("Access denied", 403)

    # Only allow deleting cancelled or refunded orders
    from ..models.order_model import RefundRequest
    is_refunded = RefundRequest.query.filter_by(
        order_id=order_id, status="refunded"
    ).first() is not None

    if order.status not in ("cancelled",) and not is_refunded:
        return error_response(
            "Only cancelled or fully refunded orders can be deleted", 400
        )

    from ..extensions import db
    # Cascade deletes order_items, payment, status_logs via relationships
    db.session.delete(order)
    db.session.commit()
    return success_response(None, "Order record deleted successfully")