-- Desactivar planes Base (ya no se usan)
UPDATE plan_configurations 
SET is_active = false 
WHERE plan_id IN ('api_base', 'client_base');

-- Renombrar API Pro a API
UPDATE plan_configurations 
SET name = 'API', plan_id = 'api'
WHERE plan_id = 'api_pro';

-- Renombrar Client Pro a Client  
UPDATE plan_configurations
SET name = 'Client', plan_id = 'client'
WHERE plan_id = 'client_pro';

-- Crear o actualizar plan ERP con módulo produccion
INSERT INTO plan_configurations (name, plan_id, available_modules, excel_limit, client_user_limit, is_active)
VALUES ('ERP', 'erp', ARRAY['api', 'clientes', 'presupuestos', 'produccion'], 50, 10, true)
ON CONFLICT (plan_id) DO UPDATE 
SET available_modules = EXCLUDED.available_modules,
    name = EXCLUDED.name,
    excel_limit = EXCLUDED.excel_limit,
    client_user_limit = EXCLUDED.client_user_limit;