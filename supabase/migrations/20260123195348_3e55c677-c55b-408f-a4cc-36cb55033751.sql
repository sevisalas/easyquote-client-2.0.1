-- Remove is_final_calculation column from composite_product_components
ALTER TABLE public.composite_product_components 
DROP COLUMN IF EXISTS is_final_calculation;