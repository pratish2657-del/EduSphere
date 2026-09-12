ALTER TABLE marketplace_orders
    ADD COLUMN platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00 AFTER total_amount,
    ADD COLUMN platform_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER platform_fee_percent,
    ADD COLUMN seller_net_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER platform_fee_amount;

CREATE TABLE IF NOT EXISTS marketplace_seller_payout_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    seller_id INT NOT NULL,
    gross_amount DECIMAL(10,2) NOT NULL,
    platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    platform_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    seller_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status ENUM('PENDING','READY','TRANSFER_INITIATED','SETTLED','FAILED','ON_HOLD','REVERSED') NOT NULL DEFAULT 'PENDING',
    razorpay_linked_account_id VARCHAR(255) NULL,
    razorpay_transfer_id VARCHAR(255) NULL,
    transfer_status VARCHAR(50) NULL,
    settlement_status VARCHAR(50) NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    settled_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_marketplace_payout_order_seller (order_id, seller_id),
    INDEX idx_marketplace_payout_seller (seller_id),
    INDEX idx_marketplace_payout_status (status),
    INDEX idx_marketplace_payout_transfer (razorpay_transfer_id)
);
