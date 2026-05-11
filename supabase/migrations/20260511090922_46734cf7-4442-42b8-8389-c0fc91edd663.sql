ALTER TABLE public.product_component_settings
  ADD COLUMN IF NOT EXISTS has_subproducts boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_prompt_settings
  ADD COLUMN IF NOT EXISTS is_subproduct_selector boolean NOT NULL DEFAULT false;

-- Solo un prompt por (api_user_id, easyquote_product_id) puede ser selector
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subproduct_selector_per_product
  ON public.product_prompt_settings (api_user_id, easyquote_product_id)
  WHERE is_subproduct_selector = true;

-- Índice para listar rápido los productos con subproductos
CREATE INDEX IF NOT EXISTS idx_product_component_has_subproducts
  ON public.product_component_settings (api_user_id)
  WHERE has_subproducts = true;