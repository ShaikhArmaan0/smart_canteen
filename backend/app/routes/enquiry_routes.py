"""
routes/enquiry_routes.py
  POST /api/enquiries/      – submit contact form (public)
  GET  /api/enquiries/      – list all (admin only)
  PUT  /api/enquiries/<id>  – mark as read (admin only)
"""
from flask import Blueprint
from ..extensions import db
from ..models.enquiry_model import Enquiry
from ..utils.helper_functions import success_response, error_response, admin_required, get_request_data

enquiry_bp = Blueprint("enquiries", __name__)


@enquiry_bp.route("", methods=["POST"])
@enquiry_bp.route("/", methods=["POST"])
def submit_enquiry():
    data    = get_request_data()
    name    = (data.get("name") or "").strip()
    email   = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()
    if not name or not email or not message:
        return error_response("Name, email and message are required", 422)
    enquiry = Enquiry(
        name=name, email=email,
        phone=(data.get("phone") or "").strip() or None,
        type=data.get("type", "general"),
        message=message,
    )
    db.session.add(enquiry)
    db.session.commit()
    return success_response(enquiry.to_dict(), "Message received! We'll get back to you soon.", 201)


@enquiry_bp.route("", methods=["GET"])
@enquiry_bp.route("/", methods=["GET"])
@admin_required
def list_enquiries():
    enquiries = Enquiry.query.order_by(Enquiry.created_at.desc()).all()
    unread    = Enquiry.query.filter_by(is_read=False).count()
    return success_response({"enquiries": [e.to_dict() for e in enquiries], "unread": unread})


@enquiry_bp.route("/<int:eid>", methods=["PUT"])
@admin_required
def mark_read(eid):
    e = Enquiry.query.get(eid)
    if not e:
        return error_response("Not found", 404)
    e.is_read = True
    db.session.commit()
    return success_response(e.to_dict(), "Marked as read")