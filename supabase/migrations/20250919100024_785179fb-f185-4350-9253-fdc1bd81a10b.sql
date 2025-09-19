-- Agregar campo holded_id para sincronización
ALTER TABLE customers ADD COLUMN holded_id TEXT;

-- Crear índices para búsquedas eficientes
CREATE INDEX idx_customers_holded_id ON customers(holded_id);
CREATE INDEX idx_customers_name_search ON customers USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_customers_email_search ON customers USING gin(to_tsvector('spanish', COALESCE(email, '')));

-- Crear función para búsqueda de clientes
CREATE OR REPLACE FUNCTION search_customers(
  search_term TEXT,
  user_uuid UUID,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  holded_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.phone,
    c.holded_id,
    c.created_at
  FROM customers c
  WHERE c.user_id = user_uuid
    AND (
      search_term = '' OR
      c.name ILIKE '%' || search_term || '%' OR
      c.email ILIKE '%' || search_term || '%' OR
      c.phone ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE WHEN c.name ILIKE search_term || '%' THEN 1 ELSE 2 END,
    c.name
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;