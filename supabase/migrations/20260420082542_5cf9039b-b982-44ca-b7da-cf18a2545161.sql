
ALTER TABLE public.product_prompt_settings
  ADD COLUMN IF NOT EXISTS force_include_in_documents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_include_condition text;

ALTER TABLE public.product_output_ot_settings
  ADD COLUMN IF NOT EXISTS force_include_in_documents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_include_condition text;

-- Validate allowed values
ALTER TABLE public.product_prompt_settings
  DROP CONSTRAINT IF EXISTS product_prompt_settings_force_condition_check;
ALTER TABLE public.product_prompt_settings
  ADD CONSTRAINT product_prompt_settings_force_condition_check
  CHECK (force_include_condition IS NULL OR force_include_condition IN ('always','value_gt_zero','value_not_empty'));

ALTER TABLE public.product_output_ot_settings
  DROP CONSTRAINT IF EXISTS product_output_ot_settings_force_condition_check;
ALTER TABLE public.product_output_ot_settings
  ADD CONSTRAINT product_output_ot_settings_force_condition_check
  CHECK (force_include_condition IS NULL OR force_include_condition IN ('always','value_gt_zero','value_not_empty'));
