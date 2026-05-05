ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_enabled_by uuid;