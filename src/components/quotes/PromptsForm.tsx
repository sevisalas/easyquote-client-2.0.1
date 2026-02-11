import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useProductPromptSettings } from "@/hooks/useProductPromptSettings";
import { isCheckedValue, detectCheckboxFormat, toOriginalFormat, type CheckboxFormat } from "@/utils/checkboxValues";

export type PromptOption = {
  value: string;
  label?: string;
  imageUrl?: string;
  color?: string;
};

export type PromptDef = {
  id: string;
  label: string;
  type: "number" | "integer" | "text" | "select" | "image" | "color" | "checkbox" | "quantity";
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: PromptOption[];
  default?: any;
  visibility?: any; // show if conditions
  hiddenWhen?: any; // hide if conditions
  adminOnly?: boolean; // only visible to admins
};

function isHexColor(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^rgb\(/i.test(v) || /^hsl\(/i.test(v);
}

function normalizeOptions(opts: any[]): PromptOption[] {
  return (opts || []).map((o: any, idx: number) => {
    if (typeof o === "string") {
      const isHexNoHash = /^[0-9a-f]{6}$/i.test(o);
      const isImage = /^https?:\/\/.+\.(?:png|jpe?g|gif|webp|svg)(?:\?.*)?$/i.test(o);
      if (isImage) {
        const file = o.split("/").pop() || o;
        const base = file.split(".")[0] || file;
        const label = base.replace(/[_-]+/g, " ");
        return { value: o, label, imageUrl: o } as PromptOption;
      }
      if (isHexNoHash) {
        const v = `#${o.toUpperCase()}`;
        return { value: v, label: v, color: v } as PromptOption;
      }
      return isHexColor(o)
        ? { value: o, label: o, color: o }
        : { value: o, label: o };
    }
    const value = o.value ?? o.id ?? o.key ?? o.name ?? String(o);
    const label = o.label ?? o.title ?? o.name ?? String(value);
    const imageFromUrl = typeof o.url === "string" && /^https?:\/\/.+\.(?:png|jpe?g|gif|webp|svg)(?:\?.*)?$/i.test(o.url) ? o.url : undefined;
    const imageUrl = o.imageUrl ?? o.image ?? o.thumbnail ?? imageFromUrl ?? undefined;
    const valueStr = String(value);
    const isHexNoHash = /^[0-9a-f]{6}$/i.test(valueStr);
    const normalizedColor = o.color ?? (isHexNoHash ? `#${valueStr.toUpperCase()}` : isHexColor(valueStr) ? valueStr : undefined);
    return { value: String(isHexNoHash ? `#${valueStr.toUpperCase()}` : valueStr), label, imageUrl, color: normalizedColor } as PromptOption;
  });
}

function getOptionLabel(options: PromptOption[] | undefined, value: any) {
  if (value === undefined || value === null) return undefined;
  const v = String(value);
  const opt = options?.find((o) => String(o.value) === v);
  return opt?.label ?? v;
}

// Flexible condition evaluation for prompt visibility
function matchValue(current: any, expected: any) {
  if (Array.isArray(expected)) return expected.map(String).includes(String(current));
  if (typeof expected === "boolean") return Boolean(current) === expected;
  return String(current) === String(expected);
}

function evalCondition(cond: any, values: Record<string, any>): boolean {
  if (!cond) return true;
  // Array => AND of items
  if (Array.isArray(cond)) return cond.every((c) => evalCondition(c, values));
  if (typeof cond === "string") {
    // very simple format: "field=value" (AND by &&)
    const parts = cond.split(/\s*&&\s*/);
    return parts.every((p) => {
      const [k, v] = p.split("=");
      if (!k) return true;
      return matchValue(values[k.trim()], (v ?? "").trim());
    });
  }
  if (typeof cond === "object") {
    // Support anyOf / allOf
    if (Array.isArray(cond.allOf)) return cond.allOf.every((c: any) => evalCondition(c, values));
    if (Array.isArray(cond.anyOf)) return cond.anyOf.some((c: any) => evalCondition(c, values));
    // { field, id, key, equals/value }
    const field = cond.field ?? cond.id ?? cond.key;
    if (field) {
      const expected = cond.equals ?? cond.value ?? cond.is;
      return matchValue(values[field], expected);
    }
    // Mapping object: { size: "L", color: "red" }
    return Object.entries(cond).every(([k, v]) => matchValue(values[k], v));
  }
  return true;
}

function isVisiblePrompt(p: PromptDef, values: Record<string, any>): boolean {
  if (p.hiddenWhen && evalCondition(p.hiddenWhen, values)) return false;
  if (p.visibility && !evalCondition(p.visibility, values)) return false;
  return true;
}

// Export for use in other components
export { isVisiblePrompt, evalCondition, matchValue };

function extractPrompts(product: any): PromptDef[] {
  const candidates = [
    product?.prompts,
    product?.inputs,
    product?.fields,
    product?.parameters,
    product?.config?.prompts,
    product?.schema?.prompts,
    product?.pricing?.prompts,
    product?.pricing?.inputs,
    product?.form?.fields,
    product?.form?.prompts,
    product?.options,
    product?.choices,
    product?.data?.prompts,
    product?.request?.fields,
  ];
  const raw: any[] = (candidates.find((r) => Array.isArray(r)) as any[]) || [];

  return raw.map((f: any, idx: number): PromptDef => {
    const id = String(f.id ?? f.key ?? f.code ?? f.slug ?? f.name ?? `field_${idx}`);
    
    // Determinar el label: usar promptText, pero si parece UUID usar promptCell o fallback legible
    const rawLabel = f.promptText ?? f.label ?? f.title ?? f.promptName ?? f.displayName ?? f.text ?? f.caption ?? f.name;
    const isUuidLabel = typeof rawLabel === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawLabel);
    const cellLabel = f.promptCell ?? f.prompt_cell ?? f.cell;
    const label = (isUuidLabel || !rawLabel) && cellLabel 
      ? `Campo ${cellLabel}` 
      : (rawLabel ?? id);
    
    const rawType = String(f.promptType ?? f.type ?? f.inputType ?? f.kind ?? f.uiType ?? "text").toLowerCase();
    const options = normalizeOptions(f.valueOptions ?? f.options ?? f.choices ?? f.values ?? f.items ?? f.optionsList ?? []);
    const hasImages = options.some((o) => !!o.imageUrl);
    const hasColors = (options?.length ?? 0) > 0 && options.every((o) => !!o.color || isHexColor(String(o.value)));

    // Type detection - rely on API-defined types, no automatic conversion
    let type: PromptDef["type"] = "text";
    if (rawType.includes("image")) type = "image";
    else if (rawType.includes("color")) type = "color";
    // Checkbox/Boolean types - render as actual checkbox
    else if (rawType.includes("checkbox") || rawType.includes("boolean") || rawType.includes("check")) {
      type = "checkbox";
    }
    else if (rawType.includes("quantity") || rawType.includes("cantidad")) type = "quantity";
    else if (rawType.includes("drop") || rawType.includes("select")) type = "select";
    else if (rawType.includes("number") || rawType.includes("decimal") || rawType.includes("float") || rawType.includes("int")) {
      const allowedDecimals = Number(f.allowedDecimals);
      type = allowedDecimals > 0 ? "number" : "integer";
    } else if ((options?.length ?? 0) > 0) type = hasImages ? "image" : hasColors ? "color" : "select";

    const allowedDecimals = Number(f.allowedDecimals);
    const decimals = rawType.includes("decimal") || rawType.includes("float") || f.decimals === true || allowedDecimals > 0;
    const inferredStep = Number.isFinite(Number(f.step))
      ? Number(f.step)
      : Number.isFinite(allowedDecimals) && allowedDecimals > 0
        ? Math.pow(10, -allowedDecimals)
        : type === "integer"
          ? 1
          : decimals
            ? 0.01
            : undefined;

    const defaultFromIndex = (Number.isFinite(Number(f.defaultIndex)) && options[Number(f.defaultIndex)]) ? options[Number(f.defaultIndex)].value : undefined;
    let defaultVal = f.currentValue ?? f.default ?? f.defaultValue ?? f.initial ?? f.value ?? f.defaultOption?.value ?? defaultFromIndex;

    if ((type === "color") && typeof defaultVal === "string" && /^[0-9a-f]{6}$/i.test(defaultVal)) {
      defaultVal = `#${defaultVal.toUpperCase()}`;
    }

    const min = Number.isFinite(Number(f.min)) ? Number(f.min) : (Number.isFinite(Number(f.minimum)) ? Number(f.minimum) : undefined);
    const max = Number.isFinite(Number(f.max)) ? Number(f.max) : (Number.isFinite(Number(f.maximum)) ? Number(f.maximum) : undefined);
    const required = !!(f.required ?? f.mandatory ?? f.valueRequired);

    const visibility = f.visibleWhen ?? f.showIf ?? f.when ?? f.condition ?? f.conditions ?? undefined;
    const hiddenWhen = f.hiddenWhen ?? f.hideIf ?? undefined;

    return {
      id,
      label,
      type,
      description: f.description ?? f.helpText,
      required,
      min,
      max,
      step: inferredStep,
      options,
      default: defaultVal,
      visibility,
      hiddenWhen,
    };
  });
}

// Export for use in other components
export { extractPrompts };

export default function PromptsForm({
  product,
  values,
  onChange,
  onCommit,
  showAllPrompts = false,
  singleColumn = false,
  columns,
}: {
  product: any;
  values: Record<string, any>;
  onChange: (id: string, value: any, label: string) => void;
  onCommit?: (id: string, value: any, label: string) => void; // Called on blur/enter for API calls
  showAllPrompts?: boolean;
  singleColumn?: boolean; // Force single column layout (for composite products in tabs)
  /** Columnas del grid (solo si singleColumn = false). Por defecto: 2. */
  columns?: 2 | 3;
}) {
  // Get product ID to filter hidden prompts
  const productId = product?.productId ?? product?.id ?? product?.product_id;
  const { isPromptHidden } = useProductPromptSettings(productId);

  const prompts = useMemo(() => extractPrompts(product), [product]);
  const defaultsMap = useMemo(() => Object.fromEntries(prompts.map((p) => [p.id, p.default])), [prompts]);
  const effectiveValues = useMemo(() => {
    // Extract values from the stored format
    // values puede ser {promptId: {label, value, order}} o {promptId: value}
    const extractedValues: Record<string, any> = {};
    Object.entries(values).forEach(([key, val]) => {
      if (val && typeof val === 'object' && 'value' in val) {
        // Formato completo {label, value, order}
        extractedValues[key] = val.value;
      } else {
        // Valor simple
        extractedValues[key] = val;
      }
    });
    return { ...defaultsMap, ...extractedValues };
  }, [defaultsMap, values]);

  // Filtrar prompts ocultos (is_hidden) pero mantener todos visibles para cálculos
  const visiblePrompts = useMemo(() => {
    return prompts.filter(p => !isPromptHidden(p.id));
  }, [prompts, isPromptHidden]);

  // Clamp numeric value to min/max range
  const clampValue = (value: any, min?: number, max?: number): any => {
    if (value === "" || value === null || value === undefined) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    let clamped = num;
    if (min !== undefined && num < min) clamped = min;
    if (max !== undefined && num > max) clamped = max;
    return clamped;
  };

  // Handle commit (blur or enter) - triggers API call with clamped value
  const handleNumericCommit = (id: string, value: any, label: string, min?: number, max?: number) => {
    const clampedValue = clampValue(value, min, max);
    const originalNum = parseFloat(value);
    
    // Show toast if value was clamped
    if (!isNaN(originalNum) && clampedValue !== originalNum) {
      if (min !== undefined && originalNum < min) {
        toast.info(`${label}: valor mínimo es ${min}`);
      } else if (max !== undefined && originalNum > max) {
        toast.info(`${label}: valor máximo es ${max}`);
      }
      onChange(id, clampedValue, label);
    }
    
    if (onCommit) {
      onCommit(id, clampedValue, label);
    }
  };

  // Handle commit (blur or enter) - triggers API call
  const handleCommit = (id: string, value: any, label: string) => {
    if (onCommit) {
      onCommit(id, value, label);
    }
  };

  // Handle key down for enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string, value: any, label: string) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // This will trigger onBlur which calls handleCommit
    }
  };

  if (!product) return null;
  if (!prompts?.length) {
    return <p className="text-sm text-muted-foreground">Este producto no define opciones.</p>;
  }

  // Check if prompt should span full width (image/color types)
  const isFullWidth = (type: PromptDef["type"]) => ["image", "color"].includes(type);

  const effectiveColumns = singleColumn ? 1 : (columns ?? 2);
  const fullSpanClass = singleColumn
    ? ""
    : effectiveColumns === 3
      ? "sm:col-span-2 lg:col-span-3"
      : "md:col-span-2";

  const renderPrompt = (p: PromptDef) => (
    <div 
      key={p.id} 
      className={`space-y-1 ${isFullWidth(p.type) ? fullSpanClass : ""}`}
    >
      {/* Para checkbox, renderizamos label + checkbox en línea horizontal con borde */}
      {p.type === "checkbox" ? (() => {
        const currentValue = effectiveValues[p.id];
        const isChecked = isCheckedValue(currentValue);
        const originalFormat = detectCheckboxFormat(currentValue);
        
        return (
          <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 h-9">
            <label
              htmlFor={p.id}
              className="text-sm leading-none cursor-pointer select-none"
            >
              {p.label}{p.required ? " *" : ""}
            </label>
            <Checkbox
              id={p.id}
              checked={isChecked}
              onCheckedChange={(checked) => {
                const newValue = toOriginalFormat(!!checked, originalFormat, currentValue);
                onChange(p.id, newValue, p.label);
                handleCommit(p.id, newValue, p.label);
              }}
            />
          </div>
        );
      })() : (
        <>
          <Label htmlFor={p.id} className="text-sm">{p.label}{p.required ? " *" : ""}</Label>
          {p.description && (
            <p className="text-xs text-muted-foreground">{p.description}</p>
          )}
        </>
      )}

      {/* Number / Integer - commits on blur/enter */}
      {(p.type === "number" || p.type === "integer") && (
        <Input
          id={p.id}
          type="number"
          inputMode={p.type === "integer" ? "numeric" : "decimal"}
          step={p.step}
          min={p.min}
          max={p.max}
          value={effectiveValues[p.id] ?? ""}
          onChange={(e) => onChange(p.id, e.target.value, p.label)}
          onBlur={(e) => handleNumericCommit(p.id, e.target.value, p.label, p.min, p.max)}
          onKeyDown={(e) => handleKeyDown(e, p.id, (e.target as HTMLInputElement).value, p.label)}
        />
      )}

      {/* Quantity - same as integer but with step=1 */}
      {p.type === "quantity" && (
        <Input
          id={p.id}
          type="number"
          inputMode="numeric"
          step={1}
          min={p.min ?? 1}
          max={p.max}
          value={effectiveValues[p.id] ?? ""}
          onChange={(e) => onChange(p.id, e.target.value, p.label)}
          onBlur={(e) => handleNumericCommit(p.id, e.target.value, p.label, p.min ?? 1, p.max)}
          onKeyDown={(e) => handleKeyDown(e, p.id, (e.target as HTMLInputElement).value, p.label)}
        />
      )}

      {/* Text - commits on blur/enter */}
      {p.type === "text" && (
        <Input
          id={p.id}
          type="text"
          value={effectiveValues[p.id] ?? ""}
          onChange={(e) => onChange(p.id, e.target.value, p.label)}
          onBlur={(e) => handleCommit(p.id, e.target.value, p.label)}
          onKeyDown={(e) => handleKeyDown(e, p.id, (e.target as HTMLInputElement).value, p.label)}
        />
      )}

      {/* Select (dropdown) - commits immediately */}
      {p.type === "select" && (() => {
        // Filter out empty/invalid options first
        const filteredOptions = p.options?.filter((o) =>
          o.value !== '' && o.value !== undefined && o.value !== null
        ) ?? [];

        // Remove exact duplicates (same value + same label) to avoid UI artifacts like "NoNo"
        const norm = (v: any) => String(v ?? "").trim().toLowerCase();
        const dedupedOptions = (() => {
          const seen = new Set<string>();
          const out: typeof filteredOptions = [];
          for (const o of filteredOptions) {
            const label = (o.label ?? o.value);
            const key = `${norm(o.value)}||${norm(label)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(o);
          }
          return out;
        })();

        // Create unique values for remaining duplicates (same value, different label)
        const seenValues = new Map<string, number>();
        const uniqueOptions = dedupedOptions.map((o) => {
          const count = seenValues.get(o.value) || 0;
          seenValues.set(o.value, count + 1);
          const uniqueValue = count > 0 ? `${o.value}__dup${count}` : o.value;
          return { ...o, uniqueValue, originalValue: o.value };
        });
        
        // Find current value in unique options (normalize to avoid number/string mismatches)
        const currentValueRaw = effectiveValues[p.id];
        const currentValue = (currentValueRaw === undefined || currentValueRaw === null) ? "" : String(currentValueRaw);
        const matchingOption = uniqueOptions?.find((o) => norm(o.originalValue) === norm(currentValue));

        // Auto-select first valid option if current value is not in available options.
        // This handles dependent fields losing their valid selection.
        const isEmpty = currentValue === "";
        const isCurrentValueValid = isEmpty || matchingOption !== undefined;

        // IMPORTANT: the Select `value` must match a SelectItem value (uniqueValue) or be "" for placeholder.
        const effectiveDisplayValue = isCurrentValueValid
          ? (matchingOption?.uniqueValue ?? "")
          : (uniqueOptions[0]?.uniqueValue ?? "");

        // If current value became invalid, auto-select first option and notify parent
        if (!isCurrentValueValid && uniqueOptions.length > 0) {
          const firstOption = uniqueOptions[0];
          // Use setTimeout to avoid updating during render
          setTimeout(() => {
            onChange(p.id, firstOption.originalValue, p.label);
            if (onCommit) onCommit(p.id, firstOption.originalValue, p.label);
          }, 0);
        }

        return (
          <Select value={effectiveDisplayValue as any} onValueChange={(v) => {
            const selected = uniqueOptions?.find(o => o.uniqueValue === v);
            const originalValue = selected?.originalValue ?? v;
            onChange(p.id, originalValue, p.label);
            handleCommit(p.id, originalValue, p.label);
          }}>
            <SelectTrigger id={p.id}>
              {(() => {
                // Use the effective value (which may be auto-corrected) for label lookup
                const valueForLabel = isCurrentValueValid ? currentValue : uniqueOptions[0]?.originalValue;
                const currentLabel = getOptionLabel(
                  uniqueOptions?.map((o: any) => ({ value: o.originalValue, label: o.label })) as any,
                  valueForLabel
                );

                // If we provide children, Radix won't try to infer/concatenate text.
                return currentLabel
                  ? <SelectValue placeholder="Selecciona una opción">{currentLabel}</SelectValue>
                  : <SelectValue placeholder="Selecciona una opción" />;
              })()}
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {uniqueOptions.map((o, idx) => (
                <SelectItem key={`${o.uniqueValue}-${idx}`} value={o.uniqueValue}>
                  {o.label ?? o.originalValue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })()}

      {/* Image picker - commits immediately */}
      {p.type === "image" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {p.options?.map((o) => {
            const selected = (effectiveValues[p.id]) === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(p.id, o.value, p.label);
                  handleCommit(p.id, o.value, p.label);
                }}
                className={`relative overflow-hidden rounded-md border transition-shadow focus:outline-none focus:ring-2 focus:ring-primary w-30 h-30 ${selected ? "ring-2 ring-primary" : "hover:shadow"}`}
                aria-pressed={selected}
                aria-label={o.label ?? o.value}
              >
                {o.imageUrl ? (
                  <img
                    src={o.imageUrl}
                    alt={`Opción ${o.label ?? o.value}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground p-2">
                    {o.label ?? o.value}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Color picker - commits immediately */}
      {p.type === "color" && (
        <div className="flex flex-wrap gap-2">
          {p.options?.map((o) => {
            const selected = (effectiveValues[p.id]) === o.value;
            const color = o.color ?? o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(p.id, o.value, p.label);
                  handleCommit(p.id, o.value, p.label);
                }}
                className={`h-9 w-9 rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary ${selected ? "ring-2 ring-primary" : "hover:brightness-105"}`}
                aria-label={`Color ${o.label ?? o.value}`}
                title={o.label ?? o.value}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  // Use single column for composite products (tabs), otherwise grid (default 2 cols; force_result puede pedir 3)
  const gridClass = singleColumn
    ? "space-y-3"
    : effectiveColumns === 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3"
      : "grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3";

  return (
    <div className={gridClass}>
      {visiblePrompts.map(renderPrompt)}
    </div>
  );
}
