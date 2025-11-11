-- Add field to track if sales order was created from scratch (not from quote)
ALTER TABLE sales_orders ADD COLUMN created_from_scratch boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN sales_orders.created_from_scratch IS 'Indicates if the sales order was created from scratch (true) or from an approved quote (false)';