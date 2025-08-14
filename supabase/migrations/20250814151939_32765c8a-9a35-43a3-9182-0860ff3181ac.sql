-- Fix the confirmation_token issue by updating NULL values to empty strings
UPDATE auth.users 
SET confirmation_token = '' 
WHERE confirmation_token IS NULL;

-- Also ensure email_confirm_token is handled
UPDATE auth.users 
SET email_confirm_token = '' 
WHERE email_confirm_token IS NULL;

-- Make sure recovery_token is also handled
UPDATE auth.users 
SET recovery_token = '' 
WHERE recovery_token IS NULL;