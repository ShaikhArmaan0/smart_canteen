"""
routes/refund_routes.py
  POST /api/refunds/request        – student requests refund for cancelled order
  GET  /api/refunds/               – admin: list all refund requests
  POST /api/refunds/<id>/send-otp  – admin: generate & send mock OTP
  POST /api/refunds/<id>/verify    – admin: verify OTP and mark refunded
  GET  /api/refunds/my             – student: check own refund status
"""
import random, string
from datetime import datetime, timedelta
from flask import Blueprint
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.order_model import Order, Payment, RefundRequest
from ..utils.helper_functions import (
    success_response, error_response, admin_required,
    get_request_data, get_current_user_id
)
from ..models.user_model import User

refund_bp = Blueprint("refunds", __name__)


def _gen_otp():
    return ''.join(random.choices(string.digits, k=6))


@refund_bp.route("/request", methods=["POST"])
@jwt_required()
def request_refund():
    """Student requests a refund after cancelling."""
    user_id  = get_current_user_id()
    data     = get_request_data()
    order_id = data.get("order_id")

    order = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", 404)
    if order.user_id != user_id:
        return error_response("Access denied", 403)
    if order.status != "cancelled":
        return error_response("Only cancelled orders can be refunded", 400)

    # Check if refund already requested
    existing = RefundRequest.query.filter_by(order_id=order_id).first()
    if existing:
        return success_response(existing.to_dict(), "Refund already requested")

    # Get payment amount
    payment = Payment.query.filter_by(order_id=order_id).first()
    amount  = float(payment.amount) if payment else float(order.total_amount)

    refund = RefundRequest(
        order_id=order_id, user_id=user_id, amount=amount, status="pending"
    )
    db.session.add(refund)
    db.session.commit()
    return success_response(refund.to_dict(), "Refund request submitted", 201)


@refund_bp.route("/my", methods=["GET"])
@jwt_required()
def my_refunds():
    user_id = get_current_user_id()
    refunds = RefundRequest.query.filter_by(user_id=user_id).order_by(RefundRequest.requested_at.desc()).all()
    result  = []
    for r in refunds:
        d = r.to_dict()
        d.pop("otp", None)  # never expose OTP to student
        result.append(d)
    return success_response(result)


@refund_bp.route("/order/<int:order_id>", methods=["GET"])
@jwt_required()
def refund_by_order(order_id):
    user_id = get_current_user_id()
    user    = User.query.get(user_id)
    refund  = RefundRequest.query.filter_by(order_id=order_id).first()
    if not refund:
        return error_response("No refund request found", 404)
    if user.role != "admin" and refund.user_id != user_id:
        return error_response("Access denied", 403)
    d = refund.to_dict()
    if user.role != "admin":
        d.pop("otp", None)
    return success_response(d)


@refund_bp.route("/", methods=["GET"])
@admin_required
def list_refunds():
    refunds = RefundRequest.query.order_by(RefundRequest.requested_at.desc()).all()
    result  = []
    for r in refunds:
        d = r.to_dict()
        d["otp"]        = r.otp   # admin can see OTP
        d["user_name"]  = r.user.name  if r.user  else "—"
        d["user_phone"] = r.user.phone if r.user  else "—"
        d["user_email"] = r.user.email if r.user  else "—"
        result.append(d)
    return success_response(result)


@refund_bp.route("/<int:rid>/send-otp", methods=["POST"])
@admin_required
def send_otp(rid):
    refund = RefundRequest.query.get(rid)
    if not refund:
        return error_response("Refund request not found", 404)
    if refund.status == "refunded":
        return error_response("Already refunded", 400)

    otp = _gen_otp()
    refund.otp            = otp
    refund.otp_expires_at = datetime.utcnow() + timedelta(minutes=15)
    refund.status         = "otp_sent"
    db.session.commit()

    # In production: send OTP via SMS to refund.user.phone
    # For demo: OTP is returned in response and shown to admin
    return success_response({
        "refund_id": rid,
        "otp":       otp,            # Admin shows this to student
        "expires_in": "15 minutes",
        "user_phone": refund.user.phone if refund.user else "—",
        "amount":    float(refund.amount),
    }, f"OTP generated: {otp} (show to student)")


@refund_bp.route("/<int:rid>/verify", methods=["POST"])
@admin_required
def verify_and_refund(rid):
    data   = get_request_data()
    otp_in = (data.get("otp") or "").strip()

    refund = RefundRequest.query.get(rid)
    if not refund:
        return error_response("Refund request not found", 404)
    if refund.status == "refunded":
        return error_response("Already refunded", 400)
    if refund.status != "otp_sent" or not refund.otp:
        return error_response("Generate OTP first", 400)
    if datetime.utcnow() > refund.otp_expires_at:
        return error_response("OTP expired — generate a new one", 400)
    if otp_in != refund.otp:
        return error_response("Incorrect OTP", 400)

    refund.status     = "refunded"
    refund.claimed_at = datetime.utcnow()
    refund.otp        = None   # clear OTP after use

    # Mark payment as refunded
    payment = Payment.query.filter_by(order_id=refund.order_id).first()
    if payment:
        payment.payment_status = "refunded"

    db.session.commit()
    return success_response(refund.to_dict(), "Refund confirmed successfully")