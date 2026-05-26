import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

// Eager: rutas críticas (login + home) para LCP rápido
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy: el resto se carga bajo demanda
const Clientes = lazy(() => import("./pages/Clientes"));
const ClienteForm = lazy(() => import("./pages/ClienteForm"));
const QuoteNew = lazy(() => import("./pages/QuoteNew"));
const QuoteEdit = lazy(() => import("./pages/QuoteEdit"));
const QuotesList = lazy(() => import("./pages/QuotesList"));
const GroupedQuoteNew = lazy(() => import("./pages/GroupedQuoteNew"));
const SettingsPdfTemplate = lazy(() => import("./pages/SettingsPdfTemplate"));
const SettingsNumberingFormats = lazy(() => import("./pages/SettingsNumberingFormats"));
const SettingsThemeCorporate = lazy(() => import("./pages/SettingsThemeCorporate"));
const SettingsSmtp = lazy(() => import("./pages/SettingsSmtp"));
const Additionals = lazy(() => import("./pages/Additionals"));
const QuoteDetail = lazy(() => import("./pages/QuoteDetail"));
const EditarSuscriptor = lazy(() => import("./pages/SubscriberEdit"));
const UsuariosSuscriptor = lazy(() => import("./pages/SubscriberUsers"));
const SubscribersList = lazy(() => import("./pages/SubscribersList"));
const NuevoSuscriptor = lazy(() => import("./pages/SubscriberNew"));
const GestionPlanes = lazy(() => import("./pages/PlansManagement"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const SuperAdminUsers = lazy(() => import("./pages/SuperAdminUsers"));
const SuperAdminRoadmap = lazy(() => import("./pages/SuperAdminRoadmap"));
const SuperAdminSupportRequests = lazy(() => import("./pages/SuperAdminSupportRequests"));
const SuperAdminTools = lazy(() => import("./pages/SuperAdminTools"));
const SettingsRenumberDocuments = lazy(() => import("./pages/SettingsRenumberDocuments"));
const Integrations = lazy(() => import("./pages/Integrations"));
const IntegrationAccess = lazy(() => import("./pages/IntegrationAccess"));
const ExcelFiles = lazy(() => import("./pages/ExcelFiles"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ProductManagement = lazy(() => import("./pages/ProductManagement"));
const ProductCategories = lazy(() => import("./pages/ProductCategories"));
const ProductForm = lazy(() => import("./pages/ProductForm"));
const ProductConfigPage = lazy(() => import("./pages/ProductConfigPage"));
const ProductionConfiguration = lazy(() => import("./pages/ProductionConfiguration"));
const WorkloadDashboard = lazy(() => import("./pages/WorkloadDashboard"));
const ProductTestPage = lazy(() => import("./pages/ProductTestPage"));
const PresupuestosDashboard = lazy(() => import("./pages/PresupuestosDashboard"));
const ImageManagement = lazy(() => import("./pages/ImageManagement"));
const SalesOrdersList = lazy(() => import("./pages/SalesOrdersList"));
const SalesOrderDetail = lazy(() => import("./pages/SalesOrderDetail"));
const SalesOrderNew = lazy(() => import("./pages/SalesOrderNew"));
const SalesOrderEdit = lazy(() => import("./pages/SalesOrderEdit"));
const ProductionBoard = lazy(() => import("./pages/ProductionBoard"));
const ProductionBoardKanban = lazy(() => import("./pages/ProductionBoardKanban"));
const ProductionBoardCompact = lazy(() => import("./pages/ProductionBoardCompact"));
const ProductionBoardRedirect = lazy(() => import("./pages/ProductionBoardRedirect"));
const Novedades = lazy(() => import("./pages/Novedades"));
const ApiHome = lazy(() => import("./pages/ApiHome"));
const CustomerDiscountsPage = lazy(() => import("./pages/CustomerDiscountsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PortalQuote = lazy(() => import("./pages/PortalQuote"));
const PortalLogin = lazy(() => import("./pages/PortalLogin"));
const PortalSetPassword = lazy(() => import("./pages/PortalSetPassword"));
const PortalHome = lazy(() => import("./pages/PortalHome"));
const B2bCatalog = lazy(() => import("./pages/B2bCatalog"));
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { useSessionMonitor } from "./hooks/useSessionMonitor";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos - los datos se consideran frescos
      gcTime: 1000 * 60 * 30, // 30 minutos en caché
      refetchOnWindowFocus: false, // No refetch al volver a la pestaña
      refetchOnReconnect: false, // No refetch al reconectar
      retry: 1, // Solo 1 reintento en errores
    },
  },
});

const AppContent = () => {
  useSessionMonitor();
  
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">
          <p className="text-muted-foreground">Cargando…</p>
        </div>
      }
    >
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Index />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Clientes />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes/nuevo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClienteForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes/:id/editar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClienteForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes/tarifas"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CustomerDiscountsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos"
        element={
          <ProtectedRoute>
            <AppLayout>
              <QuotesList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/nuevo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <QuoteNew />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/agrupado/nuevo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GroupedQuoteNew />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <QuoteDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/editar/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <QuoteEdit />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/ajustes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Additionals />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/plantilla-pdf"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsPdfTemplate />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/formatos-numeracion"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsNumberingFormats />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/tema-corporativo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsThemeCorporate />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/smtp"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsSmtp />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SubscribersList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios/nuevo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <NuevoSuscriptor />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/suscriptores/:id/usuarios"
        element={
          <ProtectedRoute>
            <AppLayout>
              <UsuariosSuscriptor />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/suscriptores/:id/editar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EditarSuscriptor />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/planes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GestionPlanes />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SuperAdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/usuarios"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SuperAdminUsers />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/renumerar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsRenumberDocuments />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/integraciones"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Integrations />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/integraciones-acceso"
        element={
          <ProtectedRoute>
            <AppLayout>
              <IntegrationAccess />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/archivos-excel"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ExcelFiles />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/productos"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductManagement />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/productos/:productId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductConfigPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/productos/test"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductTestPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/productos/nuevo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductForm />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categorias"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductCategories />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/produccion"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductionConfiguration />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/carga-trabajo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <WorkloadDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/presupuestos"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PresupuestosDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/imagenes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ImageManagement />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SalesOrdersList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/nuevo"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SalesOrderNew />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/:id/editar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SalesOrderEdit />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SalesOrderDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel-produccion"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductionBoardRedirect />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel-produccion-lista"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductionBoard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel-produccion-tablero"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductionBoardRedirect />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel-produccion-compacta"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProductionBoardRedirect />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/novedades"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Novedades />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/api-home"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ApiHome />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/roadmap"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SuperAdminRoadmap />
            </AppLayout>
          </ProtectedRoute>
        }
        />
      <Route
        path="/superadmin/solicitudes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SuperAdminSupportRequests />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/herramientas"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SuperAdminTools />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ayuda"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HelpPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracion/portal-b2b"
        element={
          <ProtectedRoute>
            <AppLayout>
              <B2bCatalog />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* Public portal routes — no auth required */}
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/set-password" element={<PortalSetPassword />} />
      <Route path="/portal" element={<PortalHome />} />
      <Route path="/portal/:token" element={<PortalQuote />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
