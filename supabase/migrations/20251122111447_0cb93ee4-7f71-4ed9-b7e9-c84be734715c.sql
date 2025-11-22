-- Función para actualizar automáticamente el último número secuencial usado
CREATE OR REPLACE FUNCTION public.update_last_sequential_number(
  p_user_id uuid,
  p_document_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_number integer := 0;
  v_format_record RECORD;
BEGIN
  -- Obtener el formato de numeración
  SELECT * INTO v_format_record
  FROM numbering_formats
  WHERE user_id = p_user_id 
    AND document_type = p_document_type
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Construir el patrón para buscar números
  IF p_document_type = 'quote' THEN
    -- Buscar en quotes y extraer el número secuencial
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(
          quote_number FROM 
          CASE 
            WHEN v_format_record.use_year THEN 
              '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            ELSE 
              v_format_record.prefix || '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
          END
        ) AS INTEGER
      )
    ), 0) INTO v_last_number
    FROM quotes
    WHERE user_id = p_user_id;
    
  ELSIF p_document_type = 'order' THEN
    -- Buscar en sales_orders y extraer el número secuencial
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(
          order_number FROM 
          CASE 
            WHEN v_format_record.use_year THEN 
              '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            ELSE 
              v_format_record.prefix || '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
          END
        ) AS INTEGER
      )
    ), 0) INTO v_last_number
    FROM sales_orders
    WHERE user_id = p_user_id;
  END IF;

  -- Actualizar el formato con el último número encontrado
  UPDATE numbering_formats
  SET last_sequential_number = GREATEST(v_last_number, last_sequential_number)
  WHERE user_id = p_user_id 
    AND document_type = p_document_type;

  RETURN v_last_number;
END;
$$;