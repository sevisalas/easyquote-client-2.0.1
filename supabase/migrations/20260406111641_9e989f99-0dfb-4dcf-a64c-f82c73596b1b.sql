-- Fix order OT-CN26-000184-B: quantity should be 8000 (accepted_quantity), price recalculated with correct multiValues
UPDATE sales_order_items 
SET quantity = 8000, 
    price = 2828.923
WHERE id = '0d4e59a9-897c-4777-80db-efe3e6d5550d';

-- Update sales order totals
UPDATE sales_orders 
SET subtotal = 2828.923,
    final_price = 2828.923
WHERE id = '847655f4-df5c-406f-9421-22e8a655f344';