-- Add hide_holded_totals column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN hide_holded_totals boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.quotes.hide_holded_totals IS 'Whether to hide totals in Holded export (sends shipping: hidden parameter)';