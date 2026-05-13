-- 1. Tabla de categorías del catálogo B2B
CREATE TABLE public.b2b_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES public.b2b_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_b2b_categories_org ON public.b2b_categories(organization_id);
CREATE INDEX idx_b2b_categories_parent ON public.b2b_categories(parent_id);

-- Evitar subcategorías de subcategorías (solo 2 niveles: principal + sub)
CREATE OR REPLACE FUNCTION public.b2b_categories_max_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_parent UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id INTO parent_parent FROM public.b2b_categories WHERE id = NEW.parent_id;
    IF parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'Solo se permite un nivel de subcategorías (principal -> subcategoría).';
    END IF;
    -- Asegurar que la categoría padre pertenece a la misma organización
    IF NOT EXISTS (
      SELECT 1 FROM public.b2b_categories
      WHERE id = NEW.parent_id AND organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'La categoría padre debe pertenecer a la misma organización.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_b2b_categories_max_depth
BEFORE INSERT OR UPDATE ON public.b2b_categories
FOR EACH ROW EXECUTE FUNCTION public.b2b_categories_max_depth();

-- Trigger updated_at
CREATE TRIGGER trg_b2b_categories_updated_at
BEFORE UPDATE ON public.b2b_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.b2b_categories ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la organización
CREATE POLICY "b2b_categories_select_members"
ON public.b2b_categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = b2b_categories.organization_id
      AND o.api_user_id = auth.uid()
  )
);

-- Escritura: admin/gestor de la organización o dueño (api_user_id)
CREATE POLICY "b2b_categories_insert_admin"
ON public.b2b_categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = b2b_categories.organization_id
      AND o.api_user_id = auth.uid()
  )
);

CREATE POLICY "b2b_categories_update_admin"
ON public.b2b_categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = b2b_categories.organization_id
      AND o.api_user_id = auth.uid()
  )
);

CREATE POLICY "b2b_categories_delete_admin"
ON public.b2b_categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = b2b_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = b2b_categories.organization_id
      AND o.api_user_id = auth.uid()
  )
);

-- GRANTS explícitos para futuras políticas Supabase Data API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_categories TO service_role;

-- 2. Añadir category_id a b2b_catalog_items
ALTER TABLE public.b2b_catalog_items
ADD COLUMN category_id UUID NULL REFERENCES public.b2b_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_b2b_catalog_items_category ON public.b2b_catalog_items(category_id);