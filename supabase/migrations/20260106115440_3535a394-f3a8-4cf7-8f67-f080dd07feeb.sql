-- Añadir campo admin_only a product_prompt_settings para restringir visibilidad de prompts
ALTER TABLE public.product_prompt_settings 
ADD COLUMN admin_only boolean NOT NULL DEFAULT false;