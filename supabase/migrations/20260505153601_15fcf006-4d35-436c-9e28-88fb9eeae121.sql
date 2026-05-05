CREATE POLICY "Portal customers can view their org PDF configuration"
ON public.pdf_configurations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.portal_user_id = auth.uid()
      AND c.organization_id = pdf_configurations.organization_id
  )
);