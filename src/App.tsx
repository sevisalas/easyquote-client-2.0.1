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
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            path="/presupuestos/nuevo"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <QuoteNew />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
