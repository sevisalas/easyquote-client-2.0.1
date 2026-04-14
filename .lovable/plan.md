

## Plan: Optimizar llamadas API para productos compuestos

### Problema actual
Para "Encuadernado" se hacen **4-6 llamadas** al API:
1. **QuoteItem.tsx** hace PATCH/GET al padre (Encuadernado) - query `pricingQueryKey`
2. **CompositeComponentTabs.tsx** hace OTRO PATCH al padre - query `parent-pricing-outputs` (linea 471)
3. PATCH al componente Interior (fuente)
4. GET al componente Cubierta solo para buscar el prompt de lomo (linea 693)
5. PATCH al componente Cubierta (receptor)
6. Posible RE-PATCH a Cubierta si hay mismatches (linea 768)

### Flujo correcto (segun el usuario)
1. **1 GET al padre** (Encuadernado) - obtiene prompts y outputs generales
2. **1 PATCH por componente** - el padre inyecta valores a cada componente

### Cambios necesarios

**Archivo 1: `src/components/quotes/CompositeComponentTabs.tsx`**

1. **Eliminar query `parent-pricing-outputs`** (linea 471-495): duplica la llamada al padre que ya hace QuoteItem. En su lugar, usar los datos que ya llegan via prop `parentProduct` (que contiene el resultado de pricing del padre desde QuoteItem)

2. **Extraer outputs del padre de `parentProduct`** en vez de hacer una llamada separada. El prop ya existe y contiene `outputValues` y `prompts`

3. **Eliminar GET extra para buscar lomo** (linea 691-727): En vez de hacer un GET al componente Cubierta para encontrar el prompt de lomo, cachear/resolver el ID del prompt de lomo usando las `promptConnections` que ya tenemos, o usando los datos de la primera (y unica) llamada PATCH

4. **Eliminar re-PATCH** (lineas 759-780): El re-PATCH existe porque la primera llamada puede ignorar valores condicionales. En vez de hacer 2 PATCHs, enviar todos los inputs correctamente desde el principio (incluyendo el lomo ya resuelto)

**Archivo 2: `src/components/quotes/QuoteItem.tsx`**

5. **Para productos compuestos con `hasConfiguredComponents`**: Asegurarse de que la query principal solo hace GET (sin inputs) para obtener los prompts y outputs del padre. Los componentes se calculan en CompositeComponentTabs

### Resultado esperado
- **1 GET/PATCH** al padre (Encuadernado) desde QuoteItem
- **1 PATCH** por componente (Interior, Cubierta) desde CompositeComponentTabs
- Total: **3 llamadas** en vez de 4-6

### Seccion tecnica

- `parentProduct` prop en CompositeComponentTabs ya contiene `data.outputValues` y `data.prompts` del padre
- Para el lomo: usar `promptConnections` para saber que prompt del componente receptor es "lomo" sin hacer GET adicional
- El re-PATCH se puede evitar enviando los inputs en el orden correcto (primero los que activan campos condicionales, luego los valores)

