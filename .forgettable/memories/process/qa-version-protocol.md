# Memory: process/qa-version-protocol
Updated: 2026-05-07

Antes de cerrar CUALQUIER versión nueva (cambio de `version.json` o
entrada en `Novedades.tsx`), aplicar el protocolo QA completo en
`docs/qa-protocolo-version.md`.

Bloques bloqueantes (si fallan → no se publica):
1. Conexión API EasyQuote (GET/PATCH, simple + compuesto, caché 20min)
2. Detalles de artículo (prompts visibles/ocultos, is_quantity,
   descripción auto vs manual, outputs, compuestos)
3. Precio y persistencia decimal (guardar sin tocar = total idéntico)
4. Tarifa de cliente (solo a base, nunca a ajustes)
8. Integración Holded (export_mode, holded_*_id rellenos, sin try/catch
   silenciosos)

Bloques contextuales (validar si el cambio los toca):
5 multi-cantidad · 6 ajustes · 7 aprobación · 9 otras integraciones
(Woo, Portal, SMTP, Imposición) · 10 PDFs · 11 RBAC/multi-tenant
· 12 producción · 13 UI/versión.

Registro obligatorio en CHANGELOG bajo la versión:
```
### QA
- Bloques validados: <lista>
- Validado por: <persona>
- Incidencias: <ninguna | lista>
```

Reglas de oro (recordar siempre):
- API = única fuente de verdad de prompts activos y precio
- Prompts guardados NUNCA se sobrescriben con API al cargar
- Tarifa SOLO a precio base
- Sin toFixed/round en guardado
- Holded: verificar nombres reales en information_schema antes de tocar
- Try/catch silenciosos = trampas, loguear siempre
- "No se sube a Holded" → consultar BD primero, código después