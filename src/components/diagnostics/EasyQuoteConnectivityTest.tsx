import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TestResult {
  accessible: boolean;
  status?: number;
  message?: string;
  error?: string;
}

interface ConnectivityTestResults {
  auth_endpoint: TestResult;
  products_endpoint: TestResult;
  main_site: TestResult;
  api_base: TestResult;
}

export const EasyQuoteConnectivityTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ConnectivityTestResults | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const runConnectivityTest = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      // Obtener token de EasyQuote primero
      const { data: tokenResponse, error: tokenError } = await supabase.functions.invoke('easyquote-auth', {
        body: { 
          email: 'test1@test1.com', 
          password: 'test1' 
        }
      });

      if (tokenError) {
        throw new Error(`Error obteniendo token: ${tokenError.message}`);
      }

      if (!tokenResponse?.token) {
        throw new Error('No se pudo obtener token de EasyQuote');
      }

      // Ejecutar test de conectividad
      const { data: testResults, error: testError } = await supabase.functions.invoke('test-easyquote-connectivity', {
        body: { token: tokenResponse.token }
      });

      if (testError) {
        throw new Error(`Error ejecutando test: ${testError.message}`);
      }

      setResults(testResults.tests);
      setTimestamp(testResults.timestamp);
      
      toast({
        title: "Test completado",
        description: "Resultados del test de conectividad disponibles",
      });

    } catch (error) {
      console.error('Error en test de conectividad:', error);
      toast({
        title: "Error en el test",
        description: error.message || "Error desconocido ejecutando el test",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (result: TestResult) => {
    if (result.accessible && (!result.status || result.status < 400)) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (result.accessible && result.status && result.status >= 400 && result.status < 500) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (result: TestResult) => {
    if (result.accessible && (!result.status || result.status < 400)) {
      return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
    } else if (result.accessible && result.status && result.status >= 400 && result.status < 500) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Advertencia</Badge>;
    } else {
      return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Diagnóstico de Conectividad EasyQuote
          {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={runConnectivityTest} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ejecutando Test...
              </>
            ) : (
              'Ejecutar Test de Conectividad'
            )}
          </Button>
          
          {timestamp && (
            <span className="text-sm text-muted-foreground">
              Último test: {new Date(timestamp).toLocaleString('es-ES')}
            </span>
          )}
        </div>

        {results && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Resultados del test de conectividad con los servicios de EasyQuote:
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(results.main_site)}
                  <div>
                    <div className="font-medium">Sitio Principal (easyquote.cloud)</div>
                    <div className="text-sm text-muted-foreground">
                      {results.main_site.message || results.main_site.error}
                    </div>
                  </div>
                </div>
                {getStatusBadge(results.main_site)}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(results.api_base)}
                  <div>
                    <div className="font-medium">API Base (api.easyquote.cloud)</div>
                    <div className="text-sm text-muted-foreground">
                      {results.api_base.message || results.api_base.error}
                    </div>
                  </div>
                </div>
                {getStatusBadge(results.api_base)}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(results.auth_endpoint)}
                  <div>
                    <div className="font-medium">Endpoint de Autenticación</div>
                    <div className="text-sm text-muted-foreground">
                      {results.auth_endpoint.message || results.auth_endpoint.error}
                    </div>
                  </div>
                </div>
                {getStatusBadge(results.auth_endpoint)}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(results.products_endpoint)}
                  <div>
                    <div className="font-medium">Endpoint de Productos</div>
                    <div className="text-sm text-muted-foreground">
                      {results.products_endpoint.message || results.products_endpoint.error}
                    </div>
                  </div>
                </div>
                {getStatusBadge(results.products_endpoint)}
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Interpretación:</strong> Si todos los endpoints muestran "OK", la API está funcionando correctamente. 
                Si hay errores, puede indicar problemas de red, mantenimiento del servidor, o problemas de configuración.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};