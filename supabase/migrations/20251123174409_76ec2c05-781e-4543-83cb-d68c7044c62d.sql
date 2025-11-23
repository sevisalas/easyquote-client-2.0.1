-- Paso 2: Actualizar políticas RLS para distinguir entre comercial y gestor

-- Actualizar política de quotes: comerciales solo ven sus propios presupuestos
DROP POLICY IF EXISTS "Users can view accessible quotes" ON quotes;

CREATE POLICY "Users can view accessible quotes" 
ON quotes 
FOR SELECT 
USING (
  -- El usuario es el creador
  (auth.uid() = user_id) 
  OR 
  -- Comerciales SOLO ven sus propios presupuestos
  (has_role(auth.uid(), 'comercial') AND auth.uid() = user_id)
  OR
  -- Gestores ven todos los presupuestos de su organización
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1
    FROM (organization_members om1
      JOIN organization_members om2 ON (om1.organization_id = om2.organization_id))
    WHERE (om1.user_id = auth.uid()) AND (om2.user_id = quotes.user_id)
  ))
  OR
  -- Admins ven todos los presupuestos de su organización
  (has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1
    FROM (organization_members om1
      JOIN organization_members om2 ON (om1.organization_id = om2.organization_id))
    WHERE (om1.user_id = auth.uid()) AND (om2.user_id = quotes.user_id)
  ))
  OR
  -- Operadores ven todos si son de la misma organización
  (has_role(auth.uid(), 'operador') AND EXISTS (
    SELECT 1
    FROM (organization_members om1
      JOIN organization_members om2 ON (om1.organization_id = om2.organization_id))
    WHERE (om1.user_id = auth.uid()) AND (om2.user_id = quotes.user_id)
  ))
);

-- Actualizar política de customers: comerciales ven TODOS los clientes de su organización
DROP POLICY IF EXISTS "Users can view organization customers" ON customers;

CREATE POLICY "Users can view organization customers" 
ON customers 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR 
  -- Comerciales pueden ver TODOS los clientes de su organización
  (has_role(auth.uid(), 'comercial') AND (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  ))
  OR
  -- Gestores, admins y operadores ven todos los clientes de su organización
  (organization_id IN (
    SELECT organization_members.organization_id
    FROM organization_members
    WHERE (organization_members.user_id = auth.uid())
  )) 
  OR 
  (organization_id IN (
    SELECT organizations.id
    FROM organizations
    WHERE (organizations.api_user_id = auth.uid())
  ))
);

-- Asegurar que comerciales NO pueden crear, modificar ni ver presupuestos de otros
DROP POLICY IF EXISTS "Users can create own quotes" ON quotes;
CREATE POLICY "Users can create own quotes" 
ON quotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update accessible quotes" ON quotes;
CREATE POLICY "Users can update accessible quotes" 
ON quotes 
FOR UPDATE 
USING (
  (auth.uid() = user_id) 
  OR 
  -- Comerciales SOLO pueden editar sus propios presupuestos
  (has_role(auth.uid(), 'comercial') AND auth.uid() = user_id)
  OR
  -- Admins pueden editar presupuestos de su organización
  (has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1
    FROM organization_members om1
    WHERE (om1.user_id = auth.uid()) AND (om1.role = 'admin') AND (EXISTS (
      SELECT 1
      FROM organization_members om2
      WHERE ((om2.organization_id = om1.organization_id) AND (om2.user_id = quotes.user_id))
    ))
  ))
);

DROP POLICY IF EXISTS "Users can delete accessible quotes" ON quotes;
CREATE POLICY "Users can delete accessible quotes" 
ON quotes 
FOR DELETE 
USING (
  (auth.uid() = user_id) 
  OR 
  -- Comerciales SOLO pueden eliminar sus propios presupuestos
  (has_role(auth.uid(), 'comercial') AND auth.uid() = user_id)
  OR
  -- Admins pueden eliminar presupuestos de su organización
  (has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1
    FROM organization_members om1
    WHERE (om1.user_id = auth.uid()) AND (om1.role = 'admin') AND (EXISTS (
      SELECT 1
      FROM organization_members om2
      WHERE ((om2.organization_id = om1.organization_id) AND (om2.user_id = quotes.user_id))
    ))
  ))
);