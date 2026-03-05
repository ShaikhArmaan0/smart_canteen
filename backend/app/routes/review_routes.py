"""
routes/review_routes.py
  GET  /api/reviews/           – all reviews (public)
  GET  /api/reviews/item/<id>  – reviews for a menu item
  POST /api/reviews/           – post a review (student)
  GET  /api/reviews/my         – my reviews
  DELETE /api/reviews/<id>     – delete own review
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from ..extensions import db
from ..models.review_model import Review
from ..utils.helper_functions import success_response, error_response, get_request_data, get_current_user_id

review_bp = Blueprint("reviews", __name__)


@review_bp.route("/", methods=["GET"])
def get_reviews():
    reviews = Review.query.order_by(Review.created_at.desc()).limit(50).all()
    return success_response([r.to_dict() for r in reviews])


@review_bp.route("/item/<int:item_id>", methods=["GET"])
def get_item_reviews(item_id):
    reviews = Review.query.filter_by(item_id=item_id).order_by(Review.created_at.desc()).all()
    return success_response([r.to_dict() for r in reviews])


@review_bp.route("/", methods=["POST"])
@jwt_required()
def post_review():
    user_id = get_current_user_id()
    data = get_request_data()
    rating = data.get("rating")
    if rating is None or not (1 <= int(rating) <= 5):
        return error_response("Rating must be 1–5", 422)

    review = Review(
        user_id=user_id,
        item_id=data.get("item_id"),
        order_id=data.get("order_id"),
        rating=int(rating),
        comment=data.get("comment", "").strip(),
        review_type=data.get("review_type", "general"),
    )
    db.session.add(review)
    db.session.commit()
    return success_response(review.to_dict(), "Review submitted", 201)


@review_bp.route("/my", methods=["GET"])
@jwt_required()
def my_reviews():
    user_id = get_current_user_id()
    reviews = Review.query.filter_by(user_id=user_id).order_by(Review.created_at.desc()).all()
    return success_response([r.to_dict() for r in reviews])


@review_bp.route("/<int:review_id>", methods=["DELETE"])
@jwt_required()
def delete_review(review_id):
    user_id = get_current_user_id()
    review = Review.query.get(review_id)
    if not review:
        return error_response("Review not found", 404)
    if review.user_id != user_id:
        return error_response("Access denied", 403)
    db.session.delete(review)
    db.session.commit()
    return success_response(None, "Review deleted")