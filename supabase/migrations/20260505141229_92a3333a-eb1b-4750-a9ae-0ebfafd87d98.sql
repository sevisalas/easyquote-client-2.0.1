
-- Portal B2B autoservicio: ampliar catálogo, eliminar solicitudes manuales, flag por organización

ALTER TABLE public.b2b_catalog_items
  ADD COLUMN IF NOT EXISTS product_id text,
  ADD COLUMN IF NOT EXISTS default_prompts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS exposed_prompt_ids text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS min_quantity integer,
  ADD COLUMN IF NOT EXISTS max_quantity integer;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS b2b_self_service_enabled boolean NOT NULL DEFAULT true;

-- Drop legacy quote-requests table (no longer needed in autoservice flow)
DROP TABLE IF EXISTS public.b2b_quote_requests CASCADE;
