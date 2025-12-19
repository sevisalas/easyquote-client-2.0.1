-- Añadir campo capacity_value a la tabla additionals para el nuevo tipo "Por capacidad"
ALTER TABLE public.additionals 
ADD COLUMN IF NOT EXISTS capacity_value integer DEFAULT NULL;

-- Añadir comentario descriptivo
COMMENT ON COLUMN public.additionals.capacity_value IS 'Capacidad por unidad (ej: 50 unidades por caja). Usado cuando type = capacity_divider';