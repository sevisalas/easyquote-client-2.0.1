DO $$
DECLARE
  v_target_id uuid := 'ccf08bf1-06bc-467c-bd1a-ef1062e71a1b';
  v_org_id uuid := '108bcc37-fc60-4bc0-a81f-c30641d0ebc9';
  v_dup_ids uuid[];
  v_quotes_updated int;
  v_orders_updated int;
  v_customers_deleted int;
BEGIN
  -- Recolectar IDs de duplicados (todos los clientes con "edice" en el nombre, excepto el destino)
  SELECT array_agg(id) INTO v_dup_ids
  FROM customers
  WHERE organization_id = v_org_id
    AND name ILIKE '%edice%'
    AND id <> v_target_id;

  RAISE NOTICE 'Duplicados encontrados: %', array_length(v_dup_ids, 1);

  -- Reasignar presupuestos
  UPDATE quotes
  SET customer_id = v_target_id
  WHERE customer_id = ANY(v_dup_ids);
  GET DIAGNOSTICS v_quotes_updated = ROW_COUNT;
  RAISE NOTICE 'Presupuestos reasignados: %', v_quotes_updated;

  -- Reasignar pedidos
  UPDATE sales_orders
  SET customer_id = v_target_id
  WHERE customer_id = ANY(v_dup_ids);
  GET DIAGNOSTICS v_orders_updated = ROW_COUNT;
  RAISE NOTICE 'Pedidos reasignados: %', v_orders_updated;

  -- Borrar duplicados
  DELETE FROM customers WHERE id = ANY(v_dup_ids);
  GET DIAGNOSTICS v_customers_deleted = ROW_COUNT;
  RAISE NOTICE 'Clientes duplicados eliminados: %', v_customers_deleted;
END $$;