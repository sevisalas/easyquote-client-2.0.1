ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS composite_multi_data jsonb;

COMMENT ON COLUMN public.quote_items.composite_multi_data IS
'Fotografía completa por cantidad de los componentes de un producto compuesto multi-cantidad. Estructura: {"<qty>": { components, activeComponents, totalPrice, parentOutputs }}. Permite restaurar y aprobar sin recalcular contra el motor externo.';