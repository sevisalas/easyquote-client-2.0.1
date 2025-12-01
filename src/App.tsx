import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Clientes from "./pages/Clientes";
import ClienteForm from "./pages/ClienteForm";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import AppLayout from "./components/layout/AppLayout";
import QuoteNew from "./pages/QuoteNew";
import QuoteEdit from "./pages/QuoteEdit";
import QuotesList from "./pages/QuotesList";
import SettingsPdfTemplate from "./pages/SettingsPdfTemplate";
import SettingsNumberingFormats from "./pages/SettingsNumberingFormats";
import SettingsTheme from "./pages/SettingsTheme";
import Additionals from "./pages/Additionals";
import QuoteDetail from "./pages/QuoteDetail";
import EditarSuscriptor from "./pages/SubscriberEdit";
import UsuariosSuscriptor from "./pages/SubscriberUsers";
import SubscribersList from "./pages/SubscribersList";
import NuevoSuscriptor from "./pages/SubscriberNew";
import GestionPlanes from "./pages/PlansManagement";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminUsers from "./pages/SuperAdminUsers";
import SettingsRenumberDocuments from "./pages/SettingsRenumberDocuments";
import Integrations from "./pages/Integrations";
import IntegrationAccess from "./pages/IntegrationAccess";
import ExcelFiles from "./pages/ExcelFiles";
import AdminDashboard from "./pages/AdminDashboard";
import ProductManagement from "./pages/ProductManagement";
import ProductCategories from "./pages/ProductCategories";
import ProductForm from "./pages/ProductForm";





import PresupuestosDashboard from "./pages/PresupuestosDashboard";
import ProductTestPage from "./pages/ProductTestPage";
import ImageManagement from "./pages/ImageManagement";
import SalesOrdersList from "./pages/SalesOrdersList";
import SalesOrderDetail from "./pages/SalesOrderDetail";
import SalesOrderNew from "./pages/SalesOrderNew";
import SalesOrderEdit from "./pages/SalesOrderEdit";
import ProductionBoard from "./pages/ProductionBoard";
import Novedades from "./pages/Novedades";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { useSessionMonitor } from "./hooks/useSessionMonitor";

const queryClient = new QueryClient();

const AppContent = () => {
  useSessionMonitor();
  
  return (
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
      {/* Ruta de tema temporalmente desactivada */}
      {/* <Route
        path="/configuracion/tema"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsTheme />
            </AppLayout>
          </ProtectedRoute>
        }
      /> */}
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
              <ProductionBoard />
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
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
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
);

export default App;
