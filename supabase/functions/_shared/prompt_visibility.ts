// Shared utilities for evaluating EasyQuote prompt visibility conditions inside edge functions.

export function unwrapPromptValue(v: unknown): unknown {
  if (v && typeof v === "object") {
    const anyV = v as any;
    if ("value" in anyV) return anyV.value;
  }
  return v;
}

export function matchValue(current: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return expected.map(String).includes(String(current));
  if (typeof expected === "boolean") return Boolean(current) === expected;
  return String(current) === String(expected);
}

export function evalCondition(cond: unknown, values: Record<string, unknown>): boolean {
  if (!cond) return true;

  // Array => AND of items
  if (Array.isArray(cond)) return cond.every((c) => evalCondition(c, values));

  if (typeof cond === "string") {
    // Simple format: "field=value" with optional AND "&&"
    const parts = cond.split(/\s*&&\s*/);
    return parts.every((p) => {
      const [k, v] = p.split("=");
      if (!k) return true;
      return matchValue(values[k.trim()], (v ?? "").trim());
    });
  }

  if (typeof cond === "object" && cond !== null) {
    const anyCond = cond as any;

    // Support anyOf / allOf
    if (Array.isArray(anyCond.allOf)) return anyCond.allOf.every((c: any) => evalCondition(c, values));
    if (Array.isArray(anyCond.anyOf)) return anyCond.anyOf.some((c: any) => evalCondition(c, values));

    // { field, id, key, equals/value }
    const field = anyCond.field ?? anyCond.id ?? anyCond.key;
    if (field) {
      const expected = anyCond.equals ?? anyCond.value ?? anyCond.is;
      return matchValue(values[String(field)], expected);
    }

    // Mapping object: { size: "L", color: "red" }
    return Object.entries(anyCond).every(([k, v]) => matchValue(values[k], v));
  }

  return true;
}

// Force-include evaluation: opposite of hide_in_documents.
// Conditions: 'always', 'value_gt_zero', 'value_not_empty'
export function matchesForceCondition(value: unknown, condition: string | null | undefined): boolean {
  const cond = (condition || "always").toLowerCase();
  let v: any = value;
  if (v && typeof v === "object" && "value" in (v as any)) v = (v as any).value;

  if (cond === "always") return true;

  const str = String(v ?? "").trim();

  if (cond === "value_not_empty") {
    if (!str) return false;
    if (str.toLowerCase() === "no") return false;
    return true;
  }

  if (cond === "value_gt_zero") {
    const normalized = str.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normalized);
    if (isNaN(n)) {
      const n2 = parseFloat(str);
      return !isNaN(n2) && n2 > 0;
    }
    return n > 0;
  }

  return true;
}

export function shouldForceInclude(
  setting: { force_include_in_documents?: boolean | null; force_include_condition?: string | null } | null | undefined,
  value: unknown,
): boolean {
  if (!setting?.force_include_in_documents) return false;
  return matchesForceCondition(value, setting.force_include_condition);
}

export function isVisiblePromptDef(
  def: { visibility?: unknown; hiddenWhen?: unknown },
  values: Record<string, unknown>,
): boolean {
  if (def.hiddenWhen && evalCondition(def.hiddenWhen, values)) return false;
  if (def.visibility && !evalCondition(def.visibility, values)) return false;
  return true;
}
