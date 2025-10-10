-- Remove product_api column from quote_items table
ALTER TABLE public.quote_items DROP COLUMN IF EXISTS product_api;

-- Remove product_api column from quotes table if it exists
ALTER TABLE public.quotes DROP COLUMN IF EXISTS product_api;