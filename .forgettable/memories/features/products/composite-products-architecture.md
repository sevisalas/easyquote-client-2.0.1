# Memory: features/products/composite-products-architecture
Updated: 2026-01-05

## Arquitectura de Productos Compuestos (Encuadernados)

### Conceptos Clave

Los productos compuestos ("Encuadernados") permiten configurar productos que están formados por múltiples partes físicas, como un libro con cubierta e interior. La arquitectura distingue claramente entre:

---

### 1. Datos Generales

**Definición:** Parámetros que se aplican a TODO el producto compuesto, independientemente de sus componentes.

**Características:**
- NO provienen de la API de EasyQuote como prompts de componente
- Se aplican por igual a todos los componentes (Cubierta, Interior 1, Interior 2)
- Se envían a la API como inputs para el cálculo de precios
- Se muestran en la sección "General" (columna izquierda), NO en las pestañas de componentes

**Ejemplos:**
- **Cantidad de ejemplares**: El número de copias es el mismo para cubierta e interiores
- **Fecha de entrega**: Aplica al producto completo
- **Cliente/Referencia**: Información del pedido global

---

### 2. Datos de Componentes

**Definición:** Parámetros específicos de cada parte física del producto.

**Características:**
- Provienen de la API de EasyQuote (prompts configurados en Excel)
- Son únicos para cada componente
- Se muestran organizados en pestañas por componente
- Cada componente tiene su propia configuración de materiales, acabados, etc.

**Ejemplos por componente:**

**Cubierta:**
- Tipo de papel (ej: Estucado 300g)
- Acabado (ej: Plastificado mate)
- Impresión (ej: 4+4 colores)

**Interior 1 / Interior 2:**
- Tipo de papel (ej: Offset 80g)
- Número de páginas
- Impresión (ej: 1+1 B/N)

---

### 3. Layout en la UI

```
┌─────────────────────────────────────────────────────────────┐
│                    Configuración del Producto               │
├─────────────────────────┬───────────────────────────────────┤
│                         │  [Cubierta] [Interior 1] [Int 2]  │
│   DATOS GENERALES       ├───────────────────────────────────┤
│                         │                                   │
│   • Cantidad ejemplares │   DATOS DEL COMPONENTE            │
│   • (otros globales)    │                                   │
│                         │   • Papel cubierta                │
│                         │   • Acabado                       │
│                         │   • Impresión                     │
│                         │   • ...                           │
└─────────────────────────┴───────────────────────────────────┘
```

---

### 4. Productos Marcados como Componentes (is_component: true)

Los productos individuales pueden marcarse como "Componentes" en la gestión de productos:

**Propósito:**
- Representan productos de EasyQuote que funcionan como partes de un producto compuesto
- Tienen su propio Excel y configuración de precios
- Se usan para calcular el precio de cada parte (cubierta, interior)

**Diferencia con Productos Compuestos (is_composite: true):**
- `is_component: true`: Producto individual que puede usarse DENTRO de un compuesto
- `is_composite: true`: Producto que AGRUPA varios componentes con configuración de pestañas

**Vista en ProductManagement:**
- Tab "Productos": Muestra productos normales y compuestos
- Tab "Componentes": Muestra solo productos marcados como `is_component: true`

---

### 5. Flujo de Datos al API

1. Usuario configura datos generales (cantidad, etc.)
2. Usuario configura cada componente en sus pestañas
3. Al calcular precio:
   - Se envían los datos generales + datos del componente a cada API de componente
   - Cada componente calcula su precio individual
   - La app suma los precios de los componentes activos

---

### 6. Configuraciones de Encuadernado

El selector `BoundProductConfigSelector` permite elegir entre:

- **Mismo papel**: Solo 1 componente (contenido unificado)
- **Cubierta + 1 Interior**: 2 componentes
- **Cubierta + 2 Interiores**: 3 componentes (ej: páginas color + B/N)

Esta selección determina qué pestañas de componentes se muestran y qué precios se suman.
