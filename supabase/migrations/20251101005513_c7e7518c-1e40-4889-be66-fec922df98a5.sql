-- Eliminar el constraint antiguo
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS organizations_subscription_plan_check;

-- Crear nuevo constraint con todos los planes
ALTER TABLE public.organizations
ADD CONSTRAINT organizations_subscription_plan_check 
CHECK (subscription_plan IN ('api_base', 'api_pro', 'client_base', 'client_pro', 'erp', 'custom'));