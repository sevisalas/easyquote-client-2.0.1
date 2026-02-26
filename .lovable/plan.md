
Objetivo: arreglar de forma definitiva que en los PDFs de plantillas 7 y 8 siga saliendo “cantidad 1” y aparezca el subtotal cuando no toca, sin tocar nada hasta tu aprobación.

1) Diagnóstico claro de por qué te sigue saliendo mal
- El PDF que genera la app NO usa la edge function `format-quote-for-pdf`; usa `src/utils/pdfGenerator.ts`.
- En tu presupuesto `PR-26-000100`, en base de datos:
  - `quote_items.quantity = 1` (valor técnico)
  - pero en prompts existe `Cantidad ejemplares = 2000` (valor real que quieres ver)
- Tu organización tiene `hide_all_prompts_in_documents = true`.
  - Eso hace que `pdfGenerator` borre todos los prompts antes de enviar datos al template.
  - Como el template busca “Cantidad ejemplares” dentro de prompts y ya no existe, cae al fallback `quantity || 1`.
  - Resultado: sale 1.
- El cambio previo en template 7/8 era correcto, pero insuficiente con “ocultar todos los prompts”.

2) Qué voy a cambiar (sin ambigüedad)
A) Fuente de cantidad (fix principal)
- Archivo: `src/utils/pdfGenerator.ts`
- Antes de filtrar/ocultar prompts, voy a extraer la cantidad visible real (ej. “Cantidad ejemplares”).
- Añadiré un campo explícito por item (por ejemplo `displayQuantity`) que viaje al template aunque los prompts estén ocultos.
- Mantendré `quantity` técnico para no romper cálculos actuales.

B) Render de UNID. en plantillas 7 y 8
- Archivos:
  - `src/components/templates/Template7.tsx`
  - `src/components/templates/Template8.tsx`
- `getItemQuantity` priorizará `item.displayQuantity` y solo si no existe hará fallback.
- Así, aunque ocultemos prompts en documentos, UNID. mostrará 2000 (o lo que corresponda).

C) Subtotal (según lo acordado)
- Mantener en 7/8 la regla: “mostrar subtotal de resumen solo si hay IVA o descuento”.
- No cambiaré más comportamiento fuera de 7 y 8 para no tocar otras marcas/plantillas.

D) Endurecer selección de plantilla (evitar PDF “equivocado” por fallback)
- Archivo: `src/utils/pdfGenerator.ts`
- Ajustaré `getTemplateConfig` para que priorice siempre `quote.organization_id` cuando está disponible, incluso si `getUser()` falla en ese momento.
- Esto evita que vuelva por defecto a plantilla 1 y parezca que “no cambió nada”.

3) Resultado esperado tras aplicar
- En plantillas 7 y 8:
  - UNID. mostrará la cantidad real (ej. 2000), no 1.
  - El subtotal del bloque de totales se ocultará cuando IVA=0 y descuento=0.
- Seguirás pudiendo tener prompts ocultos en documentos sin romper la cantidad visible.

4) Verificación que haré después del cambio
- Regenerar el PDF del mismo presupuesto (`PR-26-000100`).
- Comprobar:
  1) UNID. = 2000 en ambos ítems.
  2) bloque “Subtotal” oculto cuando IVA y descuento son 0.
  3) plantilla aplicada realmente es 7/8 (no fallback).

5) Riesgo controlado
- Bajo riesgo: cambios acotados a `pdfGenerator` + templates 7/8.
- No toca estructura de base de datos ni edge functions.
- No cambia lógica de precios, solo presentación de cantidad y selección robusta de plantilla.

Si apruebas este plan, lo implemento exactamente así, en ese orden.
