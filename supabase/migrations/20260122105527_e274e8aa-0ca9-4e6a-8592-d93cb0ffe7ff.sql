-- Fix next_document_number to sync with existing documents and avoid starting at 1 when quotes/orders already exist

CREATE OR REPLACE FUNCTION public.next_document_number(
  p_organization_id uuid,
  p_document_type text
)
RETURNS TABLE(document_number text, sequential_number int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_format record;
  v_year int := extract(year from current_date);
  v_year_bucket int;
  v_year_str text := '';
  v_prefix text := '';
  v_suffix text := '';
  v_use_year boolean := true;
  v_year_format text := 'YY';
  v_digits int := 4;
  v_next int;
  v_existing_max int;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF p_document_type NOT IN ('quote','order') THEN
    RAISE EXCEPTION 'invalid document_type: %', p_document_type;
  END IF;

  -- Authorization: caller must be owner, member, or superadmin
  IF NOT (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_organization_id
        AND o.api_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_organization_id
        AND om.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Load numbering format (organization-level)
  SELECT * INTO v_format
  FROM public.numbering_formats
  WHERE organization_id = p_organization_id
    AND document_type = p_document_type
  LIMIT 1;

  -- Defaults if missing
  IF FOUND THEN
    v_prefix := COALESCE(v_format.prefix, '');
    v_suffix := COALESCE(v_format.suffix, '');
    v_use_year := COALESCE(v_format.use_year, true);
    v_year_format := COALESCE(v_format.year_format, CASE WHEN p_document_type = 'order' THEN 'YYYY' ELSE 'YY' END);
    v_digits := COALESCE(v_format.sequential_digits, 4);
  ELSE
    v_prefix := CASE WHEN p_document_type = 'order' THEN 'SO-' ELSE '' END;
    v_suffix := '';
    v_use_year := true;
    v_year_format := CASE WHEN p_document_type = 'order' THEN 'YYYY' ELSE 'YY' END;
    v_digits := 4;
  END IF;

  v_year_bucket := CASE WHEN v_use_year THEN v_year ELSE 0 END;

  -- Compute the current max sequential number from existing documents
  IF p_document_type = 'quote' THEN
    SELECT max((regexp_match(q.quote_number, '([0-9]+)$'))[1]::int)
      INTO v_existing_max
    FROM public.quotes q
    WHERE q.organization_id = p_organization_id
      AND q.quote_number IS NOT NULL
      AND (
        NOT v_use_year
        OR extract(year from q.created_at::timestamptz) = v_year
      );
  ELSE
    SELECT max((regexp_match(o.order_number, '([0-9]+)$'))[1]::int)
      INTO v_existing_max
    FROM public.sales_orders o
    WHERE o.organization_id = p_organization_id
      AND o.order_number IS NOT NULL
      AND (
        NOT v_use_year
        OR extract(year from o.created_at::timestamptz) = v_year
      );
  END IF;

  -- Atomic increment per org/doc/year, but ensure we never go below existing max + 1
  INSERT INTO public.document_sequences (organization_id, document_type, year, last_number)
  VALUES (
    p_organization_id,
    p_document_type,
    v_year_bucket,
    GREATEST(COALESCE(v_existing_max, 0) + 1, 1)
  )
  ON CONFLICT (organization_id, document_type, year)
  DO UPDATE SET
    last_number = GREATEST(public.document_sequences.last_number + 1, GREATEST(COALESCE(v_existing_max, 0) + 1, 1)),
    updated_at = now()
  RETURNING last_number INTO v_next;

  -- Build year string
  IF v_use_year THEN
    IF v_year_format = 'YYYY' THEN
      v_year_str := v_year::text;
    ELSE
      v_year_str := lpad((v_year % 100)::text, 2, '0');
    END IF;
  END IF;

  document_number :=
    v_prefix
    || CASE WHEN v_use_year AND v_year_str <> '' THEN v_year_str || '-' ELSE '' END
    || lpad(v_next::text, v_digits, '0')
    || v_suffix;

  sequential_number := v_next;

  RETURN NEXT;
END;
$$;