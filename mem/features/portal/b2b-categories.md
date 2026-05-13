---
name: B2B Portal Categories
description: Categorías y subcategorías (1 nivel) por organización en tabla b2b_categories; b2b_catalog_items.category_id las vincula
type: feature
---
- Tabla `public.b2b_categories` (organization_id, parent_id, name, display_order, is_active). Trigger limita a 2 niveles (principal + subcategoría) y exige misma org en parent_id.
- `b2b_catalog_items.category_id` -> b2b_categories(id) ON DELETE SET NULL.
- RLS: lectura por miembros u owner de la org; escritura admin/gestor o owner.
- UI admin en /configuracion/portal-b2b: card de gestión de categorías + selector jerárquico en diálogo + lista agrupada por categoría.
- Pendiente: aplicar agrupación por categoría en el portal cliente (PortalHome / vista B2B cliente).
