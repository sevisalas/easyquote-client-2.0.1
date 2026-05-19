import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Plus, Edit, Bug, Shield, Trash2, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Navigate } from "react-router-dom";

interface ChangeItem {
  text: string;
  type: 'added' | 'changed' | 'fixed' | 'removed' | 'security';
}

interface Version {
  version: string;
  date: string;
  isDevelopment?: boolean;
  changes: {
    added?: string[];
    changed?: string[];
    fixed?: string[];
    removed?: string[];
    security?: string[];
  };
}

const versions: Version[] = [
  {
    version: "2.8.5",
    date: "2026-05-19",
    changes: {
      changed: [
        "Gestión completa de fases de producción: ahora cada organización puede editar, añadir o eliminar sus propias fases de producción de forma independiente.",
      ],
    },
  },
  {
    version: "2.8.2",
    date: "2026-05-07",
    changes: {
      changed: [
        "Cierre de versión sin novedades funcionales: mantenimiento interno y estabilidad.",
      ],
    },
  },
  {
    version: "2.7.29",
    date: "2026-05-03",
    changes: {
      security: [
        "Refuerzo de seguridad en políticas RLS: los operarios ya no pueden editar ni eliminar pedidos de venta (solo lectura).",
        "Privacidad de clientes mejorada: los operarios ya no tienen acceso a datos sensibles (email, teléfono, dirección) en el listado de clientes.",
      ],
    },
  },
  {
    version: "2.7.28",
    date: "2026-04-30",
    changes: {
      added: [
        "Nueva plantilla PDF 'Campillo Limpia' (#9), exclusiva para Campillo Nevado: hereda toda la lógica de la plantilla 7 pero sin fondo PNG, con cabecera limpia, totales en bloque tipo factura y footer corporativo centrado.",
        "Agrupación de presupuestos: nuevo modal en el listado de presupuestos para combinar varios presupuestos en uno solo. Los originales quedan en estado 'Agrupado' (bloqueado para aprobación) y el nuevo presupuesto agrupado hereda los artículos manteniendo la trazabilidad de origen sin mostrarla en los documentos. Versión inicial sin soporte de multi-cantidad.",
      ],
    },
  },
  {
    version: "2.7.27",
    date: "2026-04-30",
    changes: {
      changed: [
        "Estado 'Listo para enviar' renombrado a 'Preparado' en el listado, detalle, edición y portal del cliente, para que la etiqueta entre completa en los badges sin cortarse.",
      ],
    },
  },
  {
    version: "2.7.26",
    date: "2026-04-30",
    changes: {
      fixed: [
        "Ocultar en documentos: ahora reconoce correctamente etiquetas con sufijos o unidades (ej. 'Lomo mm' coincide con la configuración 'Lomo (entrada)'), evitando que campos marcados como ocultos aparezcan en los PDF.",
        "Paginación PDF (plantillas 7 y 8): cálculo de capacidad por página recalibrado para que artículos con muchos componentes/multi-cantidad no se partan entre páginas.",
        "Tipografía consistente en 'Archivos Excel' y 'Configuración de producto': los títulos y subtítulos ya no se ven desproporcionados por herencia de estilos globales.",
        "Paginación del PDF (Campillo/Anebri): los artículos ya no se parten entre páginas. Si las notas no caben con los totales, solo las notas saltan a una nueva página, manteniendo los artículos íntegros.",
        "Artículos personalizados sin precio base: el PDF ya no muestra la línea '1 × 0,00 €' cuando el artículo solo tiene ajustes (additionals), calculando el total correctamente a partir de estos.",
        "Precios estables al guardar sin editar: los presupuestos guardados sin tocar ningún artículo conservan exactamente el total original (corrige caídas como 1.845,75 € → 1.680 €)",
        "La tarifa de cliente nunca se aplica sobre los ajustes (importe fijo, porcentaje, multiplicador o divisor); solo afecta al precio base del API",
      ],
    },
  },
  {
    version: "2.7.25",
    date: "2026-04-27",
    changes: {
      fixed: [
        "Correcciones internas y estabilidad de base de datos.",
      ],
    },
  },
  {
    version: "7.2.22",
    date: "2026-04-23",
    changes: {
      fixed: [
        "Descripción manual completa en PDFs: las plantillas Campillo y Anebri ya no eliminan líneas válidas cuando terminan en ':' y muestran el texto completo del artículo",
      ],
    },
  },
  {
    version: "7.2.21",
    date: "2026-04-23",
    changes: {
      fixed: [
        "Protección de descripciones manuales en productos personalizados: ya no se sobrescriben al editar, guardar, aprobar ni regenerar documentos",
      ],
    },
  },
  {
    version: "2.7.20",
    date: "2026-04-23",
    changes: {
      fixed: [
        "Descripción manual con fallback automático: si el campo se deja vacío, se vuelve a usar la descripción autogenerada",
        "Precios de artículos personalizados en aprobación y Holded: el cálculo usa custom_quantity y custom_unit_price sin inflar importes por decimales mal parseados",
      ],
    },
  },
  {
    version: "2.7.19",
    date: "2026-04-22",
    changes: {
      fixed: [
        "Dashboard separado por organización activa: las estadísticas rápidas de presupuestos y pedidos ya no mezclan datos entre Anebri y Campillo",
      ],
    },
  },
  {
    version: "2.7.18",
    date: "2026-04-22",
    changes: {
      added: [
        "Filtro por texto en listados: presupuestos y pedidos permiten buscar por texto libre sobre número, cliente y datos visibles",
      ],
      fixed: [
        "Textos largos en configuración de producto: los encabezados mantienen un tamaño estable en pantalla y ya no desbordan la vista",
      ],
    },
  },
  {
    version: "2.6.3",
    date: "2026-03-14",
    changes: {
      added: [
        "Totales de filtrado en listados: presupuestos y pedidos muestran la suma total en EUR de los documentos filtrados",
        "Exportación Excel de listados: botón para descargar un .xlsx con las columnas visibles del filtrado activo",
        "Edición de pedidos con auditoría: los administradores pueden editar pedidos en cualquier estado con motivo obligatorio y registro de cambios",
      ],
    },
  },
  {
    version: "2.6.2",
    date: "2026-03-12",
    changes: {
      changed: [
        "Descripción automática en presupuestos y pedidos: se rellena con el nombre del primer artículo si el usuario no la escribe",
      ],
      fixed: [
        "Precios multi-cantidad con ajustes por cantidad en PDF: Q2/Q3 ahora usan el valor de ajuste específico de cada cantidad",
      ],
      removed: [
        "Ruta independiente de pruebas de producto (/admin/productos/test)",
      ],
    },
  },
  {
    version: "2.6.1",
    date: "2026-03-11",
    changes: {
      security: [
        "Protección del endpoint de notificaciones: autenticación JWT obligatoria y sanitización de campos HTML",
      ],
    },
  },
  {
    version: "2.5.25",
    date: "2026-03-06",
    changes: {
      added: [
        "Ajuste tipo porcentaje para artículos: nuevo tipo 'Porcentaje sobre subtotal' disponible en configuración",
      ],
    },
  },
  {
    version: "2.5.24",
    date: "2026-03-05",
    changes: {
      changed: [
        "Bloque de precio unificado en productos simples: precio y botón de modificar comparten el mismo contenedor visual",
      ],
    },
  },
  {
    version: "2.5.23",
    date: "2026-03-04",
    changes: {
      fixed: [
        "Error de clave duplicada al aprobar presupuestos: verificación de pedido existente y reintento automático",
        "Cliente recién importado no reconocido al aprobar: la verificación de holded_id ahora se refresca siempre",
      ],
    },
  },
  {
    version: "2.5.22",
    date: "2026-03-04",
    changes: {
      fixed: [
        "Precios multi-cantidad con ajustes en PDF: Q2/Q3 ahora incluyen los ajustes recalculados para cada cantidad",
        "Eliminado mensaje incorrecto sobre exportación separada de cantidades múltiples a Holded",
      ],
    },
  },
  {
    version: "2.5.21",
    date: "2026-02-27",
    changes: {
      added: [
        "Modo de exportación 'Presupuestos solo al aprobar': nuevo modo de integración con Holded",
        "Tres modos de exportación configurables desde Configuración > Integraciones",
        "Detalles de artículos visibles en consulta aunque el documento esté bloqueado o aprobado",
      ],
      fixed: [
        "Ajustes ocultos en Holded (Campillo/Anebri): los importes se distribuyen proporcionalmente entre los subtotales",
      ],
    },
  },
  {
    version: "2.5.20",
    date: "2026-02-27",
    changes: {
      fixed: [
        "Precio de productos compuestos no se actualizaba al cambiar la cantidad de ejemplares",
      ],
    },
  },
  {
    version: "2.5.19",
    date: "2026-02-26",
    changes: {
      changed: [
        "Datos de cliente en PDF simplificados: eliminados email y teléfono, solo empresa y dirección",
        "Descripción del presupuesto reubicada fuera de la tabla de artículos en plantillas Campillo y Anebri",
      ],
    },
  },
  {
    version: "2.5.18",
    date: "2026-02-25",
    changes: {
      added: [
        "Texto legal en pie de PDF: configurable desde Configuración > Plantilla PDF para plantillas Campillo y Anebri",
      ],
      fixed: [
        "Nombre de empresa en Template 8 corregido a 'ANEBRI S.L.'",
      ],
    },
  },
  {
    version: "2.5.17",
    date: "2026-02-25",
    changes: {
      fixed: [
        "Plantilla PDF compartida por organización: todos los miembros ven y usan la misma plantilla corporativa",
      ],
    },
  },
  {
    version: "2.5.16",
    date: "2026-02-24",
    changes: {
      added: [
        "Plantilla PDF Anebri (Template 8): nueva plantilla corporativa exclusiva con logo y paleta roja",
        "Previews de plantillas 7 y 8",
      ],
      fixed: [
        "Plantilla PDF incorrecta en presupuestos multi-organización: ahora usa el organization_id del presupuesto",
        "Toast 'Bienvenido' persistente: añadida duración de 3 segundos",
      ],
    },
  },
  {
    version: "2.5.15",
    date: "2026-02-23",
    changes: {
      fixed: [
        "Campos ocultos en PDF y Holded: los campos marcados como ocultos se excluyen correctamente en PDF y Holded",
        "Configuración de plantilla PDF: corrección del fallback para obtener la organización del usuario",
      ],
    },
  },
  {
    version: "2.5.14",
    date: "2026-02-20",
    changes: {
      fixed: [
        "Permisos de adjuntos para propietarios de organizaciones",
        "Edición de adjuntos en presupuestos ya exportados a Holded",
        "Descripción compuesta en Holded sin campos repetidos en cada componente",
      ],
    },
  },
  {
    version: "2.5.13",
    date: "2026-02-13",
    changes: {
      added: [
        "Adjuntos a Holded: archivos adjuntos (máx. 5 × 10 MB) se sincronizan automáticamente al exportar",
        "Interfaz de adjuntos discreta: sección colapsable en formularios de presupuestos y pedidos",
      ],
      fixed: [
        "Permisos de exportación en Holded para usuarios con múltiples organizaciones",
      ],
    },
  },
  {
    version: "2.5.12",
    date: "2026-02-11",
    changes: {
      fixed: [
        "Re-PATCH en productos compuestos: corrección automática cuando el API ignora valores condicionales heredados",
        "Guardado de datos compuestos: corrección del guardado correcto de composite_data para todas las organizaciones",
      ],
    },
  },
  {
    version: "2.5.9",
    date: "2026-02-06",
    changes: {
      fixed: [
        "Validación de precio máximo para evitar errores de desbordamiento numérico en base de datos",
        "Etiquetas descriptivas en productos compuestos: ahora se muestran correctamente en el diálogo de asociación",
      ],
    },
  },
  {
    version: "2.5.8",
    date: "2026-02-04",
    changes: {
      fixed: [
        "Productos compuestos compartidos: la configuración de componentes ahora se comparte correctamente entre organizaciones del mismo grupo API",
      ],
    },
  },
  {
    version: "2.5.7",
    date: "2026-02-03",
    changes: {
      fixed: [
        "Inputs numéricos en productos compuestos: el recálculo ahora espera a Enter o pérdida de foco",
      ],
      security: [
        "Autorización reforzada en eliminación de pedidos: verificación de permisos antes de ejecutar",
      ],
    },
  },
  {
    version: "2.5.6",
    date: "2026-02-02",
    changes: {
      added: [
        "Sistema de solicitudes de soporte: envío de funcionalidades, errores y dudas desde el Centro de ayuda",
        "Panel de gestión de solicitudes (Superadmin): vista con filtros, estadísticas y sistema de respuesta",
        "Tour guiado mejorado con selectores corregidos para menús colapsables",
      ],
      fixed: [
        "Exportación multi-cantidades a Holded: cada cantidad se exporta como artículo separado con su precio real",
        "Filtro de prompts ocultos en Holded: ahora se filtra correctamente usando el ID interno del prompt",
        "Total en presupuestos con multi-cantidades: muestra el precio de Q1 como referencia",
      ],
    },
  },
  {
    version: "2.5.4",
    date: "2026-01-26",
    changes: {
      fixed: [
        "Corrección del despliegue de la aplicación",
      ],
    },
  },
  {
    version: "2.5.0",
    date: "2026-01-20",
    changes: {
      added: [
        "Gestión de imágenes integrada con EasyQuote: listar, subir y eliminar imágenes directamente desde la API externa",
        "Sistema de categorización local de imágenes con categorías y subcategorías por organización",
        "Edge Function como proxy para la API de imágenes con autenticación automática",
      ],
    },
  },
  {
    version: "2.4.14",
    date: "2026-01-17",
    changes: {
      fixed: [
        "Precisión de precios en Holded: aumentada de 2 a 6 decimales para evitar descuadres en totales",
        "Duplicación de presupuestos: los precios guardados se mantienen sin recalcular automáticamente",
      ],
    },
  },
  {
    version: "2.4.12",
    date: "2026-01-16",
    changes: {
      changed: [
        "Validación de límites en campos numéricos: los inputs fuerzan valores mínimo/máximo al salir del campo",
        "Notificación discreta cuando un valor es ajustado automáticamente al límite permitido",
      ],
    },
  },
  {
    version: "2.4.11",
    date: "2026-01-15",
    changes: {
      added: [
        "Opciones restrictivas: Nueva sección para campos de prompts marcados como 'Opc. restrictiva' (force_result)",
        "Configuración por prompt en gestión de productos para activar/desactivar opción restrictiva",
        "Logos de empresa ahora se suben a Supabase Storage para compatibilidad con PDF",
      ],
      changed: [
        "Layout de opciones restrictivas: rótulo y valor en la misma línea, checkbox a la derecha",
        "Optimización de prompts en página de test: grid de 2 columnas",
        "Selector de estado en presupuestos: Eliminada opción 'Aprobado' del selector manual",
      ],
    },
  },
  {
    version: "2.4.10",
    date: "2026-01-14",
    changes: {
      changed: [
        "Layout de prompts en productos compuestos: campos en una sola columna para mejor legibilidad",
      ],
    },
  },
  {
    version: "2.4.9",
    date: "2026-01-14",
    changes: {
      fixed: [
        "Precio en presupuestos: Ahora se muestra siempre el output con type=Price (sin IVA)",
        "Exportación a Holded: El precio unitario se calcula como PRICE / UNIDADES correctamente",
      ],
    },
  },
  {
    version: "2.4.8",
    date: "2026-01-13",
    changes: {
      fixed: [
        "Exportación a Holded: el precio de artículos con múltiples cantidades ahora usa correctamente la base imponible (sin IVA)",
      ],
    },
  },
  {
    version: "2.4.6",
    date: "2026-01-13",
    changes: {
      changed: [
        "Deshabilitada opción de múltiples cantidades para productos compuestos (en desarrollo)",
      ],
      fixed: [
        "Control manual del último número secuencial: ya no se sobrescribe automáticamente",
      ],
    },
  },
  {
    version: "2.4.5",
    date: "2026-01-06",
    changes: {
      fixed: ["Versionado corregido"],
    },
  },
  {
    version: "2.4.4",
    date: "2026-01-06",
    changes: {
      added: [
        "Productos compuestos (encuadernados con portada + interiores)",
      ],
      fixed: [
        "Filtro admin_only en prompts ahora funciona correctamente en productos no compuestos",
      ],
    },
  },
  {
    version: "2.4.3",
    date: "2026-01-03",
    changes: {
      fixed: [
        "Formato de año dinámico en numeración muestra el año actual",
      ],
    },
  },
  {
    version: "2.4.2",
    date: "2025-12-29",
    changes: {
      fixed: [
        "Creación de usuarios en organizaciones cuando un admin pertenece a múltiples organizaciones",
      ],
    },
  },
  {
    version: "2.4.1",
    date: "2025-12-27",
    changes: {
      added: [
        "Selector de configuración de encuadernado para productos compuestos",
        "Bloqueo de edición de precio cuando las cantidades múltiples están activas",
      ],
      changed: [
        "Carga inmediata del selector de encuadernado sin esperar la API",
        "Optimización de velocidad en campos Q1-Q5 con debounce de 800ms",
      ],
    },
  },
  {
    version: "2.3.3",
    date: "2025-12-19",
    changes: {
      added: [
        "Ajuste 'Por capacidad': Nuevo tipo de ajuste para conceptos como cajas, bolsas o embalajes con cálculo automático",
        "Ordenamiento personalizable de outputs arrastrando y soltando",
        "Opción 'Por capacidad' en ajustes personalizados de artículo",
      ],
      fixed: [
        "Error UUID vacío en ajustes sin fase de producción asociada",
      ],
    },
  },
  {
    version: "2.3.1",
    date: "2025-12-12",
    changes: {
      added: [
        "Productos personalizados (no EasyQuote): crear artículos con nombre, descripción, cantidad y precio manual",
      ],
    },
  },
  {
    version: "2.2.8",
    date: "2025-12-08",
    changes: {
      fixed: [
        "Navegación a página de prueba de productos sin recarga completa",
        "Typo en título 'Pruba de productos' → 'Prueba de productos'",
      ],
    },
  },
  {
    version: "2.2.7",
    date: "2025-12-04",
    changes: {
      fixed: [
        "Campo is_discount ahora se guarda correctamente al exportar pedidos a Holded",
        "Edición de prompts numéricos: los valores ya no parpadean ni se sobrescriben",
      ],
    },
  },
  {
    version: "2.2.5",
    date: "2025-12-04",
    changes: {
      fixed: [
        "Migración de presupuestos sin organization_id para Reprotel y Tradsis",
        "Columnas de Holded visibles si la organización tiene acceso a la integración",
      ],
    },
  },
  {
    version: "2.2.4",
    date: "2025-12-03",
    changes: {
      fixed: [
        "SPA routing en producción: agregado web.config y _redirects para evitar errores 404",
      ],
    },
  },
  {
    version: "2.2.3",
    date: "2025-12-03",
    changes: {
      fixed: [
        "Filtro de prompts ocultos en Holded al exportar presupuestos",
        "Limbo de organización en login para usuarios con múltiples organizaciones",
        "Limpieza de sesión al cerrar para evitar problemas de selección",
      ],
    },
  },
  {
    version: "2.2.1",
    date: "2025-12-03",
    changes: {
      added: [
        "Botón 'Actualizar contactos' en página de Clientes",
      ],
      fixed: [
        "Selector de organizaciones en login redirige correctamente",
      ],
    },
  },
  {
    version: "2.1.0",
    date: "2025-11-26",
    changes: {
      added: [
        "Accesos directos con diseño minimalista (solo texto, sin iconos)",
        "Solo 2 acciones principales: 'Nuevo presupuesto' y 'Pedidos en producción'",
        "Diseño con color secundario unificado",
      ],
      changed: [
        "Header móvil eliminado para mayor espacio vertical",
        "'Acciones rápidas' renombrado a 'Accesos directos'",
        "Textos centrados en accesos directos",
        "Botones simplificados eliminando iconos redundantes",
      ],
      removed: [
        "Header móvil (MobileHeader) completamente removido",
        "Iconos en tarjetas de accesos directos",
        "Acciones secundarias: 'Añadir cliente' y 'Pendientes'",
      ],
    },
  },
  {
    version: "2.0.0",
    date: "2025-11-25",
    changes: {
      added: [
        "Interfaz móvil completa para roles Comercial y Operador",
        "Vista optimizada de presupuestos con tarjetas táctiles",
        "Vista optimizada de pedidos con controles de producción",
        "Vista optimizada de clientes con listado compacto",
        "Detalle de pedidos con controles táctiles de producción",
        "Navegación inferior (bottom navigation) para móvil",
        "Sistema de gestión de producción con seguimiento de tareas",
        "Fases de producción predefinidas (Preimpresión, Impresión, Acabados, Externo, Envío)",
        "Timer de tareas con pause/resume",
        "Cálculo de tiempo total acumulado por artículo",
        "Estados de producción por artículo (Borrador, Pendiente, En Producción, Terminado)",
        "Barras visuales de progreso por artículo y pedido",
        "Vistas duales para pedidos (Administrativa y Producción)",
        "Generación de Orden de Trabajo (OT) en PDF",
      ],
      changed: [
        "Navegación móvil: Sidebar reemplazado por bottom navigation",
        "Listas de documentos: Tablas reemplazadas por tarjetas en móvil",
        "Controles de formulario: Aumentado tamaño mínimo a 44px de altura",
        "Espaciado y padding optimizado para pantallas táctiles",
        "Tamaño de fuentes ajustado dinámicamente según dispositivo",
      ],
      fixed: [
        "Logout accesible en móvil (anteriormente bloqueado por sidebar oculto)",
        "Navegación de estados de producción sin recargar página",
        "Visualización de nombres de operadores en tareas de producción",
        "Renderizado de tareas de producción (issue de loop infinito resuelto)",
      ],
    },
  },
  {
    version: "1.5.0",
    date: "2025-11-15",
    changes: {
      added: [
        "Sistema de roles y permisos completo",
        "Rol Comercial: acceso a sus propios presupuestos y todos los clientes",
        "Rol Gestor: acceso completo a presupuestos, pedidos y clientes",
        "Rol Operador: acceso limitado a producción",
        "Políticas RLS (Row Level Security) en base de datos",
      ],
      changed: [
        "Mejoras en la visualización de presupuestos por rol",
        "Optimización de consultas de base de datos con filtros por organización",
      ],
      fixed: [
        "Problemas de recursión infinita en políticas RLS",
        "Visibilidad de datos entre usuarios de la misma organización",
        "Asignación correcta de organization_id en clientes",
      ],
    },
  },
  {
    version: "1.4.0",
    date: "2025-11-10",
    changes: {
      added: [
        "Integración con Holded ERP",
        "Exportación automática de pedidos a Holded",
        "Sincronización de número de documento Holded",
        "Descarga de PDFs desde Holded",
        "Importación de clientes desde Holded",
        "Sistema configurable de numeración para presupuestos y pedidos",
        "Función de reenumeración masiva de documentos",
      ],
      changed: [
        "Formato de numeración personalizable (prefijo, año, dígitos, sufijo)",
        "Mejoras en la interfaz de configuración de numeración",
      ],
      fixed: [
        "Numeración incorrecta después del año (guion restaurado)",
        "Último número secuencial iniciando en 0 (ahora inicia en 1)",
        "Conteo incorrecto de documentos para reenumeración",
      ],
    },
  },
  {
    version: "1.3.0",
    date: "2025-11-05",
    changes: {
      added: [
        "Gestión de clientes unificada (locales y de Holded)",
        "Búsqueda y filtrado de clientes",
        "Paginación de listado de clientes",
        "Columna de 'Creado por' en lista de presupuestos",
      ],
      changed: [
        "Menú de acciones convertido a dropdown para ahorrar espacio",
        "Interfaz de lista de clientes mejorada con badges de origen",
      ],
    },
  },
  {
    version: "1.2.0",
    date: "2025-10-20",
    changes: {
      added: [
        "Sistema de temas personalizables con colores por usuario",
        "Temas predefinidos (Azul Corporativo, Verde Natural, Morado Moderno)",
        "Vista previa en tiempo real de cambios de tema",
        "Configuración de plantillas PDF (6 plantillas diferentes)",
        "Personalización de logo y colores de marca en PDFs",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2025-10-10",
    changes: {
      added: [
        "Integración con EasyQuote API",
        "Obtención de productos desde EasyQuote",
        "Configuración de prompts y outputs por producto",
        "Cálculo de precios desde API EasyQuote",
        "Gestión de archivos Excel maestros",
      ],
      changed: [
        "Proxy de llamadas a EasyQuote API a través de Edge Functions",
        "Mejoras en manejo de CORS y conectividad",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2025-10-01",
    changes: {
      added: [
        "Sistema de presupuestos con artículos y adicionales",
        "Generación de PDF de presupuestos",
        "Estados de presupuestos (Borrador, Enviado, Aprobado, Rechazado)",
        "Sistema de pedidos/órdenes de venta",
        "Conversión de presupuestos a pedidos",
        "Sistema de autenticación con Supabase Auth",
        "Dashboard principal con estadísticas",
        "Sistema multiorganización con planes de suscripción",
      ],
    },
  },
];

const getChangeIcon = (type: string) => {
  switch (type) {
    case 'added':
      return <Plus className="h-4 w-4" />;
    case 'changed':
      return <Edit className="h-4 w-4" />;
    case 'fixed':
      return <Bug className="h-4 w-4" />;
    case 'removed':
      return <Trash2 className="h-4 w-4" />;
    case 'security':
      return <Shield className="h-4 w-4" />;
    default:
      return <CheckCircle2 className="h-4 w-4" />;
  }
};

const getChangeColor = (type: string) => {
  switch (type) {
    case 'added':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'changed':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'fixed':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'removed':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'security':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getChangeLabel = (type: string) => {
  switch (type) {
    case 'added':
      return 'Añadido';
    case 'changed':
      return 'Cambiado';
    case 'fixed':
      return 'Corregido';
    case 'removed':
      return 'Eliminado';
    case 'security':
      return 'Seguridad';
    default:
      return 'Cambio';
  }
};

const Novedades = () => {
  const isMobile = useIsMobile();
  const { isSuperAdmin } = useSubscription();

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={isMobile ? "p-3 space-y-4" : "container mx-auto py-6 space-y-6"}>
      {/* Header */}
      <div>
        <h1 className={`font-bold tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
          Novedades del Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Últimas actualizaciones y mejoras de EasyQuote
        </p>
      </div>

      {/* Version Cards */}
      <div className="space-y-4">
        {versions.map((version, index) => (
          <Card key={version.version} className={index === 0 ? "border-primary" : ""}>
            <CardHeader className={isMobile ? "p-4 pb-3" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className={isMobile ? "text-lg" : "text-xl"}>
                      Versión {version.version}
                    </CardTitle>
                    {version.isDevelopment ? (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">En desarrollo</Badge>
                    ) : index === 0 && (
                      <Badge className="bg-primary">Actual</Badge>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {new Date(version.date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className={isMobile ? "p-4 pt-0 space-y-4" : "space-y-4"}>
              {/* Añadido */}
              {version.changes.added && version.changes.added.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={getChangeColor('added')}>
                      {getChangeIcon('added')}
                      <span className="ml-1.5">{getChangeLabel('added')}</span>
                    </Badge>
                  </div>
                  <ul className="space-y-1.5 ml-4">
                    {version.changes.added.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cambiado */}
              {version.changes.changed && version.changes.changed.length > 0 && (
                <>
                  {version.changes.added && version.changes.added.length > 0 && (
                    <Separator className="my-3" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getChangeColor('changed')}>
                        {getChangeIcon('changed')}
                        <span className="ml-1.5">{getChangeLabel('changed')}</span>
                      </Badge>
                    </div>
                    <ul className="space-y-1.5 ml-4">
                      {version.changes.changed.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Corregido */}
              {version.changes.fixed && version.changes.fixed.length > 0 && (
                <>
                  {((version.changes.added && version.changes.added.length > 0) ||
                    (version.changes.changed && version.changes.changed.length > 0)) && (
                    <Separator className="my-3" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getChangeColor('fixed')}>
                        {getChangeIcon('fixed')}
                        <span className="ml-1.5">{getChangeLabel('fixed')}</span>
                      </Badge>
                    </div>
                    <ul className="space-y-1.5 ml-4">
                      {version.changes.fixed.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-orange-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Eliminado */}
              {version.changes.removed && version.changes.removed.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getChangeColor('removed')}>
                        {getChangeIcon('removed')}
                        <span className="ml-1.5">{getChangeLabel('removed')}</span>
                      </Badge>
                    </div>
                    <ul className="space-y-1.5 ml-4">
                      {version.changes.removed.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-red-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Seguridad */}
              {version.changes.security && version.changes.security.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getChangeColor('security')}>
                        {getChangeIcon('security')}
                        <span className="ml-1.5">{getChangeLabel('security')}</span>
                      </Badge>
                    </div>
                    <ul className="space-y-1.5 ml-4">
                      {version.changes.security.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-purple-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
};

export default Novedades;
