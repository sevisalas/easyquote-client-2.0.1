-- Añadir campo de aceptación individual a quote_items
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS accepted_quantity NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.quote_items.accepted IS 'Indica si el producto está aceptado para el pedido';
COMMENT ON COLUMN public.quote_items.accepted_quantity IS 'Cantidad específica aceptada cuando hay múltiples opciones';

-- Tabla de pedidos/órdenes de venta
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivery_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  final_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  holded_document_id TEXT,
  holded_document_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sales_orders IS 'Pedidos generados desde presupuestos aceptados';
COMMENT ON COLUMN public.sales_orders.status IS 'Estados: pending, in_production, completed, cancelled';

-- Tabla de items del pedido
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  outputs JSONB DEFAULT '{}',
  prompts JSONB DEFAULT '{}',
  multi JSONB,
  description TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sales_order_items IS 'Items de los pedidos (solo productos aceptados del presupuesto)';

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_sales_orders_quote_id ON public.sales_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_user_id ON public.sales_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON public.sales_order_items(sales_order_id);

-- Eliminar triggers si existen y recrearlos
DROP TRIGGER IF EXISTS update_sales_orders_updated_at ON public.sales_orders;
DROP TRIGGER IF EXISTS update_sales_order_items_updated_at ON public.sales_order_items;

CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_items_updated_at
  BEFORE UPDATE ON public.sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para sales_orders
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view organization sales orders" ON public.sales_orders;
CREATE POLICY "Users can view organization sales orders"
  ON public.sales_orders FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om2.user_id = sales_orders.user_id
    )
  );

DROP POLICY IF EXISTS "Organization members can create sales orders" ON public.sales_orders;
CREATE POLICY "Organization members can create sales orders"
  ON public.sales_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Organization members can update sales orders" ON public.sales_orders;
CREATE POLICY "Organization members can update sales orders"
  ON public.sales_orders FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om2.user_id = sales_orders.user_id
    )
  );

DROP POLICY IF EXISTS "Users can delete their own sales orders" ON public.sales_orders;
CREATE POLICY "Users can delete their own sales orders"
  ON public.sales_orders FOR DELETE
  USING (auth.uid() = user_id);

-- RLS para sales_order_items
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view organization sales order items" ON public.sales_order_items;
CREATE POLICY "Users can view organization sales order items"
  ON public.sales_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM organization_members om1
            JOIN organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can create sales order items for organization orders" ON public.sales_order_items;
CREATE POLICY "Users can create sales order items for organization orders"
  ON public.sales_order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM organization_members om1
            JOIN organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can update organization sales order items" ON public.sales_order_items;
CREATE POLICY "Users can update organization sales order items"
  ON public.sales_order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM organization_members om1
            JOIN organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can delete sales order items from organization orders" ON public.sales_order_items;
CREATE POLICY "Users can delete sales order items from organization orders"
  ON public.sales_order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
        AND (
          so.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM organization_members om1
            JOIN organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
          )
        )
    )
  );