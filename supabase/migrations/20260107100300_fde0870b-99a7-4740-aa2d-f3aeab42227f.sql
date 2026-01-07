
-- 1. Añadir columna organization_id a additionals
ALTER TABLE public.additionals 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 2. Migrar datos existentes: asociar cada additional a la organización del usuario que lo creó
UPDATE public.additionals a
SET organization_id = COALESCE(
  -- Primero intentar como api_user_id (owner de organización)
  (SELECT o.id FROM public.organizations o WHERE o.api_user_id = a.user_id LIMIT 1),
  -- Si no, buscar la organización del usuario como miembro
  (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = a.user_id LIMIT 1)
)
WHERE a.organization_id IS NULL;

-- 3. Hacer organization_id NOT NULL después de la migración
ALTER TABLE public.additionals 
ALTER COLUMN organization_id SET NOT NULL;

-- 4. Eliminar políticas antiguas basadas en user_id
DROP POLICY IF EXISTS "Users can view their own additionals" ON public.additionals;
DROP POLICY IF EXISTS "Users can create their own additionals" ON public.additionals;
DROP POLICY IF EXISTS "Users can update their own additionals" ON public.additionals;
DROP POLICY IF EXISTS "Users can delete their own additionals" ON public.additionals;

-- 5. Crear nuevas políticas basadas en organization_id
-- SELECT: Todos los miembros de la organización pueden ver los ajustes
CREATE POLICY "Organization members can view additionals"
ON public.additionals FOR SELECT
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o WHERE o.api_user_id = auth.uid()
    UNION
    SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
  )
);

-- INSERT: Solo admins pueden crear ajustes
CREATE POLICY "Organization admins can create additionals"
ON public.additionals FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT o.id FROM public.organizations o WHERE o.api_user_id = auth.uid()
    UNION
    SELECT om.organization_id FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.role = 'admin'
  )
);

-- UPDATE: Solo admins pueden actualizar ajustes
CREATE POLICY "Organization admins can update additionals"
ON public.additionals FOR UPDATE
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o WHERE o.api_user_id = auth.uid()
    UNION
    SELECT om.organization_id FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.role = 'admin'
  )
);

-- DELETE: Solo admins pueden eliminar ajustes
CREATE POLICY "Organization admins can delete additionals"
ON public.additionals FOR DELETE
USING (
  organization_id IN (
    SELECT o.id FROM public.organizations o WHERE o.api_user_id = auth.uid()
    UNION
    SELECT om.organization_id FROM public.organization_members om 
    WHERE om.user_id = auth.uid() AND om.role = 'admin'
  )
);

-- 6. Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_additionals_organization_id ON public.additionals(organization_id);
