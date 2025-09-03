-- Remove the confusingly named duplicate RLS policy that could be misleading
-- Keep only the properly named user-specific access control policy
DROP POLICY "Enable read access for all users" ON public.customers;