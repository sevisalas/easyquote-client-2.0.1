
-- Drop show_in_admin/show_in_production from production_variables (wrong approach)
ALTER TABLE public.production_variables 
  DROP COLUMN IF EXISTS show_in_admin,
  DROP COLUMN IF EXISTS show_in_production;

-- Create output_type_visibility table to classify output types per org
CREATE TABLE public.output_type_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  output_type text NOT NULL,
  show_in_admin boolean NOT NULL DEFAULT true,
  show_in_production boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, output_type)
);

ALTER TABLE public.output_type_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view output type visibility"
  ON public.output_type_visibility FOR SELECT TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id) 
         OR public.is_organization_owner(auth.uid(), organization_id)
         OR public.is_superadmin());

CREATE POLICY "Owners can manage output type visibility"
  ON public.output_type_visibility FOR ALL TO authenticated
  USING (public.is_organization_owner(auth.uid(), organization_id) OR public.is_superadmin())
  WITH CHECK (public.is_organization_owner(auth.uid(), organization_id) OR public.is_superadmin());
