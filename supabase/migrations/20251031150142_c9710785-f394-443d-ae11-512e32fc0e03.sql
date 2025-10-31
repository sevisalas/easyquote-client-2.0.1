-- Actualizar políticas RLS de quotes para permitir acceso compartido en organización
DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can create their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON quotes;

-- Política SELECT: Ver presupuestos propios o de su organización
CREATE POLICY "Users can view organization quotes"
ON quotes
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = quotes.user_id
  )
);

-- Política INSERT: Miembros de organización pueden crear presupuestos
CREATE POLICY "Organization members can create quotes"
ON quotes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Política UPDATE: Miembros pueden actualizar presupuestos de su organización
CREATE POLICY "Organization members can update quotes"
ON quotes
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = quotes.user_id
  )
);

-- Política DELETE: Solo propietarios pueden eliminar sus presupuestos
CREATE POLICY "Users can delete their own quotes"
ON quotes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Actualizar políticas RLS de quote_items
DROP POLICY IF EXISTS "Users can view their own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can create quote items for their quotes" ON quote_items;
DROP POLICY IF EXISTS "Users can update their own quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can delete their own quote items" ON quote_items;

CREATE POLICY "Users can view organization quote items"
ON quote_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_items.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

CREATE POLICY "Users can create quote items for organization quotes"
ON quote_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_items.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

CREATE POLICY "Users can update organization quote items"
ON quote_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_items.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

CREATE POLICY "Users can delete quote items from organization quotes"
ON quote_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_items.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

-- Actualizar políticas RLS de quote_additionals
DROP POLICY IF EXISTS "Users can view their own quote additionals" ON quote_additionals;
DROP POLICY IF EXISTS "Users can create quote additionals for their quotes" ON quote_additionals;
DROP POLICY IF EXISTS "Users can update their own quote additionals" ON quote_additionals;
DROP POLICY IF EXISTS "Users can delete their own quote additionals" ON quote_additionals;

CREATE POLICY "Users can view organization quote additionals"
ON quote_additionals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_additionals.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

CREATE POLICY "Users can create quote additionals for organization quotes"
ON quote_additionals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_additionals.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

CREATE POLICY "Users can update organization quote additionals"
ON quote_additionals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_additionals.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);

CREATE POLICY "Users can delete quote additionals from organization quotes"
ON quote_additionals
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_additionals.quote_id
    AND (
      q.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() 
        AND om2.user_id = q.user_id
      )
    )
  )
);