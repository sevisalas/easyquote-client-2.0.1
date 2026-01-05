-- Add is_component field to product_component_settings
ALTER TABLE public.product_component_settings 
ADD COLUMN is_component boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.product_component_settings.is_component IS 'When true, this product is a component (used inside composite products) and should not appear in quote/order product selection';