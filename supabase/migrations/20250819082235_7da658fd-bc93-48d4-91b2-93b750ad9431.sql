-- Añadir campo de asignación a la tabla additionals
ALTER TABLE public.additionals 
ADD COLUMN assignment_type text NOT NULL DEFAULT 'article' CHECK (assignment_type IN ('article', 'quote'));

-- Actualizar los tipos existentes para ser más específicos según la asignación
-- Para artículos: mantener net_amount y quantity_multiplier
-- Para presupuestos: net_amount y percentage
-- Actualizar la restricción de tipo
ALTER TABLE public.additionals 
DROP CONSTRAINT IF EXISTS additionals_type_check;

ALTER TABLE public.additionals 
ADD CONSTRAINT additionals_type_check 
CHECK (
  (assignment_type = 'article' AND type IN ('net_amount', 'quantity_multiplier')) OR
  (assignment_type = 'quote' AND type IN ('net_amount', 'percentage'))
);