-- Fase 1: Preparar tabla customers para unificación
-- Añadir columnas necesarias
ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'local';

-- Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_holded_id ON customers(holded_id) WHERE holded_id IS NOT NULL;

-- Migrar datos de holded_contacts a customers
INSERT INTO customers (
  id,
  user_id,
  organization_id,
  name,
  email,
  phone,
  holded_id,
  source,
  created_at,
  updated_at
)
SELECT 
  hc.id,
  o.api_user_id as user_id,
  hc.organization_id,
  hc.name,
  hc.email,
  COALESCE(hc.phone, hc.mobile) as phone,
  hc.holded_id,
  'holded' as source,
  hc.created_at,
  hc.updated_at
FROM holded_contacts hc
JOIN organizations o ON o.id = hc.organization_id
ON CONFLICT (id) DO NOTHING;

-- Actualizar user_id en customers importados de holded para que coincida con el owner
UPDATE customers c
SET user_id = o.api_user_id
FROM organizations o
WHERE c.organization_id = o.id
  AND c.source = 'holded'
  AND c.user_id != o.api_user_id;

-- Actualizar sales_orders para usar customer_id unificado
UPDATE sales_orders so
SET customer_id = so.holded_contact_id
WHERE so.holded_contact_id IS NOT NULL 
  AND so.customer_id IS NULL;

-- Eliminar la columna holded_contact_id de sales_orders
ALTER TABLE sales_orders DROP COLUMN IF EXISTS holded_contact_id;

-- Actualizar RLS policies de customers para incluir organization_id
DROP POLICY IF EXISTS "Users can view customers based on role" ON customers;
DROP POLICY IF EXISTS "Organization admins can create customers" ON customers;
DROP POLICY IF EXISTS "Organization admins can update customers" ON customers;
DROP POLICY IF EXISTS "Organization admins can delete customers" ON customers;

-- Nueva política de SELECT unificada
CREATE POLICY "Users can view organization customers"
ON customers FOR SELECT
USING (
  auth.uid() = user_id
  OR
  -- Miembros de la misma organización
  (organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  ))
  OR
  -- Owners de la organización
  (organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  ))
);

-- Nueva política de INSERT
CREATE POLICY "Users can create organization customers"
ON customers FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND organization_id IS NULL)
  OR
  -- Owners pueden crear para su organización
  (organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  ))
  OR
  -- Miembros pueden crear para su organización
  (organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  ))
);

-- Nueva política de UPDATE
CREATE POLICY "Users can update organization customers"
ON customers FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  (organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  ))
  OR
  (organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
);

-- Nueva política de DELETE
CREATE POLICY "Users can delete organization customers"
ON customers FOR DELETE
USING (
  auth.uid() = user_id
  OR
  (organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  ))
  OR
  (organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
);

-- Eliminar tabla holded_contacts
DROP TABLE IF EXISTS holded_contacts CASCADE;