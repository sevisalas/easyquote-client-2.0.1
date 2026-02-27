-- Fix quote PR-26-000111: update totals to reflect only accepted items
UPDATE quotes 
SET subtotal = 80.79, final_price = 80.79 
WHERE id = 'be4c54be-406c-4bf8-85b9-e0e47ed9ffe7';