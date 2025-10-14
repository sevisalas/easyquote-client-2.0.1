import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface CsvRow {
  ID: string;
  Nombre: string;
  "Calculator ID": string;
}

export const WooCommerceCsvUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentOrganization?.id) return;

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"/, '').replace(/"$/, '').replace(/^\ufeff/, ''));
      
      // Parse CSV
      const products: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => 
          v.trim().replace(/^"/, '').replace(/"$/, '')
        ) || [];
        
        if (values.length >= 3) {
          products.push({
            ID: values[0],
            Nombre: values[1],
            "Calculator ID": values[2]
          });
        }
      }

      console.log(`Parsed ${products.length} products from CSV`);

      // Group by calculator_id
      const groupedProducts: Record<string, { id: string; name: string }[]> = {};
      products.forEach(p => {
        const calcId = p["Calculator ID"];
        if (!calcId) return;
        
        if (!groupedProducts[calcId]) {
          groupedProducts[calcId] = [];
        }
        
        groupedProducts[calcId].push({
          id: p.ID,
          name: p.Nombre
        });
      });

      // Delete existing links for this organization
      const { error: deleteError } = await supabase
        .from("woocommerce_product_links")
        .delete()
        .eq("organization_id", currentOrganization.id);

      if (deleteError) throw deleteError;

      // Insert new links
      const records = Object.entries(groupedProducts).map(([calculatorId, wooProducts]) => ({
        organization_id: currentOrganization.id,
        easyquote_product_id: calculatorId,
        easyquote_product_name: calculatorId,
        woo_products: wooProducts,
        is_linked: true,
        product_count: wooProducts.length,
        last_synced_at: new Date().toISOString()
      }));

      if (records.length > 0) {
        const { error: insertError } = await supabase
          .from("woocommerce_product_links")
          .insert(records);

        if (insertError) throw insertError;
      }

      toast({
        title: "CSV importado correctamente",
        description: `Se han vinculado ${records.length} calculadoras con ${products.length} productos de WooCommerce`,
      });

      // Reset input
      event.target.value = '';
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast({
        title: "Error al importar CSV",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="csv-upload" className="text-sm font-medium">
          Importar productos desde CSV
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Sube un archivo CSV con las columnas: ID, Nombre, Calculator ID
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          className="flex-1"
        />
        <Button
          disabled={uploading}
          variant="outline"
          size="icon"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>
      {uploading && (
        <p className="text-xs text-muted-foreground">
          Procesando archivo...
        </p>
      )}
    </div>
  );
};
