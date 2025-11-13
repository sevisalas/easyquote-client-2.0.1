-- Create atomic function to generate unique sales order numbers
CREATE OR REPLACE FUNCTION public.generate_sales_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_num INTEGER;
  v_next_num INTEGER;
  v_order_number TEXT;
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 5;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  LOOP
    -- Get the highest number for this year with row lock to prevent race conditions
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(order_number FROM 'SO-' || v_year || '-(\d+)') AS INTEGER
        )
      ),
      0
    ) INTO v_max_num
    FROM sales_orders
    WHERE order_number LIKE 'SO-' || v_year || '-%'
    FOR UPDATE;
    
    v_next_num := v_max_num + 1;
    v_order_number := 'SO-' || v_year || '-' || LPAD(v_next_num::TEXT, 4, '0');
    
    -- Check if this number already exists
    IF NOT EXISTS (
      SELECT 1 FROM sales_orders WHERE order_number = v_order_number
    ) THEN
      RETURN v_order_number;
    END IF;
    
    -- If we got here, there was a conflict, retry
    v_attempt := v_attempt + 1;
    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique order number after % attempts', v_max_attempts;
    END IF;
    
    -- Small delay before retry
    PERFORM pg_sleep(0.1);
  END LOOP;
END;
$function$;