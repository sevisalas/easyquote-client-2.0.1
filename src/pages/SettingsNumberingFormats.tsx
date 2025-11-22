import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  sequential_digits: number;
  last_sequential_number: number;
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
    year_format: 'YY',
    sequential_digits: 4,
    last_sequential_number: 0
  });
  const [orderFormat, setOrderFormat] = useState<NumberingFormat>({
    document_type: 'order',
    prefix: 'SO-',
    suffix: '',
    use_year: true,
    year_format: 'YYYY',
    sequential_digits: 4,
    last_sequential_number: 0
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
            year_format: quoteData.year_format as 'YY' | 'YYYY',
            sequential_digits: quoteData.sequential_digits || 4,
            last_sequential_number: quoteData.last_sequential_number || 0
          });
        }

        if (orderData) {
          setOrderFormat({
            id: orderData.id,
            document_type: 'order',
            prefix: orderData.prefix || '',
            suffix: orderData.suffix || '',
            use_year: orderData.use_year,
            year_format: orderData.year_format as 'YY' | 'YYYY',
            sequential_digits: orderData.sequential_digits || 4,
            last_sequential_number: orderData.last_sequential_number || 0
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
    
    example += '-' + sequential.toString().padStart(format.sequential_digits, '0');
    
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
        sequential_digits: format.sequential_digits,
        last_sequential_number: format.last_sequential_number
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
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Formatos de numeración</h1>
            <p className="text-sm text-muted-foreground">Configura el formato de los números</p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </>
            )}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Presupuestos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Presupuestos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="quote-prefix" className="text-xs">Prefijo</Label>
                  <Input
                    id="quote-prefix"
                    className="h-8 text-sm"
                    value={quoteFormat.prefix}
                    onChange={(e) => setQuoteFormat({ ...quoteFormat, prefix: e.target.value })}
                    placeholder="PRES-"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="quote-suffix" className="text-xs">Sufijo</Label>
                  <Input
                    id="quote-suffix"
                    className="h-8 text-sm"
                    value={quoteFormat.suffix}
                    onChange={(e) => setQuoteFormat({ ...quoteFormat, suffix: e.target.value })}
                    placeholder="-A"
                  />
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="quote-digits" className="text-xs">Dígitos</Label>
                  <Select
                    value={quoteFormat.sequential_digits.toString()}
                    onValueChange={(value) => setQuoteFormat({ ...quoteFormat, sequential_digits: parseInt(value) })}
                  >
                    <SelectTrigger id="quote-digits" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 (001)</SelectItem>
                      <SelectItem value="4">4 (0001)</SelectItem>
                      <SelectItem value="5">5 (00001)</SelectItem>
                      <SelectItem value="6">6 (000001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center h-8">
                  <Switch
                    id="quote-use-year"
                    checked={quoteFormat.use_year}
                    onCheckedChange={(checked) => setQuoteFormat({ ...quoteFormat, use_year: checked })}
                  />
                  <Label htmlFor="quote-use-year" className="text-xs cursor-pointer ml-2">Año</Label>
                </div>
                {quoteFormat.use_year && (
                  <div className="flex-1">
                    <Label htmlFor="quote-year-format" className="text-xs">Formato año</Label>
                    <Select
                      value={quoteFormat.year_format}
                      onValueChange={(value: 'YY' | 'YYYY') => setQuoteFormat({ ...quoteFormat, year_format: value })}
                    >
                      <SelectTrigger id="quote-year-format" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YY">25</SelectItem>
                        <SelectItem value="YYYY">2025</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-2">
                <div>
                  <Label htmlFor="quote-last-number" className="text-xs">Último número usado</Label>
                  <Input
                    id="quote-last-number"
                    type="number"
                    min="0"
                    className="h-8 text-sm"
                    value={quoteFormat.last_sequential_number}
                    onChange={(e) => setQuoteFormat({ ...quoteFormat, last_sequential_number: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Próximo número: {generateExample(quoteFormat, quoteFormat.last_sequential_number + 1)}
                  </p>
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Vista previa:</p>
                  <p className="text-sm font-mono font-semibold">{generateExample(quoteFormat, quoteFormat.last_sequential_number + 1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pedidos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pedidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="order-prefix" className="text-xs">Prefijo</Label>
                  <Input
                    id="order-prefix"
                    className="h-8 text-sm"
                    value={orderFormat.prefix}
                    onChange={(e) => setOrderFormat({ ...orderFormat, prefix: e.target.value })}
                    placeholder="SO-"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="order-suffix" className="text-xs">Sufijo</Label>
                  <Input
                    id="order-suffix"
                    className="h-8 text-sm"
                    value={orderFormat.suffix}
                    onChange={(e) => setOrderFormat({ ...orderFormat, suffix: e.target.value })}
                    placeholder="-B"
                  />
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="order-digits" className="text-xs">Dígitos</Label>
                  <Select
                    value={orderFormat.sequential_digits.toString()}
                    onValueChange={(value) => setOrderFormat({ ...orderFormat, sequential_digits: parseInt(value) })}
                  >
                    <SelectTrigger id="order-digits" className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 (001)</SelectItem>
                      <SelectItem value="4">4 (0001)</SelectItem>
                      <SelectItem value="5">5 (00001)</SelectItem>
                      <SelectItem value="6">6 (000001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center h-8">
                  <Switch
                    id="order-use-year"
                    checked={orderFormat.use_year}
                    onCheckedChange={(checked) => setOrderFormat({ ...orderFormat, use_year: checked })}
                  />
                  <Label htmlFor="order-use-year" className="text-xs cursor-pointer ml-2">Año</Label>
                </div>
                {orderFormat.use_year && (
                  <div className="flex-1">
                    <Label htmlFor="order-year-format" className="text-xs">Formato año</Label>
                    <Select
                      value={orderFormat.year_format}
                      onValueChange={(value: 'YY' | 'YYYY') => setOrderFormat({ ...orderFormat, year_format: value })}
                    >
                      <SelectTrigger id="order-year-format" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YY">25</SelectItem>
                        <SelectItem value="YYYY">2025</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-2">
                <div>
                  <Label htmlFor="order-last-number" className="text-xs">Último número usado</Label>
                  <Input
                    id="order-last-number"
                    type="number"
                    min="0"
                    className="h-8 text-sm"
                    value={orderFormat.last_sequential_number}
                    onChange={(e) => setOrderFormat({ ...orderFormat, last_sequential_number: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Próximo número: {generateExample(orderFormat, orderFormat.last_sequential_number + 1)}
                  </p>
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Vista previa:</p>
                  <p className="text-sm font-mono font-semibold">{generateExample(orderFormat, orderFormat.last_sequential_number + 1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> El siguiente número se generará como <strong>último número usado + 1</strong>. 
            Puedes editar manualmente el "Último número usado" para ajustar la secuencia.
          </p>
        </div>
    </div>
  );
}
