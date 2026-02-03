import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnyPrompt = Record<string, any>;

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default function ProductPromptsDebugPanel({
  prompts,
  title = "Prompts (API)",
}: {
  prompts: AnyPrompt[] | undefined;
  title?: string;
}) {
  const list = Array.isArray(prompts) ? prompts : [];

  const normalized = useMemo(() => {
    return list
      .map((p: AnyPrompt, idx: number) => {
        const id = safeString(p?.id ?? p?.promptId ?? p?.prompt_id ?? "");
        const label = safeString(p?.promptText ?? p?.label ?? p?.name ?? p?.promptName ?? "");
        const type = safeString(p?.promptType ?? p?.type ?? "");
        const seq = p?.promptSequence ?? p?.sequence ?? p?.order ?? idx + 1;
        const currentValue = p?.currentValue ?? p?.value ?? p?.defaultValue ?? p?.default;
        const options = Array.isArray(p?.valueOptions)
          ? p.valueOptions
          : Array.isArray(p?.options)
            ? p.options
            : [];

        return {
          idx,
          id,
          label,
          type,
          seq,
          currentValue,
          optionsCount: Array.isArray(options) ? options.length : 0,
        };
      })
      .sort((a, b) => {
        const as = Number(a.seq);
        const bs = Number(b.seq);
        if (Number.isFinite(as) && Number.isFinite(bs)) return as - bs;
        return a.idx - b.idx;
      });
  }, [list]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(list, null, 2));
      toast.success("Prompts copiados al portapapeles");
    } catch (e) {
      console.error("Copy prompts failed", e);
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">{normalized.length}</div>
          <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={list.length === 0}>
            Copiar JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay prompts cargados todavía.</p>
        ) : (
          <>
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Orden</th>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Texto</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Valor</th>
                    <th className="px-3 py-2 font-medium">Opc.</th>
                  </tr>
                </thead>
                <tbody>
                  {normalized.map((p) => (
                    <tr key={`${p.id}-${p.idx}`} className="border-t">
                      <td className="px-3 py-2 align-top whitespace-nowrap">{safeString(p.seq)}</td>
                      <td className="px-3 py-2 align-top font-mono text-xs whitespace-nowrap">{p.id || "—"}</td>
                      <td className="px-3 py-2 align-top">{p.label || "—"}</td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">{p.type || "—"}</td>
                      <td className="px-3 py-2 align-top">{safeString(p.currentValue) || "—"}</td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">{p.optionsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">Ver respuesta cruda</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(list, null, 2)}
              </pre>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
