-- Arreglar política de organization_members para que comerciales puedan ver otros miembros
DROP POLICY IF EXISTS "Members can view their memberships" ON public.organization_members;

CREATE POLICY "Members can view organization memberships"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  -- Puede ver su propio registro
  auth.uid() = user_id
  OR
  -- Puede ver otros miembros de su organización
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Los owners pueden ver todos los miembros
  auth.uid() IN (
    SELECT api_user_id 
    FROM organizations 
    WHERE id = organization_members.organization_id
  )
);

-- Arreglar política de sales_orders para incluir rol comercial (igual que quotes)
DROP POLICY IF EXISTS "Users can view accessible quotes" ON public.sales_orders;

CREATE POLICY "Users can view accessible sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  -- Puede ver sus propios pedidos
  auth.uid() = user_id
  OR
  -- Los comerciales pueden ver todos los pedidos
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