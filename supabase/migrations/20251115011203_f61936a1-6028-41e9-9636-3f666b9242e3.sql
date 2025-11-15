-- Agregar columna para referenciar directamente contactos de Holded (sin constraint)
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS holded_contact_id uuid REFERENCES holded_contacts(id);

-- Crear índice para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_sales_orders_holded_contact_id 
ON sales_orders(holded_contact_id);

-- Comentario
COMMENT ON COLUMN sales_orders.holded_contact_id IS 'ID del contacto de Holded (alternativa a customer_id)';

-- Hacer customer_id nullable si no lo es
ALTER TABLE sales_orders 
ALTER COLUMN customer_id DROP NOT NULL;