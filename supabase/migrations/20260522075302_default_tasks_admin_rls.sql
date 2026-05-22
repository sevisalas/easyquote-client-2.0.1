-- Allow organization admins/gestors (not only api_user_id owner) to manage default production tasks
DROP POLICY IF EXISTS "Organization owners can insert default tasks" ON public.default_production_tasks;
DROP POLICY IF EXISTS "Organization owners can update default tasks" ON public.default_production_tasks;
DROP POLICY IF EXISTS "Organization owners can delete default tasks" ON public.default_production_tasks;

CREATE POLICY "Organization admins can insert default tasks"
ON public.default_production_tasks FOR INSERT
WITH CHECK (
  organization_id IN (SELECT id FROM public.organizations WHERE api_user_id = auth.uid())
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('admin','gestor','superadmin')
  )
);

CREATE POLICY "Organization admins can update default tasks"
ON public.default_production_tasks FOR UPDATE
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE api_user_id = auth.uid())
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('admin','gestor','superadmin')
  )
);

CREATE POLICY "Organization admins can delete default tasks"
ON public.default_production_tasks FOR DELETE
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE api_user_id = auth.uid())
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('admin','gestor','superadmin')
  )
);
