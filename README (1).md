# 🍽️ Smart Canteen — Setup & Run Guide

A full-stack college canteen management system with student ordering and admin dashboard.

---

## 📁 Project Structure

```
smart_canteen_v2.zip
├── smart_canteen_backend/      ← Flask + MySQL API
│   ├── app/
│   │   ├── models/             ← Database models
│   │   ├── routes/             ← API endpoints
│   │   ├── services/           ← Business logic
│   │   └── utils/
│   ├── .env                    ← Your config (edit this!)
│   ├── requirements.txt
│   ├── run.py                  ← Entry point + seed command
│   └── setup_db.sql            ← Database schema (optional)
└── smart_canteen_frontend/     ← HTML + CSS + JS (no build needed)
    ├── index.html              ← Home / Menu
    ├── login.html              ← Login & Register
    ├── cart.html               ← Cart & Checkout
    ├── orders.html             ← My Orders
    ├── transactions.html       ← Order History
    ├── profile.html            ← User Profile
    ├── admin.html              ← Admin Panel
    ├── admin-profile.html      ← Admin Profile
    ├── reviews.html            ← Reviews & Feedback
    ├── contact.html            ← Contact / Bulk Orders
    ├── privacy.html            ← Privacy Policy
    ├── terms.html              ← Terms & Conditions
    ├── css/style.css
    └── js/main.js
```

---

## ✅ Prerequisites

Make sure these are installed on your system:

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.9+ | `python --version` |
| pip | latest | `pip --version` |
| MySQL | 8.0+ | `mysql --version` |
| A browser | Chrome / Edge / Firefox | — |

> **No Node.js needed.** The frontend is plain HTML/CSS/JS.

---

## 🚀 QUICK SETUP (5 steps)

### Step 1 — Extract the ZIP

Unzip `smart_canteen_v2.zip` anywhere you like:

```
smart_canteen_v2/
├── smart_canteen_backend/
└── smart_canteen_frontend/
```

---

### Step 2 — Create the MySQL Database

Open MySQL (via terminal or MySQL Workbench) and run:

```sql
CREATE DATABASE smart_canteen_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

That's it — tables are created automatically in the next step.

---

### Step 3 — Configure the Backend

Open `smart_canteen_backend/.env` in any text editor and update **only** these two lines:

```env
DB_USER=root                    ← your MySQL username
DB_PASSWORD=your_password_here  ← your MySQL password
```

Everything else can stay as-is for local development.

**Full .env for reference:**
```env
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=smart-canteen-super-secret-key-2024

DB_HOST=localhost
DB_PORT=3306
DB_NAME=smart_canteen_db
DB_USER=root
DB_PASSWORD=your_password_here     ← CHANGE THIS

JWT_SECRET_KEY=jwt-smart-canteen-secret-2024
JWT_ACCESS_TOKEN_EXPIRES=86400

RAZORPAY_KEY_ID=rzp_test_YourKeyHere
RAZORPAY_KEY_SECRET=YourSecretHere
```

---

### Step 4 — Install & Seed the Backend

Open a terminal and run these commands:

```bash
# Go into the backend folder
cd smart_canteen_backend

# Install Python packages
pip install -r requirements.txt

# Create all database tables + seed demo data
python -m flask seed-db
```

You should see:
```
📦  Creating tables …
  ✅  Users seeded
  ✅  Canteens seeded
  ✅  Categories seeded
  ✅  Menu items seeded (18 items)
  ✅  Sample orders seeded
  ✅  Sample reviews seeded

🎉  Seeding complete!
  Admin  → admin@canteen.com  / admin123
  Student→ rahul@student.com  / student123
```

---

### Step 5 — Start Both Servers

**Terminal 1 — Start the backend API:**
```bash
cd smart_canteen_backend
python run.py
```
Backend runs at: `http://localhost:5000`

**Terminal 2 — Serve the frontend:**
```bash
cd smart_canteen_frontend
python -m http.server 8080
```
Frontend runs at: `http://localhost:8080`

> **Open your browser at:** `http://localhost:8080`

---

## 🔑 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@canteen.com | admin123 |
| **Student** | rahul@student.com | student123 |
| **Student** | priya@student.com | student123 |
| **Student** | amit@student.com | student123 |

---

## 📱 Pages & What They Do

### Student Pages
| Page | URL | Description |
|------|-----|-------------|
| Home / Menu | `/index.html` | Browse food, filter by category, search, add to cart |
| Login | `/login.html` | Sign in or register. Has "Forgot Password" flow |
| Cart | `/cart.html` | Review items, choose UPI or Cash, place order |
| My Orders | `/orders.html` | Track live orders with status progress bar |
| Order History | `/transactions.html` | All past orders with receipt download |
| Profile | `/profile.html` | Edit name/email/phone/password, dark mode toggle |
| Reviews | `/reviews.html` | Read reviews & submit your own |
| Contact | `/contact.html` | Bulk orders & support contact form |
| Privacy Policy | `/privacy.html` | Privacy information |
| Terms | `/terms.html` | Terms and conditions |

### Admin Pages (login required as admin)
| Page | URL | Description |
|------|-----|-------------|
| Admin Panel | `/admin.html` | Dashboard, orders, menu management, students list |
| Admin Profile | `/admin-profile.html` | Edit admin name/email/phone/password |

---

## 🔌 API Endpoints Reference

Base URL: `http://localhost:5000/api`

### Auth
```
POST /auth/register          Create student account
POST /auth/login             Login (returns JWT token)
GET  /auth/me                Get current user info
PUT  /auth/profile           Update profile / change password
POST /auth/forgot-password   Request password reset token
POST /auth/reset-password    Reset password with token
```

### Menu
```
GET  /menu/items             All menu items (filter: ?canteen_id=1&available=1)
GET  /menu/categories        All categories
POST /menu/items             Add item (admin only)
PUT  /menu/items/<id>        Edit item (admin only)
DELETE /menu/items/<id>      Delete item (admin only)
```

### Orders
```
POST /orders/                Place new order
GET  /orders/                My order history (student)
GET  /orders/<id>            Single order details
GET  /orders/all             All orders (admin only)
PUT  /orders/<id>/status     Update order status (admin only)
```

### Payments
```
POST /payments/mock-success  Confirm payment (dev mode)
GET  /payments/order/<id>    Payment info for an order
```

### Admin
```
GET  /admin/dashboard        Stats: today's orders, revenue, pending count
GET  /admin/users            All students list
GET  /admin/sales-report     Sales data by date range
```

### Reviews
```
GET  /reviews/               All reviews
POST /reviews/               Submit a review (auth required)
```

---

## ⚠️ Troubleshooting

### "Cannot connect to server" on the frontend
- Make sure the backend is running: `python run.py`
- Check it's on port 5000: visit `http://localhost:5000/api/menu/items`

### MySQL connection error on `flask seed-db`
- Check your DB_USER and DB_PASSWORD in `.env`
- Make sure MySQL is running: `mysql -u root -p`
- Make sure the database exists: `CREATE DATABASE smart_canteen_db;`

### `ModuleNotFoundError` when running Flask
```bash
pip install -r requirements.txt
```
If on Linux/Mac with multiple Python versions:
```bash
pip3 install -r requirements.txt
python3 run.py
```

### Port 8080 already in use
Use a different port:
```bash
python -m http.server 3000
```
Then open `http://localhost:3000`

### Frontend shows "Server unavailable"
The frontend expects the API at `http://localhost:5000`. If your backend is on a different host/port, edit the top of `js/main.js`:
```js
const API = 'http://localhost:5000/api';  ← change this
```

### Tables already exist / seed runs again
The seed script checks before inserting — safe to run multiple times. To reset completely:
```sql
DROP DATABASE smart_canteen_db;
CREATE DATABASE smart_canteen_db;
```
Then run `flask seed-db` again.

---

## 🗂️ Seeded Demo Data

After `flask seed-db`, your database will have:

- **5 users** (1 admin + 4 students)
- **2 canteens** (Main Canteen, Mini Cafeteria)
- **5 categories** (Veg, Non-Veg, Snacks, Drinks, Desserts)
- **18 menu items** with real food photos from Unsplash
- **5 sample orders** in various statuses (pending, preparing, ready, completed)
- **4 sample reviews**

---

## 🔒 Security Notes (for production use)

1. Change `SECRET_KEY` and `JWT_SECRET_KEY` in `.env` to long random strings
2. Set `FLASK_ENV=production` 
3. Use a proper WSGI server like **gunicorn**: `gunicorn run:app`
4. Use **nginx** to serve the frontend files instead of `python -m http.server`
5. Enable HTTPS with an SSL certificate
6. Use environment variables instead of `.env` file on the server

---

## 📞 Support

- Contact page: `http://localhost:8080/contact.html`
- Admin panel: `http://localhost:8080/admin.html` (login as admin first)
