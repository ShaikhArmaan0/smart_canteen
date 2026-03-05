"""
app/__init__.py
"""
from flask import Flask
from .config import config_map, Config
from .extensions import db, jwt, migrate, cors


def create_app(config_name="development"):
    app = Flask(__name__)
    app.url_map.strict_slashes = False   # prevents POST→GET redirect on trailing slash
    app.config.from_object(config_map.get(config_name, Config))

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False,
    }})

    # ── JWT error handlers (default is 422, we want 401) ──────────────────
    from flask import jsonify

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        return jsonify({"success": False, "message": f"Invalid token: {reason}"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(reason):
        return jsonify({"success": False, "message": f"Authorization required: {reason}"}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_data):
        return jsonify({"success": False, "message": "Token has expired, please login again"}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_data):
        return jsonify({"success": False, "message": "Token has been revoked"}), 401

    from .models import user_model, menu_model, order_model, admin_model  # noqa
    from .models import review_model, enquiry_model  # noqa

    from .routes.auth_routes    import auth_bp
    from .routes.menu_routes    import menu_bp
    from .routes.order_routes   import order_bp
    from .routes.payment_routes import payment_bp
    from .routes.admin_routes   import admin_bp
    from .routes.wallet_routes  import wallet_bp
    from .routes.review_routes  import review_bp
    from .routes.enquiry_routes import enquiry_bp
    from .routes.refund_routes  import refund_bp

    app.register_blueprint(auth_bp,     url_prefix="/api/auth")
    app.register_blueprint(menu_bp,     url_prefix="/api/menu")
    app.register_blueprint(order_bp,    url_prefix="/api/orders")
    app.register_blueprint(payment_bp,  url_prefix="/api/payments")
    app.register_blueprint(admin_bp,    url_prefix="/api/admin")
    app.register_blueprint(wallet_bp,   url_prefix="/api/wallet")
    app.register_blueprint(review_bp,   url_prefix="/api/reviews")
    app.register_blueprint(enquiry_bp,  url_prefix="/api/enquiries")
    app.register_blueprint(refund_bp,   url_prefix="/api/refunds")

    @app.route("/api/health")
    def health():
        return {"status": "ok", "message": "Smart Canteen API is running"}, 200

    return app