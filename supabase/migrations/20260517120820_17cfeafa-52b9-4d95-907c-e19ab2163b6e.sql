ALTER TABLE public.organization_themes
ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'light'
CHECK (mode IN ('light','dark'));

DROP INDEX IF EXISTS organization_themes_active_unique;

CREATE UNIQUE INDEX IF NOT EXISTS organization_themes_active_mode_unique
ON public.organization_themes (organization_id, mode)
WHERE is_active = true;