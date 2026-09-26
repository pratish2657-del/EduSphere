-- EduSphere Marketplace — COD support
--
-- The COD implementation stores payment_method='COD' and keeps
-- payment status='PENDING' until cash is collected.
--
-- Run this only if marketplace_payments.payment_method is currently
-- an ENUM that does not allow 'COD'. If it is already VARCHAR/TEXT,
-- no database change is required.

ALTER TABLE marketplace_payments
    MODIFY COLUMN payment_method VARCHAR(20) NOT NULL;
