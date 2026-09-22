-- ============================================================
-- EDUSPHERE MARKETPLACE
-- CLEAN INITIAL DATABASE
--
-- PAYMENT:
--   Direct Google Pay / UPI
--   UTR submission
--   Manual admin verification
--
-- NO:
--   Cashfree
--   Razorpay
--   Payment Gateway
--   Gateway Webhook
--   Seller Payout
--   Split Payment
--   Gateway Refund
-- ============================================================


-- ============================================================
-- 1. MARKETPLACE PRODUCTS
-- ============================================================

CREATE TABLE marketplace_products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    seller_id BIGINT UNSIGNED NOT NULL,
    institution_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT NULL,

    category VARCHAR(100) NULL,

    product_type ENUM(
        'PHYSICAL',
        'DIGITAL'
    ) NOT NULL,

    condition_type ENUM(
        'NEW',
        'USED',
        'DIGITAL'
    ) NOT NULL DEFAULT 'NEW',

    price DECIMAL(12,2) NOT NULL,

    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,

    preview_image_path VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_marketplace_products_seller (
        seller_id
    ),

    INDEX idx_marketplace_products_institution (
        institution_id
    ),

    INDEX idx_marketplace_products_category (
        category
    ),

    INDEX idx_marketplace_products_type (
        product_type
    ),

    INDEX idx_marketplace_products_active (
        is_active
    ),

    CONSTRAINT chk_marketplace_product_price
        CHECK (price >= 0),

    CONSTRAINT chk_marketplace_product_quantity
        CHECK (quantity >= 0),

    CONSTRAINT chk_marketplace_product_reserved
        CHECK (
            reserved_quantity >= 0
            AND reserved_quantity <= quantity
        )
);


-- ============================================================
-- 2. MARKETPLACE ATTACHMENTS
-- ============================================================

CREATE TABLE marketplace_attachments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    product_id BIGINT UNSIGNED NOT NULL,

    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(150) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,

    storage_path VARCHAR(1000) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_marketplace_attachments_product (
        product_id
    ),

    CONSTRAINT fk_marketplace_attachment_product
        FOREIGN KEY (product_id)
        REFERENCES marketplace_products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- ============================================================
-- 3. CARTS
-- ============================================================

CREATE TABLE marketplace_carts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_marketplace_cart_user (
        user_id
    ),

    INDEX idx_marketplace_carts_user (
        user_id
    )
);


-- ============================================================
-- 4. CART ITEMS
-- ============================================================

CREATE TABLE marketplace_cart_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    cart_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,

    quantity INT NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_marketplace_cart_product (
        cart_id,
        product_id
    ),

    INDEX idx_marketplace_cart_items_product (
        product_id
    ),

    CONSTRAINT fk_marketplace_cart_item_cart
        FOREIGN KEY (cart_id)
        REFERENCES marketplace_carts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_marketplace_cart_item_product
        FOREIGN KEY (product_id)
        REFERENCES marketplace_products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_marketplace_cart_quantity
        CHECK (quantity > 0)
);


-- ============================================================
-- 5. ORDERS
-- ============================================================

CREATE TABLE marketplace_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    buyer_id BIGINT UNSIGNED NOT NULL,
    institution_id BIGINT UNSIGNED NOT NULL,

    -- Server-calculated pricing

    subtotal_amount DECIMAL(12,2) NOT NULL,

    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,

    tax_amount DECIMAL(12,2) NOT NULL,

    total_amount DECIMAL(12,2) NOT NULL,

    shipping_address TEXT NULL,

    status ENUM(
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'COMPLETED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'PENDING',

    expires_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_marketplace_orders_buyer (
        buyer_id
    ),

    INDEX idx_marketplace_orders_institution (
        institution_id
    ),

    INDEX idx_marketplace_orders_status (
        status
    ),

    INDEX idx_marketplace_orders_created (
        created_at
    ),

    CONSTRAINT chk_marketplace_order_subtotal
        CHECK (subtotal_amount >= 0),

    CONSTRAINT chk_marketplace_order_tax
        CHECK (tax_percent >= 0),

    CONSTRAINT chk_marketplace_order_tax_amount
        CHECK (tax_amount >= 0),

    CONSTRAINT chk_marketplace_order_total
        CHECK (total_amount >= 0)
);


-- ============================================================
-- 6. ORDER ITEMS
-- ============================================================

CREATE TABLE marketplace_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    seller_id BIGINT UNSIGNED NOT NULL,

    -- Snapshot of product information
    -- at the time of purchase

    product_name VARCHAR(255) NOT NULL,

    unit_price DECIMAL(12,2) NOT NULL,

    quantity INT NOT NULL,

    subtotal DECIMAL(12,2) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_marketplace_order_items_order (
        order_id
    ),

    INDEX idx_marketplace_order_items_product (
        product_id
    ),

    INDEX idx_marketplace_order_items_seller (
        seller_id
    ),

    CONSTRAINT fk_marketplace_order_item_order
        FOREIGN KEY (order_id)
        REFERENCES marketplace_orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_marketplace_order_item_product
        FOREIGN KEY (product_id)
        REFERENCES marketplace_products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_marketplace_order_item_price
        CHECK (unit_price >= 0),

    CONSTRAINT chk_marketplace_order_item_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_marketplace_order_item_subtotal
        CHECK (subtotal >= 0)
);


-- ============================================================
-- 7. PAYMENTS
--
-- DIRECT GOOGLE PAY / UPI ONLY
-- ============================================================

CREATE TABLE marketplace_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    order_id BIGINT UNSIGNED NOT NULL,

    buyer_id BIGINT UNSIGNED NOT NULL,

    payment_method ENUM(
        'UPI'
    ) NOT NULL DEFAULT 'UPI',

    status ENUM(
        'PENDING',
        'PAID',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    amount DECIMAL(12,2) NOT NULL,

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    -- Buyer submitted payment information

    utr_number VARCHAR(100) NULL,

    payer_upi_id VARCHAR(255) NULL,

    payer_phone VARCHAR(30) NULL,

    submitted_at DATETIME NULL,

    -- Manual admin verification

    verified_at DATETIME NULL,

    verified_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_marketplace_payment_order (
        order_id
    ),

    INDEX idx_marketplace_payments_buyer (
        buyer_id
    ),

    INDEX idx_marketplace_payments_status (
        status
    ),

    INDEX idx_marketplace_payments_utr (
        utr_number
    ),

    INDEX idx_marketplace_payments_verified_by (
        verified_by
    ),

    CONSTRAINT fk_marketplace_payment_order
        FOREIGN KEY (order_id)
        REFERENCES marketplace_orders(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_marketplace_payment_amount
        CHECK (amount > 0)
);


-- ============================================================
-- 8. SELLERS
--
-- Simple seller information.
--
-- NO:
--   Payment provider onboarding
--   Vendor ID
--   Payout account
--   Split payment
-- ============================================================

CREATE TABLE marketplace_sellers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(255) NOT NULL,

    phone VARCHAR(30) NOT NULL,

    upi_id VARCHAR(255) NOT NULL,

    status ENUM(
        'ACTIVE',
        'INACTIVE'
    ) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_marketplace_seller_user (
        user_id
    ),

    INDEX idx_marketplace_sellers_upi (
        upi_id
    ),

    INDEX idx_marketplace_sellers_status (
        status
    )
);


-- ============================================================
-- 9. RECEIPTS
--
-- Created after payment is manually verified.
-- ============================================================

CREATE TABLE marketplace_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    order_id BIGINT UNSIGNED NOT NULL,

    payment_id BIGINT UNSIGNED NOT NULL,

    receipt_number VARCHAR(100) NOT NULL,

    amount DECIMAL(12,2) NOT NULL,

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_marketplace_receipt_order (
        order_id
    ),

    UNIQUE KEY uq_marketplace_receipt_payment (
        payment_id
    ),

    UNIQUE KEY uq_marketplace_receipt_number (
        receipt_number
    ),

    CONSTRAINT fk_marketplace_receipt_order
        FOREIGN KEY (order_id)
        REFERENCES marketplace_orders(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_marketplace_receipt_payment
        FOREIGN KEY (payment_id)
        REFERENCES marketplace_payments(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_marketplace_receipt_amount
        CHECK (amount > 0)
);


-- ============================================================
-- VERIFY MARKETPLACE TABLES
-- ============================================================

SHOW TABLES LIKE 'marketplace_%';