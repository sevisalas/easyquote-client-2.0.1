import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GENERAL_COMPONENT, useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";

interface ComponentTabsOutputsProps {
  productId: string;
  outputs: any[];
  activeComponent?: string;
  onComponentChange?: (component: string) => void;
  renderOutput: (output: any, index: number) => React.ReactNode;
  renderPrice?: () => React.ReactNode;
  renderImages?: (images: any[]) => React.ReactNode;
  isLoading?: boolean;
}

// Labels para componentes
const COMPONENT_LABELS: Record<string, string> = {
  general: "General",
  cubierta: "Cubierta",
  interior_1: "Interior 1",
  interior_2: "Interior 2"
};

// Orden predefinido de componentes
const COMPONENT_ORDER = ["cubierta", "interior_1", "interior_2"];

function normalizeKey(v: any): string {
  return String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
}

function extractCellRef(v: any): string | undefined {
  const s = String(v ?? "").replace(/\$/g, "").toUpperCase();
  const m = s.match(/\b[A-Z]{1,3}\d{1,4}\b/);
  return m?.[0];
}

function getOutputCell(def: any): string | undefined {
  return def?.outputCell ?? def?.output_cell ?? def?.cell ?? def?.outputcell ?? def?.nameCell ?? def?.name_cell;
}

function getOutputName(def: any): string | undefined {
  return def?.outputName ?? def?.output_name ?? def?.name ?? def?.label ?? def?.title;
}

function getOutputSheet(def: any): string | undefined {
  return def?.sheet ?? def?.sheetName ?? def?.sheet_name ?? def?.tab ?? def?.worksheet;
}

function getOutputTypeName(def: any): string | undefined {
  return def?.outputTypeName ?? def?.output_type_name ?? def?.typeName ?? def?.type_name ?? def?.outputType ?? def?.type;
}

export default function ComponentTabsOutputs({
  productId,
  outputs,
  activeComponent,
  onComponentChange,
  renderOutput,
  renderPrice,
  renderImages,
  isLoading: isLoadingProp = false
}: ComponentTabsOutputsProps) {
  const {
    isComposite,
    enabledComponents,
    getPromptComponent,
    isLoading: isLoadingSettings
  } = useProductComponentSettings(productId);

  // Definiciones de outputs (traen sheet/nameCell/cell) para poder mapear outputs del pricing -> componente
  const { data: outputDefinitions = [], isLoading: isLoadingOutputDefinitions } = useQuery({
    queryKey: ["easyquote-outputs-definitions", productId],
    queryFn: async () => {
      if (!productId) return [];
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any[]>("easyquote-outputs", {
        token,
        productId,
      });
      if (error) {
        console.error("[ComponentTabsOutputs] Error fetching output definitions", error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const isLoadingData = isLoadingProp || isLoadingSettings || isLoadingOutputDefinitions;

  // Normalizar + enriquecer outputs (en ProductTestPage funciona porque se completa nameCell/sheet)
  const orderedOutputDefinitions = useMemo(() => {
    return (outputDefinitions as any[]).map((d: any, index: number) => ({
      ...d,
      __index: Number.isFinite(Number(d?.__index)) ? Number(d?.__index) : index,
    }));
  }, [outputDefinitions]);

  const normalizedOutputs = useMemo(() => {
    if (!Array.isArray(outputs)) return [];

    return outputs.map((o: any, pos: number) => {
      const idxRaw = Number(o?.idx ?? o?.index ?? o?.orderSeq ?? o?.outputIndex ?? o?.order ?? NaN);
      const idx = Number.isFinite(idxRaw) ? idxRaw : undefined;

      return {
        ...o,
        __pos: Number.isFinite(Number(o?.__pos)) ? Number(o?.__pos) : pos,
        idx,
        stableId: String(o?.stableId ?? o?.id ?? o?.outputId ?? o?.outputID ?? "").trim(),
        sheet: String(o?.sheet ?? "").trim(),
        nameCell: String(o?.nameCell ?? o?.outputNameCell ?? o?.name_cell ?? "").trim(),
        valueCell: String(o?.valueCell ?? o?.outputValueCell ?? o?.value_cell ?? "").trim(),
        label: o?.label || o?.name || o?.outputText || o?.text || o?.outputName || "",
        name: o?.name || o?.label || o?.outputName || "",
        value: o?.value ?? o?.currentValue ?? o?.outputValue ?? o?.result ?? "",
        outputType: o?.outputType || o?.type || "",
      };
    });
  }, [outputs]);

  const resolvedOutputs = useMemo(() => {
    const normalizeType = (v: any) => String(v ?? "").trim().toLowerCase();
    const normalizeId = (v: any) => String(v ?? "").trim();

    const defById = new Map<string, any>();
    const defByOriginalIndex = new Map<number, any>();
    orderedOutputDefinitions.forEach((d: any, sortedIndex: number) => {
      const id = normalizeId(d?.id);
      if (id) defById.set(id, d);

      const originalIndex = Number(d?.__index);
      if (Number.isFinite(originalIndex)) defByOriginalIndex.set(originalIndex, d);

      // También guardamos el índice ya ordenado como fallback
      defByOriginalIndex.set(sortedIndex, defByOriginalIndex.get(sortedIndex) ?? d);
    });

    const getDefByIndex = (n: number) => defByOriginalIndex.get(n);

    const defsByType = new Map<string, any[]>();
    for (const d of orderedOutputDefinitions as any[]) {
      const t = normalizeType(getOutputTypeName(d));
      if (!t) continue;
      if (!defsByType.has(t)) defsByType.set(t, []);
      defsByType.get(t)!.push(d);
    }

    const counters = new Map<string, number>();

    return normalizedOutputs.map((o: any) => {
      // Si ya viene con celda, respetarla
      if (o?.nameCell) return o;

      const stableId = normalizeId(o?.stableId);
      if (stableId && defById.has(stableId)) {
        const def = defById.get(stableId);
        return {
          ...o,
          sheet: o.sheet || String(getOutputSheet(def) ?? "").trim(),
          nameCell: String(extractCellRef(getOutputCell(def)) ?? getOutputCell(def) ?? "").trim(),
        };
      }

      const idxRaw = Number(o?.idx);
      if (Number.isFinite(idxRaw)) {
        const def = getDefByIndex(idxRaw) ?? getDefByIndex(idxRaw - 1);
        if (def) {
          return {
            ...o,
            stableId: stableId || normalizeId(def?.id),
            sheet: o.sheet || String(getOutputSheet(def) ?? "").trim(),
            nameCell: String(extractCellRef(getOutputCell(def)) ?? getOutputCell(def) ?? "").trim(),
          };
        }
      }

      const posRaw = Number(o?.__pos);
      if (Number.isFinite(posRaw)) {
        const def = getDefByIndex(posRaw);
        if (def) {
          return {
            ...o,
            stableId: stableId || normalizeId(def?.id),
            sheet: o.sheet || String(getOutputSheet(def) ?? "").trim(),
            nameCell: String(extractCellRef(getOutputCell(def)) ?? getOutputCell(def) ?? "").trim(),
          };
        }
      }

      const t = normalizeType(o?.outputType);
      const defs = defsByType.get(t);
      if (!defs || defs.length === 0) return o;

      const i = counters.get(t) ?? 0;
      const def = defs[i];
      counters.set(t, i + 1);
      if (!def) return o;

      return {
        ...o,
        stableId: stableId || normalizeId(def?.id),
        sheet: o.sheet || String(getOutputSheet(def) ?? "").trim(),
        nameCell: String(extractCellRef(getOutputCell(def)) ?? getOutputCell(def) ?? "").trim(),
      };
    });
  }, [normalizedOutputs, orderedOutputDefinitions]);

  // Componentes disponibles ordenados
  const availableComponents = useMemo(() => {
    if (!isComposite) return [GENERAL_COMPONENT.value];
    
    const sortedEnabled = [...enabledComponents].sort((a, b) => {
      const indexA = COMPONENT_ORDER.indexOf(a);
      const indexB = COMPONENT_ORDER.indexOf(b);
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });
    
    return [GENERAL_COMPONENT.value, ...sortedEnabled];
  }, [enabledComponents, isComposite]);

  // Inferir componente desde el nombre de la hoja Excel
  const inferComponentFromSheet = (sheetName?: string): string => {
    if (!sheetName) return "general";
    const lower = String(sheetName).toLowerCase();

    // Mapeo directo por nombre
    if (lower.includes("cubierta") || lower.includes("cover")) return "cubierta";
    if (lower.includes("interior_2") || lower.includes("interior2")) return "interior_2";
    if (lower.includes("interior_1") || lower.includes("interior1") || lower.includes("interior")) return "interior_1";

    // Intentar inferir por número
    const match = lower.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      const enabled = enabledComponents || [];
      if (Number.isFinite(n) && n >= 1 && n <= enabled.length) {
        return enabled[n - 1];
      }
      if (Number.isFinite(n) && n >= 1 && n <= availableComponents.length) {
        return availableComponents[n - 1];
      }
    }

    return "general";
  };

  const outputMetaByKey = useMemo(() => {
    const map = new Map<string, { cell?: string; sheet?: string }>();

    for (const def of outputDefinitions as any[]) {
      const cell = extractCellRef(getOutputCell(def)) ?? normalizeKey(getOutputCell(def));
      const name = getOutputName(def);
      const sheet = getOutputSheet(def);

      const keys = [def?.id, def?.key, def?.code, def?.slug, name, getOutputCell(def)].filter(Boolean);
      for (const k of keys) {
        const kn = normalizeKey(k);
        if (kn) map.set(kn, { cell, sheet });
      }

      if (cell) map.set(normalizeKey(cell), { cell, sheet });
    }

    return map;
  }, [outputDefinitions]);

  // Agrupar outputs por componente
  const outputsByComponent = useMemo(() => {
    const grouped: Record<string, any[]> = {};

    // Inicializar todos los componentes
    availableComponents.forEach((comp) => {
      grouped[comp] = [];
    });

    for (const output of resolvedOutputs) {
      const rawIdentifier = output?.nameCell || output?.name_cell || output?.name || output?.label;
      const identifier = String(rawIdentifier ?? "");

      const idNorm = normalizeKey(identifier);
      const cellFromIdentifier = extractCellRef(identifier);
      const meta =
        (idNorm ? outputMetaByKey.get(idNorm) : undefined) ??
        (cellFromIdentifier ? outputMetaByKey.get(normalizeKey(cellFromIdentifier)) : undefined);

      const metaCell = meta?.cell;
      const metaSheet = meta?.sheet;

      // 1) Primero por celda (E13) si la tenemos
      // 2) Luego por nombre textual ("Plastificado", "Encuadernado")
      let component = "general";
      if (metaCell) {
        component = getPromptComponent(metaCell);
      }
      if (component === "general" && identifier) {
        component = getPromptComponent(identifier);
      }

      // Fallback: inferir por sheet de definiciones (o del output si viniera)
      if (component === "general") {
        const sheet = metaSheet ?? output?.sheet;
        if (sheet) component = inferComponentFromSheet(sheet);
      }

      // Si el componente no está en los disponibles, poner en general
      if (!grouped[component]) {
        grouped[GENERAL_COMPONENT.value].push(output);
      } else {
        grouped[component].push(output);
      }
    }

    return grouped;
  }, [resolvedOutputs, availableComponents, getPromptComponent, inferComponentFromSheet, outputMetaByKey]);

  // Contar outputs por componente
  const countByComponent = useMemo(() => {
    const counts: Record<string, number> = {};
    availableComponents.forEach(comp => {
      counts[comp] = outputsByComponent[comp]?.length || 0;
    });
    return counts;
  }, [outputsByComponent, availableComponents]);

  // Componentes para pestañas (en productos compuestos NO mostramos "General")
  const tabComponents = useMemo(() => {
    if (!isComposite) return availableComponents;
    return availableComponents.filter((c) => c !== GENERAL_COMPONENT.value);
  }, [availableComponents, isComposite]);

  // Outputs generales
  const generalOutputs = useMemo(() => 
    outputsByComponent[GENERAL_COMPONENT.value] || [], 
    [outputsByComponent]
  );

  // Separar images de text outputs para outputs generales
  const generalImages = useMemo(() => 
    generalOutputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [generalOutputs]
  );
  
  const generalTextOutputs = useMemo(() => 
    generalOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      const type = String(o?.type || "").toLowerCase();
      return !/^https?:\/\//i.test(value) && type !== "price";
    }),
    [generalOutputs]
  );

  // Estado del tab activo
  const initialTab = useMemo(() => {
    // Si hay activeComponent y es válido, usarlo
    if (activeComponent && tabComponents.includes(activeComponent)) {
      return activeComponent;
    }
    // Buscar el primer tab con outputs
    for (const comp of tabComponents) {
      if ((countByComponent[comp] || 0) > 0) return comp;
    }
    return tabComponents[0] || "";
  }, [tabComponents, countByComponent, activeComponent]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Sincronizar con el componente activo del padre (prompts)
  useEffect(() => {
    if (!activeComponent) return;

    const hasComponentOutputs = (countByComponent[activeComponent] || 0) > 0;
    if (tabComponents.includes(activeComponent) && hasComponentOutputs) {
      setActiveTab(activeComponent);
    }
  }, [activeComponent, tabComponents, countByComponent]);

  // Notificar cambio de componente
  useEffect(() => {
    if (onComponentChange && activeTab) {
      onComponentChange(activeTab);
    }
  }, [activeTab, onComponentChange]);

  // Mantener activeTab válido
  useEffect(() => {
    if (!tabComponents.length) return;
    if (!activeTab || !tabComponents.includes(activeTab)) {
      setActiveTab(initialTab);
    }
  }, [activeTab, tabComponents, initialTab]);

  // Si está cargando, mostrar indicador
  if (isLoadingData) {
    return (
      <div className="space-y-4">
        {renderPrice && renderPrice()}
        <div className="flex items-center justify-center py-4">
          <span className="text-sm text-muted-foreground animate-pulse">Calculando resultados...</span>
        </div>
      </div>
    );
  }

  // Si NO es compuesto o no hay tabs, mostrar outputs planos
  if (!isComposite || tabComponents.length === 0) {
    return (
      <div className="space-y-4">
        {renderPrice && renderPrice()}
        {renderImages && generalImages.length > 0 && renderImages(generalImages)}
        {generalTextOutputs.length > 0 && (
          <section className="space-y-2">
            {generalTextOutputs.map((o, idx) => renderOutput(o, idx))}
          </section>
        )}
      </div>
    );
  }

  // Producto compuesto: mostrar con pestañas
  return (
    <div className="space-y-4">
      {/* Precio siempre visible arriba */}
      {renderPrice && renderPrice()}

      {/* Outputs generales siempre visibles (sin pestaña) */}
      {renderImages && generalImages.length > 0 && renderImages(generalImages)}
      {generalTextOutputs.length > 0 && (
        <section className="space-y-2">
          {generalTextOutputs.map((o, idx) => renderOutput(o, idx))}
        </section>
      )}

      {/* Pestañas solo para componentes específicos (sin "General") */}
      {tabComponents.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {tabComponents.map(comp => {
              const label = COMPONENT_LABELS[comp] || comp;
              return (
                <TabsTrigger 
                  key={comp} 
                  value={comp} 
                  className="relative flex items-center text-xs" 
                >
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Contenido de cada tab - muestra solo los outputs de ese componente */}
          {tabComponents.map(comp => {
            const componentOutputs = outputsByComponent[comp] || [];
            
            const componentImages = componentOutputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? "")));
            const componentTextOutputs = componentOutputs.filter((o: any) => {
              const value = String(o?.value ?? "");
              const type = String(o?.type || "").toLowerCase();
              return !/^https?:\/\//i.test(value) && type !== "price";
            });

            return (
              <TabsContent key={comp} value={comp} className="mt-0 space-y-3">
                {renderImages && componentImages.length > 0 && renderImages(componentImages)}
                {componentTextOutputs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No hay resultados para {COMPONENT_LABELS[comp] || comp}.
                  </p>
                ) : (
                  <section className="space-y-2">
                    {componentTextOutputs.map((o, idx) => renderOutput(o, idx))}
                  </section>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

