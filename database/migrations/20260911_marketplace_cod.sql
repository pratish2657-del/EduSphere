-- EduSphere marketplace: Cash on Delivery support for physical products.
-- COD orders are confirmed at checkout, inventory is finalized immediately,
-- and the payment remains PENDING until an authorized admin confirms cash collection.

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'marketplace_orders'
    AND COLUMN_NAME = 'shipping_address'
);

SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE marketplace_orders ADD COLUMN shipping_address TEXT NULL AFTER seller_net_amount',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
