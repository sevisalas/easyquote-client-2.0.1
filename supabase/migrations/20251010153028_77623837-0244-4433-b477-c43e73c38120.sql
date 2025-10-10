-- Add Holded integration fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN holded_estimate_id text,
ADD COLUMN holded_estimate_number text;

-- Add index for better query performance when searching by Holded ID
CREATE INDEX idx_quotes_holded_estimate_id ON public.quotes(holded_estimate_id) WHERE holded_estimate_id IS NOT NULL;

COMMENT ON COLUMN public.quotes.holded_estimate_id IS 'ID interno del presupuesto en Holded';
COMMENT ON COLUMN public.quotes.holded_estimate_number IS 'Número de presupuesto visible en Holded (ej: PRE-2024-00123)';