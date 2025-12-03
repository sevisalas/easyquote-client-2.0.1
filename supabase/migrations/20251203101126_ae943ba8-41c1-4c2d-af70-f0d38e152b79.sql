-- Modificar la función para buscar por organization_id en lugar de user_id
CREATE OR REPLACE FUNCTION public.update_last_sequential_number(p_user_id uuid, p_document_type text, p_organization_id uuid DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_number integer := 0;
  v_format_record RECORD;
  v_org_id uuid;
BEGIN
  -- Determinar organization_id: usar el parámetro si se proporciona, sino buscar por user_id
  IF p_organization_id IS NOT NULL THEN
    v_org_id := p_organization_id;
  ELSE
    -- Buscar la organización del usuario (como owner primero, luego como miembro)
    SELECT id INTO v_org_id FROM organizations WHERE api_user_id = p_user_id LIMIT 1;
    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id FROM organization_members WHERE user_id = p_user_id LIMIT 1;
    END IF;
  END IF;

  -- Obtener el formato de numeración por organization_id
  IF v_org_id IS NOT NULL THEN
    SELECT * INTO v_format_record
    FROM numbering_formats
    WHERE organization_id = v_org_id 
      AND document_type = p_document_type
    LIMIT 1;
  END IF;
  
  -- Fallback a user_id si no hay formato por organización
  IF NOT FOUND THEN
    SELECT * INTO v_format_record
    FROM numbering_formats
    WHERE user_id = p_user_id 
      AND document_type = p_document_type
    LIMIT 1;
  END IF;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Construir el patrón para buscar números - filtrar por organización si es posible
  IF p_document_type = 'quote' THEN
    -- Buscar el máximo número secuencial en quotes
    -- Usamos el prefijo del formato para filtrar solo los presupuestos de esta organización
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(
          quote_number FROM 
          CASE 
            WHEN v_format_record.prefix != '' THEN 
              v_format_record.prefix || '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            WHEN v_format_record.use_year THEN 
              '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            ELSE 
              '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
          END
        ) AS INTEGER
      )
    ), 0) INTO v_last_number
    FROM quotes
    WHERE user_id = p_user_id
      AND quote_number LIKE v_format_record.prefix || '%';
    
  ELSIF p_document_type = 'order' THEN
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(
          order_number FROM 
          CASE 
            WHEN v_format_record.prefix != '' THEN 
              v_format_record.prefix || '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            WHEN v_format_record.use_year THEN 
              '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            ELSE 
              '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
          END
        ) AS INTEGER
      )
    ), 0) INTO v_last_number
    FROM sales_orders
    WHERE user_id = p_user_id
      AND order_number LIKE v_format_record.prefix || '%';
  END IF;

  -- Actualizar el formato con el último número encontrado
  IF v_org_id IS NOT NULL THEN
    UPDATE numbering_formats
    SET last_sequential_number = GREATEST(v_last_number, last_sequential_number)
    WHERE organization_id = v_org_id 
      AND document_type = p_document_type;
  ELSE
    UPDATE numbering_formats
    SET last_sequential_number = GREATEST(v_last_number, last_sequential_number)
    WHERE user_id = p_user_id 
      AND document_type = p_document_type;
  END IF;

  RETURN v_last_number;
END;
$function$;