

## Plan: Plantilla de email editable por organización

### Problema actual
Cuando se envía un presupuesto por email, el diseño del email es siempre el mismo y no se puede cambiar. Cada organización debería poder personalizar su propio email.

### Lo que se va a construir

**En la página de Configuración SMTP** (donde ya configuras el servidor de correo), se añade una nueva sección "Plantilla de email" con:
- Campo para editar el **asunto** del email
- Editor para el **cuerpo HTML** del email
- Etiquetas con las **variables disponibles** que se pueden usar: nombre del cliente, numero de presupuesto, precio, enlace al PDF, nombre de la empresa
- Botón de **vista previa** para ver cómo queda antes de guardar
- Botón guardar

Cuando se envía un presupuesto, el sistema usa la plantilla personalizada de esa organización. Si no ha creado ninguna, usa una por defecto.

### Cambios técnicos

1. **Nueva tabla `email_templates`** en la base de datos
   - Guarda el asunto y cuerpo HTML por organización
   - Protegida para que cada org solo vea la suya

2. **Nuevo hook `useEmailTemplates.ts`**
   - Carga y guarda la plantilla de la organización actual

3. **Modificar `SettingsSmtp.tsx`**
   - Añadir la card de "Plantilla de email" debajo de la config SMTP

4. **Modificar Edge Function `send-quote-email`**
   - Buscar si la organización tiene plantilla personalizada
   - Si la tiene, usarla reemplazando las variables
   - Si no, usar la plantilla por defecto

