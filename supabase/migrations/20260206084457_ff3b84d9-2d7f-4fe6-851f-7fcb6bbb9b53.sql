-- Guardar etiqueta personalizada por prompt
ALTER TABLE public.product_prompt_settings
ADD COLUMN IF NOT EXISTS label text;