"""
services/order_service.py – place_order and update_order_status logic.
"""
from datetime import datetime, timedelta
from ..extensions import db
from ..models.order_model import Order, OrderItem, OrderStatusLog, Payment
from ..models.menu_model import MenuItem
from ..utils.helper_functions import generate_token_number


def place_order(user_id, canteen_id, items_data, pay_from_wallet=False):
    """
    items_data: [{"menu_item_id": int, "quantity": int}, ...]
    pay_from_wallet: if True, deduct total from user.wallet_balance
    Returns (order, error_str)
    """
    from ..models.user_model import User

    if not items_data:
        return None, "No items provided"

    total, max_prep, order_items = 0, 0, []

    for entry in items_data:
        item = MenuItem.query.get(entry.get("menu_item_id"))
        if not item:
            return None, f"Menu item {entry.get('menu_item_id')} not found"
        if not item.is_available:
            return None, f"'{item.name}' is currently unavailable"

        qty = int(entry.get("quantity", 1))
        if qty < 1:
            return None, "Quantity must be at least 1"

        total    += float(item.price) * qty
        max_prep  = max(max_prep, item.preparation_time or 10)
        order_items.append(OrderItem(
            menu_item_id=item.id,
            quantity=qty,
            price=item.price,
            item_preparation_time=item.preparation_time,
        ))

    total = round(total, 2)

    # Wallet deduction
    if pay_from_wallet:
        user = User.query.get(user_id)
        if not user:
            return None, "User not found"
        balance = float(user.wallet_balance or 0)
        if balance < total:
            return None, f"Insufficient wallet balance. Required Rs.{total}, available Rs.{balance:.2f}"
        user.wallet_balance = balance - total

    order = Order(
        user_id=user_id,
        canteen_id=canteen_id,
        total_amount=total,
        status="confirmed" if pay_from_wallet else "pending",
        token_number=generate_token_number(),
        estimated_ready_time=datetime.utcnow() + timedelta(minutes=max_prep + 5),
    )
    db.session.add(order)
    db.session.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.session.add(oi)

    initial_status = "confirmed" if pay_from_wallet else "pending"
    db.session.add(OrderStatusLog(order_id=order.id, status=initial_status, updated_by=user_id))

    # Auto-create payment record if wallet used
    if pay_from_wallet:
        payment = Payment(
            order_id=order.id,
            user_id=user_id,
            payment_method="wallet",
            payment_status="success",
            transaction_id=f"WALLET_{order.id}_{int(datetime.utcnow().timestamp())}",
            amount=total,
            paid_at=datetime.utcnow(),
        )
        db.session.add(payment)

    db.session.commit()
    return order, None


def update_order_status(order_id, new_status, admin_id):
    valid = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]
    if new_status not in valid:
        return None, f"Invalid status. Must be one of: {valid}"

    order = Order.query.get(order_id)
    if not order:
        return None, "Order not found"

    order.status = new_status
    db.session.add(OrderStatusLog(order_id=order.id, status=new_status, updated_by=admin_id))
    db.session.commit()
    return order, None
