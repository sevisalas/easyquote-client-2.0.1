# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [2.2.5] - 2025-12-04

### Corregido
- **Presupuestos sin organization_id**: Migración de datos para asignar organization_id correcto a presupuestos de Reprotel y Tradsis
- **Columnas de Holded visibles sin API key**: Las columnas de Nº Holded ahora se muestran si la organización tiene acceso a la integración, independientemente de si la API key está configurada (aplica a presupuestos y pedidos)

---

## [2.2.4] - 2025-12-03

### Corregido
- **SPA routing en producción**: Agregado `web.config` para IIS y `_redirects` para otros hosts, evitando errores 404 al recargar páginas

---

## [2.2.3] - 2025-12-03

### Corregido
- **Filtro de prompts ocultos en Holded**: Los prompts marcados como "Ocultar en documentos" ahora se filtran correctamente al exportar presupuestos a Holded
- **Limbo de organización en login**: Usuarios con múltiples organizaciones ya no se quedan sin organización seleccionada al iniciar sesión
- **Limpieza de sesión al cerrar**: Se limpia `pending_org_selection` al hacer logout para evitar problemas de selección de organización

---

## [2.2.1] - 2025-12-03

### Añadido
- **Botón "Actualizar contactos"** en página de Clientes (igual que en Nuevo Presupuesto)

### Corregido
- **Selector de organizaciones en login**: Usuarios con múltiples organizaciones ahora son redirigidos correctamente a la organización seleccionada

---

## [2.1.0] - 2025-11-26

### Añadido
- **Interfaz móvil simplificada**
  - Accesos directos con diseño minimalista (solo texto, sin iconos)
  - Solo 2 acciones principales: "Nuevo presupuesto" y "Pedidos en producción"
  - Diseño con color secundario unificado

### Cambiado
- **Header móvil eliminado**: Mayor espacio vertical en dispositivos móviles
- **"Acciones rápidas" renombrado a "Accesos directos"**
- **Textos centrados** en accesos directos para mejor presentación
- **Botones simplificados** en acciones eliminando iconos redundantes

### Eliminado
- Header móvil (MobileHeader) completamente removido
- Iconos en tarjetas de accesos directos
- Acciones secundarias: "Añadir cliente" y "Pendientes"

---

## [2.0.0] - 2024-11-25

### Añadido
- **Interfaz móvil completa** para roles Comercial y Operador
  - Vista optimizada de presupuestos con tarjetas táctiles
  - Vista optimizada de pedidos con controles de producción
  - Vista optimizada de clientes con listado compacto
  - Detalle de pedidos con controles táctiles de producción
  - Navegación inferior (bottom navigation) para móvil
  - Botones y controles táctiles optimizados (height: 44px+)
  - Formularios adaptados con campos más grandes
- **Sistema de gestión de producción**
  - Seguimiento de tareas por artículo
  - Fases de producción predefinidas (Preimpresión, Impresión, Acabados, Externo, Envío)
  - Timer de tareas con pause/resume
  - Cálculo de tiempo total acumulado por artículo
  - Estados de producción por artículo (Borrador, Pendiente, En Producción, Terminado)
  - Barras visuales de progreso por artículo y pedido
- **Vistas duales para pedidos**
  - Vista Administrativa (con precios y detalles comerciales)
  - Vista Producción (sin precios, enfocada en fabricación)
  - Toggle entre vistas según rol de usuario
- **Generación de Orden de Trabajo (OT) en PDF**
  - Descarga de órdenes de trabajo por pedido
  - Incluye prompts, outputs y especificaciones del producto

### Cambiado
- **Navegación móvil**: Sidebar reemplazado por bottom navigation en dispositivos móviles
- **Listas de documentos**: Tablas reemplazadas por tarjetas en móvil para mejor UX
- **Controles de formulario**: Aumentado tamaño mínimo a 44px de altura en móvil
- **Espaciado y padding**: Optimizado para pantallas táctiles pequeñas
- **Tamaño de fuentes**: Ajustado dinámicamente según dispositivo

### Corregido
- Logout accesible en móvil (anteriormente bloqueado por sidebar oculto)
- Navegación de estados de producción sin recargar página
- Visualización de nombres de operadores en tareas de producción
- Renderizado de tareas de producción (issue de loop infinito resuelto)

---

## [1.5.0] - 2024-11-15

### Añadido
- **Sistema de roles y permisos**
  - Rol Comercial: acceso a sus propios presupuestos y todos los clientes
  - Rol Gestor: acceso completo a presupuestos, pedidos y clientes
  - Rol Operador: acceso limitado a producción
  - Rol Admin: acceso completo al sistema
- **Políticas RLS (Row Level Security)**
  - Seguridad a nivel de base de datos por rol
  - Prevención de acceso cruzado entre organizaciones
  - Validación de permisos en todas las tablas

### Cambiado
- Mejoras en la visualización de presupuestos por rol
- Optimización de consultas de base de datos con filtros por organización

### Corregido
- Problemas de recursión infinita en políticas RLS
- Visibilidad de datos entre usuarios de la misma organización
- Asignación correcta de `organization_id` en clientes

---

## [1.4.0] - 2024-11-10

### Añadido
- **Integración con Holded ERP**
  - Exportación automática de pedidos a Holded
  - Sincronización de número de documento Holded
  - Descarga de PDFs desde Holded
  - Importación de clientes desde Holded
- **Numeración automática de documentos**
  - Sistema configurable de numeración para presupuestos
  - Sistema configurable de numeración para pedidos
  - Función de reenumeración masiva de documentos
  - Actualización automática del último número secuencial

### Cambiado
- Formato de numeración personalizable (prefijo, año, dígitos secuenciales, sufijo)
- Mejoras en la interfaz de configuración de numeración

### Corregido
- Numeración incorrecta después del año (guion restaurado)
- Último número secuencial iniciando en 0 (ahora inicia en 1)
- Conteo incorrecto de documentos para reenumeración

---

## [1.3.0] - 2024-11-05

### Añadido
- **Gestión de clientes unificada**
  - Tabla unificada de clientes locales y de Holded
  - Búsqueda y filtrado de clientes
  - Paginación de listado de clientes
  - CRUD completo de clientes locales
- **Información de creador en documentos**
  - Columna de "Creado por" en lista de presupuestos
  - Visualización de nombre de usuario en documentos

### Cambiado
- Menú de acciones convertido a dropdown para ahorrar espacio
- Interfaz de lista de clientes mejorada con badges de origen

---

## [1.2.0] - 2024-12-20

### Añadido
- **Sistema de temas personalizables**
  - Temas predefinidos (Azul Corporativo, Verde Natural, Morado Moderno, etc.)
  - Personalización de colores por usuario
  - Vista previa en tiempo real de cambios
  - Guardado persistente de preferencias por usuario
- **Configuración de plantillas PDF**
  - 6 plantillas diferentes para documentos
  - Personalización de logo y colores de marca
  - Configuración de footer personalizado

---

## [1.1.0] - 2024-12-10

### Añadido
- **Integración con EasyQuote API**
  - Obtención de productos desde EasyQuote
  - Configuración de prompts y outputs por producto
  - Cálculo de precios desde API EasyQuote
  - Selección de hojas de Excel por prompt/output
- **Gestión de productos**
  - CRUD completo de productos
  - Categorización de productos
  - Mapeo de productos EasyQuote a categorías locales
- **Archivos Excel**
  - Subida y gestión de archivos Excel maestros
  - Visualización de archivos disponibles

### Cambiado
- Proxy de llamadas a EasyQuote API a través de Edge Functions
- Mejoras en manejo de CORS y conectividad

---

## [1.0.0] - 2024-12-01

### Añadido
- **Sistema de presupuestos**
  - Creación y edición de presupuestos
  - Gestión de artículos en presupuestos
  - Adicionales (cargos y descuentos)
  - Generación de PDF de presupuestos
  - Estados de presupuestos (Borrador, Enviado, Aprobado, Rechazado)
- **Sistema de pedidos/órdenes de venta**
  - Conversión de presupuestos a pedidos
  - Creación de pedidos desde cero
  - Gestión de estados de pedidos
  - Visualización detallada de pedidos
- **Sistema de autenticación**
  - Login/logout con Supabase Auth
  - Gestión de sesiones
  - Protección de rutas
- **Dashboard principal**
  - Estadísticas rápidas de documentos
  - Acciones rápidas
  - Visualización de últimos pedidos
- **Sistema multiorganización**
  - Organizaciones (suscriptores)
  - Membresía de usuarios a organizaciones
  - Planes de suscripción (Free, Pro, Business)
  - Límites por plan (usuarios, archivos Excel)

### Infraestructura
- Base de datos Supabase
- Edge Functions para lógica de negocio
- Almacenamiento de archivos en Supabase Storage
- Frontend React + Vite + TypeScript
- Styling con Tailwind CSS
- UI components con shadcn/ui

---

## Tipos de cambios

- **Añadido**: para nuevas funcionalidades
- **Cambiado**: para cambios en funcionalidades existentes
- **Obsoleto**: para funcionalidades que pronto se eliminarán
- **Eliminado**: para funcionalidades eliminadas
- **Corregido**: para corrección de errores
- **Seguridad**: en caso de vulnerabilidades

---

## Formato de versiones

El proyecto usa [Versionado Semántico](https://semver.org/lang/es/):
- **MAJOR** (X.0.0): Cambios incompatibles con versiones anteriores
- **MINOR** (0.X.0): Nueva funcionalidad compatible con versiones anteriores
- **PATCH** (0.0.X): Correcciones de errores compatibles con versiones anteriores
