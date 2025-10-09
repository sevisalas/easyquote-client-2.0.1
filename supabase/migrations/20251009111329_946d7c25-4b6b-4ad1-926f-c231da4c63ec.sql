
-- Primero eliminar el default
ALTER TABLE public.quote_items 
ALTER COLUMN multi DROP DEFAULT;

-- Cambiar el tipo de columna multi de integer a jsonb
ALTER TABLE public.quote_items 
ALTER COLUMN multi TYPE jsonb USING 
  CASE 
    WHEN multi IS NULL THEN NULL
    ELSE to_jsonb(multi)
  END;

-- Establecer el nuevo default como null (ya que multi es opcional)
ALTER TABLE public.quote_items 
ALTER COLUMN multi SET DEFAULT NULL;
