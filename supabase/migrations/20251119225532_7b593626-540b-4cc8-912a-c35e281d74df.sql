-- Eliminar políticas que permiten a comerciales ver y crear pedidos
DROP POLICY IF EXISTS "Comercial can view sales orders" ON sales_orders;
DROP POLICY IF EXISTS "Comercial can create sales orders" ON sales_orders;