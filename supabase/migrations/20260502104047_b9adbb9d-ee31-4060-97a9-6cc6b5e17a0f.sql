
-- ============================================
-- BLOQUE 1: Cerrar tabla integrations por tenant
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view integrations" ON public.integrations;
DROP POLICY IF EXISTS "Anyone authenticated can view integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can view integrations" ON public.integrations;

CREATE POLICY "Members can view their organization integrations"
ON public.integrations
FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.is_organization_member(auth.uid(), organization_id)
  OR public.is_organization_owner(auth.uid(), organization_id)
  OR public.is_superadmin()
);

-- ============================================
-- BLOQUE 2: Revocar EXECUTE a anon en funciones internas
-- (Mantenemos validate_api_key abierta para webhooks externos)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.create_organization_api_credential(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.decrypt_credential(bytea) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.encrypt_credential(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.detect_suspicious_customer_access(integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_api_key() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_api_secret() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_sales_order_number() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_customer_audit_trail(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_organization_api_credentials(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_organization_easyquote_credentials(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_organization_easyquote_credentials_for_superadmin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_organization_easyquote_credentials_for_superadmin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_credentials(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_organization_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_customer_access() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_document_number(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_customers(text, uuid, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_user_credentials(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_last_sequential_number(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_last_sequential_number(uuid, text, uuid) FROM anon, public;

-- ============================================
-- BLOQUE 3: Limpieza automática api_performance_metrics > 30 días
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_api_performance_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.api_performance_metrics
  WHERE created_at < (now() - interval '30 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_api_performance_metrics() FROM anon, public;

-- Habilitar pg_cron y programar limpieza diaria a las 03:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-api-performance-metrics-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-api-performance-metrics-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_old_api_performance_metrics(); $$
);

-- Limpieza inicial inmediata (los ~67k registros antiguos)
SELECT public.cleanup_old_api_performance_metrics();
