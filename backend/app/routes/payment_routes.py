"""
routes/payment_routes.py
  POST /api/payments/initiate         – create Razorpay order
  POST /api/payments/verify           – verify payment signature
  POST /api/payments/mock-success     – dev: instant payment success
  GET  /api/payments/order/<order_id> – payment info for an order
"""
from datetime import datetime
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.order_model import Order, Payment
from ..models.user_model import User
from ..utils.helper_functions import success_response, error_response, get_request_data, get_current_user_id

payment_bp = Blueprint("payments", __name__)


def _razorpay_client():
    """Return Razorpay client or None if package not installed."""
    try:
        import razorpay
        return razorpay.Client(
            auth=(current_app.config["RAZORPAY_KEY_ID"],
                  current_app.config["RAZORPAY_KEY_SECRET"])
        )
    except ImportError:
        return None


@payment_bp.route("/initiate", methods=["POST"])
@jwt_required()
def initiate_payment():
    """
    Body: { "order_id": int, "payment_method": "razorpay"|"upi"|"cash" }
    Returns Razorpay order details for frontend checkout.
    """
    user_id = get_current_user_id()
    data    = get_request_data()
    order_id = data.get("order_id")
    method   = data.get("payment_method", "razorpay")

    order = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", 404)
    if order.user_id != user_id:
        return error_response("Access denied", 403)
    if order.payment and order.payment.payment_status == "success":
        return error_response("Order already paid", 400)

    payment = Payment(
        order_id=order_id, user_id=user_id,
        payment_method=method, payment_status="pending",
        amount=order.total_amount,
    )
    db.session.add(payment)

    rz_data = None
    if method == "razorpay":
        client = _razorpay_client()
        amount_paise = int(float(order.total_amount) * 100)
        if client:
            try:
                rz_order = client.order.create({
                    "amount": amount_paise, "currency": "INR",
                    "receipt": f"order_{order_id}",
                    "notes": {"order_id": order_id},
                })
                payment.razorpay_order_id = rz_order["id"]
                rz_data = {
                    "razorpay_order_id": rz_order["id"],
                    "razorpay_key":      current_app.config["RAZORPAY_KEY_ID"],
                    "amount":            rz_order["amount"],
                    "currency":          "INR",
                }
            except Exception as e:
                # Razorpay not connected – simulation mode
                mock_id = f"order_sim_{order_id}"
                payment.razorpay_order_id = mock_id
                rz_data = {
                    "razorpay_order_id": mock_id,
                    "razorpay_key":      current_app.config["RAZORPAY_KEY_ID"],
                    "amount":            amount_paise,
                    "currency":          "INR",
                    "simulation":        True,
                }
        else:
            mock_id = f"order_sim_{order_id}"
            payment.razorpay_order_id = mock_id
            rz_data = {
                "razorpay_order_id": mock_id,
                "razorpay_key":      current_app.config["RAZORPAY_KEY_ID"],
                "amount":            amount_paise,
                "currency":          "INR",
                "simulation":        True,
            }

    db.session.commit()
    resp = {
        "payment_id": payment.id, "order_id": order_id,
        "amount": float(order.total_amount), "payment_method": method,
        "payment_status": "pending",
    }
    if rz_data:
        resp["razorpay"] = rz_data
    return success_response(resp, "Payment initiated", 201)


@payment_bp.route("/verify", methods=["POST"])
@jwt_required()
def verify_payment():
    """
    Body: { "order_id", "razorpay_payment_id", "razorpay_order_id", "razorpay_signature" }
    """
    user_id = get_current_user_id()
    data    = get_request_data()
    order_id   = data.get("order_id")
    rz_pay_id  = data.get("razorpay_payment_id")
    rz_ord_id  = data.get("razorpay_order_id")
    rz_sig     = data.get("razorpay_signature")

    payment = Payment.query.filter_by(order_id=order_id, user_id=user_id).first()
    if not payment:
        return error_response("Payment record not found", 404)

    client = _razorpay_client()
    if client and rz_sig:
        try:
            client.utility.verify_payment_signature({
                "razorpay_order_id":   rz_ord_id,
                "razorpay_payment_id": rz_pay_id,
                "razorpay_signature":  rz_sig,
            })
            verified = True
        except Exception:
            return error_response("Signature verification failed", 400)
    else:
        # Simulation: any non-empty payment ID = success
        verified = bool(rz_pay_id)

    if verified:
        payment.payment_status      = "success"
        payment.razorpay_payment_id = rz_pay_id
        payment.transaction_id      = rz_pay_id
        payment.paid_at             = datetime.utcnow()
        order = Order.query.get(order_id)
        if order:
            order.status = "confirmed"
        db.session.commit()
        return success_response(payment.to_dict(), "Payment successful")

    payment.payment_status = "failed"
    db.session.commit()
    return error_response("Payment failed", 400)


@payment_bp.route("/mock-success", methods=["POST"])
@jwt_required()
def mock_payment_success():
    """
    DEV ONLY – instantly marks order as paid.
    Body: { "order_id": int, "payment_method": "upi"|"cash"|"mock" }
    """
    user_id  = get_current_user_id()
    data     = get_request_data()
    order_id = data.get("order_id")
    method   = data.get("payment_method", "upi")

    order = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", 404)
    if order.user_id != user_id:
        return error_response("Access denied", 403)

    payment = Payment.query.filter_by(order_id=order_id).first()
    if not payment:
        payment = Payment(order_id=order_id, user_id=user_id,
                          payment_method=method, amount=order.total_amount)
        db.session.add(payment)
    else:
        payment.payment_method = method

    payment.payment_status = "success"
    payment.transaction_id = f"TXN_{order_id}_{int(datetime.utcnow().timestamp())}"
    payment.paid_at        = datetime.utcnow()
    order.status           = "confirmed"
    db.session.commit()
    return success_response(payment.to_dict(), "Payment successful")


@payment_bp.route("/order/<int:order_id>", methods=["GET"])
@jwt_required()
def get_payment_by_order(order_id):
    user_id = get_current_user_id()
    user    = User.query.get(user_id)
    payment = Payment.query.filter_by(order_id=order_id).first()
    if not payment:
        return error_response("No payment found for this order", 404)
    if user.role != "admin" and payment.user_id != user_id:
        return error_response("Access denied", 403)
    return success_response(payment.to_dict())