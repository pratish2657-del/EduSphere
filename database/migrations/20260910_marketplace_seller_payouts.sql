CREATE TABLE IF NOT EXISTS marketplace_seller_payouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_upi_app ENUM('GOOGLE_PAY','PHONEPE','PAYTM','BHIM','OTHER') NULL,
    upi_id VARCHAR(255) NULL,
    account_holder_name VARCHAR(255) NULL,
    payout_status ENUM('NOT_CONFIGURED','PENDING_VERIFICATION','VERIFIED','REJECTED') NOT NULL DEFAULT 'NOT_CONFIGURED',
    razorpay_linked_account_id VARCHAR(255) NULL,
    payout_verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_marketplace_seller_payout_status (payout_status)
);
