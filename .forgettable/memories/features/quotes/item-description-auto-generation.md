# Memory: features/quotes/item-description-auto-generation
Updated: 2026-03-26

## Qué se pone en la descripción de un artículo

### Auto-generada (description_manual = false)
Al guardar el presupuesto (QuoteNew/QuoteEdit), si el campo `description` está vacío y `description_manual` es `false`, se genera automáticamente con formato `Label: Valor`, una línea por prompt (newline-separated).

**Se excluyen:**
- Valores `No`
- Valores vacíos
- Etiquetas internas: `tarifa`, `forzar máquina`, `forzar maquina`, `tira y retira`, `forzar poses`, `forzar poses/pags.`, `modelos`

**Productos compuestos:** Se inyectan bloques de componentes (`── Interior ──`, `── Cubierta ──`, etc.) con los prompts de cada componente.

### Manual (description_manual = true)
El usuario edita manualmente el campo de descripción. Se activa el flag `description_manual = true`.

**En el PDF:** Cuando `description_manual` es `true`, se muestra SOLO la descripción escrita por el usuario. No se muestran prompts individuales ni secciones de componentes. Solo la descripción tal cual.

### Reset del flag
El flag `description_manual` se resetea a `false` únicamente cuando el usuario cambia de producto.
