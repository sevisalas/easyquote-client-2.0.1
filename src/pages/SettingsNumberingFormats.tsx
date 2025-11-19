import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface NumberingFormat {
  id?: string;
  document_type: 'quote' | 'order';
  prefix: string;
  suffix: string;
  use_year: boolean;
  year_format: 'YY' | 'YYYY';
}

export default function SettingsNumberingFormats() {
  const navigate = useNavigate();
  const { isOrgAdmin, isSuperAdmin, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteFormat, setQuoteFormat] = useState<NumberingFormat>({
    document_type: 'quote',
    prefix: '',
    suffix: '',
    use_year: true,
    year_format: 'YY'
  });
  const [orderFormat, setOrderFormat] = useState<NumberingFormat>({
    document_type: 'order',
    prefix: 'SO-',
    suffix: '',
    use_year: true,
    year_format: 'YYYY'
  });

  useEffect(() => {
    if (!subscriptionLoading && !isOrgAdmin && !isSuperAdmin) {
      navigate("/");
      return;
    }
    loadFormats();
  }, [subscriptionLoading, isOrgAdmin, isSuperAdmin, navigate]);

  const loadFormats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data) {
        const quoteData = data.find(f => f.document_type === 'quote');
        const orderData = data.find(f => f.document_type === 'order');

        if (quoteData) {
          setQuoteFormat({
            id: quoteData.id,
            document_type: 'quote',
            prefix: quoteData.prefix || '',
            suffix: quoteData.suffix || '',
            use_year: quoteData.use_year,
            year_format: quoteData.year_format as 'YY' | 'YYYY'
          });
        }

        if (orderData) {
          setOrderFormat({
            id: orderData.id,
            document_type: 'order',
            prefix: orderData.prefix || '',
            suffix: orderData.suffix || '',
            use_year: orderData.use_year,
            year_format: orderData.year_format as 'YY' | 'YYYY'
          });
        }
      }
    } catch (error) {
      console.error('Error loading formats:', error);
      toast({
        title: "Error al cargar formatos",
        description: "No se pudieron cargar los formatos de numeración.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateExample = (format: NumberingFormat, sequential: number = 1) => {
    let example = format.prefix;
    
    if (format.use_year) {
      const year = new Date().getFullYear();
      const yearStr = format.year_format === 'YY' 
        ? year.toString().slice(-2) 
        : year.toString();
      example += yearStr;
    }
    
    example += '-' + sequential.toString().padStart(5, '0');
    
    if (format.suffix) {
      example += format.suffix;
    }
    
    return example;
  };

  const saveFormat = async (format: NumberingFormat) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get organization_id if user is org owner
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)
        .maybeSingle();

      const formatData = {
        user_id: user.id,
        organization_id: orgData?.id || null,
        document_type: format.document_type,
        prefix: format.prefix,
        suffix: format.suffix || '',
        use_year: format.use_year,
        year_format: format.year_format,
      };

      if (format.id) {
        const { error } = await supabase
          .from('numbering_formats')
          .update(formatData)
          .eq('id', format.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('numbering_formats')
          .insert(formatData);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error saving format:', error);
      return false;
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const quoteSuccess = await saveFormat(quoteFormat);
      const orderSuccess = await saveFormat(orderFormat);

      if (quoteSuccess && orderSuccess) {
        toast({
          title: "Formatos guardados",
          description: "Los formatos de numeración se han guardado correctamente.",
        });
        await loadFormats();
      } else {
        throw new Error('Failed to save formats');
      }
    } catch (error) {
      console.error('Error saving formats:', error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar los formatos de numeración.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || subscriptionLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Formatos de Numeración</h1>
            <p className="text-muted-foreground mt-1">
              Configura el formato de los números de presupuestos y pedidos
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar cambios
              </>
            )}
          </Button>
        </div>

        {/* Presupuestos */}
        <Card>
          <CardHeader>
            <CardTitle>Formato de Presupuestos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quote-prefix">Prefijo</Label>
                <Input
                  id="quote-prefix"
                  value={quoteFormat.prefix}
                  onChange={(e) => setQuoteFormat({ ...quoteFormat, prefix: e.target.value })}
                  placeholder="Ej: PRES-"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-suffix">Sufijo (opcional)</Label>
                <Input
                  id="quote-suffix"
                  value={quoteFormat.suffix}
                  onChange={(e) => setQuoteFormat({ ...quoteFormat, suffix: e.target.value })}
                  placeholder="Ej: -A"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="quote-use-year"
                checked={quoteFormat.use_year}
                onCheckedChange={(checked) => setQuoteFormat({ ...quoteFormat, use_year: checked })}
              />
              <Label htmlFor="quote-use-year" className="cursor-pointer">
                Incluir año
              </Label>
            </div>

            {quoteFormat.use_year && (
              <div className="space-y-2">
                <Label htmlFor="quote-year-format">Formato del año</Label>
                <Select
                  value={quoteFormat.year_format}
                  onValueChange={(value: 'YY' | 'YYYY') => setQuoteFormat({ ...quoteFormat, year_format: value })}
                >
                  <SelectTrigger id="quote-year-format" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YY">2 dígitos (25)</SelectItem>
                    <SelectItem value="YYYY">4 dígitos (2025)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="pt-4 border-t">
              <Label className="text-sm text-muted-foreground">Vista previa:</Label>
              <p className="text-lg font-mono font-semibold mt-1">
                {generateExample(quoteFormat)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Formato de Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="order-prefix">Prefijo</Label>
                <Input
                  id="order-prefix"
                  value={orderFormat.prefix}
                  onChange={(e) => setOrderFormat({ ...orderFormat, prefix: e.target.value })}
                  placeholder="Ej: SO-"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order-suffix">Sufijo (opcional)</Label>
                <Input
                  id="order-suffix"
                  value={orderFormat.suffix}
                  onChange={(e) => setOrderFormat({ ...orderFormat, suffix: e.target.value })}
                  placeholder="Ej: -B"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="order-use-year"
                checked={orderFormat.use_year}
                onCheckedChange={(checked) => setOrderFormat({ ...orderFormat, use_year: checked })}
              />
              <Label htmlFor="order-use-year" className="cursor-pointer">
                Incluir año
              </Label>
            </div>

            {orderFormat.use_year && (
              <div className="space-y-2">
                <Label htmlFor="order-year-format">Formato del año</Label>
                <Select
                  value={orderFormat.year_format}
                  onValueChange={(value: 'YY' | 'YYYY') => setOrderFormat({ ...orderFormat, year_format: value })}
                >
                  <SelectTrigger id="order-year-format" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YY">2 dígitos (25)</SelectItem>
                    <SelectItem value="YYYY">4 dígitos (2025)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="pt-4 border-t">
              <Label className="text-sm text-muted-foreground">Vista previa:</Label>
              <p className="text-lg font-mono font-semibold mt-1">
                {generateExample(orderFormat)}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> El número secuencial se genera automáticamente y siempre tendrá 5 dígitos (00001, 00002, etc.).
            Los formatos configurados se aplicarán a todos los nuevos presupuestos y pedidos creados.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
