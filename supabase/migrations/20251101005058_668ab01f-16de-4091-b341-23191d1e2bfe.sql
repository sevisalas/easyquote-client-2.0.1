-- Actualizar Custom para que tenga los 3 módulos
UPDATE plan_configurations
SET available_modules = ARRAY['API', 'Client', 'Production']
WHERE plan_id = 'custom';

-- Corregir límite de excel en ERP (debería ser 50)
UPDATE plan_configurations
SET excel_limit = 50
WHERE plan_id = 'erp';