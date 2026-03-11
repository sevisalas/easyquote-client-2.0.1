

## Plan: Secciones OT configurables por producto (con soporte compuestos)

### Contexto

Los productos pueden ser:
- **Simples**: prompts y outputs vienen del API de EasyQuote (`product_prompt_settings` los configura)
- **Compuestos**: tienen prompts/outputs **generales** (`composite_product_prompts`, `composite_product_outputs`) + prompts/outputs **por componente** (cada componente es un producto EasyQuote con su propio `product_prompt_settings`)

La configuración de OT debe cubrir los 3 niveles: prompts de producto simple, prompts/outputs generales del compuesto, y prompts/outputs de cada componente.

### Secciones OT

```
datos_destacados | Datos destacados
impresion        | Impresión
acabados         | Acabados
imposiciones     | Imposiciones
ajustes          | Ajustes
observaciones    | Observaciones y notas
```

(Encabezado y Artículo/descripción son fijos, no configurables)

### Cambios en BD

**1. Migración — Añadir columnas OT a `product_prompt_settings`**

```sql
ALTER TABLE product_prompt_settings
  ADD COLUMN show_in_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN ot_section text DEFAULT NULL;
```

Esto cubre prompts de productos simples Y prompts de componentes dentro de compuestos (cada componente tiene su `easyquote_product_id`).

**2. Migración — Añadir columnas OT a `composite_product_prompts`**

```sql
ALTER TABLE composite_product_prompts
  ADD COLUMN show_in_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN ot_section text DEFAULT NULL;
```

Para los prompts **generales** del producto compuesto (ej: Cantidad, Formato, Tipo encuadernación).

**3. Migración — Añadir columnas OT a `composite_product_outputs`**

```sql
ALTER TABLE composite_product_outputs
  ADD COLUMN show_in_ot boolean NOT NULL DEFAULT false,
  ADD COLUMN ot_section text DEFAULT NULL;
```

Para los outputs **generales** del producto compuesto (ej: Lomo calculado).

**4. Nueva tabla `product_output_ot_settings`**

Para outputs de productos simples/componentes. La tabla `output_type_visibility` es global por org y no tiene granularidad por producto ni columnas OT.

```sql
CREATE TABLE product_output_ot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  easyquote_product_id text NOT NULL,
  output_name text NOT NULL,
  label text,
  show_in_ot boolean NOT NULL DEFAULT false,
  ot_section text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (api_user_id, easyquote_product_id, output_name)
);
ALTER TABLE product_output_ot_settings ENABLE ROW LEVEL SECURITY;
-- RLS por api_user_id (mismo patrón que product_prompt_settings)
```

### Cobertura por tipo de producto

| Tipo | Prompts | Outputs |
|------|---------|---------|
| Simple | `product_prompt_settings.show_in_ot/ot_section` | `product_output_ot_settings` |
| Compuesto - General | `composite_product_prompts.show_in_ot/ot_section` | `composite_product_outputs.show_in_ot/ot_section` |
| Compuesto - Componente | `product_prompt_settings` (del componente) | `product_output_ot_settings` (del componente) |

### Cambios en código

**5. `useProductPromptSettings.ts`** — Exponer `show_in_ot` y `ot_section` en el interface y añadir helpers `isPromptInOt()`, `getPromptOtSection()`.

**6. `useCompositeProductConfig.ts`** — Los tipos `CompositePrompt` y `CompositeOutput` ya se cargan desde las tablas composite. Solo hay que exponer los nuevos campos en las queries y mutations.

**7. Nuevo hook `useProductOutputOtSettings.ts`** — CRUD para `product_output_ot_settings`, mismo patrón que `useProductPromptSettings`.

**8. UI en gestión de productos** — En la configuración de cada producto (simple o componente), añadir toggle "Mostrar en OT" y selector de sección para cada prompt y output. Para compuestos, lo mismo en los prompts/outputs generales.

### Sin cambios en el generador OT por ahora

Los datos quedan guardados y listos para consumir cuando implementemos el layout especializado de Campillo/Anebri.

