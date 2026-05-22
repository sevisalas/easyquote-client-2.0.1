import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Save } from "lucide-react";
import { useStatusSettings, StatusSetting } from "@/hooks/useStatusSettings";
import { DEFAULT_STATUS_HEX, DEFAULT_STATUS_LABEL, styleFromHex } from "@/lib/statusColors";

export function StatusSettingsPanel() {
  const { settings, upsert, isLoading } = useStatusSettings();
  const [draft, setDraft] = useState<StatusSetting[]>([]);

  useEffect(() => {
    setDraft(settings);
  }, [JSON.stringify(settings)]);

  const update = (i: number, patch: Partial<StatusSetting>) => {
    setDraft((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const resetRow = (i: number) => {
    const row = draft[i];
    update(i, {
      label: DEFAULT_STATUS_LABEL[row.status_key],
      color: DEFAULT_STATUS_HEX[row.status_key],
    });
  };

  const save = (row: StatusSetting) => upsert(row);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Estados del pedido y trabajo</CardTitle>
        <CardDescription className="text-xs">
          Personaliza la etiqueta y el color de cada estado. Se usan en pedidos, items
          y panel de producción. Las claves internas no cambian.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {draft.map((row, i) => {
          const style = styleFromHex(row.color);
          return (
            <div
              key={row.status_key}
              className="grid grid-cols-[140px_1fr_72px_140px_auto] items-center gap-2 border rounded p-2"
            >
              <code className="text-[11px] text-muted-foreground">{row.status_key}</code>
              <Input
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="h-8"
              />
              <input
                type="color"
                value={row.color}
                onChange={(e) => update(i, { color: e.target.value })}
                className="h-8 w-full rounded border cursor-pointer"
              />
              <Badge
                className="border justify-center"
                style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
              >
                {row.label}
              </Badge>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Restaurar por defecto"
                  onClick={() => resetRow(i)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => save(row)}
                  disabled={
                    row.label === settings[i]?.label && row.color === settings[i]?.color
                  }
                >
                  <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}