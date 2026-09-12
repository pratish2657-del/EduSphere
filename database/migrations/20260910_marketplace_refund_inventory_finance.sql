-- Adds idempotent inventory restoration tracking for full marketplace refunds.
SET @db = DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=@db AND TABLE_NAME='marketplace_refunds'
        AND COLUMN_NAME='inventory_restored'
    ),
    'SELECT 1',
    'ALTER TABLE marketplace_refunds ADD COLUMN inventory_restored BOOLEAN NOT NULL DEFAULT FALSE AFTER processed_at'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
