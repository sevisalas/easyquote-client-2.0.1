import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, Copy, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function QuoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Load quote data
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          customers (
            id,
            name,
            email,
            phone,
            address
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const formatEUR = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No especificada";
    return new Date(dateString).toLocaleDateString("es-ES");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "sent": return "default";
      case "accepted": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft": return "Borrador";
      case "sent": return "Enviado";
      case "accepted": return "Aceptado";
      case "rejected": return "Rechazado";
      default: return status;
    }
  };

  const handleDuplicate = () => {
    navigate(`/presupuestos/nuevo?from=${id}`);
  };

  const handleEdit = () => {
    navigate(`/presupuestos/${id}/editar`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Cargando presupuesto...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive">Error al cargar el presupuesto</p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                Volver
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selections = Array.isArray(quote.selections) ? quote.selections : [];
  const quoteAdditionals = Array.isArray(quote.quote_additionals) ? quote.quote_additionals : [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>Presupuesto {quote.quote_number}</span>
              <Badge variant={getStatusColor(quote.status)}>
                {getStatusText(quote.status)}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEdit} variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button onClick={handleDuplicate} variant="outline">
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </Button>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Quote Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Cliente</h4>
              <div className="text-sm space-y-1">
                <p><strong>{quote.customers?.name || "Cliente no encontrado"}</strong></p>
                {quote.customers?.email && <p>{quote.customers.email}</p>}
                {quote.customers?.phone && <p>{quote.customers.phone}</p>}
                {quote.customers?.address && <p>{quote.customers.address}</p>}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Detalles</h4>
              <div className="text-sm space-y-1">
                <p><strong>Número:</strong> {quote.quote_number}</p>
                <p><strong>Fecha:</strong> {formatDate(quote.created_at)}</p>
                <p><strong>Válido hasta:</strong> {formatDate(quote.valid_until)}</p>
                <p><strong>Estado:</strong> {getStatusText(quote.status)}</p>
              </div>
            </div>
          </div>

          {quote.title && (
            <div>
              <h4 className="font-medium mb-2">Título</h4>
              <p className="text-sm">{quote.title}</p>
            </div>
          )}

          {quote.description && (
            <div>
              <h4 className="font-medium mb-2">Descripción</h4>
              <p className="text-sm whitespace-pre-wrap">{quote.description}</p>
            </div>
          )}

          {quote.notes && (
            <div>
              <h4 className="font-medium mb-2">Notas internas</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          {selections.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay productos en este presupuesto.
            </p>
          ) : (
            <div className="space-y-4">
              {selections.map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">Producto {index + 1}</h4>
                    <span className="font-semibold">
                      {item.price ? formatEUR(item.price) : "Sin precio"}
                    </span>
                  </div>
                  
                  {item.itemDescription && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.itemDescription}
                    </p>
                  )}

                  {item.outputs && item.outputs.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p>Configuraciones: {item.outputs.length} elementos</p>
                    </div>
                  )}

                  {item.itemAdditionals && item.itemAdditionals.length > 0 && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium mb-1">Ajustes del producto:</h5>
                      <div className="text-xs space-y-1">
                        {item.itemAdditionals.map((additional: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span>{additional.name}</span>
                            <span>
                              {additional.type === 'net_amount' ? formatEUR(additional.value) : additional.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote-level Additionals */}
      {quoteAdditionals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ajustes del Presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quoteAdditionals.map((additional: any, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{additional.name}</span>
                  <span>
                    {additional.type === 'net_amount' ? formatEUR(additional.value) : additional.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatEUR(quote.subtotal || 0)}</span>
            </div>
            {quote.tax_amount > 0 && (
              <div className="flex justify-between">
                <span>IVA:</span>
                <span>{formatEUR(quote.tax_amount)}</span>
              </div>
            )}
            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Descuento:</span>
                <span>-{formatEUR(quote.discount_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{formatEUR(quote.final_price || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}