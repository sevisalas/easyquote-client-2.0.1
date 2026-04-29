-- Restrict pdf_templates SELECT to authenticated users
DROP POLICY IF EXISTS "Users can view available templates" ON public.pdf_templates;
CREATE POLICY "Authenticated users can view available templates"
ON public.pdf_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- Restrict integrations SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view integrations" ON public.integrations;
CREATE POLICY "Authenticated users can view integrations"
ON public.integrations
FOR SELECT
TO authenticated
USING (true);