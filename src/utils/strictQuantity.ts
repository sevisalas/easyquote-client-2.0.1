import { parseQuantity, promptsToArray } from './approvedMultiQuantity';

/**
 * Resuelve la cantidad de un item de presupuesto/pedido SIN fallback a 1.
 * Devuelve null si no se puede determinar de forma fiable.
 *
 * Orden de búsqueda:
 *  1. Para productos personalizados (__CUSTOM_PRODUCT__): prompt 'custom_quantity'.
 *  2. Prompt explícito de cantidad (label CANTIDAD/UNIDADES/EJEMPLAR/QTY o id 'custom_quantity').
 *  3. item.quantity directo (solo si es número válido > 0).
 *
 * NUNCA inventa 1.
 */
export const resolveItemQuantityStrict = (item: any): number | null => {
  if (!item) return null;

  const promptsArray = promptsToArray(item.prompts);

  if (item.product_id === '__CUSTOM_PRODUCT__') {
    const customQty = promptsArray.find(
      (p: any) => String(p?.id || p?.name || '').trim() === 'custom_quantity',
    );
    if (customQty?.value !== undefined && customQty?.value !== null && String(customQty.value).trim() !== '') {
      const n = parseQuantity(customQty.value);
      // parseQuantity tiene fallback interno a 1 cuando el valor no es parseable;
      // verificamos que el origen sea realmente numérico válido.
      const raw = String(customQty.value).trim().replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) return n;
    }
    return null;
  }

  const qtyPrompt = promptsArray.find((p: any) => {
    const id = String(p?.id || '').trim();
    if (id === 'custom_quantity') return true;
    const label = String(p?.label || p?.id || '').toUpperCase();
    return (
      label.includes('CANTIDAD') ||
      label.includes('UNIDADES') ||
      label.includes('EJEMPLAR') ||
      label.includes('QUANTITY') ||
      label === 'QTY'
    );
  });

  if (qtyPrompt?.value !== undefined && qtyPrompt?.value !== null && String(qtyPrompt.value).trim() !== '') {
    const raw = String(qtyPrompt.value).trim().replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  if (item.quantity !== undefined && item.quantity !== null && String(item.quantity).trim() !== '') {
    const raw = String(item.quantity).trim().replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

export const buildQuantityErrorMessage = (item: any): string => {
  const name = item?.product_name || item?.description?.split('\n')?.[0] || 'Artículo sin nombre';
  return `No se pudo determinar la cantidad del artículo "${name}". Revisa el motor de precios del producto.`;
};
