import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PromptOption = {
  value: string;
  label?: string;
  imageUrl?: string;
  color?: string;
};

export type PromptDef = {
  id: string;
  label: string;
  type: "number" | "integer" | "text" | "select" | "image" | "color";
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: PromptOption[];
  default?: any;
};

function isHexColor(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^rgb\(/i.test(v) || /^hsl\(/i.test(v);
}

function normalizeOptions(opts: any[]): PromptOption[] {
  return (opts || []).map((o: any) => {
    if (typeof o === "string") {
      return isHexColor(o)
        ? { value: o, label: o, color: o }
        : { value: o, label: o };
    }
    const value = o.value ?? o.id ?? o.key ?? o.name ?? String(o);
    const label = o.label ?? o.title ?? o.name ?? String(value);
    const imageUrl = o.imageUrl ?? o.image ?? o.thumbnail ?? o.url ?? undefined;
    const color = o.color ?? (isHexColor(value) ? value : undefined);
    return { value: String(value), label, imageUrl, color } as PromptOption;
  });
}

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
    const id = String(f.id ?? f.key ?? f.name ?? `field_${idx}`);
    const label = f.label ?? f.title ?? f.name ?? id;
    const t = String(f.type ?? f.inputType ?? f.kind ?? "text").toLowerCase();
    const options = normalizeOptions(f.options ?? f.choices ?? f.values ?? f.items ?? []);
    const hasImages = options.some((o) => !!o.imageUrl);
    const hasColors = options.every((o) => !!o.color || isHexColor(o.value));

    let type: PromptDef["type"] = "text";
    if (t.includes("int")) type = "integer";
    else if (t.includes("number") || t.includes("decimal") || t.includes("float")) type = "number";
    else if ((options?.length ?? 0) > 0) type = hasImages ? "image" : hasColors ? "color" : "select";

    const decimals = t.includes("decimal") || t.includes("float") || f.decimals === true;

    return {
      id,
      label,
      type,
      description: f.description ?? f.helpText,
      required: !!(f.required ?? f.mandatory),
      min: Number.isFinite(f.min) ? Number(f.min) : undefined,
      max: Number.isFinite(f.max) ? Number(f.max) : undefined,
      step: Number.isFinite(f.step) ? Number(f.step) : decimals ? 0.01 : type === "integer" ? 1 : undefined,
      options,
      default: f.default ?? f.defaultValue,
    };
  });
}

export default function PromptsForm({
  product,
  values,
  onChange,
}: {
  product: any;
  values: Record<string, any>;
  onChange: (id: string, value: any) => void;
}) {
  const prompts = useMemo(() => extractPrompts(product), [product]);

  if (!product) return null;
  if (!prompts?.length) {
    return <p className="text-sm text-muted-foreground">Este producto no define opciones.</p>;
  }

  return (
    <div className="space-y-6">
      {prompts.map((p) => (
        <div key={p.id} className="space-y-2">
          <Label htmlFor={p.id}>{p.label}{p.required ? " *" : ""}</Label>
          {p.description && (
            <p className="text-xs text-muted-foreground">{p.description}</p>
          )}

          {/* Number / Integer */}
          {(p.type === "number" || p.type === "integer") && (
            <Input
              id={p.id}
              type="number"
              inputMode="decimal"
              step={p.step}
              min={p.min}
              max={p.max}
              value={values[p.id] ?? p.default ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange(p.id, v === "" ? "" : Number(v));
              }}
            />
          )}

          {/* Text */}
          {p.type === "text" && (
            <Input
              id={p.id}
              type="text"
              value={values[p.id] ?? p.default ?? ""}
              onChange={(e) => onChange(p.id, e.target.value)}
            />
          )}

          {/* Select (dropdown) */}
          {p.type === "select" && (
            <Select value={values[p.id] ?? p.default ?? undefined} onValueChange={(v) => onChange(p.id, v)}>
              <SelectTrigger id={p.id}>
                <SelectValue placeholder="Selecciona una opción" />
              </SelectTrigger>
              <SelectContent>
                {p.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label ?? o.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Image picker */}
          {p.type === "image" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {p.options?.map((o) => {
                const selected = (values[p.id] ?? p.default) === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(p.id, o.value)}
                    className={`relative overflow-hidden rounded-md border transition-shadow focus:outline-none focus:ring-2 focus:ring-primary ${selected ? "ring-2 ring-primary" : "hover:shadow"}`}
                    aria-pressed={selected}
                    aria-label={o.label ?? o.value}
                  >
                    {o.imageUrl ? (
                      <img
                        src={o.imageUrl}
                        alt={`Opción ${o.label ?? o.value}`}
                        loading="lazy"
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="h-24 w-full grid place-items-center text-sm text-muted-foreground">
                        {o.label ?? o.value}
                      </div>
                    )}
                    {o.label && (
                      <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur px-2 py-1 text-xs">
                        {o.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Color picker */}
          {p.type === "color" && (
            <div className="flex flex-wrap gap-2">
              {p.options?.map((o) => {
                const selected = (values[p.id] ?? p.default) === o.value;
                const color = o.color ?? o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(p.id, o.value)}
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
      ))}
    </div>
  );
}
