
-- 1) Flag de activación del add-on
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS b2b_portal_enabled boolean NOT NULL DEFAULT false;

-- 2) Catálogo de productos publicados por el tenant en su Portal B2B
CREATE TABLE IF NOT EXISTS public.b2b_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  product_ref text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_catalog_items_org ON public.b2b_catalog_items(organization_id, is_active, display_order);

ALTER TABLE public.b2b_catalog_items ENABLE ROW LEVEL SECURITY;

-- Lectura pública (anon) SOLO de items activos de orgs con Portal B2B activado
CREATE POLICY "Public read active b2b catalog when enabled"
ON public.b2b_catalog_items
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = b2b_catalog_items.organization_id
      AND o.b2b_portal_enabled = true
  )
);

-- Gestión por miembros admin/gestor/comercial de la organización
CREATE POLICY "Org staff can manage b2b catalog"
ON public.b2b_catalog_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_catalog_items.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','comercial')
  )
  OR public.is_organization_owner(auth.uid(), b2b_catalog_items.organization_id)
  OR public.is_superadmin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_catalog_items.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','comercial')
  )
  OR public.is_organization_owner(auth.uid(), b2b_catalog_items.organization_id)
  OR public.is_superadmin()
);

CREATE TRIGGER trg_b2b_catalog_items_updated_at
BEFORE UPDATE ON public.b2b_catalog_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Solicitudes de presupuesto enviadas desde el Portal B2B
CREATE TABLE IF NOT EXISTS public.b2b_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  portal_user_id uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'pending', -- pending | converted | rejected
  converted_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  converted_at timestamptz,
  converted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_requests_org_status ON public.b2b_quote_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_requests_customer ON public.b2b_quote_requests(customer_id, created_at DESC);

ALTER TABLE public.b2b_quote_requests ENABLE ROW LEVEL SECURITY;

-- Cliente del portal: ve sus propias solicitudes
CREATE POLICY "Portal customer can read own requests"
ON public.b2b_quote_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = b2b_quote_requests.customer_id
      AND c.portal_user_id = auth.uid()
  )
);

-- Cliente del portal: crea solicitudes solo para su propio customer
CREATE POLICY "Portal customer can insert own requests"
ON public.b2b_quote_requests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = b2b_quote_requests.customer_id
      AND c.portal_user_id = auth.uid()
      AND c.organization_id = b2b_quote_requests.organization_id
  )
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = b2b_quote_requests.organization_id
      AND o.b2b_portal_enabled = true
  )
);

-- Equipo interno: lectura y gestión de solicitudes de su organización
CREATE POLICY "Org staff can read b2b requests"
ON public.b2b_quote_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_quote_requests.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','comercial')
  )
  OR public.is_organization_owner(auth.uid(), b2b_quote_requests.organization_id)
  OR public.is_superadmin()
);

CREATE POLICY "Org staff can update b2b requests"
ON public.b2b_quote_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_quote_requests.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','comercial')
  )
  OR public.is_organization_owner(auth.uid(), b2b_quote_requests.organization_id)
  OR public.is_superadmin()
);

CREATE TRIGGER trg_b2b_quote_requests_updated_at
BEFORE UPDATE ON public.b2b_quote_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
