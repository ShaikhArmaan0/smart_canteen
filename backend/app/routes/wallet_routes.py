"""
routes/wallet_routes.py
  GET  /api/wallet/balance        – get my wallet balance
  POST /api/wallet/add            – add balance (simulated)
  GET  /api/wallet/history        – payment history for student
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.user_model import User
from ..models.order_model import Payment
from ..utils.helper_functions import success_response, error_response, get_request_data, get_current_user_id

wallet_bp = Blueprint("wallet", __name__)


@wallet_bp.route("/balance", methods=["GET"])
@jwt_required()
def get_balance():
    user = User.query.get(get_current_user_id())
    if not user:
        return error_response("User not found", 404)
    return success_response({
        "wallet_balance": float(user.wallet_balance or 0),
        "user_id": user.id,
        "name": user.name,
    })


@wallet_bp.route("/add", methods=["POST"])
@jwt_required()
def add_balance():
    user = User.query.get(get_current_user_id())
    if not user:
        return error_response("User not found", 404)

    data = get_request_data()
    amount = data.get("amount", 0)

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return error_response("Invalid amount", 422)

    if amount <= 0:
        return error_response("Amount must be greater than 0", 422)
    if amount > 10000:
        return error_response("Maximum top-up is ₹10,000 at once", 422)

    user.wallet_balance = float(user.wallet_balance or 0) + amount
    db.session.commit()

    return success_response({
        "wallet_balance": float(user.wallet_balance),
        "added": amount,
    }, f"₹{amount:.0f} added to wallet successfully")


@wallet_bp.route("/history", methods=["GET"])
@jwt_required()
def wallet_history():
    user_id = get_current_user_id()
    payments = (Payment.query
                .filter_by(user_id=user_id)
                .order_by(Payment.created_at.desc())
                .all())
    return success_response([p.to_dict() for p in payments])