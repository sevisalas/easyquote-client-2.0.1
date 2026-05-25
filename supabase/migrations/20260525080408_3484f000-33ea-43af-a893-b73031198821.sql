UPDATE quote_items
SET multi = jsonb_set(multi, '{qtyInputs}', '[5000]'::jsonb)
WHERE id='20d5c658-6c30-47d7-a116-c1b6ad2d3ddb';

UPDATE sales_order_items
SET multi = jsonb_set(multi, '{qtyInputs}', '[5000]'::jsonb)
WHERE id='0ab44381-1461-403c-bfce-adb76e0284ad';