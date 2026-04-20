ALTER TABLE public.product_prompt_settings
ADD COLUMN IF NOT EXISTS hide_when_value TEXT NULL;

COMMENT ON COLUMN public.product_prompt_settings.hide_when_value IS 'Si está definido, el prompt se oculta en documentos cuando su valor coincide exactamente (case-insensitive, trim) con este texto.';