import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SalesOrder {
  id: string;
  order_number: string;
  quote_id?: string;
  customer_id?: string;
  user_id: string;
  status: 'draft' | 'pending' | 'in_production' | 'completed';
  order_date: string;
  delivery_date?: string;
  title?: string;
  description?: string;
  terms_conditions?: string;
  valid_until?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  final_price: number;
  notes?: string;
  holded_document_id?: string;
  holded_document_number?: string;
  production_progress?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_from_scratch?: boolean;
}

export interface SalesOrderAdditional {
  id: string;
  sales_order_id: string;
  additional_id?: string;
  name: string;
  type: string;
  value: number;
  is_discount: boolean;
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
  production_status?: 'pending' | 'in_progress' | 'completed';
  imposition_data?: Record<string, any>;
}

export const useSalesOrders = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const fetchSalesOrders = async () => {
    try {
      setLoading(true);
      
      // Filtrar por organization_id para separar datos por tenant
      const organizationId = sessionStorage.getItem('selected_organization_id');
      
      let query = supabase
        .from('sales_orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      
      const { data, error } = await query;

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

  const fetchSalesOrderAdditionals = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_order_additionals')
        .select('*')
        .eq('sales_order_id', orderId);

      if (error) throw error;
      return data as SalesOrderAdditional[];
    } catch (error: any) {
      console.error('Error fetching sales order additionals:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los ajustes del pedido",
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

  const updateSalesOrderItem = async (
    itemId: string,
    updates: { quantity?: number; price?: number; description?: string }
  ): Promise<boolean> => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('sales_order_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Artículo actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      
      return true;
    } catch (error: any) {
      console.error('Error updating sales order item:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el artículo",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const recalculateSalesOrderTotals = async (orderId: string): Promise<boolean> => {
    try {
      // Fetch all items
      const { data: items, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('price, quantity')
        .eq('sales_order_id', orderId);

      if (itemsError) throw itemsError;

      // Fetch additionals
      const { data: additionals, error: additionalsError } = await supabase
        .from('sales_order_additionals')
        .select('type, value, is_discount')
        .eq('sales_order_id', orderId);

      if (additionalsError) throw additionalsError;

      // Calculate subtotal
      const subtotal = items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;

      // Calculate discount and tax from additionals
      let discountAmount = 0;
      let taxAmount = 0;

      additionals?.forEach((add) => {
        if (add.is_discount) {
          if (add.type === 'percentage') {
            discountAmount += (subtotal * add.value) / 100;
          } else {
            discountAmount += add.value;
          }
        } else {
          if (add.type === 'percentage') {
            taxAmount += (subtotal * add.value) / 100;
          } else {
            taxAmount += add.value;
          }
        }
      });

      const finalPrice = subtotal - discountAmount + taxAmount;

      // Update order totals
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          final_price: finalPrice,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      return true;
    } catch (error: any) {
      console.error('Error recalculating totals:', error);
      return false;
    }
  };

  const deleteSalesOrder = async (orderId: string) => {
    try {
      setLoading(true);
      
      // Delete items first
      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .delete()
        .eq('sales_order_id', orderId);

      if (itemsError) throw itemsError;

      // Delete additionals
      const { error: additionalsError } = await supabase
        .from('sales_order_additionals')
        .delete()
        .eq('sales_order_id', orderId);

      if (additionalsError) throw additionalsError;

      // Delete the order
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Pedido eliminado",
        description: "El pedido se eliminó correctamente",
      });
      return true;
    } catch (error: any) {
      console.error('Error deleting sales order:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el pedido",
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
    fetchSalesOrderAdditionals,
    updateSalesOrderStatus,
    updateSalesOrderItem,
    recalculateSalesOrderTotals,
    deleteSalesOrder,
  };
};