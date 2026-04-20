
WITH base AS (
  SELECT 
    c.id,
    c.organization_id,
    LOWER(BTRIM(REGEXP_REPLACE(c.name, '\s+', ' ', 'g'))) AS norm_name,
    c.created_at,
    EXISTS (SELECT 1 FROM quotes q WHERE q.customer_id = c.id) 
      OR EXISTS (SELECT 1 FROM sales_orders s WHERE s.customer_id = c.id) AS has_history
  FROM customers c
  WHERE c.organization_id = '108bcc37-fc60-4bc0-a81f-c30641d0ebc9'
    AND c.source = 'holded'
),
groups AS (
  SELECT norm_name FROM base
  GROUP BY norm_name HAVING COUNT(*) > 1
),
ranked AS (
  SELECT b.*,
    ROW_NUMBER() OVER (
      PARTITION BY b.norm_name
      ORDER BY b.has_history DESC, b.created_at ASC, b.id ASC
    ) AS rn
  FROM base b
  JOIN groups g ON g.norm_name = b.norm_name
)
DELETE FROM customers
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1 AND has_history = false
);
