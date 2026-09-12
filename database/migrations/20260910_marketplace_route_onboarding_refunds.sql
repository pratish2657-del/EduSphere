-- EduSphere marketplace: Razorpay Route onboarding + payout operations + refunds/reversals
-- Run after the existing marketplace seller payout / fee migrations.

ALTER TABLE marketplace_seller_payouts
    ADD COLUMN razorpay_stakeholder_id VARCHAR(255) NULL AFTER razorpay_linked_account_id,
    ADD COLUMN razorpay_product_id VARCHAR(255) NULL AFTER razorpay_stakeholder_id,
    ADD COLUMN route_activation_status VARCHAR(50) NULL AFTER payout_status,
    ADD COLUMN bank_account_last4 VARCHAR(4) NULL AFTER account_holder_name,
    ADD COLUMN bank_ifsc VARCHAR(20) NULL AFTER bank_account_last4,
    ADD COLUMN onboarding_error TEXT NULL AFTER route_activation_status;

CREATE TABLE IF NOT EXISTS marketplace_refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_id INT NOT NULL,
    buyer_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reverse_transfers BOOLEAN NOT NULL DEFAULT TRUE,
    razorpay_refund_id VARCHAR(255) NULL,
    status ENUM('PENDING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
    failure_reason TEXT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES marketplace_payments(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_marketplace_refund_razorpay (razorpay_refund_id),
    INDEX idx_marketplace_refund_order (order_id),
    INDEX idx_marketplace_refund_payment (payment_id),
    INDEX idx_marketplace_refund_status (status)
);

CREATE TABLE IF NOT EXISTS marketplace_payout_reversals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payout_transaction_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    razorpay_reversal_id VARCHAR(255) NULL,
    status ENUM('PENDING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
    failure_reason TEXT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (payout_transaction_id) REFERENCES marketplace_seller_payout_transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_marketplace_reversal_razorpay (razorpay_reversal_id),
    INDEX idx_marketplace_reversal_payout (payout_transaction_id),
    INDEX idx_marketplace_reversal_status (status)
);
