# Memory: architecture/api/easyquote-pricing-source-of-truth
Updated: 2026-02-08

## Principio Fundamental

El API de `easyquote-pricing` es la **ÚNICA fuente de verdad** para los prompts activos en un cálculo.

### Comportamiento del API

1. **Respuestas Inteligentes**: El API solo devuelve los prompts que participan activamente en el cálculo actual. Los campos con valor nulo en el nombre no se devuelven.

2. **Dinamismo**: Cuando el usuario cambia un valor, el siguiente PATCH **PUEDE** devolver un conjunto diferente de prompts. Por ejemplo, seleccionar "Tapa dura" puede activar campos de "Lomo" que antes no existían.

3. **Reemplazo Completo**: El estado local debe reemplazarse completamente con cada respuesta del API. NO se acumulan prompts de respuestas anteriores.

### Diferencia entre Endpoints

| Endpoint | Propósito | Cuándo Usar |
|----------|-----------|-------------|
| `easyquote-prompts` | Definiciones completas de todos los campos posibles | Configuración/mapeo de productos compuestos |
| `easyquote-pricing` | Campos activos en el cálculo actual | UI en tiempo real, renderizado de formularios |

### Reglas de Implementación

1. **NO inventar campos**: Si el API de pricing no devuelve un prompt, NO se muestra en la UI (aunque tenga configuración `force_result` en la BD).

2. **`force_result` es solo presentación**: Esta configuración solo afecta DÓNDE se muestra un prompt (en sección "Opciones restrictivas" vs formulario normal). NO crea campos que el API no devuelve.

3. **Persistencia solo al guardar**: Los prompts solo se guardan en la BD cuando el usuario guarda el presupuesto (borrador o envío), nunca antes.

4. **Guardar solo los activos**: Al guardar, se persisten únicamente los prompts de la última respuesta del API, no acumulados históricos.
