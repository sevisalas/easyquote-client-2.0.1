-- Problema: Hay 3 políticas SELECT en sales_orders y una de ellas bloquea el acceso de comerciales
-- Solución: Eliminar las políticas conflictivas y dejar solo una correcta

-- Eliminar todas las políticas SELECT existentes en sales_orders
DROP POLICY IF EXISTS "Users can view accessible orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view accessible sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view sales orders with draft restriction" ON public.sales_orders;

-- Crear UNA sola política SELECT correcta que permita:
-- 1. Ver sus propios pedidos
-- 2. Rol comercial puede ver TODOS los pedidos
-- 3. Miembros de la organización pueden ver pedidos de su organización
CREATE POLICY "Users can view accessible sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  -- Puede ver sus propios pedidos
  auth.uid() = user_id
  OR
  -- Los comerciales pueden ver TODOS los pedidos
  has_role(auth.uid(), 'comercial'::app_role)
  OR
  -- Puede ver pedidos de usuarios de su organización
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