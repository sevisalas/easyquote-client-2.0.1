-- Fix: reset sequential per year when use_year=true in update_last_sequential_number

CREATE OR REPLACE FUNCTION public.update_last_sequential_number(
  p_user_id uuid,
  p_document_type text,
  p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_number integer := 0;
  v_format_record RECORD;
  v_org_id uuid;
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  v_year_str text;
BEGIN
  -- Prefer provided organization_id
  v_org_id := p_organization_id;

  -- If not provided, resolve user's organization (best-effort)
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM organizations
    WHERE api_user_id = p_user_id
    LIMIT 1;

    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id
      FROM organization_members
      WHERE user_id = p_user_id
      LIMIT 1;
    END IF;
  END IF;

  -- Fetch numbering format by organization_id first
  IF v_org_id IS NOT NULL THEN
    SELECT * INTO v_format_record
    FROM numbering_formats
    WHERE organization_id = v_org_id
      AND document_type = p_document_type
    LIMIT 1;
  END IF;

  -- Fallback to legacy user-specific format (no org)
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

  -- Build current year string used in document numbers when use_year=true
  IF COALESCE(v_format_record.use_year, false) THEN
    IF COALESCE(v_format_record.year_format, 'YYYY') = 'YY' THEN
      v_year_str := RIGHT(v_year::text, 2);
    ELSE
      v_year_str := v_year::text;
    END IF;
  END IF;

  -- IMPORTANT: when use_year=true, only consider documents from CURRENT year segment
  IF p_document_type = 'quote' THEN
    IF v_org_id IS NOT NULL THEN
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(
              quote_number FROM
              CASE
                WHEN v_format_record.prefix != '' AND v_format_record.prefix IS NOT NULL THEN
                  v_format_record.prefix || '.*?(\\d+)' || COALESCE(v_format_record.suffix, '') || '$'
                ELSE
                  '(\\d+)' || COALESCE(v_format_record.suffix, '') || '$'
              END
            ) AS integer
          )
        ),
        0
      ) INTO v_last_number
      FROM quotes
      WHERE organization_id = v_org_id
        AND (v_format_record.prefix IS NULL OR v_format_record.prefix = '' OR quote_number LIKE v_format_record.prefix || '%')
        AND (
          NOT COALESCE(v_format_record.use_year, false)
          OR quote_number LIKE COALESCE(v_format_record.prefix, '') || v_year_str || '-%'
        );
    ELSE
      -- Legacy: by user_id (no org)
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(
              quote_number FROM '([0-9]+)' || COALESCE(v_format_record.suffix, '') || '$'
            ) AS integer
          )
        ),
        0
      ) INTO v_last_number
      FROM quotes
      WHERE user_id = p_user_id
        AND organization_id IS NULL
        AND (
          NOT COALESCE(v_format_record.use_year, false)
          OR quote_number LIKE COALESCE(v_format_record.prefix, '') || v_year_str || '-%'
        );
    END IF;

  ELSIF p_document_type = 'order' THEN
    IF v_org_id IS NOT NULL THEN
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(
              order_number FROM
              CASE
                WHEN v_format_record.prefix != '' AND v_format_record.prefix IS NOT NULL THEN
                  v_format_record.prefix || '.*?(\\d+)' || COALESCE(v_format_record.suffix, '') || '$'
                ELSE
                  '(\\d+)' || COALESCE(v_format_record.suffix, '') || '$'
              END
            ) AS integer
          )
        ),
        0
      ) INTO v_last_number
      FROM sales_orders
      WHERE organization_id = v_org_id
        AND (v_format_record.prefix IS NULL OR v_format_record.prefix = '' OR order_number LIKE v_format_record.prefix || '%')
        AND (
          NOT COALESCE(v_format_record.use_year, false)
          OR order_number LIKE COALESCE(v_format_record.prefix, '') || v_year_str || '-%'
        );
    ELSE
      -- Legacy: by user_id (no org)
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(
              order_number FROM '([0-9]+)' || COALESCE(v_format_record.suffix, '') || '$'
            ) AS integer
          )
        ),
        0
      ) INTO v_last_number
      FROM sales_orders
      WHERE user_id = p_user_id
        AND organization_id IS NULL
        AND (
          NOT COALESCE(v_format_record.use_year, false)
          OR order_number LIKE COALESCE(v_format_record.prefix, '') || v_year_str || '-%'
        );
    END IF;
  END IF;

  -- Persist last number found for current context
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