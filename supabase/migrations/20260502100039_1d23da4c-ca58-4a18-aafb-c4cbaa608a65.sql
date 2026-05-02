-- Backfill source_quote_id / source_item_id en presupuestos destino agrupados existentes
WITH src AS (
  SELECT id AS src_id, quote_id AS src_quote_id, grouped_into_quote_id AS dest_quote_id, name,
         row_number() OVER (PARTITION BY grouped_into_quote_id, name ORDER BY created_at) AS rn
  FROM public.quote_items
  WHERE grouped_into_quote_id IS NOT NULL
),
dst AS (
  SELECT qi.id AS dst_id, qi.quote_id AS dst_quote_id, qi.name,
         row_number() OVER (PARTITION BY qi.quote_id, qi.name ORDER BY qi.created_at) AS rn
  FROM public.quote_items qi
  WHERE qi.source_quote_id IS NULL
    AND qi.quote_id IN (SELECT DISTINCT grouped_into_quote_id FROM public.quote_items WHERE grouped_into_quote_id IS NOT NULL)
)
UPDATE public.quote_items qi
SET source_quote_id = src.src_quote_id,
    source_item_id = src.src_id
FROM dst
JOIN src ON src.dest_quote_id = dst.dst_quote_id
        AND src.name = dst.name
        AND src.rn = dst.rn
WHERE qi.id = dst.dst_id;