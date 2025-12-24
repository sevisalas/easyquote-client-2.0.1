-- Tabla para métricas de rendimiento del API
CREATE TABLE public.api_performance_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  endpoint text,
  response_time_ms integer NOT NULL,
  status_code integer,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_api_metrics_org_id ON public.api_performance_metrics(organization_id);
CREATE INDEX idx_api_metrics_created_at ON public.api_performance_metrics(created_at DESC);
CREATE INDEX idx_api_metrics_function ON public.api_performance_metrics(function_name);

-- RLS - Solo superadmins pueden ver las métricas
ALTER TABLE public.api_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all metrics"
ON public.api_performance_metrics
FOR SELECT
USING (is_superadmin());

CREATE POLICY "System can insert metrics"
ON public.api_performance_metrics
FOR INSERT
WITH CHECK (true);

-- Vista para estadísticas diarias de uso por organización
CREATE OR REPLACE VIEW public.organization_daily_stats AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  DATE(q.created_at) as date,
  COUNT(DISTINCT q.id) as quotes_count,
  COUNT(DISTINCT so.id) as orders_count
FROM public.organizations o
LEFT JOIN public.quotes q ON q.organization_id = o.id
LEFT JOIN public.sales_orders so ON so.organization_id = o.id
GROUP BY o.id, o.name, DATE(q.created_at), DATE(so.created_at);

-- Vista para métricas de rendimiento agregadas
CREATE OR REPLACE VIEW public.api_performance_summary AS
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

COMMENT ON TABLE public.api_performance_metrics IS 'Almacena métricas de rendimiento de las edge functions para análisis de SuperAdmin';