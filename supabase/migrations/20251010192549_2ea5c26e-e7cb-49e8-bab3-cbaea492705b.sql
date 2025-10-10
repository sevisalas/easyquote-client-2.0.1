-- First, check if the constraint already exists and drop it if needed
ALTER TABLE quote_additionals DROP CONSTRAINT IF EXISTS quote_additionals_additional_id_fkey;

-- Clean up invalid additional_id references
UPDATE quote_additionals 
SET additional_id = NULL 
WHERE additional_id IS NOT NULL 
AND additional_id NOT IN (SELECT id FROM additionals);

-- Now add the foreign key constraint
ALTER TABLE quote_additionals 
ADD CONSTRAINT quote_additionals_additional_id_fkey 
FOREIGN KEY (additional_id) 
REFERENCES additionals(id) 
ON DELETE SET NULL;