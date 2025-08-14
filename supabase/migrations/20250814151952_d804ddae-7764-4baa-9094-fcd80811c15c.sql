-- Fix only the confirmation_token field that exists
UPDATE auth.users 
SET confirmation_token = '' 
WHERE confirmation_token IS NULL;

-- Also fix recovery_token if it exists
UPDATE auth.users 
SET recovery_token = '' 
WHERE recovery_token IS NULL;