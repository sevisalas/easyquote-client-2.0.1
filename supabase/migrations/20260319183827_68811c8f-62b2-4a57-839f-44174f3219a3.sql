
DROP POLICY IF EXISTS "Superadmin can delete plan configurations" ON public.plan_configurations;
DROP POLICY IF EXISTS "Superadmin can insert plan configurations" ON public.plan_configurations;
DROP POLICY IF EXISTS "Superadmin can update plan configurations" ON public.plan_configurations;

CREATE POLICY "Superadmin can delete plan configurations"
  ON public.plan_configurations FOR DELETE
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmin can insert plan configurations"
  ON public.plan_configurations FOR INSERT
  TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmin can update plan configurations"
  ON public.plan_configurations FOR UPDATE
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());
