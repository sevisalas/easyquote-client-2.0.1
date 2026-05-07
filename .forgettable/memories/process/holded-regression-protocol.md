# Memory: process/holded-regression-protocol
Updated: 2026-05-07

ANTES de modificar approve-quote, holded-export-*, pricing o cualquier
flujo de aprobación es OBLIGATORIO:

1. Releer `process/regression-checklist-quotes-orders` y
   `integrations/holded/export-pipeline-complete`.
2. Verificar nombres de tabla/columna con `supabase--read_query` contra
   `information_schema`. NO asumir nombres "plausibles". Caso real
   detectado: `approve-quote` consultaba `holded_integration_settings`
   (no existe). La fuente correcta es `organization_integration_access`
   + `integrations(name='Holded')` con `configuration.export_mode`
   ('all' | 'estimates_on_approval' | 'orders_only') y
   `is_active && access_token_encrypted`.
3. Tras el cambio: validar con un quote real de Campillo o Anebri (modo
   `estimates_on_approval`) que `holded_estimate_id` Y
   `holded_document_id` quedan rellenos en BD.
4. Los `try/catch` "best-effort" son trampas silenciosas. Revisar SIEMPRE
   los logs de `approve-quote`, `holded-export-estimate` y
   `holded-export-order` después de cada despliegue.
5. Si el usuario reporta "no se sube a Holded": primero consultar
   `quotes`/`sales_orders` recientes con `holded_*_id IS NULL` antes de
   tocar código — el síntoma confirma el bug en segundos.
