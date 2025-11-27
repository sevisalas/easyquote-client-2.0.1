-- Add imposition_data column to sales_order_items
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS imposition_data JSONB DEFAULT NULL;

COMMENT ON COLUMN sales_order_items.imposition_data IS 'Configuración de imposición: producto (ancho, alto, sangrado), pliego (ancho, alto, área válida), calles, repeticiones calculadas';