-- Normalizar módulos en plan API (eliminar duplicados y mayúsculas)
UPDATE plan_configurations 
SET available_modules = ARRAY['api', 'excel', 'productos', 'categorias']
WHERE plan_id = 'api';

-- Normalizar módulos en plan Client
UPDATE plan_configurations
SET available_modules = ARRAY['api', 'clientes', 'presupuestos', 'excel']
WHERE plan_id = 'client';

-- Asegurar que ERP tiene los módulos correctos
UPDATE plan_configurations
SET available_modules = ARRAY['api', 'clientes', 'presupuestos', 'produccion']
WHERE plan_id = 'erp';