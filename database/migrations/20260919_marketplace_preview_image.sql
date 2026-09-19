-- Marketplace product preview image
-- Separate from protected digital product attachments.

ALTER TABLE marketplace_products
    ADD COLUMN preview_image_path VARCHAR(500) NULL
    AFTER description;

CREATE INDEX idx_marketplace_products_preview_image
    ON marketplace_products (preview_image_path);