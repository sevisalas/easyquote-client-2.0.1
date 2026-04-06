WITH target AS (
  SELECT
    soi.id,
    soi.quantity,
    soi.prompts,
    soi.multi,
    COALESCE(
      (
        SELECT row_elem->'outs'
        FROM jsonb_array_elements(COALESCE(soi.multi->'rows', '[]'::jsonb)) AS row_elem
        WHERE NULLIF(row_elem->>'qty', '')::numeric = soi.quantity::numeric
        LIMIT 1
      ),
      soi.outputs
    ) AS selected_outs,
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(p->>'id', '') = COALESCE(soi.multi->>'qtyPrompt', '')
            OR upper(COALESCE(p->>'label', '')) IN ('CANTIDAD EJEMPLARES', 'CANTIDAD', 'UNIDADES', 'EJEMPLARES', 'QTY')
          THEN jsonb_set(p, '{value}', to_jsonb(soi.quantity), true)
          ELSE p
        END
        ORDER BY COALESCE((p->>'order')::int, 0)
      )
      FROM jsonb_array_elements(COALESCE(soi.prompts, '[]'::jsonb)) AS p
    ) AS synced_prompts
  FROM public.sales_order_items soi
  JOIN public.sales_orders so ON so.id = soi.sales_order_id
  WHERE so.order_number = 'OT-CN26-000184-B'
)
UPDATE public.sales_order_items AS soi
SET
  prompts = target.synced_prompts,
  outputs = target.selected_outs,
  description = (
    SELECT string_agg(format('%s: %s', p->>'label', p->>'value'), E'\n' ORDER BY COALESCE((p->>'order')::int, 0))
    FROM jsonb_array_elements(COALESCE(target.synced_prompts, '[]'::jsonb)) AS p
    WHERE COALESCE(NULLIF(trim(p->>'value'), ''), '') <> ''
      AND upper(trim(p->>'value')) <> 'NO'
      AND lower(trim(p->>'label')) NOT IN (
        'tarifa',
        'forzar máquina',
        'forzar maquina',
        'tira y retira',
        'forzar poses',
        'forzar poses/pags.',
        'modelos'
      )
  ),
  updated_at = now()
FROM target
WHERE soi.id = target.id;