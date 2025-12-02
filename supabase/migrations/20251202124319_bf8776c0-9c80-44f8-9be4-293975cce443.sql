-- Add foreground color columns to organization_themes
ALTER TABLE public.organization_themes
ADD COLUMN IF NOT EXISTS primary_foreground text NOT NULL DEFAULT '0 0% 100%',
ADD COLUMN IF NOT EXISTS secondary_foreground text NOT NULL DEFAULT '0 0% 0%',
ADD COLUMN IF NOT EXISTS accent_foreground text NOT NULL DEFAULT '0 0% 100%',
ADD COLUMN IF NOT EXISTS muted_foreground text DEFAULT '215 16% 47%';