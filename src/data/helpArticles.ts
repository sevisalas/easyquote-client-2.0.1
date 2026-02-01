// Artículos de ayuda estáticos con acceso progresivo por rol
// Roles: user < comercial < operador < admin < superadmin

export type UserRole = 'user' | 'comercial' | 'operador' | 'admin' | 'superadmin';

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  icon: string;
  minRole: UserRole; // Rol mínimo para ver este artículo
  tags: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  minRole: UserRole;
}

// Jerarquía de roles (mayor número = más permisos)
export const roleHierarchy: Record<UserRole, number> = {
  user: 1,
  comercial: 2,
  operador: 3,
  admin: 4,
  superadmin: 5,
};

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Primeros pasos',
    icon: 'Rocket',
    description: 'Aprende lo básico para empezar a usar EasyQuote',
    minRole: 'user',
  },
  {
    id: 'quotes',
    name: 'Presupuestos',
    icon: 'FileText',
    description: 'Crea y gestiona presupuestos profesionales',
    minRole: 'user',
  },
  {
    id: 'customers',
    name: 'Clientes',
    icon: 'Users',
    description: 'Gestión de tu cartera de clientes',
    minRole: 'user',
  },
  {
    id: 'orders',
    name: 'Pedidos',
    icon: 'Package',
    description: 'Convierte presupuestos en pedidos y gestiona producción',
    minRole: 'comercial',
  },
  {
    id: 'production',
    name: 'Producción',
    icon: 'Factory',
    description: 'Panel de taller y gestión de tareas',
    minRole: 'operador',
  },
  {
    id: 'integrations',
    name: 'Integraciones',
    icon: 'Plug',
    description: 'Conecta con Holded, WooCommerce y más',
    minRole: 'admin',
  },
  {
    id: 'settings',
    name: 'Configuración',
    icon: 'Settings',
    description: 'Personaliza EasyQuote para tu empresa',
    minRole: 'admin',
  },
  {
    id: 'admin',
    name: 'Administración',
    icon: 'Shield',
    description: 'Gestión de suscriptores y sistema',
    minRole: 'superadmin',
  },
];

export const helpArticles: HelpArticle[] = [
  // ====== PRIMEROS PASOS ======
  {
    id: 'welcome',
    title: 'Bienvenido a EasyQuote',
    summary: 'Introducción general a la aplicación y sus funcionalidades principales.',
    content: `
## ¿Qué es EasyQuote?

EasyQuote es una aplicación de presupuestación profesional que te permite:

- **Crear presupuestos** con cálculo automático de precios
- **Gestionar clientes** y mantener un historial completo
- **Convertir presupuestos en pedidos** de forma instantánea
- **Controlar la producción** con un panel de taller intuitivo
- **Exportar a Holded** para facturación automática

## Navegación básica

- **Sidebar izquierdo**: Accede a todas las secciones
- **Dashboard**: Vista general de tu actividad reciente
- **Botón de ayuda**: Siempre disponible para consultas

## Primeros pasos recomendados

1. Añade tu primer cliente
2. Crea un presupuesto de prueba
3. Explora las configuraciones de tu cuenta
    `,
    category: 'getting-started',
    icon: 'Rocket',
    minRole: 'user',
    tags: ['inicio', 'bienvenida', 'introducción'],
  },
  {
    id: 'navigation',
    title: 'Navegación por la aplicación',
    summary: 'Cómo moverte por EasyQuote y encontrar lo que necesitas.',
    content: `
## Estructura del menú

El sidebar contiene todas las secciones principales:

### Para todos los usuarios
- **Inicio**: Dashboard con resumen de actividad
- **Clientes**: Listado y gestión de clientes
- **Presupuestos**: Crear y ver presupuestos

### Para comerciales y superiores
- **Pedidos**: Gestión de pedidos y producción

### Para administradores
- **Configuración**: Ajustes de la organización
- **Usuarios**: Gestión de miembros del equipo

## Atajos útiles

- Haz clic en el logo para volver al inicio
- Usa el botón de contraer para más espacio
- Cambia de organización desde el footer del menú
    `,
    category: 'getting-started',
    icon: 'Navigation',
    minRole: 'user',
    tags: ['navegación', 'menú', 'sidebar'],
  },

  // ====== PRESUPUESTOS ======
  {
    id: 'create-quote',
    title: 'Crear un presupuesto',
    summary: 'Paso a paso para crear tu primer presupuesto.',
    content: `
## Crear un nuevo presupuesto

1. Ve a **Presupuestos** → **Nuevo**
2. Selecciona o crea un cliente
3. Añade artículos al presupuesto

## Añadir artículos

Cada artículo se configura mediante:

1. **Selección de producto**: Elige del catálogo disponible
2. **Prompts**: Responde las preguntas del producto (cantidad, tamaño, etc.)
3. **Outputs**: Configura acabados y opciones
4. **Precio automático**: Se calcula en base a tus respuestas

## Guardar y enviar

- El presupuesto se guarda automáticamente
- Puedes generar PDF para enviar al cliente
- Exportar a Holded si tienes la integración activa
    `,
    category: 'quotes',
    icon: 'FileText',
    minRole: 'user',
    tags: ['presupuesto', 'crear', 'artículos', 'prompts'],
  },
  {
    id: 'quote-products',
    title: 'Configurar productos en presupuestos',
    summary: 'Cómo funcionan los prompts, outputs y el cálculo de precios.',
    content: `
## Sistema de configuración de productos

Los productos en EasyQuote se configuran dinámicamente:

### Prompts
Son las preguntas que definen el producto:
- Cantidad
- Tamaño/formato
- Tipo de papel
- Colores de impresión

### Outputs
Resultados calculados y opciones adicionales:
- Acabados disponibles
- Precio base calculado
- Opciones de envío

### Multi
Configuración de cantidades múltiples para un mismo producto.

## Importante

⚠️ **No modifiques precios manualmente** - El sistema calcula automáticamente desde la API de EasyQuote según los prompts configurados.
    `,
    category: 'quotes',
    icon: 'Calculator',
    minRole: 'user',
    tags: ['productos', 'prompts', 'outputs', 'precios'],
  },

  // ====== CLIENTES ======
  {
    id: 'manage-customers',
    title: 'Gestionar clientes',
    summary: 'Crear, editar y organizar tu cartera de clientes.',
    content: `
## Añadir un cliente

1. Ve a **Clientes** → **Nuevo**
2. Completa los datos básicos:
   - Nombre (obligatorio)
   - Email
   - Teléfono
   - Dirección

## Clientes desde Holded

Si tienes integración con Holded:
- Los clientes se sincronizan automáticamente
- Puedes importar contactos existentes
- Los cambios se reflejan en ambos sistemas

## Buscar clientes

- Usa el buscador en la lista de clientes
- Filtra por nombre, email o teléfono
    `,
    category: 'customers',
    icon: 'Users',
    minRole: 'user',
    tags: ['clientes', 'contactos', 'holded'],
  },

  // ====== PEDIDOS (comercial+) ======
  {
    id: 'create-order',
    title: 'Crear y gestionar pedidos',
    summary: 'Convertir presupuestos en pedidos y hacer seguimiento.',
    content: `
## Crear pedido desde presupuesto

La forma más rápida:
1. Abre un presupuesto aprobado
2. Haz clic en **Convertir a pedido**
3. El pedido hereda todos los artículos y configuración

## Crear pedido desde cero

1. Ve a **Pedidos** → **Nuevo**
2. Selecciona cliente
3. Añade artículos (igual que en presupuestos)

## Estados de pedido

- **Pendiente**: Recién creado
- **En producción**: Se ha iniciado el trabajo
- **Completado**: Listo para entregar
- **Entregado**: Finalizado
    `,
    category: 'orders',
    icon: 'Package',
    minRole: 'comercial',
    tags: ['pedidos', 'convertir', 'estados'],
  },

  // ====== PRODUCCIÓN (operador+) ======
  {
    id: 'production-panel',
    title: 'Panel de taller',
    summary: 'Gestión visual de tareas de producción.',
    content: `
## Acceder al panel

Ve a **Pedidos** → **Panel taller**

## Vista Kanban

Las tareas se organizan en columnas por fase:
- Pendiente
- En proceso
- Completado

## Gestionar tareas

- **Arrastrar**: Mueve tareas entre fases
- **Clic**: Abre detalles de la tarea
- **Timer**: Registra tiempo de trabajo

## Filtros

- Por fecha de entrega
- Por operador asignado
- Por estado
    `,
    category: 'production',
    icon: 'Factory',
    minRole: 'operador',
    tags: ['producción', 'taller', 'kanban', 'tareas'],
  },

  // ====== INTEGRACIONES (admin+) ======
  {
    id: 'holded-integration',
    title: 'Integración con Holded',
    summary: 'Configura la conexión con Holded para facturación automática.',
    content: `
## Configurar Holded

1. Ve a **Configuración** → **Integraciones**
2. Activa Holded
3. Introduce tu API Key de Holded

## Funcionalidades

Con Holded conectado puedes:
- Exportar presupuestos como borradores
- Exportar pedidos como ventas
- Sincronizar clientes bidireccionalmen
- Generar PDFs automáticamete

## Mapeo de cuentas

Configura las cuentas contables para:
- Ventas
- Productos
- Impuestos
    `,
    category: 'integrations',
    icon: 'Plug',
    minRole: 'admin',
    tags: ['holded', 'integración', 'facturación', 'api'],
  },

  // ====== CONFIGURACIÓN (admin+) ======
  {
    id: 'numbering-formats',
    title: 'Formatos de numeración',
    summary: 'Personaliza la numeración de presupuestos y pedidos.',
    content: `
## Configurar numeración

Ve a **Configuración** → **Numeración**

## Opciones disponibles

- **Prefijo**: Texto antes del número (ej: "PRE-")
- **Año**: Incluir año en la numeración
- **Dígitos**: Cantidad de dígitos del secuencial
- **Sufijo**: Texto después del número

## Ejemplos

- PRE-2024-0001
- P24001
- 2024/PRE/00001
    `,
    category: 'settings',
    icon: 'Hash',
    minRole: 'admin',
    tags: ['numeración', 'formato', 'prefijo'],
  },
  {
    id: 'user-management',
    title: 'Gestión de usuarios',
    summary: 'Añadir, editar y gestionar los miembros de tu equipo.',
    content: `
## Roles disponibles

- **Usuario**: Acceso básico a presupuestos y clientes
- **Comercial**: + Acceso a pedidos
- **Operador**: + Panel de producción
- **Admin**: + Configuración e integraciones

## Invitar usuario

1. Ve a **Gestión de usuarios**
2. Haz clic en **Invitar**
3. Introduce email y selecciona rol
4. El usuario recibirá un email de invitación

## Modificar permisos

Solo los administradores pueden cambiar roles de otros usuarios.
    `,
    category: 'settings',
    icon: 'UserCog',
    minRole: 'admin',
    tags: ['usuarios', 'roles', 'permisos', 'invitar'],
  },

  // ====== ADMINISTRACIÓN (superadmin) ======
  {
    id: 'subscriber-management',
    title: 'Gestión de suscriptores',
    summary: 'Administrar organizaciones y planes de suscripción.',
    content: `
## Panel de suscriptores

Accede desde el menú lateral → **Suscriptores**

## Acciones disponibles

- **Crear organización**: Nueva cuenta para un cliente
- **Editar plan**: Cambiar límites y módulos
- **Ver usuarios**: Listar miembros de cada organización
- **Configurar credenciales**: API EasyQuote por organización

## Planes

- **API**: Solo acceso API
- **Client**: Presupuestos + Clientes
- **ERP**: + Pedidos + Producción
    `,
    category: 'admin',
    icon: 'Shield',
    minRole: 'superadmin',
    tags: ['suscriptores', 'planes', 'organizaciones'],
  },
];

// Helper para filtrar artículos por rol
export function getArticlesForRole(userRole: UserRole): HelpArticle[] {
  const userRoleLevel = roleHierarchy[userRole];
  return helpArticles.filter(
    (article) => roleHierarchy[article.minRole] <= userRoleLevel
  );
}

// Helper para filtrar categorías por rol
export function getCategoriesForRole(userRole: UserRole): HelpCategory[] {
  const userRoleLevel = roleHierarchy[userRole];
  return helpCategories.filter(
    (category) => roleHierarchy[category.minRole] <= userRoleLevel
  );
}

// Helper para buscar artículos
export function searchArticles(
  articles: HelpArticle[],
  query: string
): HelpArticle[] {
  const lowerQuery = query.toLowerCase();
  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(lowerQuery) ||
      article.summary.toLowerCase().includes(lowerQuery) ||
      article.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
