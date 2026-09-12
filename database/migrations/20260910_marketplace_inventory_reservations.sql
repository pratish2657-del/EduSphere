-- Marketplace inventory reservation hardening
-- Run once on existing installations.

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_products' AND COLUMN_NAME = 'reserved_quantity'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE marketplace_products ADD COLUMN reserved_quantity INT NOT NULL DEFAULT 0 AFTER quantity',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_orders' AND COLUMN_NAME = 'expires_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE marketplace_orders ADD COLUMN expires_at TIMESTAMP NULL AFTER seller_net_amount',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing pending orders were created before reservations existed. Do not
-- attempt to infer historical reservations automatically. New checkouts use
-- reserved_quantity from this migration onward.
