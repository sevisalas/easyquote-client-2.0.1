import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/contexts/SubscriptionContext";
interface ClienteData {
  name: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  province: string;
  notes: string;
  integration_id: string;
}

const ClienteForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { organization, membership } = useSubscription();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState<ClienteData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    zip: "",
    city: "",
    province: "",
    notes: "",
    integration_id: ""
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      fetchCliente();
    }
  }, [id]);

  const fetchCliente = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setFormData({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        zip: data.zip || "",
        city: data.city || "",
        province: data.province || "",
        notes: data.notes || "",
        integration_id: data.integration_id || ""
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar la información del cliente",
        variant: "destructive",
      });
      navigate('/clientes');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', id);

        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Cliente actualizado correctamente",
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user found");

        // Resolve organization_id robustly: sessionStorage > context > DB lookup
        let orgId = sessionStorage.getItem('selected_organization_id') 
          || organization?.id 
          || (membership as any)?.organization_id 
          || (membership as any)?.organization?.id 
          || null;

        // Fallback: query organization_members if still null
        if (!orgId) {
          const { data: memberData } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();
          if (memberData) {
            orgId = memberData.organization_id;
          }
        }

        console.log('[ClienteForm] Creating customer with orgId:', orgId, 'userId:', user.id);

        const { error } = await supabase
          .from('customers')
          .insert({
            ...formData,
            user_id: user.id,
            organization_id: orgId
          });

        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Cliente creado correctamente",
        });
      }
      
      navigate('/clientes');
    } catch (error: any) {
      console.error('[ClienteForm] Error:', error?.message || error);
      toast({
        title: "Error",
        description: isEditing ? "No se pudo actualizar el cliente" : "No se pudo crear el cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-20">
            <p className="text-muted-foreground">Cargando datos del cliente...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'p-3' : 'p-6'}`}>
      <div className="max-w-2xl mx-auto">
        <header className={isMobile ? 'mb-4' : 'mb-8'}>
          <Button
            variant="ghost"
            onClick={() => navigate('/clientes')}
            className={`mb-4 ${isMobile ? 'h-10' : ''}`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>
          <h1 className={`font-bold text-foreground mb-2 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
            {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isEditing ? 'Modifica la información del cliente' : 'Completa los datos del nuevo cliente'}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4' : ''}>
            <form onSubmit={handleSubmit} className={isMobile ? 'space-y-4' : 'space-y-6'}>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nombre completo del cliente"
                  required
                  className={isMobile ? 'h-11' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  className={isMobile ? 'h-11' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+34 600 000 000"
                  className={isMobile ? 'h-11' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Domicilio</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Calle, número, ciudad..."
                  className={isMobile ? 'h-11' : ''}
                />
              </div>

              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                <div className="space-y-2">
                  <Label htmlFor="zip">C.P.</Label>
                  <Input
                    id="zip"
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    placeholder="28001"
                    className={isMobile ? 'h-11' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Población</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Madrid"
                    className={isMobile ? 'h-11' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Provincia</Label>
                  <Input
                    id="province"
                    name="province"
                    value={formData.province}
                    onChange={handleChange}
                    placeholder="Madrid"
                    className={isMobile ? 'h-11' : ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="integration_id">ID de Integración</Label>
                <Input
                  id="integration_id"
                  name="integration_id"
                  value={formData.integration_id}
                  onChange={handleChange}
                  placeholder="ID de app integrada (opcional)"
                  className={isMobile ? 'h-11' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Información adicional sobre el cliente..."
                  rows={4}
                  className={isMobile ? 'min-h-[100px]' : ''}
                />
              </div>

              <div className={`flex gap-4 pt-4 ${isMobile ? 'flex-col' : ''}`}>
                <Button
                  type="submit"
                  disabled={loading}
                  className={`bg-primary hover:bg-primary/90 ${isMobile ? 'h-11 w-full' : ''}`}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Guardando...' : 'Guardar Cliente'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/clientes')}
                  disabled={loading}
                  className={isMobile ? 'h-11 w-full' : ''}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClienteForm;