-- Fix: Generate sales order number without using FOR UPDATE with aggregate
CREATE OR REPLACE FUNCTION public.generate_sales_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_next_num INTEGER;
  v_order_number TEXT;
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 10;
  v_exists BOOLEAN;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  LOOP
    -- Get the next available number by counting existing orders
    SELECT COUNT(*) + 1 INTO v_next_num
    FROM sales_orders
    WHERE order_number LIKE 'SO-' || v_year || '-%';
    
    -- Format the order number
    v_order_number := 'SO-' || v_year || '-' || LPAD(v_next_num::TEXT, 4, '0');
    
    -- Try to verify this number doesn't exist with a lock
    SELECT EXISTS(
      SELECT 1 FROM sales_orders 
      WHERE order_number = v_order_number
      FOR UPDATE NOWAIT
    ) INTO v_exists;
    
    -- If number doesn't exist, we can use it
    IF NOT v_exists THEN
      RETURN v_order_number;
    END IF;
    
    -- If exists, increment and retry
    v_attempt := v_attempt + 1;
    IF v_attempt >= v_max_attempts THEN
      -- Use timestamp to ensure uniqueness as fallback
      v_order_number := 'SO-' || v_year || '-' || LPAD(v_next_num::TEXT, 4, '0') || '-' || EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::TEXT;
      RETURN v_order_number;
    END IF;
    
    -- Small delay before retry
    PERFORM pg_sleep(0.05);
  END LOOP;
END;
$function$;