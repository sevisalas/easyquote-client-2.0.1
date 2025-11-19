import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, RefreshCw, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Organization {
  id: string;
  name: string;
  api_user_id: string;
}

interface NumberingFormat {
  prefix: string;
  suffix: string | null;
  use_year: boolean;
  year_format: string;
  sequential_digits: number;
}

const SettingsRenumberDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [renumberQuotes, setRenumberQuotes] = useState(false);
  const [renumberOrders, setRenumberOrders] = useState(false);
  const [quoteFormat, setQuoteFormat] = useState<NumberingFormat | null>(null);
  const [orderFormat, setOrderFormat] = useState<NumberingFormat | null>(null);
  const [documentCounts, setDocumentCounts] = useState<{ quotes: number; orders: number }>({ quotes: 0, orders: 0 });

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/');
      return;
    }
    fetchOrganizations();
  }, [isSuperAdmin, navigate]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchFormatsAndCounts();
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, api_user_id')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los suscriptores",
        variant: "destructive",
      });
    }
  };

  const fetchFormatsAndCounts = async () => {
    try {
      const selectedOrg = organizations.find(o => o.id === selectedOrgId);
      if (!selectedOrg) return;

      // Fetch numbering formats
      const { data: formats, error: formatsError } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('user_id', selectedOrg.api_user_id);

      if (formatsError) throw formatsError;

      const quoteFormat = formats?.find(f => f.document_type === 'quote');
      const orderFormat = formats?.find(f => f.document_type === 'order');

      setQuoteFormat(quoteFormat ? {
        prefix: quoteFormat.prefix,
        suffix: quoteFormat.suffix,
        use_year: quoteFormat.use_year,
        year_format: quoteFormat.year_format,
        sequential_digits: quoteFormat.sequential_digits
      } : {
        prefix: '',
        suffix: '',
        use_year: true,
        year_format: 'YY',
        sequential_digits: 4
      });

      setOrderFormat(orderFormat ? {
        prefix: orderFormat.prefix,
        suffix: orderFormat.suffix,
        use_year: orderFormat.use_year,
        year_format: orderFormat.year_format,
        sequential_digits: orderFormat.sequential_digits
      } : {
        prefix: 'SO-',
        suffix: '',
        use_year: true,
        year_format: 'YYYY',
        sequential_digits: 4
      });

      // Fetch document counts
      const { count: quotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', selectedOrg.api_user_id);

      const { count: ordersCount } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', selectedOrg.api_user_id);

      setDocumentCounts({
        quotes: quotesCount || 0,
        orders: ordersCount || 0
      });
    } catch (error: any) {
      console.error('Error fetching formats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los formatos",
        variant: "destructive",
      });
    }
  };

  const generateExample = (format: NumberingFormat): string => {
    let example = format.prefix;
    
    if (format.use_year) {
      const year = new Date().getFullYear();
      const yearStr = format.year_format === 'YY' 
        ? year.toString().slice(-2) 
        : year.toString();
      example += yearStr;
    }
    
    example += '-' + '1'.padStart(format.sequential_digits, '0');
    
    if (format.suffix) {
      example += format.suffix;
    }
    
    return example;
  };

  const handleRenumber = async () => {
    if (!selectedOrgId || (!renumberQuotes && !renumberOrders)) {
      toast({
        title: "Error",
        description: "Selecciona un suscriptor y al menos un tipo de documento",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const selectedOrg = organizations.find(o => o.id === selectedOrgId);
      if (!selectedOrg) throw new Error("Organización no encontrada");

      const { data, error } = await supabase.functions.invoke('renumber-documents', {
        body: {
          userId: selectedOrg.api_user_id,
          renumberQuotes,
          renumberOrders,
          quoteFormat,
          orderFormat
        }
      });

      if (error) throw error;

      toast({
        title: "Renumeración completada",
        description: `Se han renumerado ${data.quotesUpdated || 0} presupuestos y ${data.ordersUpdated || 0} pedidos`,
      });

      // Reset selections
      setRenumberQuotes(false);
      setRenumberOrders(false);
      fetchFormatsAndCounts();
    } catch (error: any) {
      console.error('Error renumbering documents:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron renumerar los documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Hash className="h-8 w-8" />
            Renumerar Documentos
          </h1>
          <p className="text-muted-foreground">
            Renumerar presupuestos y pedidos según el formato configurado
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Suscriptor</CardTitle>
          <CardDescription>
            Elige el suscriptor cuyos documentos deseas renumerar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Suscriptor</Label>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un suscriptor" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {org.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrgId && (
            <>
              <Alert>
                <AlertDescription>
                  Este suscriptor tiene <strong>{documentCounts.quotes}</strong> presupuestos 
                  y <strong>{documentCounts.orders}</strong> pedidos.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="renumber-quotes"
                    checked={renumberQuotes}
                    onCheckedChange={(checked) => setRenumberQuotes(checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="renumber-quotes" className="cursor-pointer">
                      Renumerar Presupuestos ({documentCounts.quotes})
                    </Label>
                    {quoteFormat && (
                      <p className="text-sm text-muted-foreground">
                        Formato: {generateExample(quoteFormat)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="renumber-orders"
                    checked={renumberOrders}
                    onCheckedChange={(checked) => setRenumberOrders(checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="renumber-orders" className="cursor-pointer">
                      Renumerar Pedidos ({documentCounts.orders})
                    </Label>
                    {orderFormat && (
                      <p className="text-sm text-muted-foreground">
                        Formato: {generateExample(orderFormat)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200">
                <AlertDescription className="text-amber-800">
                  <strong>Advertencia:</strong> Esta acción renumerará todos los documentos seleccionados
                  según su fecha de creación. Esta operación no se puede deshacer.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleRenumber}
                disabled={loading || (!renumberQuotes && !renumberOrders)}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Renumerando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Renumerar Documentos
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsRenumberDocuments;
