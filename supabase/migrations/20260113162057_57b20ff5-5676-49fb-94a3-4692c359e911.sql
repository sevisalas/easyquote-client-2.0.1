-- Drop old user_id based unique constraints
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_user_id_quote_number_key;
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_user_id_order_number_key;

-- Add new organization_id based unique constraints (correct for multi-tenant)
ALTER TABLE public.quotes ADD CONSTRAINT quotes_organization_id_quote_number_key UNIQUE (organization_id, quote_number);
ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_organization_id_order_number_key UNIQUE (organization_id, order_number);