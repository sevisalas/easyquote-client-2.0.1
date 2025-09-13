-- Update password policy to allow shorter passwords
UPDATE auth.config 
SET password_min_length = 4 
WHERE parameter = 'password_min_length';