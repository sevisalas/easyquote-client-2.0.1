
ALTER TABLE public.product_prompt_settings
  ADD COLUMN IF NOT EXISTS is_quantity boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_prompt_settings_is_quantity
  ON public.product_prompt_settings (api_user_id, easyquote_product_id)
  WHERE is_quantity = true;
