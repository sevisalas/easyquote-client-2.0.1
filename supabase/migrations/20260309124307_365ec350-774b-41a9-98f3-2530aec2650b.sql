ALTER TABLE public.production_variables 
  ADD COLUMN IF NOT EXISTS show_in_admin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_production boolean NOT NULL DEFAULT true;