ALTER TABLE public.production_phases
  DROP CONSTRAINT IF EXISTS production_phases_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_phases_global_name_unique
ON public.production_phases(name)
WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_phases_org_name_unique
ON public.production_phases(organization_id, name)
WHERE organization_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.initialize_organization_production_phases(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.production_phases (
    name, display_name, display_order, color, is_active, organization_id
  )
  SELECT gp.name, gp.display_name, gp.display_order, gp.color, gp.is_active, p_organization_id
  FROM public.production_phases gp
  WHERE gp.organization_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.production_phases op
      WHERE op.organization_id = p_organization_id
        AND op.name = gp.name
    );

  UPDATE public.default_production_tasks dpt
  SET phase_id = (
    SELECT op.id FROM public.production_phases op
    JOIN public.production_phases gp ON gp.name = op.name AND gp.organization_id IS NULL
    WHERE op.organization_id = dpt.organization_id
      AND gp.id = dpt.phase_id
    LIMIT 1
  )
  WHERE dpt.organization_id = p_organization_id
    AND EXISTS (
      SELECT 1 FROM public.production_phases gp
      WHERE gp.id = dpt.phase_id AND gp.organization_id IS NULL
    );

  UPDATE public.production_variables pv
  SET task_phase_id = (
    SELECT op.id FROM public.production_phases op
    JOIN public.production_phases gp ON gp.name = op.name AND gp.organization_id IS NULL
    WHERE op.organization_id = pv.organization_id
      AND gp.id = pv.task_phase_id
    LIMIT 1
  )
  WHERE pv.organization_id = p_organization_id
    AND pv.task_phase_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.production_phases gp
      WHERE gp.id = pv.task_phase_id AND gp.organization_id IS NULL
    );

  UPDATE public.additionals a
  SET task_phase_id = (
    SELECT op.id FROM public.production_phases op
    JOIN public.production_phases gp ON gp.name = op.name AND gp.organization_id IS NULL
    WHERE op.organization_id = a.organization_id
      AND gp.id = a.task_phase_id
    LIMIT 1
  )
  WHERE a.organization_id = p_organization_id
    AND a.task_phase_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.production_phases gp
      WHERE gp.id = a.task_phase_id AND gp.organization_id IS NULL
    );

  UPDATE public.production_tasks pt
  SET phase_id = (
    SELECT op.id FROM public.production_phases op
    JOIN public.production_phases gp ON gp.name = op.name AND gp.organization_id IS NULL
    WHERE op.organization_id = p_organization_id
      AND gp.id = pt.phase_id
    LIMIT 1
  )
  WHERE EXISTS (
    SELECT 1
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.sales_order_id
    JOIN public.production_phases gp ON gp.id = pt.phase_id AND gp.organization_id IS NULL
    WHERE soi.id = pt.sales_order_item_id
      AND so.organization_id = p_organization_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_organization_production_phases_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_organization_production_phases(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_organization_production_phases_on_create ON public.organizations;
CREATE TRIGGER initialize_organization_production_phases_on_create
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.initialize_organization_production_phases_on_create();

DO $$
DECLARE org_record record;
BEGIN
  FOR org_record IN SELECT id FROM public.organizations LOOP
    PERFORM public.initialize_organization_production_phases(org_record.id);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "View global and own org phases" ON public.production_phases;
DROP POLICY IF EXISTS "Manage own org custom phases" ON public.production_phases;
DROP POLICY IF EXISTS "Superadmins manage global phases" ON public.production_phases;
DROP POLICY IF EXISTS "View own org phases and superadmin globals" ON public.production_phases;
DROP POLICY IF EXISTS "Manage own org phases" ON public.production_phases;

CREATE POLICY "View own org phases and superadmin globals"
ON public.production_phases
FOR SELECT TO authenticated
USING (
  public.is_superadmin()
  OR (organization_id IS NOT NULL AND public.is_organization_member(auth.uid(), organization_id))
);

CREATE POLICY "Manage own org phases"
ON public.production_phases
FOR ALL TO authenticated
USING (
  organization_id IS NOT NULL AND (
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
  organization_id IS NOT NULL AND (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = production_phases.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin','gestor')
    )
  )
);

CREATE POLICY "Superadmins manage global phases"
ON public.production_phases
FOR ALL TO authenticated
USING (organization_id IS NULL AND public.is_superadmin())
WITH CHECK (organization_id IS NULL AND public.is_superadmin());