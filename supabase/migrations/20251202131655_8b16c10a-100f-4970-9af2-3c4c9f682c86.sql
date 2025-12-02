-- Add sidebar accent foreground column
ALTER TABLE public.organization_themes 
ADD COLUMN IF NOT EXISTS sidebar_accent_foreground TEXT;