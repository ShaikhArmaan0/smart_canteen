-- ============================================================
-- Smart Canteen – MySQL Database Setup Script
-- Run this ONCE to create the database and user.
-- Then use: flask seed-db   to populate with demo data.
-- ============================================================

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS smart_canteen_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. (Optional) Create a dedicated DB user instead of using root
--    Uncomment and edit if you want a separate user:
-- CREATE USER IF NOT EXISTS 'canteen_user'@'localhost' IDENTIFIED BY 'canteen_pass_2024';
-- GRANT ALL PRIVILEGES ON smart_canteen_db.* TO 'canteen_user'@'localhost';
-- FLUSH PRIVILEGES;

USE smart_canteen_db;

-- ============================================================
-- Tables are created automatically by Flask-Migrate / SQLAlchemy
-- when you run:   flask seed-db
-- 
-- The tables created will be:
--   users, canteens, categories, time_slots, menu_days,
--   menu_items, menu_schedule, orders, order_items,
--   payments, order_status_logs, admin_logs
-- ============================================================

-- ============================================================
-- MANUAL TABLE DEFINITIONS (use ONLY if not using Flask-Migrate)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    password       VARCHAR(255) NOT NULL,
    role           VARCHAR(20) DEFAULT 'student',
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS canteens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    location   VARCHAR(255),
    is_active  BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    canteen_id INT NOT NULL,
    name       VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canteen_id) REFERENCES canteens(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS time_slots (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_days (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    day_name VARCHAR(20) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    canteen_id       INT NOT NULL,
    category_id      INT NOT NULL,
    name             VARCHAR(150) NOT NULL,
    description      TEXT,
    price            DECIMAL(10,2) NOT NULL,
    preparation_time INT DEFAULT 10,
    image_url        VARCHAR(255),
    is_available     BOOLEAN DEFAULT TRUE,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canteen_id) REFERENCES canteens(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_schedule (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id        INT NOT NULL,
    day_id              INT NOT NULL,
    time_slot_id        INT NOT NULL,
    stock_quantity      INT DEFAULT 50,
    low_stock_threshold INT DEFAULT 5,
    is_active           BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
    FOREIGN KEY (day_id) REFERENCES menu_days(id),
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    user_id              INT NOT NULL,
    canteen_id           INT NOT NULL,
    total_amount         DECIMAL(10,2) NOT NULL,
    status               VARCHAR(30) DEFAULT 'pending',
    token_number         INT,
    estimated_ready_time DATETIME,
    order_time           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (canteen_id) REFERENCES canteens(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    order_id              INT NOT NULL,
    menu_item_id          INT NOT NULL,
    quantity              INT NOT NULL DEFAULT 1,
    price                 DECIMAL(10,2) NOT NULL,
    item_preparation_time INT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    order_id            INT NOT NULL,
    user_id             INT NOT NULL,
    payment_method      VARCHAR(50),
    payment_status      VARCHAR(30) DEFAULT 'pending',
    transaction_id      VARCHAR(150),
    razorpay_order_id   VARCHAR(150),
    razorpay_payment_id VARCHAR(150),
    upi_id              VARCHAR(100),
    amount              DECIMAL(10,2) NOT NULL,
    paid_at             DATETIME,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_status_logs (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT NOT NULL,
    status     VARCHAR(30) NOT NULL,
    updated_by INT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_logs (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    admin_id   INT NOT NULL,
    action     VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB;
