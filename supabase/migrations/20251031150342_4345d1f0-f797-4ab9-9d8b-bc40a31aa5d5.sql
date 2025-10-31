-- Verificar y eliminar solo las políticas que no existen aún
DO $$ 
BEGIN
  -- Políticas de quote_items
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_items' AND policyname = 'Users can view organization quote items') THEN
    DROP POLICY "Users can view organization quote items" ON quote_items;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_items' AND policyname = 'Users can create quote items for organization quotes') THEN
    DROP POLICY "Users can create quote items for organization quotes" ON quote_items;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_items' AND policyname = 'Users can update organization quote items') THEN
    DROP POLICY "Users can update organization quote items" ON quote_items;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_items' AND policyname = 'Users can delete quote items from organization quotes') THEN
    DROP POLICY "Users can delete quote items from organization quotes" ON quote_items;
  END IF;
  
  -- Políticas de quote_additionals
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_additionals' AND policyname = 'Users can view organization quote additionals') THEN
    DROP POLICY "Users can view organization quote additionals" ON quote_additionals;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_additionals' AND policyname = 'Users can create quote additionals for organization quotes') THEN
    DROP POLICY "Users can create quote additionals for organization quotes" ON quote_additionals;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_additionals' AND policyname = 'Users can update organization quote additionals') THEN
    DROP POLICY "Users can update organization quote additionals" ON quote_additionals;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_additionals' AND policyname = 'Users can delete quote additionals from organization quotes') THEN
    DROP POLICY "Users can delete quote additionals from organization quotes" ON quote_additionals;
  END IF;
END $$;

-- Actualizar políticas RLS de quote_items
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