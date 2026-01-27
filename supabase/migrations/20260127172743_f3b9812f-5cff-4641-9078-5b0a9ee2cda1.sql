-- Add is_hidden column to composite_product_prompts
ALTER TABLE public.composite_product_prompts
ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.composite_product_prompts.is_hidden IS 'When true, the prompt is used for calculations but not shown to users';