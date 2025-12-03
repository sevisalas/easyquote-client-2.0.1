-- Actualizar la función para filtrar por organization_id correctamente
CREATE OR REPLACE FUNCTION public.update_last_sequential_number(p_user_id uuid, p_document_type text, p_organization_id uuid DEFAULT NULL::uuid)
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
  -- Usar el organization_id proporcionado directamente si existe
  v_org_id := p_organization_id;
  
  -- Si no se proporciona, buscar la organización del usuario
  IF v_org_id IS NULL THEN
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
      AND organization_id IS NULL
    LIMIT 1;
  END IF;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- IMPORTANTE: Filtrar por organization_id, NO por user_id
  IF p_document_type = 'quote' THEN
    IF v_org_id IS NOT NULL THEN
      -- Buscar solo en quotes de esta organización
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(
            quote_number FROM 
            CASE 
              WHEN v_format_record.prefix != '' AND v_format_record.prefix IS NOT NULL THEN 
                v_format_record.prefix || '.*?(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
              ELSE 
                '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            END
          ) AS INTEGER
        )
      ), 0) INTO v_last_number
      FROM quotes
      WHERE organization_id = v_org_id
        AND (v_format_record.prefix IS NULL OR v_format_record.prefix = '' OR quote_number LIKE v_format_record.prefix || '%');
    ELSE
      -- Legacy: buscar por user_id sin organization_id
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(
            quote_number FROM '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
          ) AS INTEGER
        )
      ), 0) INTO v_last_number
      FROM quotes
      WHERE user_id = p_user_id
        AND organization_id IS NULL;
    END IF;
    
  ELSIF p_document_type = 'order' THEN
    IF v_org_id IS NOT NULL THEN
      -- Buscar solo en sales_orders de esta organización
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(
            order_number FROM 
            CASE 
              WHEN v_format_record.prefix != '' AND v_format_record.prefix IS NOT NULL THEN 
                v_format_record.prefix || '.*?(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
              ELSE 
                '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
            END
          ) AS INTEGER
        )
      ), 0) INTO v_last_number
      FROM sales_orders
      WHERE organization_id = v_org_id
        AND (v_format_record.prefix IS NULL OR v_format_record.prefix = '' OR order_number LIKE v_format_record.prefix || '%');
    ELSE
      -- Legacy: buscar por user_id sin organization_id
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(
            order_number FROM '(\d+)' || COALESCE(v_format_record.suffix, '') || '$'
          ) AS INTEGER
        )
      ), 0) INTO v_last_number
      FROM sales_orders
      WHERE user_id = p_user_id
        AND organization_id IS NULL;
    END IF;
  END IF;

  -- Actualizar el formato con el último número encontrado
  IF v_org_id IS NOT NULL THEN
    UPDATE numbering_formats
    SET last_sequential_number = GREATEST(v_last_number, 0)
    WHERE organization_id = v_org_id 
      AND document_type = p_document_type;
  ELSE
    UPDATE numbering_formats
    SET last_sequential_number = GREATEST(v_last_number, 0)
    WHERE user_id = p_user_id 
      AND document_type = p_document_type
      AND organization_id IS NULL;
  END IF;

  RETURN v_last_number;
END;
$function$;