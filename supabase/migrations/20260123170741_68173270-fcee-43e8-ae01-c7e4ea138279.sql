-- Add is_final_calculation field to composite_product_components
-- Components marked as final will wait for all prior components to complete
-- and receive aggregated output values as hidden inputs

ALTER TABLE public.composite_product_components 
ADD COLUMN is_final_calculation boolean NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.composite_product_components.is_final_calculation IS 
'When true, this component will be calculated after all non-final components complete, receiving aggregated outputs as hidden inputs';