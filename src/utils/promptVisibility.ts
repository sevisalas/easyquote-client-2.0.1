// Utility functions for prompt visibility and extraction

export interface PromptOption {
  label?: string;
  value: any;
  icon?: string;
  image?: string;
}

export interface PromptDef {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: PromptOption[];
  default?: any;
  visibility?: any;
  hiddenWhen?: any;
}

function isHexColor(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

function normalizeOptions(opts: any[]): PromptOption[] {
  return opts.map((o) => {
    if (typeof o === "string") return { value: o, label: o };
    if (typeof o === "number") return { value: o, label: String(o) };
    if (typeof o === "object" && o !== null) {
      const val = o.value ?? o.id ?? o.label ?? String(o);
      const lbl = o.label ?? o.name ?? String(val);
      return { value: val, label: lbl, icon: o.icon, image: o.image };
    }
    return { value: String(o), label: String(o) };
  });
}

export function getOptionLabel(options: PromptOption[] | undefined, value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  const v = String(value);
  const opt = options?.find((o) => String(o.value) === v);
  return opt?.label ?? v;
}

// Flexible condition evaluation for prompt visibility
export function matchValue(current: any, expected: any): boolean {
  if (Array.isArray(expected)) return expected.map(String).includes(String(current));
  if (typeof expected === "boolean") return Boolean(current) === expected;
  return String(current) === String(expected);
}

export function evalCondition(cond: any, values: Record<string, any>): boolean {
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

export function isVisiblePrompt(p: PromptDef, values: Record<string, any>): boolean {
  if (p.hiddenWhen && evalCondition(p.hiddenWhen, values)) return false;
  if (p.visibility && !evalCondition(p.visibility, values)) return false;
  return true;
}

export function extractPrompts(product: any): PromptDef[] {
  const candidates = [
    product?.prompts,
    product?.inputs,
    product?.fields,
    product?.parameters,
    product?.data,
  ];
  const raw = candidates.find((c) => Array.isArray(c) && c.length > 0);
  if (!raw) return [];

  return raw.map((item: any, i: number) => {
    const id = item.id ?? item.key ?? item.name ?? `p${i}`;
    const label = item.label ?? item.title ?? item.name ?? id;
    const rawType = item.type ?? "text";
    const type = rawType.toLowerCase();
    const description = item.description ?? item.help;
    const required = Boolean(item.required);
    let options: PromptOption[] | undefined;

    if (item.options && Array.isArray(item.options)) {
      const normalized = normalizeOptions(item.options);
      if (type === "image") {
        options = normalized.map((o) => ({
          ...o,
          image: o.image ?? (typeof o.value === "string" && (o.value.startsWith("http") || o.value.startsWith("data:")) ? o.value : undefined),
        }));
      } else if (type === "color") {
        options = normalized.map((o) => ({
          ...o,
          value: isHexColor(String(o.value)) ? o.value : (o.label && isHexColor(String(o.label)) ? o.label : o.value),
        }));
      } else {
        options = normalized;
      }
    }

    const min = item.min ?? item.minimum;
    const max = item.max ?? item.maximum;
    let inferredStep: number | undefined;
    if (type === "integer") inferredStep = 1;
    else if (type === "number" && (min !== undefined || max !== undefined)) inferredStep = 0.01;
    const step = item.step ?? inferredStep;
    const defaultVal = item.default ?? item.value;
    const { visibility, hiddenWhen } = item;

    return {
      id,
      label,
      type,
      required,
      description,
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
