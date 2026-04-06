
UPDATE sales_order_items
SET 
  quantity = 5000,
  price = 514.96,
  prompts = jsonb_set(
    prompts::jsonb,
    '{0,value}',
    '"5000"'
  ),
  description = 'Cantidad ejemplares: 5000
Producto: Díptico
Plegado: Díptico
Tamaño cerrado: DIN A5 (14,8 x 21)
Papel: Estucado brillo 200 grs
Tintas: 4+4
Plastificado: Sin plastificar
Acabado: Corte guillotina',
  outputs = '[{"name":"Corte","type":"Generic","value":"43,1591424"},{"name":"Ancho hoja valido","type":"Width","value":"864"},{"name":"Alto mm (abierto)","type":"Height","value":"210"},{"name":"Ancho mm (abierto)","type":"Width","value":"296"},{"name":"Alto mm (cerrado)","type":"Height","value":"210"},{"name":"Ancho mm (cerrado)","type":"Width","value":"148"},{"name":"Coste papel","type":"Generic","value":"171,48688128000003"},{"name":"Precio Kg papel","type":"Generic","value":"1,9644300000000001"},{"name":"Coste planchas","type":"Generic","value":"123,6"},{"name":"Coste tirada","type":"Generic","value":"74,159999999999997"},{"name":"Mejor opción","type":"Instructions","value":"Offset 64 x 88 cm"},{"name":"Precio","type":"Price","value":"514,95539868"},{"name":"Plegado","type":"Generic","value":"49,439999999999998"},{"name":"Plastificado","type":"Generic","value":"0"},{"name":"Total hojas","type":"Quantity","value":"775"},{"name":"Poses","type":"Workflow","value":"8"},{"name":"Alto hoja valido","type":"Height","value":"624"},{"name":"Troquelado","type":"Generic","value":"0"},{"name":"Hendido","type":"Generic","value":"53,109375"},{"name":"Resmas","type":"Quantity","value":"1,55"}]'::jsonb
WHERE sales_order_id = '3a67bf3a-52cf-4ae2-83aa-cb5b1b0b985f';

UPDATE sales_orders
SET final_price = 514.96,
    subtotal = 514.96
WHERE id = '3a67bf3a-52cf-4ae2-83aa-cb5b1b0b985f';
