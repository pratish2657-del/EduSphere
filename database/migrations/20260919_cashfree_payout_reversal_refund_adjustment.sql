-- EduSphere x StudyFlow
-- Cashfree Easy Split post-settlement payout adjustment
--
-- The previous implementation stored a Cashfree vendor-ledger transfer
-- in cashfree_transfer_id. That transfer is historical and is NOT reused
-- as a payout reversal.
--
-- New reversal/adjustment records store the Cashfree refund ID separately.

ALTER TABLE marketplace_payout_reversals
    ADD COLUMN cashfree_refund_id VARCHAR(255) NULL
        AFTER cashfree_transfer_id;

CREATE INDEX idx_marketplace_payout_reversals_cashfree_refund
    ON marketplace_payout_reversals (cashfree_refund_id);
