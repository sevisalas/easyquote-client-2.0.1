# Notas de Desarrollo - EasyQuote

## Reglas de Negocio Críticas

### 1. Sistema de Productos
- **NUNCA usar cantidades fijas**: Todos los productos provienen del API de EasyQuote
- **Flujo de datos obligatorio**: `prompts` → `outputs` → `multi` → `price`
- Los productos tienen configuraciones dinámicas basadas en respuestas del usuario
- El precio se calcula en base a las selecciones en `prompts`, `outputs` y `multi`

### 2. Presupuestos y Pedidos
- **Los pedidos son una réplica exacta de presupuestos**
- Misma funcionalidad, mismo flujo, mismos componentes
- Un pedido puede crearse desde un presupuesto o desde cero
- Ambos comparten la misma estructura de artículos con prompts/outputs/multi

### 3. Componentes Obligatorios

#### QuoteItem (src/components/quotes/QuoteItem.tsx)
- **SIEMPRE usar este componente** para editar productos en presupuestos y pedidos
- **NUNCA crear diálogos simples** con solo cantidad/precio
- Este componente maneja:
  - Selección de producto del API
  - Configuración de prompts (preguntas del producto)
  - Configuración de outputs (acabados/opciones)
  - Configuración de multi (cantidades múltiples)
  - Cálculo automático de precio

#### Estructura de uso en edición:
```tsx
{items.map((item) => (
  <QuoteItem
    key={item.id}
    item={item}
    onChange={handleItemChange}
    onFinish={handleItemFinish}
    onRemove={handleRemoveItem}
  />
))}
```

### 4. Estructura de Datos de Artículos

#### Presupuestos (quote_items)
```typescript
{
  id: uuid
  quote_id: uuid
  product_id: string        // ID del producto en EasyQuote API
  product_name: string
  prompts: jsonb           // Respuestas a preguntas del producto
  outputs: jsonb           // Acabados/opciones seleccionados
  multi: jsonb             // Cantidades múltiples
  price: number            // Calculado automáticamente
  quantity: number         // Total de unidades
  position: number         // Orden en la lista
}
```

#### Pedidos (sales_order_items)
Misma estructura que quote_items, solo cambia `quote_id` por `sales_order_id`

### 5. Flujo de Trabajo con API

1. Usuario selecciona producto del API EasyQuote
2. QuoteItem carga las preguntas (prompts) del producto
3. Usuario responde preguntas
4. Se cargan outputs disponibles según respuestas
5. Usuario configura cantidades (multi)
6. API calcula precio automáticamente
7. Se guarda todo en JSONB (prompts, outputs, multi)

### 6. Adicionales (Additionals)

- Pueden ser cargos o descuentos
- Tipos: `fixed` (fijo) o `percentage` (porcentaje)
- Se aplican al subtotal del presupuesto/pedido
- Se gestionan con componentes dedicados: `QuoteAdditionalsSelector`, `AdditionalsSelector`

### 7. Patrones a EVITAR

❌ **NO hacer esto:**
- Diálogos simples con solo cantidad/precio para editar productos
- Cantidades fijas sin prompts/outputs/multi
- Bypass del sistema de configuración de productos
- Edición directa de precios sin recalcular desde API

✅ **SÍ hacer esto:**
- Usar QuoteItem para toda edición de productos
- Mantener sincronización con EasyQuote API
- Guardar prompts/outputs/multi en JSONB
- Respetar el flujo completo de configuración

### 8. Integraciones

#### Holded
- Exportación de presupuestos y pedidos
- Sincronización de clientes
- Generación de PDFs
- Webhooks para actualizaciones

#### WooCommerce
- Sincronización de productos
- Mapeo de productos EasyQuote a WooCommerce
- CSV upload de productos

### 9. Sistema de Plantillas PDF

- Múltiples plantillas disponibles (Template1-6)
- Registro en `src/utils/templateRegistry.ts`
- Configuración por organización en `pdf_configurations`
- Renderizado con `QuoteTemplate` component

### 10. Autenticación y Permisos

- Multi-tenant: organizaciones con miembros
- Roles: superadmin, admin, user, comercial, operador
- RLS policies basadas en organization_members
- Credenciales EasyQuote por organización

## Comandos Útiles

```bash
# Ver logs de edge functions
npx supabase functions logs <function-name>

# Deploy edge functions
npx supabase functions deploy <function-name>

# Ver estructura de base de datos
psql -h <host> -U postgres -d postgres -c "\dt"
```

## Contacto con APIs Externas

- **EasyQuote API**: Gestión en `src/lib/easyquoteApi.ts`
- **Holded API**: Edge functions en `supabase/functions/holded-*`
- **WooCommerce**: Edge functions en `supabase/functions/woocommerce-*`

## Infraestructura del Servidor EasyQuote API

### Servidor OVH (VPS)
- **RAM**: 8 GB
- **CPU**: Intel Core Haswell, 2 vCPU
- **Uso típico**: CPU ~53%, RAM ~24% (1.9 GB de 7.8 GB)
- **Tipo de disco**: Desconocido (VPS estándar OVH)

### Motor de cálculo
- **Librería**: Syncfusion XlsIO
- **Funcionamiento**: Los Excel ya están leídos e interpretados en memoria, NO se procesan en cada petición
- **Cálculo**: Solo ejecuta las fórmulas con los valores de entrada recibidos

### Funciones Excel Soportadas por Syncfusion
**Matemáticas**: ABS, ACOS, ACOSH, ASIN, ASINH, ATAN, ATAN2, ATANH, CEILING, COMBIN, COS, COSH, DEGREES, EVEN, EXP, FACT, FLOOR, INT, LN, LOG, LOG10, MDETERM, MINVERSE, MMULT, MOD, ODD, PI, POWER, PRODUCT, RADIANS, RAND, ROMAN, ROUND, ROUNDDOWN, ROUNDUP, SIGN, SIN, SINH, SQRT, SUBTOTAL, SUM, SUMIF, SUMIFS, SUMPRODUCT, SUMSQ, SUMX2MY2, SUMX2PY2, SUMXMY2, TAN, TANH, TRUNC

**Estadísticas**: AVEDEV, AVERAGE, AVERAGEA, AVERAGEIF, AVERAGEIFS, BETADIST, BETAINV, BINOMDIST, CHIDIST, CHIINV, CHITEST, CONFIDENCE, CORREL, COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, COVAR, CRITBINOM, DEVSQ, EXPONDIST, FDIST, FINV, FISHER, FISHERINV, FORECAST, FREQUENCY, FTEST, GAMMADIST, GAMMAINV, GAMMALN, GEOMEAN, GROWTH, HARMEAN, HYPGEOMDIST, INTERCEPT, KURT, LARGE, LINEST, LOGEST, LOGINV, LOGNORMDIST, MAX, MAXA, MEDIAN, MIN, MINA, MODE, NEGBINOMDIST, NORMDIST, NORMINV, NORMSDIST, NORMSINV, PEARSON, PERCENTILE, PERCENTRANK, PERMUT, POISSON, PROB, QUARTILE, RANK, RSQ, SKEW, SLOPE, SMALL, STANDARDIZE, STDEV, STDEVA, STDEVP, STDEVPA, STEYX, TDIST, TINV, TREND, TRIMMEAN, TTEST, VAR, VARA, VARP, VARPA, WEIBULL, ZTEST

**Lógicas**: AND, FALSE, IF, IFERROR, IFNA, IFS, NOT, OR, SWITCH, TRUE, XOR

**Texto**: BAHTTEXT, CHAR, CLEAN, CODE, CONCAT, CONCATENATE, DOLLAR, EXACT, FIND, FIXED, LEFT, LEN, LOWER, MID, PROPER, REPLACE, REPT, RIGHT, SEARCH, SUBSTITUTE, T, TEXT, TEXTJOIN, TRIM, UPPER, VALUE

**Fecha/Hora**: DATE, DATEDIF, DATEVALUE, DAY, DAYS, DAYS360, EDATE, EOMONTH, HOUR, ISOWEEKNUM, MINUTE, MONTH, NETWORKDAYS, NETWORKDAYS.INTL, NOW, SECOND, TIME, TIMEVALUE, TODAY, WEEKDAY, WEEKNUM, WORKDAY, WORKDAY.INTL, YEAR, YEARFRAC

**Búsqueda**: ADDRESS, AREAS, CHOOSE, COLUMN, COLUMNS, HLOOKUP, HYPERLINK, INDEX, INDIRECT, LOOKUP, MATCH, OFFSET, ROW, ROWS, TRANSPOSE, VLOOKUP, XLOOKUP

**Información**: CELL, ERROR.TYPE, ISBLANK, ISERR, ISERROR, ISEVEN, ISLOGICAL, ISNA, ISNONTEXT, ISNUMBER, ISODD, ISREF, ISTEXT, N, NA, TYPE

**Financieras**: ACCRINT, ACCRINTM, AMORDEGRC, AMORLINC, COUPDAYBS, COUPDAYS, COUPDAYSNC, COUPNCD, COUPNUM, COUPPCD, CUMIPMT, CUMPRINC, DB, DDB, DISC, DOLLARDE, DOLLARFR, DURATION, EFFECT, FV, FVSCHEDULE, INTRATE, IPMT, IRR, ISPMT, MDURATION, MIRR, NOMINAL, NPER, NPV, ODDFPRICE, ODDFYIELD, ODDLPRICE, ODDLYIELD, PMT, PPMT, PRICE, PRICEDISC, PRICEMAT, PV, RATE, RECEIVED, SLN, SYD, TBILLEQ, TBILLPRICE, TBILLYIELD, VDB, XIRR, XNPV, YIELD, YIELDDISC, YIELDMAT

**Ingeniería**: BESSELI, BESSELJ, BESSELK, BESSELY, BIN2DEC, BIN2HEX, BIN2OCT, COMPLEX, CONVERT, DEC2BIN, DEC2HEX, DEC2OCT, DELTA, ERF, ERFC, GESTEP, HEX2BIN, HEX2DEC, HEX2OCT, IMABS, IMAGINARY, IMARGUMENT, IMCONJUGATE, IMCOS, IMDIV, IMEXP, IMLN, IMLOG10, IMLOG2, IMPOWER, IMPRODUCT, IMREAL, IMSIN, IMSQRT, IMSUB, IMSUM, OCT2BIN, OCT2DEC, OCT2HEX

**Base de datos**: DAVERAGE, DCOUNT, DCOUNTA, DGET, DMAX, DMIN, DPRODUCT, DSTDEV, DSTDEVP, DSUM, DVAR, DVARP

**Cubo**: CUBEKPIMEMBER, CUBEMEMBER, CUBEMEMBERPROPERTY, CUBERANKEDMEMBER, CUBESET, CUBESETCOUNT, CUBEVALUE

**Web**: ENCODEURL, FILTERXML, WEBSERVICE

**IMPORTANTE**: Si un Excel usa funciones NO listadas aquí, Syncfusion devolverá error o valor incorrecto. Verificar compatibilidad antes de subir.

### Rendimiento
- **Tiempos de respuesta**: ~6 segundos (mejorado de ~9s tras subir RAM a 8GB)
- **Cuello de botella**: Ejecución de fórmulas Excel complejas
- **Caché NO viable**: Millones de combinaciones posibles de prompts/valores

### Métricas OVH vs Servidor
- OVH puede mostrar 100% RAM porque cuenta memoria cacheada
- El servidor real muestra ~24% de uso (la cache es liberarle automáticamente)
- Siempre verificar con `free -h` o Administrador de tareas para datos reales

---

**Última actualización**: 2025-12-26
**Mantener actualizado**: Cada vez que se establezca una nueva regla crítica de negocio
