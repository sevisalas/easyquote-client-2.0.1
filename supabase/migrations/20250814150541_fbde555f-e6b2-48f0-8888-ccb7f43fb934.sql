-- Corregir los campos NULL en auth.users para vdp@tradsis.net
UPDATE auth.users 
SET 
  confirmation_token = NULL,
  email_change = NULL,
  email_change_token_new = NULL,
  recovery_token = NULL,
  email_change_token_current = NULL,
  phone_change = NULL,
  phone_change_token = NULL
WHERE email = 'vdp@tradsis.net';