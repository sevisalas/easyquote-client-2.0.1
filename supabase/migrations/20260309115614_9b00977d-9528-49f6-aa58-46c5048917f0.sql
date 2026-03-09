
-- Add imposition_field to production_variables to map variables to imposition calculator fields
ALTER TABLE public.production_variables
ADD COLUMN imposition_field text DEFAULT NULL;

-- Add observations JSONB array to sales_order_items for tracking changes
ALTER TABLE public.sales_order_items
ADD COLUMN observations jsonb DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.production_variables.imposition_field IS 'Maps this variable to an imposition field: productWidth, productHeight, validWidth, validHeight, bleed, sheetWidth, sheetHeight, gutterH, gutterV';
COMMENT ON COLUMN public.sales_order_items.observations IS 'Array of observation entries: [{type, message, timestamp, user}]';
