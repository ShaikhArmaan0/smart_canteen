"""
run.py – Entry point + seed command
"""
import os
from app import create_app
from app.extensions import db

app = create_app(os.getenv("FLASK_ENV", "development"))

# Auto-create any new tables on startup (safe - won't affect existing tables)
with app.app_context():
    db.create_all()
    # Ensure at least one TimeSlot exists (required for schedule routes)
    from datetime import time as _time
    from app.models.menu_model import TimeSlot as _TS
    if not _TS.query.first():
        db.session.add(_TS(name="All Day", start_time=_time(8, 0), end_time=_time(21, 0)))
        db.session.commit()


@app.cli.command("seed-db")
def seed_db():
    """Create all tables and populate with demo data."""
    from datetime import datetime, time, timedelta
    from app.models.user_model  import User
    from app.models.menu_model  import (Canteen, Category, TimeSlot,
                                         MenuDay, MenuItem, MenuSchedule)
    from app.models.order_model import Order, OrderItem, Payment, OrderStatusLog
    from app.models.review_model import Review

    print("\n📦  Creating tables …")
    db.create_all()

    # ── Users ──────────────────────────────────────────────────────────────
    if not User.query.first():
        users_data = [
            ("Admin User",   "admin@canteen.com", "admin123",   "admin",   "+91-9999000001", 0),
            ("Rahul Sharma", "rahul@student.com", "student123", "student", "+91-9876543210", 500),
            ("Priya Patel",  "priya@student.com", "student123", "student", "+91-9876543211", 350),
            ("Amit Singh",   "amit@student.com",  "student123", "student", "+91-9876543212", 200),
            ("Sneha Joshi",  "sneha@student.com",  "student123", "student", "+91-9876543213", 750),
        ]
        for name, email, pw, role, phone, wallet in users_data:
            u = User(name=name, email=email, role=role, phone=phone, wallet_balance=wallet)
            u.set_password(pw)
            db.session.add(u)
        db.session.commit()
        print("  ✅  Users seeded")

    if not Canteen.query.first():
        db.session.add_all([
            Canteen(name="Main Canteen",   location="Block A, Ground Floor"),
            Canteen(name="Mini Cafeteria", location="Library Building, 1st Floor"),
        ])
        db.session.commit()
        print("  ✅  Canteens seeded")

    if not TimeSlot.query.first():
        db.session.add_all([
            TimeSlot(name="Breakfast", start_time=time(8, 0),  end_time=time(10, 30)),
            TimeSlot(name="Lunch",     start_time=time(12, 0), end_time=time(14, 30)),
            TimeSlot(name="Snacks",    start_time=time(16, 0), end_time=time(17, 30)),
            TimeSlot(name="Dinner",    start_time=time(19, 0), end_time=time(21, 0)),
        ])
        db.session.commit()
        print("  ✅  Time slots seeded")

    if not MenuDay.query.first():
        for d in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]:
            db.session.add(MenuDay(day_name=d))
        db.session.commit()
        print("  ✅  Menu days seeded")

    if not Category.query.first():
        c = Canteen.query.first()
        for cat_name in ["Veg", "Non-Veg", "Snacks", "Drinks", "Desserts"]:
            db.session.add(Category(canteen_id=c.id, name=cat_name))
        db.session.commit()
        print("  ✅  Categories seeded")

    if not MenuItem.query.first():
        canteen = Canteen.query.first()
        cats    = {c.name: c.id for c in Category.query.all()}

        items = [
            ("Paneer Butter Masala","Rich creamy paneer curry with tomato gravy",120,15,"Veg",
             "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400"),
            ("Dal Tadka","Yellow lentils tempered with cumin and spices",80,12,"Veg",
             "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400"),
            ("Veg Biryani","Fragrant basmati rice with seasonal vegetables",100,20,"Veg",
             "https://images.unsplash.com/photo-1563379091339-03246963d96c?w=400"),
            ("Aloo Paratha","Whole wheat flatbread stuffed with spiced potato",60,10,"Veg",
             "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400"),
            ("Rajma Chawal","Kidney beans curry served with steamed rice",90,15,"Veg",
             "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400"),
            ("Chicken Curry","Spicy chicken in rich tomato-onion gravy",150,20,"Non-Veg",
             "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400"),
            ("Egg Bhurji","Scrambled eggs with onion, tomato and spices",70,8,"Non-Veg",
             "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400"),
            ("Chicken Biryani","Aromatic basmati with tender chicken pieces",160,25,"Non-Veg",
             "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400"),
            ("Samosa (2 pcs)","Crispy fried pastry with spiced potato filling",30,5,"Snacks",
             "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400"),
            ("Vada Pav","Mumbai street-style spicy potato burger",25,5,"Snacks",
             "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400"),
            ("Masala Maggi","Spicy instant noodles with vegetables",40,8,"Snacks",
             "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400"),
            ("Bread Omelette","Egg omelette with toasted bread slices",45,7,"Snacks",
             "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400"),
            ("Cold Coffee","Chilled blended coffee with milk and sugar",60,5,"Drinks",
             "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400"),
            ("Fresh Lime Soda","Refreshing lime juice with chilled soda",40,3,"Drinks",
             "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400"),
            ("Mango Lassi","Thick chilled yogurt with fresh mango pulp",55,4,"Drinks",
             "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400"),
            ("Masala Chai","Traditional spiced milk tea",20,5,"Drinks",
             "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400"),
            ("Gulab Jamun (2 pcs)","Soft milk-solid dumplings soaked in rose syrup",50,5,"Desserts",
             "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400"),
            ("Kheer","Creamy rice pudding with cardamom and nuts",45,0,"Desserts",
             "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400"),
        ]
        for name, desc, price, prep, cat_name, img in items:
            db.session.add(MenuItem(
                canteen_id=canteen.id, category_id=cats[cat_name],
                name=name, description=desc, price=price,
                preparation_time=prep, image_url=img, is_available=True,
            ))
        db.session.commit()
        print("  ✅  Menu items seeded (18 items)")

    if not Order.query.first():
        student = User.query.filter_by(role="student").first()
        canteen = Canteen.query.first()
        items   = MenuItem.query.limit(6).all()

        sample_orders = [
            ("completed", 1, -3), ("completed", 2, -2),
            ("preparing", 5, -0.5), ("ready", 3, -0.3),
            ("pending", 9, -0.1),
        ]
        for status, token, hours_ago in sample_orders:
            order_items = items[:2] if status == "completed" else items[2:4]
            total = sum(float(i.price) for i in order_items)
            order = Order(
                user_id=student.id, canteen_id=canteen.id,
                total_amount=total, status=status, token_number=token,
                order_time=datetime.utcnow() + timedelta(hours=hours_ago),
            )
            db.session.add(order)
            db.session.flush()
            for it in order_items:
                db.session.add(OrderItem(
                    order_id=order.id, menu_item_id=it.id,
                    quantity=1, price=it.price,
                    item_preparation_time=it.preparation_time,
                ))
            db.session.add(OrderStatusLog(order_id=order.id, status=status, updated_by=student.id))
            if status == "completed":
                db.session.add(Payment(
                    order_id=order.id, user_id=student.id,
                    payment_method="upi", payment_status="success",
                    transaction_id=f"TXN_DEMO_{order.id:04d}", amount=total,
                    paid_at=datetime.utcnow() + timedelta(hours=hours_ago),
                ))
        db.session.commit()
        print("  ✅  Sample orders seeded")

    if not Review.query.first():
        student = User.query.filter_by(role="student").first()
        items = MenuItem.query.limit(3).all()
        for i, item in enumerate(items):
            db.session.add(Review(
                user_id=student.id, item_id=item.id,
                rating=4+i%2, comment=f"Great {item.name}! Loved the taste.",
                review_type="item",
            ))
        db.session.add(Review(
            user_id=student.id, rating=5,
            comment="Excellent canteen service! Fast delivery and good food quality.",
            review_type="general",
        ))
        db.session.commit()
        print("  ✅  Sample reviews seeded")

    print("\n🎉  Seeding complete!")
    print("  Admin  → admin@canteen.com  / admin123")
    print("  Student→ rahul@student.com  / student123\n")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)