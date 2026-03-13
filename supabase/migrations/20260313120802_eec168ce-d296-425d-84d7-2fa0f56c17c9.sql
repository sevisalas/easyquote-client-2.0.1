
-- Tabla de auditoría para ediciones de pedidos
CREATE TABLE public.sales_order_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  changes JSONB,
  order_status_at_edit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sales_order_edit_logs ENABLE ROW LEVEL SECURITY;

-- Solo miembros de la org pueden ver los logs
CREATE POLICY "Org members can view edit logs"
  ON public.sales_order_edit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_organization_member(auth.uid(), organization_id)
  );

-- Solo admins de la org pueden insertar logs
CREATE POLICY "Admins can insert edit logs"
  ON public.sales_order_edit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = sales_order_edit_logs.organization_id
          AND om.role = 'admin'
      )
      OR public.is_superadmin()
    )
  );

-- Index para búsquedas por pedido
CREATE INDEX idx_sales_order_edit_logs_order ON public.sales_order_edit_logs(sales_order_id);
CREATE INDEX idx_sales_order_edit_logs_org ON public.sales_order_edit_logs(organization_id);
