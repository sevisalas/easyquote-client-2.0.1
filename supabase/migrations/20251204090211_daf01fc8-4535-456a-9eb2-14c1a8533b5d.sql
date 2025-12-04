-- Fix sales_orders without organization_id by matching user_id to organization owner
UPDATE sales_orders 
SET organization_id = 'cae1d80f-fb8e-4101-bed8-d721d5bb8729'
WHERE user_id = '5a19026a-f9c0-46e6-925f-1fcc2094ef59'
  AND organization_id IS NULL;

-- Fix Tradsis order
UPDATE sales_orders 
SET organization_id = 'f95d535e-5a8f-4fef-9dda-75071d5b0e9e'
WHERE user_id = 'b47bd4a9-9244-423a-951e-0541af80da88'
  AND organization_id IS NULL;