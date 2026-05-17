
# Modo Oscuro (Dark Mode) en EasyQuote

## Estado actual
- `index.css` ya tiene definida la variante `.dark` con todas las variables HSL (background, foreground, primary, sidebar, etc.).
- Tailwind ya soporta `dark:` por clase.
- **Falta todo el resto**: no hay toggle, no se aplica nunca la clase `dark` al `<html>`, no se persiste, y los logos no cambian.

## Qué voy a construir

### 1. Sistema de tema claro/oscuro/sistema
- Nuevo hook `useDarkMode()` que:
  - Lee la preferencia del usuario de `localStorage` (`easyquote-theme`: `light` | `dark` | `system`).
  - Si es `system`, escucha `prefers-color-scheme` y se actualiza en vivo.
  - Aplica/quita la clase `dark` en `<html>`.
  - Expone `mode`, `resolvedMode` (`light`|`dark`) y `setMode`.
- Inicialización temprana en `index.html` (script inline) para evitar el "flash" de tema claro al cargar.

### 2. Toggle visible para el usuario
- Botón en el **header** (junto al avatar / selector de organización) con icono Sol / Luna / Monitor y menú de 3 opciones: Claro, Oscuro, Sistema.
- También accesible desde **Configuración → Tema Corporativo** como sección "Apariencia (preferencia personal)" — para que quede claro que el tema corporativo (colores de marca) y el modo claro/oscuro son cosas distintas.

### 3. Ajuste del tema corporativo en modo oscuro
- `useTheme` (colores de organización) actualmente sobreescribe `--primary`, `--sidebar-*`, etc. **siempre**, lo cual rompería el modo oscuro.
- Lo modifico para que: si está activo el modo oscuro, **no inyecte los colores claros del tema corporativo en `:root`**, sino que los aplique únicamente dentro de la variante oscura (o los omita y use los del `.dark` por defecto).
- Decisión simple: en modo oscuro mantenemos los colores `.dark` predefinidos y solo respetamos `--primary` corporativo (acento de marca). Resto (sidebar, fondos, muted) usa los del `.dark`.

### 4. Logos blancos en modo oscuro
- Copiar `logo_transparente_blanco.png` y `favicon_blanco.png` a `public/lovable-uploads/`.
- En `AppSidebar.tsx`, `Index.tsx`, `Auth.tsx`, `ApiHome.tsx`: usar `resolvedMode === 'dark'` para alternar `src`.

### 5. Revisión de componentes con colores hardcodeados
- Búsqueda rápida de `bg-white`, `text-black`, `bg-gray-*` en componentes de layout principal y reemplazo por tokens semánticos (`bg-background`, `text-foreground`, `bg-muted`) donde aplique. Alcance: sidebar, header, dashboard, listados de presupuestos/pedidos. No tocaré PDFs ni plantillas de email (deben quedar siempre en claro).

## Fuera de alcance
- BD: no se crea ninguna tabla. La preferencia es por usuario y vive en `localStorage`.
- Plantillas PDF, exportaciones Holded, emails → siempre en claro.
- Portal cliente público → no se toca en esta iteración (se puede añadir después si lo quieres).
- Tema oscuro forzado a nivel organización → no, es preferencia personal.

## Resultado
El usuario tendrá un botón Sol/Luna en el header. Al cambiar, toda la app cambia al instante, el logo de EasyQuote pasa a blanco, y la preferencia se recuerda en su navegador. El tema corporativo (colores de marca) sigue funcionando en claro; en oscuro se aplica el modo oscuro estándar conservando el color primario corporativo como acento.
