# Memory: features/products/composite-data-propagation-logic
Updated: 2026-01-21

General data (Cantidad ejemplares, Formato/Tamaño, Tipo de encuadernación) is configured at the composite product level and automatically propagated to all nested components. This data acts as shared input for each component's individual pricing calculation, ensuring consistency across the entire composite product set. General inputs/outputs are defined directly in the app to simplify management and avoid "phantom" products in the API.
