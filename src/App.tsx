import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import ClienteForm from "./pages/ClienteForm";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import AppLayout from "./components/layout/AppLayout";
import QuoteNew from "./pages/QuoteNew";
import QuoteEdit from "./pages/QuoteEdit";
import QuotesList from "./pages/QuotesList";
import SettingsPdfTemplate from "./pages/SettingsPdfTemplate";
import Additionals from "./pages/Additionals";
import QuoteDetail from "./pages/QuoteDetail";
import GestionUsuarios from "./pages/UserManagement";
import EditarSuscriptor from "./pages/SubscriberEdit";
import UsuariosSuscriptor from "./pages/SubscriberUsers";
import GestionPlanes from "./pages/PlansManagement";
import Integrations from "./pages/Integrations";
import IntegrationAccess from "./pages/IntegrationAccess";
import ExcelFiles from "./pages/ExcelFiles";
import AdminDashboard from "./pages/AdminDashboard";
import ProductManagement from "./pages/ProductManagement";
import ProductCategories from "./pages/ProductCategories";
import ApiCredentials from "./pages/ApiCredentials";
import OrganizationApiCredentials from "./pages/OrganizationApiCredentials";


import PresupuestosDashboard from "./pages/PresupuestosDashboard";
import ProductTestPage from "./pages/ProductTestPage";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SubscriptionProvider>
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
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
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
            path="/configuracion/credenciales-api"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ApiCredentials />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracion/credenciales-organizacion"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <OrganizationApiCredentials />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <GestionUsuarios />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </SubscriptionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
