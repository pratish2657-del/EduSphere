-- EduSphere marketplace: Cashfree Easy Split migration.
-- Keeps legacy Razorpay columns for historical compatibility; all new
-- marketplace payment/payout/refund workflows use Cashfree fields.

ALTER TABLE marketplace_seller_payouts
    ADD COLUMN cashfree_vendor_id VARCHAR(255) NULL AFTER payout_status,
    ADD COLUMN cashfree_vendor_status VARCHAR(50) NULL AFTER cashfree_vendor_id,
    ADD COLUMN cashfree_schedule_option INT NULL AFTER cashfree_vendor_status,
    ADD COLUMN cashfree_vendor_error TEXT NULL AFTER cashfree_schedule_option;

ALTER TABLE marketplace_seller_payout_transactions
    ADD COLUMN cashfree_vendor_id VARCHAR(255) NULL AFTER status,
    ADD COLUMN cashfree_split_status VARCHAR(50) NULL AFTER cashfree_vendor_id,
    ADD COLUMN cashfree_settlement_id VARCHAR(255) NULL AFTER cashfree_split_status,
    ADD COLUMN cashfree_transfer_id VARCHAR(255) NULL AFTER cashfree_settlement_id;

ALTER TABLE marketplace_refunds
    ADD COLUMN cashfree_refund_id VARCHAR(255) NULL AFTER reverse_transfers;

ALTER TABLE marketplace_payout_reversals
    ADD COLUMN cashfree_transfer_id VARCHAR(255) NULL AFTER amount;

CREATE INDEX idx_marketplace_payout_cashfree_vendor
    ON marketplace_seller_payout_transactions(cashfree_vendor_id);

CREATE UNIQUE INDEX uq_marketplace_refund_cashfree
    ON marketplace_refunds(cashfree_refund_id);
