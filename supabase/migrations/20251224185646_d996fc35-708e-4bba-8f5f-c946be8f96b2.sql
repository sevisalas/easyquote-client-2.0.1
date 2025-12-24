-- Arreglar las vistas para que usen SECURITY INVOKER (comportamiento por defecto seguro)
DROP VIEW IF EXISTS public.organization_daily_stats;
DROP VIEW IF EXISTS public.api_performance_summary;

-- Recrear vistas con SECURITY INVOKER explícito
CREATE VIEW public.organization_daily_stats 
WITH (security_invoker = true) AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  COALESCE(DATE(q.created_at), DATE(so.created_at)) as date,
  COUNT(DISTINCT q.id) as quotes_count,
  COUNT(DISTINCT so.id) as orders_count
FROM public.organizations o
LEFT JOIN public.quotes q ON q.organization_id = o.id
LEFT JOIN public.sales_orders so ON so.organization_id = o.id
WHERE COALESCE(DATE(q.created_at), DATE(so.created_at)) IS NOT NULL
GROUP BY o.id, o.name, COALESCE(DATE(q.created_at), DATE(so.created_at));

CREATE VIEW public.api_performance_summary 
WITH (security_invoker = true) AS
SELECT 
  function_name,
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  AVG(response_time_ms)::integer as avg_response_time,
  MAX(response_time_ms) as max_response_time,
  MIN(response_time_ms) as min_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::integer as p95_response_time,
  COUNT(*) FILTER (WHERE status_code >= 400) as error_count
FROM public.api_performance_metrics
GROUP BY function_name, DATE(created_at);