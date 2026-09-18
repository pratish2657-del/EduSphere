-- EduSphere marketplace: Cashfree Easy Split Phase 1 completion.
-- Adds refund reconciliation fields used by the Cashfree refund webhook.
-- Safe to run once after the existing 20260912_cashfree_easy_split_migration.sql.

SET @db = DATABASE();

SET @sql = (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @db
              AND TABLE_NAME = 'marketplace_refunds'
              AND COLUMN_NAME = 'cashfree_refund_arn'
        ),
        'SELECT 1',
        'ALTER TABLE marketplace_refunds ADD COLUMN cashfree_refund_arn VARCHAR(255) NULL AFTER cashfree_refund_id'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @db
              AND TABLE_NAME = 'marketplace_refunds'
              AND COLUMN_NAME = 'cashfree_refund_splits'
        ),
        'SELECT 1',
        'ALTER TABLE marketplace_refunds ADD COLUMN cashfree_refund_splits LONGTEXT NULL AFTER cashfree_refund_arn'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The inventory_restored flag is added by the existing
-- 20260910_marketplace_refund_inventory_finance.sql migration.
-- No duplicate ALTER is performed here.
