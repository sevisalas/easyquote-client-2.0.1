-- Revisar las políticas RLS actuales en organization_integration_access
-- y añadir política para que los miembros de la organización puedan leer sus accesos

-- Permitir que los miembros de una organización lean los accesos de integración de su organización
CREATE POLICY "Organization members can view their integration access" 
ON public.organization_integration_access 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.organizations o 
    WHERE o.id = organization_integration_access.organization_id 
    AND o.api_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 
    FROM public.organization_members om 
    WHERE om.organization_id = organization_integration_access.organization_id 
    AND om.user_id = auth.uid()
  )
);