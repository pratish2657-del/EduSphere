ALTER TABLE marketplace_seller_payout_transactions
    ADD COLUMN cashfree_settlement_utr VARCHAR(255) NULL
        AFTER cashfree_settlement_id,
    ADD COLUMN cashfree_settlement_time VARCHAR(50) NULL
        AFTER cashfree_settlement_utr;
