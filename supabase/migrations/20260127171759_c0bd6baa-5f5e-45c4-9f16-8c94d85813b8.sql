-- Añadir columna product_type para distinguir entre encuadernado y compuesto
ALTER TABLE public.product_component_settings 
ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'sencillo';

-- Migrar datos existentes basándose en is_composite y enabled_components
UPDATE public.product_component_settings
SET product_type = CASE
  WHEN is_composite = false THEN 'sencillo'
  WHEN is_composite = true AND (
    enabled_components && ARRAY['cubierta'] OR 
    enabled_components && ARRAY['interior_1']
  ) THEN 'encuadernado'
  ELSE 'compuesto'
END
WHERE product_type = 'sencillo' OR product_type IS NULL;