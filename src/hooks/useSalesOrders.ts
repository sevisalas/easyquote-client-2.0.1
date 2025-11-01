import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SalesOrder {
  id: string;
  order_number: string;
  quote_id?: string;
  customer_id?: string;
  user_id: string;
  status: 'pending' | 'in_production' | 'completed' | 'cancelled';
  order_date: string;
  delivery_date?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  final_price: number;
  notes?: string;
  holded_document_id?: string;
  holded_document_number?: string;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  price: number;
  outputs?: Record<string, any>;
  prompts?: Record<string, any>;
  multi?: Record<string, any>;
  description?: string;
  position: number;
}

export const useSalesOrders = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const fetchSalesOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SalesOrder[];
    } catch (error: any) {
      console.error('Error fetching sales orders:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los pedidos",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrderById = async (id: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as SalesOrder | null;
    } catch (error: any) {
      console.error('Error fetching sales order:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cargar el pedido",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', orderId)
        .order('position');

      if (error) throw error;
      return data as SalesOrderItem[];
    } catch (error: any) {
      console.error('Error fetching sales order items:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los items del pedido",
        variant: "destructive",
      });
      return [];
    }
  };

  const updateSalesOrderStatus = async (orderId: string, status: SalesOrder['status']) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('sales_orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Estado actualizado",
        description: "El estado del pedido se actualizó correctamente",
      });
      return true;
    } catch (error: any) {
      console.error('Error updating sales order status:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchSalesOrders,
    fetchSalesOrderById,
    fetchSalesOrderItems,
    updateSalesOrderStatus,
  };
};