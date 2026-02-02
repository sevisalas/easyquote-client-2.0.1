-- Add holded_id column to quotes table to track exported estimates
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS holded_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_holded_id ON public.quotes(holded_id) WHERE holded_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.quotes.holded_id IS 'ID of the estimate in Holded after export';