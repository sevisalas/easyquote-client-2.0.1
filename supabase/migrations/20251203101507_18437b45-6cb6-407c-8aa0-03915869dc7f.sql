-- Añadir organization_id a quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Añadir organization_id a sales_orders  
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Migrar datos existentes de Campillo (el owner principal)
UPDATE quotes 
SET organization_id = '108bcc37-fc60-4bc0-a81f-c30641d0ebc9'
WHERE user_id = 'a21eb8c8-e9fa-4afb-812f-b0fa48aea3e4' 
AND organization_id IS NULL;

UPDATE sales_orders 
SET organization_id = '108bcc37-fc60-4bc0-a81f-c30641d0ebc9'
WHERE user_id = 'a21eb8c8-e9fa-4afb-812f-b0fa48aea3e4' 
AND organization_id IS NULL;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_organization_id ON sales_orders(organization_id);