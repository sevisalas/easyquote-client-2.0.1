CREATE TABLE IF NOT EXISTS public.organization_status_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status_key text NOT NULL CHECK (status_key IN ('draft','pending','in_progress','completed','cancelled')),
  label text NOT NULL,
  color text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, status_key)
);

ALTER TABLE public.organization_status_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read status settings"
  ON public.organization_status_settings FOR SELECT
  USING (
    public.is_superadmin()
    OR public.is_organization_member(auth.uid(), organization_id)
    OR public.is_organization_owner(auth.uid(), organization_id)
  );

CREATE POLICY "admin or gestor can insert status settings"
  ON public.organization_status_settings FOR INSERT
  WITH CHECK (
    public.is_superadmin()
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_status_settings.organization_id
        AND om.role IN ('admin','gestor')
    )
  );

CREATE POLICY "admin or gestor can update status settings"
  ON public.organization_status_settings FOR UPDATE
  USING (
    public.is_superadmin()
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_status_settings.organization_id
        AND om.role IN ('admin','gestor')
    )
  );

CREATE POLICY "admin or gestor can delete status settings"
  ON public.organization_status_settings FOR DELETE
  USING (
    public.is_superadmin()
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_status_settings.organization_id
        AND om.role IN ('admin','gestor')
    )
  );

CREATE TRIGGER trg_oss_updated_at
BEFORE UPDATE ON public.organization_status_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();