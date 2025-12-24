import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MetricData {
  functionName: string;
  endpoint?: string;
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra métricas de rendimiento en la base de datos.
 * Esta función es "fire and forget" - no bloquea la respuesta.
 */
export async function logMetric(data: MetricData): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("metrics: Missing Supabase credentials, skipping metric logging");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('api_performance_metrics')
      .insert({
        function_name: data.functionName,
        endpoint: data.endpoint,
        response_time_ms: data.responseTimeMs,
        status_code: data.statusCode,
        error_message: data.errorMessage,
        organization_id: data.organizationId,
        metadata: data.metadata || {}
      });

    if (error) {
      console.warn("metrics: Failed to log metric:", error.message);
    }
  } catch (err) {
    // Never let metric logging fail the main request
    console.warn("metrics: Exception while logging:", err);
  }
}

/**
 * Helper para medir el tiempo de una operación async
 */
export async function withMetrics<T>(
  functionName: string,
  operation: () => Promise<T>,
  options: {
    endpoint?: string;
    organizationId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ result: T; durationMs: number }> {
  const startTime = Date.now();
  let statusCode = 200;
  let errorMessage: string | undefined;
  
  try {
    const result = await operation();
    const durationMs = Date.now() - startTime;
    
    // Log metric asynchronously (don't await)
    logMetric({
      functionName,
      endpoint: options.endpoint,
      responseTimeMs: durationMs,
      statusCode,
      organizationId: options.organizationId,
      metadata: options.metadata
    }).catch(() => {});
    
    return { result, durationMs };
  } catch (err) {
    statusCode = 500;
    errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;
    
    // Log error metric
    logMetric({
      functionName,
      endpoint: options.endpoint,
      responseTimeMs: durationMs,
      statusCode,
      errorMessage,
      organizationId: options.organizationId,
      metadata: options.metadata
    }).catch(() => {});
    
    throw err;
  }
}
