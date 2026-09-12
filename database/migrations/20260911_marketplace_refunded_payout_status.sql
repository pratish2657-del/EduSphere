-- Add REFUNDED status for seller payout transactions
-- when a marketplace payment is fully refunded before Route transfer.

ALTER TABLE marketplace_seller_payout_transactions
MODIFY COLUMN status ENUM(
    'PENDING',
    'READY',
    'TRANSFER_INITIATED',
    'SETTLED',
    'FAILED',
    'ON_HOLD',
    'REVERSED',
    'REFUNDED'
) NOT NULL DEFAULT 'PENDING';