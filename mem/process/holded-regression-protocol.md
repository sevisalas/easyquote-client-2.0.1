---
name: Holded regression protocol
description: Protocolo obligatorio antes de tocar approve-quote, exports Holded, pricing o aprobaciones para no romper Campillo/Anebri
type: preference
---
ANTES de modificar approve-quote, holded-export-*, pricing o cualquier flujo de aprobación:

1. Releer mem://process/regression-checklist-quotes-orders y mem://integrations/holded/export-pipeline-complete.
2. Verificar nombres de tabla/columna con supabase--read_query contra information_schema. NO asumir nombres "plausibles" como holded_integration_settings — la tabla real es organization_integration_access + integrations(name='Holded') con configuration.export_mode.
3. Tras el cambio: validar con un quote real de Campillo o Anebri (modo estimates_on_approval) que holded_estimate_id Y holded_document_id quedan rellenos en BD.
4. Los try/catch "best-effort" son trampas silenciosas. Revisar SIEMPRE los logs de approve-quote, holded-export-estimate y holded-export-order después de cada despliegue.
5. Si el usuario reporta "no se sube a Holded": primero consultar quotes/sales_orders recientes filtrando por holded_*_id IS NULL antes de tocar código.
