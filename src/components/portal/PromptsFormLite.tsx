import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { extractPrompts, type PromptDef } from "@/components/quotes/PromptsForm";

/**
 * Versión "lite" de PromptsForm para el Portal B2B.
 * - Reutiliza extractPrompts (mismo tratamiento de tipos: number/integer/text/select/image/color/quantity).
 * - Sin useProductPromptSettings (la visibilidad ya viene filtrada desde b2b-pricing).
 * - Sin admin_only, sin multi-cantidad, sin ajustes, sin lógica de composites.
 * - Commit inmediato (no hay debounce de blur — el padre ya hace debounce del PATCH).
 */
export default function PromptsFormLite({
  prompts: apiPrompts,
  values,
  onChange,
}: {
  prompts: any[];
  values: Record<string, any>;
  onChange: (id: string, value: any, label: string) => void;
}) {
  const prompts = useMemo(() => extractPrompts({ prompts: apiPrompts }), [apiPrompts]);
  const defaultsMap = useMemo(
    () => Object.fromEntries(prompts.map((p) => [p.id, p.default])),
    [prompts]
  );
  const effectiveValues = useMemo(
    () => ({ ...defaultsMap, ...values }),
    [defaultsMap, values]
  );

  if (!prompts.length) return null;

  const renderPrompt = (p: PromptDef) => {
    const val = effectiveValues[p.id] ?? "";

    return (
      <div key={p.id} className="space-y-1">
        <Label htmlFor={p.id} className="text-sm">
          {p.label}
          {p.required ? " *" : ""}
        </Label>
        {p.description && (
          <p className="text-xs text-muted-foreground">{p.description}</p>
        )}

        {(p.type === "number" || p.type === "integer" || p.type === "quantity") && (
          <Input
            id={p.id}
            type="number"
            inputMode={p.type === "number" ? "decimal" : "numeric"}
            step={p.type === "quantity" ? 1 : p.step}
            min={p.type === "quantity" ? (p.min ?? 1) : p.min}
            max={p.max}
            value={val}
            onChange={(e) => onChange(p.id, e.target.value, p.label)}
          />
        )}

        {p.type === "text" && (
          <Input
            id={p.id}
            type="text"
            value={val}
            onChange={(e) => onChange(p.id, e.target.value, p.label)}
          />
        )}

        {p.type === "select" && (() => {
          const options = (p.options ?? []).filter(
            (o) => o.value !== "" && o.value !== undefined && o.value !== null
          );
          const current = val === undefined || val === null ? "" : String(val);
          const match = options.find((o) => String(o.value) === current);
          return (
            <Select
              value={match ? String(match.value) : ""}
              onValueChange={(v) => onChange(p.id, v, p.label)}
            >
              <SelectTrigger id={p.id}>
                <SelectValue placeholder="Selecciona una opción" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {options.map((o, idx) => (
                  <SelectItem key={`${o.value}-${idx}`} value={String(o.value)}>
                    {o.label ?? String(o.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })()}

        {p.type === "image" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {p.options?.map((o) => {
              const selected = String(val) === String(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange(p.id, o.value, p.label)}
                  className={`relative overflow-hidden rounded-md border transition-shadow focus:outline-none focus:ring-2 focus:ring-primary aspect-square ${
                    selected ? "ring-2 ring-primary" : "hover:shadow"
                  }`}
                  aria-pressed={selected}
                  aria-label={o.label ?? String(o.value)}
                >
                  {o.imageUrl ? (
                    <img
                      src={o.imageUrl}
                      alt={`Opción ${o.label ?? o.value}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2">
                      {o.label ?? String(o.value)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {p.type === "color" && (
          <div className="flex flex-wrap gap-2">
            {p.options?.map((o) => {
              const selected = String(val) === String(o.value);
              const color = o.color ?? String(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange(p.id, o.value, p.label)}
                  className={`h-9 w-9 rounded-md border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary ${
                    selected ? "ring-2 ring-primary" : "hover:brightness-105"
                  }`}
                  aria-label={`Color ${o.label ?? o.value}`}
                  title={o.label ?? String(o.value)}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return <div className="space-y-3">{prompts.map(renderPrompt)}</div>;
}