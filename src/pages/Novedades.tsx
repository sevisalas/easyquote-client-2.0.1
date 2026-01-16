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
                    ) : index === 1 && (
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
