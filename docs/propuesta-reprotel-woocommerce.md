# Propuesta Comercial: Módulo de Generación Automática de Presupuestos desde WooCommerce

## Cliente: Reprotel

---

## 1. Descripción

Desarrollo de un módulo que permita a los clientes finales de Reprotel, desde la tienda WooCommerce, configurar productos con calculadora EasyQuote y, al finalizar, obtener automáticamente un presupuesto en PDF generado desde Holded.

---

## 2. Estado Actual de la Integración

| Componente | Estado |
|------------|--------|
| Productos WooCommerce vinculados | 117 productos activos |
| API Keys configuradas | ✅ Activas y funcionales |
| Integración Holded | ✅ Configurada y operativa |
| Plugin WooCommerce | ✅ Funcional (sincronización de productos) |

---

## 3. Flujo Propuesto

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE TRABAJO                              │
└─────────────────────────────────────────────────────────────────────────┘

  Cliente Web                    EasyQuote Manager                Holded
       │                               │                            │
       │  1. Configura producto        │                            │
       │     en WooCommerce            │                            │
       │                               │                            │
       │  2. Click "Descargar          │                            │
       │     Presupuesto"              │                            │
       │                               │                            │
       ├──────────────────────────────>│                            │
       │  3. POST /woocommerce-        │                            │
       │     create-quote              │                            │
       │     (api_key, prompts,        │                            │
       │      outputs, precio)         │                            │
       │                               │                            │
       │                               │  4. Crea presupuesto       │
       │                               │     en base de datos       │
       │                               │                            │
       │                               ├───────────────────────────>│
       │                               │  5. Exporta a Holded       │
       │                               │     (estimate)             │
       │                               │                            │
       │                               │<───────────────────────────┤
       │                               │  6. Recibe holded_id       │
       │                               │                            │
       │                               ├───────────────────────────>│
       │                               │  7. Descarga PDF           │
       │                               │                            │
       │                               │<───────────────────────────┤
       │                               │  8. PDF en base64          │
       │                               │                            │
       │<──────────────────────────────┤                            │
       │  9. Retorna PDF               │                            │
       │     (descarga automática)     │                            │
       │                               │                            │
       ▼                               ▼                            ▼
```

---

## 4. Alcance Funcional

### 4.1 Nuevo Endpoint en EasyQuote Manager

- **Ruta:** `POST /functions/v1/woocommerce-create-quote`
- **Autenticación:** API Key de la organización
- **Entrada:** Datos del producto configurado (prompts, outputs, precio)
- **Salida:** PDF del presupuesto en base64

### 4.2 Funcionalidades Incluidas

| Funcionalidad | Descripción |
|---------------|-------------|
| Creación automática de presupuesto | Se crea registro en EasyQuote Manager con cliente genérico |
| Exportación a Holded | El presupuesto se exporta automáticamente como estimate |
| Descarga de PDF | Se recupera el PDF generado por Holded |
| Retorno al plugin | El PDF se envía en base64 para descarga directa |
| Trazabilidad | Cada presupuesto queda registrado con número único |

### 4.3 Modificaciones al Plugin WooCommerce

- Nuevo botón "Descargar Presupuesto" en página de producto
- Llamada al endpoint con datos configurados
- Descarga automática del PDF recibido
- Manejo de errores y estados de carga

---

## 5. Beneficios

1. **Automatización completa:** El cliente obtiene su presupuesto sin intervención manual
2. **Profesionalidad:** PDF con formato corporativo de Holded
3. **Trazabilidad:** Todos los presupuestos quedan registrados en el sistema
4. **Escalabilidad:** Preparado para conversión a pedidos en el futuro
5. **Integración nativa:** Utiliza infraestructura existente sin duplicar sistemas

---

## 6. Propuesta Económica

| Concepto | Importe |
|----------|---------|
| Desarrollo del módulo (único pago) | XXX € |
| Incremento mensual por servicio | +XX €/mes |

*Nota: Los importes se definirán tras validación del alcance.*

---

## 7. Timeline de Implementación

| Fase | Duración | Descripción |
|------|----------|-------------|
| Desarrollo backend | 3-4 días | Nuevo endpoint en Supabase |
| Modificación plugin | 2-3 días | Integración con WooCommerce |
| Pruebas y ajustes | 2-3 días | Testing completo del flujo |
| **Total estimado** | **1-2 semanas** | |

---

## 8. Requisitos Previos

- [x] API Keys de organización configuradas
- [x] Integración Holded activa
- [x] Productos WooCommerce sincronizados
- [ ] Cliente genérico "Cliente Web" creado en el sistema

---

## 9. Observaciones

1. Los presupuestos se crearán con un cliente genérico "Cliente Web" hasta que se implemente captura de datos del cliente
2. El flujo está preparado para futura conversión de presupuestos a pedidos
3. Compatible con la configuración actual de Holded de Reprotel

---

## 10. Próximos Pasos

1. Validación de esta propuesta
2. Confirmación de presupuesto económico
3. Planificación de fechas de implementación
4. Desarrollo e integración
5. Pruebas en entorno de producción

---

*Documento generado por EasyQuote Manager*
*Fecha: Diciembre 2025*
