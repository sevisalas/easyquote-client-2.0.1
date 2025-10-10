-- First, set invalid customer_id references to NULL
UPDATE quotes 
SET customer_id = NULL 
WHERE customer_id IS NOT NULL 
AND customer_id NOT IN (SELECT id FROM customers);

-- Now add the foreign key constraint
ALTER TABLE quotes 
ADD CONSTRAINT quotes_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE SET NULL;