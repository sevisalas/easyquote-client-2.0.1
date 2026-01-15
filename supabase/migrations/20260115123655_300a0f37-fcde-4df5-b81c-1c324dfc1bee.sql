-- Añadir campo force_result a product_prompt_settings para separar prompts que fuerzan resultados
ALTER TABLE public.product_prompt_settings 
ADD COLUMN force_result boolean NOT NULL DEFAULT false;