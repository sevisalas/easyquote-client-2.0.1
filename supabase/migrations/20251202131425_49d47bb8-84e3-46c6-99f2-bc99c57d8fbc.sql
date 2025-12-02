-- Add sidebar color columns to organization_themes
ALTER TABLE public.organization_themes 
ADD COLUMN IF NOT EXISTS sidebar_background TEXT,
ADD COLUMN IF NOT EXISTS sidebar_foreground TEXT,
ADD COLUMN IF NOT EXISTS sidebar_accent TEXT;