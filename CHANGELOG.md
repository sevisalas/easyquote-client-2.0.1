# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [2.5.13] - 2026-02-13

### Añadido
- **Adjuntos a Holded**: Los archivos adjuntos a presupuestos y pedidos (máx. 5 archivos de 10MB cada uno) se sincronizan automáticamente a Holded durante la exportación
- **Interfaz de adjuntos discreta**: Sección colapsable al final de formularios de presupuestos y pedidos para minimizar distracción visual

### Corregido
- **Permisos de exportación en Holded**: Corrección en la validación de acceso para users que pertenecen a múltiples organizaciones al exportar presupuestos

---

## [2.5.12] - 2026-02-11

### Corregido
- **Re-PATCH en productos compuestos**: Mecanismo automático de re-envío cuando el API ignora valores condicionales heredados (ej: dimensiones "Personalizado") en la primera llamada
- **Guardado de datos compuestos**: Corrección del guardado correcto de composite_data para todas las organizaciones

---

## [2.5.11] - 2026-02-09

### Añadido
- **Validación de incongruencia de hojas**: Alerta visual cuando un campo de entrada está configurado en una hoja de Excel diferente al resto del producto (icono ámbar con tooltip explicativo)

### Corregido
- **Comportamiento de campos numéricos**: Los campos numéricos y de texto en opciones restrictivas ahora solo disparan el cálculo al confirmar (Tab/Enter), no durante la edición

---

## [2.5.8] - 2026-02-04

### Corregido
- **Productos compuestos compartidos**: La configuración de componentes ahora se comparte correctamente entre organizaciones del mismo grupo API (api_user_id)

---

## [2.5.6] - 2026-02-02

### Añadido
- **Sistema de solicitudes de soporte**: Nueva funcionalidad para que los usuarios envíen solicitudes de funcionalidades, reportes de errores y dudas desde el Centro de ayuda
- **Panel de gestión de solicitudes (Superadmin)**: Vista dedicada para gestionar todas las solicitudes con filtros por estado, estadísticas y sistema de respuesta
- **Tour guiado mejorado**: Corregidos los selectores del tour para que funcione correctamente con los menús colapsables del sidebar

### Corregido
- **Exportación multi-cantidades a Holded**: Cada cantidad ahora se exporta como artículo separado con su precio real (Q1, Q2, etc.)
- **Filtro de prompts ocultos en Holded**: Los campos marcados como "Ocultar en documentos" ahora se filtran correctamente usando el ID interno del prompt
- **Total en presupuestos con multi-cantidades**: El resumen ahora muestra el precio de Q1 como referencia en lugar de 0

---

## [2.5.5] - 2026-01-29

### Cambiado
- **Tipos de producto simplificados**: Eliminado tipo "Encuadernado", consolidado en "Compuesto". Añadido placeholder para tipo "Kit" (próximamente)

---

## [2.5.4] - 2026-01-26

### Añadido
- **Agregación de outputs en productos compuestos**: Los valores numéricos de outputs específicos (ej: "Lomo") de los componentes ahora se suman automáticamente en el output correspondiente del producto padre, según la configuración definida en `composite_output_aggregations`

---

## [2.5.3] - 2026-01-26

### Corregido
- **Numeración de presupuestos en borradores**: Corregida condición de carrera en la función `next_document_number` que causaba números duplicados al guardar borradores concurrentemente
- **Sincronización de secuencias**: La función ahora bloquea la fila con `FOR UPDATE` y recalcula el siguiente número usando `GREATEST` entre la secuencia almacenada y el máximo existente en documentos

---

## [2.5.2] - 2026-01-21

### Corregido
- **Numeración secuencial**: Corregida condición de carrera en la generación de números de presupuestos y pedidos que causaba duplicados (violación de clave única)
- **Cálculo en tiempo real**: El sistema ahora consulta la base de datos para obtener el máximo secuencial justo antes de insertar, evitando conflictos entre usuarios concurrentes

### Cambiado
- **Estados de presupuestos simplificados**: Eliminado el desplegable de estados y reemplazado por botones de acción contextuales según el estado actual
- **Texto dinámico "Enviar a Holded"**: Los botones de envío ahora muestran "Enviar a Holded" o "Guardar y enviar a Holded" cuando la organización tiene la integración activa con modo de exportación de presupuestos habilitado

---

## [2.5.0] - 2026-01-20

### Añadido
- **Gestión de imágenes integrada con EasyQuote**: Nueva funcionalidad para listar, subir y eliminar imágenes directamente desde la API de EasyQuote
- Sistema de categorización local de imágenes con categorías y subcategorías por organización
- Edge Function `easyquote-images` como proxy para la API externa con autenticación automática

---

## [2.4.16] - 2026-01-19

### Corregido
- **Sincronización de prompts desde cache**: Los prompts dependientes ahora se actualizan correctamente incluso cuando los datos de pricing provienen del cache, sincronizando valores y opciones con la respuesta de la API

---

## [2.4.15] - 2026-01-19

### Corregido
- **Cache de opciones dinámicas**: Las opciones de prompts dependientes (ej: "Tira y retira") ahora se actualizan correctamente cuando cambian otros campos relacionados (ej: "tintas")

---

## [2.4.14] - 2026-01-17

### Corregido
- **Precisión de precios en Holded**: Aumentada la precisión de precios unitarios de 2 a 6 decimales para evitar descuadres en totales
- **Duplicación de presupuestos**: Los precios guardados se mantienen al duplicar, sin recalcular automáticamente

---

## [2.4.12] - 2026-01-16

### Cambiado
- **Validación de límites en campos numéricos**: Los inputs numéricos en prompts ahora fuerzan los valores mínimo/máximo al salir del campo
- **Notificación de ajuste de valores**: Se muestra un mensaje discreto cuando un valor es ajustado automáticamente al límite permitido

---

## [2.4.11] - 2026-01-15

### Añadido
- **Opciones restrictivas**: Nueva sección para campos de prompts marcados como "Opc. restrictiva" (force_result), visible en página de pruebas, presupuestos y pedidos
- Configuración por prompt en gestión de productos para activar/desactivar opción restrictiva

### Cambiado
- Layout de opciones restrictivas: rótulo y valor en la misma línea, checkbox a la derecha, grid de 3 columnas
- Optimización de prompts en página de test: grid de 2 columnas para productos simples
- **Selector de estado en presupuestos**: Eliminada opción "Aprobado" del selector manual (solo se activa mediante aprobación de artículos)

---

## [2.4.10] - 2026-01-14

### Cambiado
- **Layout de prompts en productos compuestos**: Los campos de cada componente (pestañas) y sección general ahora se muestran en una sola columna para mejor legibilidad en tablets

---

## [2.4.9] - 2026-01-14

### Corregido
- **Precio en presupuestos**: Ahora se muestra siempre el output con `type=Price` (sin IVA) en lugar de `pricing.price`
- **Exportación a Holded**: El precio unitario se calcula como PRICE / UNIDADES, buscando unidades en output `type=Quantity`, luego por nombre ("unidades", "cantidad", etc.), y finalmente en prompts

---

## [2.4.8] - 2026-01-13

### Corregido
- Exportación a Holded: el precio de artículos con múltiples cantidades ahora usa correctamente la base imponible (sin IVA)

---

## [2.4.6] - 2026-01-13

### Cambiado
- Deshabilitada opción de múltiples cantidades para productos compuestos (en desarrollo)

### Corregido
- Control manual del último número secuencial: el sistema ya no sobrescribe automáticamente el valor configurado en formatos de numeración

---

## [2.4.5] - 2026-01-06

### Corregido
- Versionado corregido

---

## [2.4.4] - 2026-01-06

### Añadido
- Productos compuestos (encuadernados con portada + interiores)

### Corregido
- Filtro admin_only en prompts ahora funciona correctamente en productos no compuestos

---

## [2.4.3] - 2026-01-03

### Corregido
- **Formato de año dinámico en numeración**: El selector de formato de año ahora muestra el año actual (26/2026) en lugar de valores hardcodeados (25/2025)

---

## [2.4.2] - 2025-12-29

### Corregido
- **Creación de usuarios en organizaciones**: Corregido error de autorización cuando un admin pertenece a múltiples organizaciones

---

## [2.4.1] - 2025-12-27

### Añadido
- **Selector de configuración de encuadernado**: Para productos compuestos, permite elegir entre "Mismo papel", "Portada + 1 Interior" o "Portada + 2 Interiores"
- **Bloqueo de edición de precio con multi-cantidades**: Cuando las cantidades múltiples están activas, se deshabilita la edición manual del precio principal

### Cambiado
- **Carga inmediata del selector de encuadernado**: El selector de configuración aparece inmediatamente al seleccionar un producto, sin esperar la respuesta de la API de precios
- **Optimización de velocidad en campos de cantidad**: Los campos Q1-Q5 ahora usan debounce de 800ms para evitar llamadas API intermedias mientras el usuario escribe

---

## [2.3.3] - 2025-12-19

### Añadido
- **Ajuste "Por capacidad"**: Nuevo tipo de ajuste de artículo para conceptos como cajas, bolsas o embalajes donde el coste depende de la cantidad de unidades. Configurable con "unidades por envase" y cálculo automático: `CEIL(cantidad / capacidad) × precio`
- **Ordenamiento personalizable de outputs**: Los usuarios pueden reordenar los outputs de cada producto arrastrando y soltando. El orden se guarda por producto y organización
- **Opción "Por capacidad" en ajustes personalizados**: Al crear un ajuste personalizado en un artículo, ahora se puede seleccionar el tipo "Por capacidad"

### Corregido
- **Error UUID vacío en ajustes**: Corregido error "invalid input syntax for type uuid" al crear ajustes sin fase de producción asociada

---

## [2.3.1] - 2025-12-12

### Añadido
- **Productos personalizados (no EasyQuote)**: Nueva funcionalidad para crear artículos personalizados en presupuestos sin depender de productos de la API de EasyQuote. Permite definir nombre, descripción, cantidad y precio manualmente.

---

## [2.2.8] - 2025-12-08

### Corregido
- **Navegación a página de prueba de productos**: Cambiado `window.location.href` por `navigate()` de React Router para evitar recarga completa y pérdida de caché
- **Typo en título**: Corregido "Pruba de productos" → "Prueba de productos"

---

## [2.2.7] - 2025-12-04

### Corregido
- **Ajustes en pedidos**: Campo `is_discount` ahora se guarda correctamente al exportar pedidos a Holded
- **Edición de prompts numéricos**: Los valores ya no parpadean ni se sobrescriben al editar campos numéricos en productos

---

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
