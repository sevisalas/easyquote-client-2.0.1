import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Boxes, Search, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";

interface EasyQuoteProduct {
  id: string;
  name: string;
  isActive: boolean;
}

interface ComponentSetting {
  easyquote_product_id: string;
  is_component: boolean;
}

export default function ComponentsManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Obtener organization_id del usuario
  const { data: organizationId } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Primero buscar si es owner de una organización
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)
        .maybeSingle();

      if (org) return org.id;

      // Si no, buscar membresía
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return member?.organization_id || null;
    }
  });

  // Obtener productos de EasyQuote
  const { data: easyquoteProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['easyquote-products-for-components'],
    queryFn: async () => {
      const { data, error } = await invokeEasyQuoteFunction<EasyQuoteProduct[]>('easyquote-products', {});
      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      // Solo productos activos
      const list = Array.isArray(data) ? data : (data as any)?.items || [];
      return list.filter((p: any) => p.isActive === true) as EasyQuoteProduct[];
    }
  });

  // Obtener configuración de componentes (qué productos son componentes)
  const { data: componentSettings = [], isLoading: loadingSettings } = useQuery({
    queryKey: ['component-settings', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('product_component_settings')
        .select('easyquote_product_id, is_component')
        .eq('organization_id', organizationId)
        .eq('is_component', true);

      if (error) throw error;
      return data as ComponentSetting[];
    },
    enabled: !!organizationId
  });

  // Mutación para marcar/desmarcar producto como componente
  const toggleComponentMutation = useMutation({
    mutationFn: async ({ productId, isComponent }: { productId: string; isComponent: boolean }) => {
      if (!organizationId) throw new Error('No organization');

      const { error } = await supabase
        .from('product_component_settings')
        .upsert({
          organization_id: organizationId,
          easyquote_product_id: productId,
          is_component: isComponent,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,easyquote_product_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-settings'] });
      queryClient.invalidateQueries({ queryKey: ['component-product-ids'] });
      toast({ title: "Configuración actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Set de productos marcados como componentes
  const componentProductIds = useMemo(() => {
    return new Set(componentSettings.map(s => s.easyquote_product_id));
  }, [componentSettings]);

  // Filtrar productos por búsqueda
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return easyquoteProducts;
    const term = searchTerm.toLowerCase();
    return easyquoteProducts.filter(p => 
      p.name.toLowerCase().includes(term)
    );
  }, [easyquoteProducts, searchTerm]);

  // Productos marcados como componentes (para mostrar primero)
  const componentProducts = filteredProducts.filter(p => componentProductIds.has(p.id));
  const regularProducts = filteredProducts.filter(p => !componentProductIds.has(p.id));

  const isLoading = loadingProducts || loadingSettings;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Boxes className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Componentes</h1>
          <p className="text-muted-foreground text-sm">
            Marca productos como componentes para usarlos dentro de productos compuestos
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {componentProductIds.size} componente{componentProductIds.size !== 1 ? 's' : ''} configurado{componentProductIds.size !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos disponibles</p>
              <p className="text-sm">Sube archivos Excel para crear productos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[150px] text-right">Es componente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Primero mostrar los que son componentes */}
                {componentProducts.map((product) => (
                  <TableRow key={product.id} className="bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Componente
                        </Badge>
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={true}
                        onCheckedChange={(checked) => {
                          toggleComponentMutation.mutate({ 
                            productId: product.id, 
                            isComponent: checked 
                          });
                        }}
                        disabled={toggleComponentMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {/* Luego mostrar los productos regulares */}
                {regularProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={false}
                        onCheckedChange={(checked) => {
                          toggleComponentMutation.mutate({ 
                            productId: product.id, 
                            isComponent: checked 
                          });
                        }}
                        disabled={toggleComponentMutation.isPending}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <strong>Nota:</strong> Los productos marcados como componentes no aparecerán en la lista de selección de productos al crear presupuestos o pedidos. 
        Solo se podrán usar dentro de productos compuestos.
      </div>
    </div>
  );
}
