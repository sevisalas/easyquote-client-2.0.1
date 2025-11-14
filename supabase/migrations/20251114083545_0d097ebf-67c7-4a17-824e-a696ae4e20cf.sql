-- Drop the existing function
DROP FUNCTION IF EXISTS public.generate_sales_order_number();

-- Create a simpler, more reliable version that works with RPC
CREATE OR REPLACE FUNCTION public.generate_sales_order_number()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_next_num INTEGER;
  v_order_number TEXT;
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 20;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  LOOP
    -- Get the next available number by counting existing orders for this year
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(order_number FROM 'SO-' || v_year || '-(\d+)')
        AS INTEGER
      )
    ), 0) + 1
    INTO v_next_num
    FROM sales_orders
    WHERE order_number LIKE 'SO-' || v_year || '-%';
    
    -- Format the order number
    v_order_number := 'SO-' || v_year || '-' || LPAD(v_next_num::TEXT, 4, '0');
    
    -- Check if this number already exists (without locking)
    IF NOT EXISTS(SELECT 1 FROM sales_orders WHERE order_number = v_order_number) THEN
      RETURN v_order_number;
    END IF;
    
    -- If exists, increment attempt counter
    v_attempt := v_attempt + 1;
    IF v_attempt >= v_max_attempts THEN
      -- Use timestamp to ensure uniqueness as fallback
      v_order_number := 'SO-' || v_year || '-' || LPAD(v_next_num::TEXT, 4, '0') || '-' || FLOOR(EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()))::TEXT;
      RETURN v_order_number;
    END IF;
    
    -- Small random delay before retry to reduce collision probability
    PERFORM pg_sleep(random() * 0.1);
  END LOOP;
END;
$function$;