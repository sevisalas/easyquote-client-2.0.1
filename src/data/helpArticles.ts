// Artículos de ayuda estáticos con acceso progresivo por rol
// Roles: user < comercial < operador < admin < superadmin

export type UserRole = "user" | "comercial" | "operador" | "admin" | "superadmin";

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
    id: "getting-started",
    name: "Primeros pasos",
    icon: "Rocket",
    description: "Aprende lo básico para empezar a usar EasyQuote",
    minRole: "user",
  },
  {
    id: "quotes",
    name: "Presupuestos",
    icon: "FileText",
    description: "Crea y gestiona presupuestos profesionales",
    minRole: "user",
  },
  {
    id: "customers",
    name: "Clientes",
    icon: "Users",
    description: "Gestión de tu cartera de clientes",
    minRole: "user",
  },
  {
    id: "orders",
    name: "Pedidos",
    icon: "Package",
    description: "Convierte presupuestos en pedidos y gestiona producción",
    minRole: "comercial",
  },
  {
    id: "production",
    name: "Producción",
    icon: "Factory",
    description: "Panel de taller y gestión de tareas",
    minRole: "operador",
  },
  {
    id: "integrations",
    name: "Integraciones",
    icon: "Plug",
    description: "Conecta con Holded, WooCommerce y más",
    minRole: "admin",
  },
  {
    id: "excel",
    name: "Archivos Excel",
    icon: "FileSpreadsheet",
    description: "Gestión de archivos Excel y maestros",
    minRole: "admin",
  },
  {
    id: "settings",
    name: "Configuración",
    icon: "Settings",
    description: "Personaliza EasyQuote para tu empresa",
    minRole: "admin",
  },
  {
    id: "admin",
    name: "Administración",
    icon: "Shield",
    description: "Gestión de suscriptores y sistema",
    minRole: "superadmin",
  },
];

export const helpArticles: HelpArticle[] = [
  // ====== PRIMEROS PASOS ======
  {
    id: "welcome",
    title: "Bienvenido a EasyQuote",
    summary: "Introducción general a la aplicación y sus funcionalidades principales.",
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
    category: "getting-started",
    icon: "Rocket",
    minRole: "user",
    tags: ["inicio", "bienvenida", "introducción"],
  },
  {
    id: "navigation",
    title: "Navegación por la aplicación",
    summary: "Cómo moverte por EasyQuote y encontrar lo que necesitas.",
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
    category: "getting-started",
    icon: "Navigation",
    minRole: "user",
    tags: ["navegación", "menú", "sidebar"],
  },

  // ====== PRESUPUESTOS ======
  {
    id: "create-quote",
    title: "Crear un presupuesto",
    summary: "Paso a paso para crear tu primer presupuesto.",
    content: `
## Crear un nuevo presupuesto

1. Ve a **Presupuestos** → **Nuevo**
2. Selecciona o crea un cliente
3. Añade artículos al presupuesto

## Añadir artículos

Cada artículo se configura mediante:

1. **Selección de producto**: Elige del catálogo disponible
2. **Datos de entrada**: Responde las preguntas del producto (cantidad, tamaño, etc.)
3. **Datos de salida**: Configura acabados y opciones
4. **Precio automático**: Se calcula en base a tus respuestas

## Guardar y enviar

- El presupuesto se guarda automáticamente
- Puedes generar PDF para enviar al cliente
- Exportar a Holded si tienes la integración activa
    `,
    category: "quotes",
    icon: "FileText",
    minRole: "user",
    tags: ["presupuesto", "crear", "artículos", "entradas"],
  },
  {
    id: "quote-products",
    title: "Configurar productos en presupuestos",
    summary: "Cómo funcionan los datos de entrada, de salida y el cálculo de precios.",
    content: `
## Sistema de configuración de productos

Los productos en EasyQuote se configuran dinámicamente:

### Datos de entrada
Son las preguntas que definen el producto:
- Cantidad
- Tamaño/formato
- Tipo de papel
- Colores de impresión

### Datos de salida
Resultados calculados y opciones adicionales:
- Acabados disponibles
- Precio base calculado
- Opciones de envío

### Multi
Configuración de cantidades múltiples para un mismo producto.

## Importante

⚠️ **No modifiques precios manualmente** - El sistema calcula automáticamente desde la API de EasyQuote según los datos de entrada configurados.
    `,
    category: "quotes",
    icon: "Calculator",
    minRole: "user",
    tags: ["productos", "entradas", "salidas", "precios"],
  },

  // ====== CLIENTES ======
  {
    id: "manage-customers",
    title: "Gestionar clientes",
    summary: "Crear, editar y organizar tu cartera de clientes.",
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
    category: "customers",
    icon: "Users",
    minRole: "user",
    tags: ["clientes", "contactos", "holded"],
  },
  {
    id: "customer-tariffs",
    title: "Tarifas de cliente",
    summary: "Aplica descuentos o recargos automáticos a presupuestos y pedidos de un cliente.",
    content: `
## ¿Qué son las tarifas?

Las tarifas permiten aplicar un descuento o recargo porcentual de forma automática a los presupuestos y pedidos de un cliente concreto. Son invisibles en el PDF y en las exportaciones a Holded.

## Cómo se aplican

⚠️ **Importante**: la tarifa del cliente se aplica **únicamente al precio base del artículo** (el "Price" que devuelve el motor de cálculo, o la suma de "Price" de los componentes en productos compuestos).

**La tarifa NO se aplica a ningún tipo de ajuste**, ni de artículo ni de presupuesto:
- ❌ Ajustes de importe fijo (€)
- ❌ Ajustes porcentuales (%)
- ❌ Ajustes multiplicadores (×)
- ❌ Ajustes por capacidad

### ¿Y si quiero aplicar un descuento sobre un ajuste?

Si necesitas que un ajuste lleve descuento para un cliente concreto, tienes dos opciones:

1. **Introducir el ajuste con el precio ya descontado** manualmente al añadirlo al presupuesto.
2. **Crear un ajuste específico de descuento** para ese cliente y añadirlo a sus presupuestos.

## Asignar una tarifa a un cliente

1. Ve a **Clientes** → selecciona el cliente
2. En la sección **Descuentos / Tarifas**, asigna una tarifa existente o crea una nueva
3. Indica si es descuento (resta) o recargo (suma) y el porcentaje

## Indicador en presupuestos y pedidos

Cuando un cliente tiene tarifa activa, se muestra un aviso debajo del selector de cliente con el nombre y porcentaje de la tarifa aplicada.

## Ejemplo

Si un cliente tiene una tarifa del **−10%** y el precio base de un artículo es **100 €**:
- Precio ajustado del artículo: **90 €**
- Un ajuste fijo de **20 €** se mantiene en **20 €** (sin descuento)
- Un ajuste porcentual del **5%** se calcula sobre **100 €** (precio base sin tarifa) → **5 €**
    `,
    category: "customers",
    icon: "Percent",
    minRole: "admin",
    tags: ["tarifas", "descuentos", "recargos", "clientes", "precios"],
  },

  // ====== PEDIDOS (comercial+) ======
  {
    id: "create-order",
    title: "Crear y gestionar pedidos",
    summary: "Convertir presupuestos en pedidos y hacer seguimiento.",
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
    category: "orders",
    icon: "Package",
    minRole: "comercial",
    tags: ["pedidos", "convertir", "estados"],
  },

  // ====== PRODUCCIÓN (operador+) ======
  {
    id: "production-panel",
    title: "Panel de taller",
    summary: "Gestión visual de tareas de producción.",
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
    category: "production",
    icon: "Factory",
    minRole: "operador",
    tags: ["producción", "taller", "kanban", "tareas"],
  },

  // ====== INTEGRACIONES (admin+) ======
  {
    id: "holded-integration",
    title: "Integración con Holded",
    summary: "Configura la conexión con Holded para facturación automática.",
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
    category: "integrations",
    icon: "Plug",
    minRole: "admin",
    tags: ["holded", "integración", "facturación", "api"],
  },

  // ====== ARCHIVOS EXCEL (admin+) ======
  {
    id: "excel-master-files",
    title: "Archivos Excel maestros",
    summary: "Cómo funcionan los archivos maestros y la vinculación con archivos hijos.",
    content: `
## ¿Qué son los archivos maestros?

Los archivos maestros centralizan la lógica de cálculo compartida entre varios productos. En lugar de duplicar fórmulas en cada archivo Excel, los archivos hijos referencian al maestro para obtener datos comunes (tarifas, tablas de precios, configuraciones).

## Ventajas

- **Mantenimiento centralizado**: Cambia una tarifa en el maestro y se refleja en todos los productos hijos
- **Menos errores**: Evita inconsistencias entre archivos duplicados
- **Sin pérdida de rendimiento**: Los tiempos de cálculo son equivalentes a archivos independientes

## Configurar un archivo como maestro

1. Ve a **Archivos Excel**
2. Localiza el archivo que quieres usar como maestro
3. Activa el interruptor **Es maestro**
4. Asigna un **nombre de referencia local** (ej: "maestro EQ01.xlsx")
5. Se generará una URL pública que puedes copiar

## Subir un archivo hijo vinculado

1. En **Archivos Excel**, haz clic en **Subir archivo**
2. Selecciona el archivo .xlsx
3. En el selector **Asociar maestro**, elige el archivo maestro correspondiente
4. Al subir, el sistema reemplaza automáticamente las referencias externas por la URL del maestro

## Actualizar un archivo hijo

Al actualizar un archivo existente:
1. Haz clic en **Actualizar** junto al archivo
2. Selecciona el nuevo .xlsx
3. Elige el maestro a asociar (si aplica)
4. El sistema vuelve a procesar las referencias automáticamente

## ¿Cómo funciona internamente?

El sistema analiza el archivo .xlsx y busca referencias externas (enlaces a otros archivos Excel). Al encontrarlas, las sustituye por la URL pública del maestro alojado en EasyQuote. Esto permite que las fórmulas funcionen tanto en la nube como al descargar el archivo.

## Preguntas frecuentes

**¿Afecta al rendimiento?**
No. Las pruebas de benchmark confirman tiempos equivalentes (~500ms) entre productos con y sin maestro.

**¿Puedo tener varios maestros?**
Sí. Puedes marcar varios archivos como maestros, cada uno con su nombre de referencia local.

**¿Qué pasa si actualizo el maestro?**
Los archivos hijos que ya fueron subidos con la referencia al maestro seguirán funcionando. Si cambias la estructura del maestro, deberás re-subir los archivos hijos.
    `,
    category: "excel",
    icon: "Crown",
    minRole: "admin",
    tags: ["excel", "maestro", "master", "archivos", "vinculación", "fórmulas"],
  },

  {
    id: "excel-error-scanner",
    title: "Revisión previa de archivos Excel",
    summary: "Escanea tu archivo Excel antes de subirlo para detectar errores y problemas.",
    content: `
## ¿Para qué sirve?

Antes de subir un archivo Excel a EasyQuote, puedes escanearlo para detectar problemas que podrían causar errores de cálculo o fallos en la API. Esto te ahorra tiempo y evita incidencias.

## Cómo usar el escáner

1. Ve a **Archivos Excel**
2. Haz clic en el botón **Revisar Excel** (icono de lupa)
3. Selecciona o arrastra el archivo .xlsx que quieres analizar
4. El sistema analizará el archivo y mostrará un informe

## ¿Qué detecta?

El escáner busca los problemas más comunes:

### Errores de fórmulas
- **#REF!**: Referencias a celdas que no existen (celdas eliminadas)
- **#DIV/0!**: Divisiones entre cero
- **#VALUE!**: Tipos de datos incorrectos en fórmulas
- **#NAME?**: Nombres de funciones no reconocidos
- **#N/A**: Valores no encontrados en búsquedas

### Problemas estructurales
- **Enlaces externos rotos**: Referencias a otros archivos que no están disponibles
- **Hojas vacías**: Hojas sin contenido que pueden causar confusión
- **Celdas con texto muy largo**: Valores que podrían causar problemas en la API

### Advertencias
- **Fórmulas circulares**: Celdas que se referencian a sí mismas
- **Rangos con nombre inválidos**: Nombres definidos que apuntan a celdas inexistentes

## Interpretar los resultados

- 🟢 **Sin errores**: El archivo está listo para subir
- 🟡 **Advertencias**: El archivo puede funcionar, pero conviene revisar los puntos señalados
- 🔴 **Errores**: Se recomienda corregir los problemas antes de subir

## Recomendaciones

- Ejecuta siempre el escáner **antes de subir** un archivo nuevo o actualizado
- Presta especial atención a los errores **#REF!** ya que suelen causar fallos en el motor de cálculo
- Si el archivo tiene enlaces externos, considera usar la función de **archivos maestros** para gestionarlos
    `,
    category: "excel",
    icon: "Search",
    minRole: "admin",
    tags: ["excel", "errores", "revisión", "escanear", "problemas", "fórmulas", "diagnóstico"],
  },

  // ====== CONFIGURACIÓN (admin+) ======
  {
    id: "numbering-formats",
    title: "Formatos de numeración",
    summary: "Personaliza la numeración de presupuestos y pedidos.",
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
    category: "settings",
    icon: "Hash",
    minRole: "admin",
    tags: ["numeración", "formato", "prefijo"],
  },
  {
    id: "user-management",
    title: "Gestión de usuarios",
    summary: "Añadir, editar y gestionar los miembros de tu equipo.",
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
    category: "settings",
    icon: "UserCog",
    minRole: "admin",
    tags: ["usuarios", "roles", "permisos", "invitar"],
  },

  // ====== ADMINISTRACIÓN (superadmin) ======
  {
    id: "subscriber-management",
    title: "Gestión de suscriptores",
    summary: "Administrar organizaciones y planes de suscripción.",
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
    category: "admin",
    icon: "Shield",
    minRole: "superadmin",
    tags: ["suscriptores", "planes", "organizaciones"],
  },
];

// Helper para filtrar artículos por rol
export function getArticlesForRole(userRole: UserRole): HelpArticle[] {
  const userRoleLevel = roleHierarchy[userRole];
  return helpArticles.filter((article) => roleHierarchy[article.minRole] <= userRoleLevel);
}

// Helper para filtrar categorías por rol
export function getCategoriesForRole(userRole: UserRole): HelpCategory[] {
  const userRoleLevel = roleHierarchy[userRole];
  return helpCategories.filter((category) => roleHierarchy[category.minRole] <= userRoleLevel);
}

// Helper para buscar artículos
export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const lowerQuery = query.toLowerCase();
  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(lowerQuery) ||
      article.summary.toLowerCase().includes(lowerQuery) ||
      article.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
  );
}
