
-- Remove the global unique constraint on order_number (keep the per-org one)
ALTER TABLE public.sales_orders DROP CONSTRAINT sales_orders_order_number_key;
