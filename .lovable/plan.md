

## Plan: Añadir "Tarifas" como submenú en Clientes (solo admin)

### Concepto
Crear una nueva página `/clientes/tarifas` que liste todos los clientes con descuentos configurados y permita gestionar las tarifas. Se añade como tercer submenú bajo "Clientes" (Listado, Nuevo, Tarifas), visible solo para admins.

### Cambios

**1. Nueva página `src/pages/CustomerDiscountsPage.tsx`**
- Lista todos los clientes de la organización
- Para cada cliente, muestra sus descuentos activos (si los tiene)
- Permite expandir un cliente para ver/crear/editar/eliminar descuentos inline
- Usa el hook `useCustomerDiscounts` existente
- Solo accesible por admins

**2. Ruta en `App.tsx`**
- Añadir `<Route path="/clientes/tarifas" ...>` con `ProtectedRoute` y `AppLayout`

**3. Submenú en `AppSidebar.tsx`**
- Añadir "Tarifas" como tercer `SidebarMenuSubItem` bajo Clientes (después de "Nuevo")
- Condición: solo visible si `membership?.role === 'admin'` o `isOrgAdmin`
- Icono: `Percent` de lucide-react

**4. Quitar sección de descuentos de `ClienteForm.tsx`**
- Eliminar la sección "Descuentos / Tarifas" del formulario de edición de cliente (se gestiona desde la nueva página)

### Estructura de la página Tarifas
- Buscador de clientes (filtro por nombre)
- Lista de clientes con badge indicando cuántos descuentos activos tiene cada uno
- Al hacer clic en un cliente, se expande mostrando el componente `CustomerDiscountsSection` existente
- Botón para ir al formulario del cliente si se necesita

