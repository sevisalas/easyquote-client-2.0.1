-- Restrict permissive INSERT policies to authenticated users only

-- customer_access_logs: only allow inserts where user_id matches the caller
DROP POLICY IF EXISTS "System can insert audit logs" ON public.customer_access_logs;
CREATE POLICY "Authenticated users can insert their own audit logs"
ON public.customer_access_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- api_performance_metrics: only allow authenticated users to insert metrics
DROP POLICY IF EXISTS "System can insert metrics" ON public.api_performance_metrics;
CREATE POLICY "Authenticated users can insert metrics"
ON public.api_performance_metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- quote_portal_tokens: explicit deny-all policy (only service role bypasses RLS)
-- Tokens are managed exclusively from edge functions using the service role key
CREATE POLICY "No direct client access to portal tokens"
ON public.quote_portal_tokens
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);