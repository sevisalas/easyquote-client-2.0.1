-- Fix quotes status allowed values to include 'approved'
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_valid_check;
ALTER TABLE public.quotes
ADD CONSTRAINT quotes_status_valid_check
CHECK (
  status IS NULL OR status IN ('draft', 'sent', 'approved', 'rejected')
);