-- REVERTIR Y CORREGIR POLÍTICAS RLS ROTAS

-- 1. LIMPIAR Y RECREAR POLÍTICAS DE SALES_ORDERS
DROP POLICY IF EXISTS "Users can view accessible sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view sales orders with draft restriction" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view their own sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view organization sales orders" ON public.sales_orders;

-- Crear política unificada para sales_orders
CREATE POLICY "Users can view accessible sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  -- Propios pedidos
  auth.uid() = user_id
  OR
  -- Rol comercial puede ver todos
  has_role(auth.uid(), 'comercial'::app_role)
  OR
  -- Miembros de la misma organización
  EXISTS (
    SELECT 1
    FROM organization_members om1
    WHERE om1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM organization_members om2
      WHERE om2.organization_id = om1.organization_id
      AND om2.user_id = sales_orders.user_id
    )
  )
);

-- 2. VERIFICAR Y RECREAR POLÍTICAS DE QUOTES (por si acaso)
DROP POLICY IF EXISTS "Users can view accessible quotes" ON public.quotes;

CREATE POLICY "Users can view accessible quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  -- Propios presupuestos
  auth.uid() = user_id
  OR
  -- Rol comercial puede ver todos
  has_role(auth.uid(), 'comercial'::app_role)
  OR
  -- Miembros de la misma organización
  EXISTS (
    SELECT 1
    FROM organization_members om1
    WHERE om1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM organization_members om2
      WHERE om2.organization_id = om1.organization_id
      AND om2.user_id = quotes.user_id
    )
  )
);

-- 3. VERIFICAR CUSTOMERS
DROP POLICY IF EXISTS "Users can view organization customers" ON public.customers;

CREATE POLICY "Users can view organization customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  -- Propios clientes
  auth.uid() = user_id
  OR
  -- Miembros de la organización pueden ver clientes de la organización
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Owners de la organización
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);