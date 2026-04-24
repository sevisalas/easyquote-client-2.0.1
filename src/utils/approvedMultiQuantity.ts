const AUTO_DESCRIPTION_EXCLUDED_LABELS = [
  'tarifa',
  'forzar máquina',
  'forzar maquina',
  'tira y retira',
  'forzar poses',
  'forzar poses/pags.',
  'modelos',
];

const normalizePromptKey = (value: string) =>
  String(value ?? '').replace(/\$/g, '').trim().toUpperCase();

export const parseQuantity = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 1;

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const parseLocaleNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const promptsToArray = (prompts: any): Array<{ id: string; label: string; value: any; order: number }> => {
  if (Array.isArray(prompts)) {
    return prompts
      .filter((prompt: any) => prompt && (prompt.id || prompt.name || prompt.label))
      .map((prompt: any, index: number) => ({
        ...prompt,
        id: String(prompt.id || prompt.name || prompt.label || `prompt-${index}`),
        label: prompt.label || String(prompt.id || prompt.name || prompt.label || `Prompt ${index + 1}`),
        order: prompt.order ?? index,
      }));
  }

  if (prompts && typeof prompts === 'object') {
    return Object.entries(prompts).map(([id, prompt]: [string, any], index: number) => ({
      id,
      label: prompt?.label || id,
      value: prompt?.value,
      order: prompt?.order ?? index,
    }));
  }

  return [];
};

export const promptsToObject = (prompts: any): Record<string, { label: string; value: any; order: number }> => {
  return promptsToArray(prompts).reduce((acc, prompt) => {
    acc[prompt.id] = {
      label: prompt.label,
      value: prompt.value,
      order: prompt.order ?? 999,
    };
    return acc;
  }, {} as Record<string, { label: string; value: any; order: number }>);
};

const findQuantityPromptIndex = (
  prompts: Array<{ id: string; label: string; value: any; order: number }>,
) => {
  const customQuantityIndex = prompts.findIndex(
    (prompt) => String(prompt.id || '').trim() === 'custom_quantity',
  );

  if (customQuantityIndex >= 0) return customQuantityIndex;

  return prompts.findIndex((prompt) => {
    const text = normalizePromptKey(prompt.label || prompt.id || '');
    return (
      text.includes('CANTIDAD') ||
      text.includes('UNIDADES') ||
      text.includes('EJEMPLAR') ||
      text.includes('QUANTITY') ||
      text === 'QTY'
    );
  });
};

export const syncPromptsWithQuantity = (prompts: any, quantity: number) => {
  const promptsArray = [...promptsToArray(prompts)];
  const quantityPromptIndex = findQuantityPromptIndex(promptsArray);

  if (quantityPromptIndex >= 0) {
    promptsArray[quantityPromptIndex] = {
      ...promptsArray[quantityPromptIndex],
      value: String(quantity),
    };
  }

  return promptsArray;
};

export const buildAutoDescriptionFromPrompts = (prompts: any) => {
  return promptsToArray(prompts)
    .filter((prompt) => {
      const value = String(prompt?.value ?? '').trim();
      const label = String(prompt?.label ?? '').toLowerCase().trim();

      if (!value || value.toLowerCase() === 'no') return false;
      if (AUTO_DESCRIPTION_EXCLUDED_LABELS.some((excluded) => label.includes(excluded))) return false;

      return true;
    })
    .map((prompt) => `${prompt.label}: ${String(prompt.value).trim()}`)
    .join('\n');
};

export const applyItemAdditionals = (basePrice: number, item: any, quantity: number): number => {
  const additionals = item?.item_additionals;
  if (!Array.isArray(additionals) || additionals.length === 0) return basePrice;

  const qtyInputs: number[] = item?.multi?.qtyInputs || [];
  const qtyIndex = qtyInputs.findIndex((q: number) => Number(q) === Number(quantity));

  let total = basePrice;

  for (const additional of additionals) {
    let value = additional.value || 0;
    if (
      additional.type === 'net_amount' &&
      Array.isArray(additional.multiValues) &&
      qtyIndex >= 0 &&
      qtyIndex < additional.multiValues.length
    ) {
      value = Number(additional.multiValues[qtyIndex]) || value;
    }

    const isDiscount = additional.is_discount === true || value < 0;
    if (isDiscount) {
      switch (additional.type) {
        case 'net_amount':
          total -= Math.abs(value);
          break;
        case 'percentage':
          total -= Math.abs((total * value) / 100);
          break;
      }
      continue;
    }

    switch (additional.type) {
      case 'net_amount':
        total += value;
        break;
      case 'percentage':
        total += (total * value) / 100;
        break;
      case 'quantity_multiplier':
        total += value * quantity;
        break;
      case 'capacity_divider': {
        const cap = additional.capacity_value || 1;
        total += value * Math.ceil(quantity / cap);
        break;
      }
    }
  }

  return total;
};

export const resolveApprovedQuoteItemState = (item: any) => {
  const acceptedQuantity = item?.accepted_quantity ? parseQuantity(item.accepted_quantity) : null;
  const multi = item?.multi as any;
  const promptArray = acceptedQuantity ? syncPromptsWithQuantity(item?.prompts, acceptedQuantity) : promptsToArray(item?.prompts);
  const selectedRow = acceptedQuantity && multi?.rows && Array.isArray(multi.rows)
    ? multi.rows.find((row: any) => {
        const rowQty = row?.qty ?? row?.quantity;
        return parseQuantity(rowQty) === acceptedQuantity;
      })
    : null;

  const resolvedOutputs = Array.isArray(selectedRow?.outs)
    ? selectedRow.outs
    : Array.isArray(item?.outputs)
      ? item.outputs
      : [];

  let resolvedPrice = parseLocaleNumber(item?.price || 0);
  if (acceptedQuantity && selectedRow) {
    const basePrice = parseLocaleNumber(
      selectedRow.outs?.find((output: any) => output.type === 'Price')?.value ??
      selectedRow.price ??
      item?.price ??
      0,
    );
    resolvedPrice = applyItemAdditionals(basePrice, item, acceptedQuantity);
  }

  const resolvedDescription = item?.description_manual === true
    ? item?.description || ''
    : buildAutoDescriptionFromPrompts(promptArray) || item?.description || '';

  return {
    resolvedQuantity: acceptedQuantity ?? parseQuantity(item?.quantity ?? 1),
    resolvedPrice,
    resolvedOutputs,
    resolvedPromptsArray: promptArray,
    resolvedPromptsObject: promptsToObject(promptArray),
    resolvedDescription,
    selectedRow,
  };
};