
ALTER TABLE public.production_phases
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_production_phases_organization_id ON public.production_phases(organization_id);

-- Reset policies
DROP POLICY IF EXISTS "Authenticated users can view production phases" ON public.production_phases;
DROP POLICY IF EXISTS "Superadmins can manage production phases" ON public.production_phases;
DROP POLICY IF EXISTS "View global and own org phases" ON public.production_phases;
DROP POLICY IF EXISTS "Manage own org custom phases" ON public.production_phases;
DROP POLICY IF EXISTS "Superadmins manage global phases" ON public.production_phases;

-- SELECT: globals + own org
CREATE POLICY "View global and own org phases"
ON public.production_phases
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.is_organization_member(auth.uid(), organization_id)
  OR public.is_superadmin()
);

-- INSERT/UPDATE/DELETE custom phases for own org (admin or gestor)
CREATE POLICY "Manage own org custom phases"
ON public.production_phases
FOR ALL
TO authenticated
USING (
  organization_id IS NOT NULL
  AND (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = production_phases.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin','gestor')
    )
  )
)
WITH CHECK (
  organization_id IS NOT NULL
  AND (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = production_phases.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin','gestor')
    )
  )
);

-- Superadmins manage globals
CREATE POLICY "Superadmins manage global phases"
ON public.production_phases
FOR ALL
TO authenticated
USING (organization_id IS NULL AND public.is_superadmin())
WITH CHECK (organization_id IS NULL AND public.is_superadmin());
