-- Rename product_name to product_api
ALTER TABLE quote_items RENAME COLUMN product_name TO product_api;

-- Rename description to product_name
ALTER TABLE quote_items RENAME COLUMN description TO product_name;

-- Add new description field
ALTER TABLE quote_items ADD COLUMN description text;