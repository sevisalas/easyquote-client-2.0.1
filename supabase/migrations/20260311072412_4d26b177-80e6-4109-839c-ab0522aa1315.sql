
-- 1. Add OT columns to product_prompt_settings
ALTER TABLE public.product_prompt_settings
  ADD COLUMN IF NOT EXISTS show_in_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ot_section text DEFAULT NULL;

-- 2. Add OT columns to composite_product_prompts
ALTER TABLE public.composite_product_prompts
  ADD COLUMN IF NOT EXISTS show_in_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ot_section text DEFAULT NULL;

-- 3. Add OT columns to composite_product_outputs
ALTER TABLE public.composite_product_outputs
  ADD COLUMN IF NOT EXISTS show_in_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ot_section text DEFAULT NULL;

-- 4. New table for output OT settings per product (simple/component)
CREATE TABLE IF NOT EXISTS public.product_output_ot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  easyquote_product_id text NOT NULL,
  output_name text NOT NULL,
  label text,
  show_in_ot boolean NOT NULL DEFAULT false,
  ot_section text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (api_user_id, easyquote_product_id, output_name)
);

ALTER TABLE public.product_output_ot_settings ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_output_ot_settings_api_user
  ON public.product_output_ot_settings(api_user_id, easyquote_product_id);

-- RLS policies (same pattern as product_prompt_settings)
CREATE POLICY "View output ot settings by api_user_id"
ON public.product_output_ot_settings
FOR SELECT
USING (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

CREATE POLICY "Insert output ot settings by api_user_id"
ON public.product_output_ot_settings
FOR INSERT
WITH CHECK (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

CREATE POLICY "Update output ot settings by api_user_id"
ON public.product_output_ot_settings
FOR UPDATE
USING (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

CREATE POLICY "Delete output ot settings by api_user_id"
ON public.product_output_ot_settings
FOR DELETE
USING (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);
