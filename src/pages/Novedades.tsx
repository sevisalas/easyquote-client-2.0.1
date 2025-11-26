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
    version: "2.0.0",
    date: "2025-01-26",
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
    date: "2025-01-15",
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
    date: "2025-01-10",
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
    date: "2025-01-05",
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
  const { isOrgAdmin } = useSubscription();

  if (!isOrgAdmin) {
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
                    {index === 0 && (
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
