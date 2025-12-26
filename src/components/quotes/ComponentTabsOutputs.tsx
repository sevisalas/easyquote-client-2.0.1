import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { GENERAL_COMPONENT, useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { type BoundProductConfig, getActiveComponents } from "./BoundProductConfigSelector";

// Función para formatear precio en EUR
function formatEUR(value: any): string {
  const num = typeof value === "number" ? value : parseFloat(String(value ?? 0).replace(/\./g, "").replace(",", ".")) || 0;
  return num.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

// Función para parsear precio desde string
function parsePrice(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}

interface ComponentTabsOutputsProps {
  productId: string;
  outputs: any[];
  activeComponent?: string;
  onComponentChange?: (component: string) => void;
  renderOutput: (output: any, index: number) => React.ReactNode;
  renderPrice?: () => React.ReactNode;
  renderImages?: (images: any[]) => React.ReactNode;
  isLoading?: boolean;
  savedOutputOrder?: string[] | null;
  /** Configuración de producto encuadernado (afecta labels) */
  boundProductConfig?: BoundProductConfig | null;
  /** Precio total editable por el usuario */
  editablePrice?: number | null;
  /** Callback cuando el usuario edita el precio */
  onPriceChange?: (price: number) => void;
}

// Labels dinámicos para componentes según la configuración
function getComponentLabels(boundProductConfig?: BoundProductConfig | null): Record<string, string> {
  switch (boundProductConfig) {
    case "same_paper":
      return {
        general: "General",
        interior_1: "Contenido"
      };
    case "cover_1_interior":
      return {
        general: "General",
        cubierta: "Cubierta",
        interior_1: "Interior"
      };
    default:
      return {
        general: "General",
        cubierta: "Cubierta",
        interior_1: "Interior 1",
        interior_2: "Interior 2"
      };
  }
}

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
  // IMPORTANTE: el orden guardado en Supabase usa nameCell (no outputCell)
  return (
    def?.nameCell ??
    def?.name_cell ??
    def?.outputNameCell ??
    def?.output_name_cell ??
    def?.labelCell ??
    def?.label_cell ??
    def?.outputCell ??
    def?.output_cell ??
    def?.cell ??
    def?.outputcell
  );
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
  isLoading: isLoadingProp = false,
  savedOutputOrder,
  boundProductConfig,
  editablePrice,
  onPriceChange
}: ComponentTabsOutputsProps) {
  // Labels dinámicos según configuración
  const componentLabels = useMemo(() => getComponentLabels(boundProductConfig), [boundProductConfig]);
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

  // Crear mapa de orden guardado para ordenar outputs
  const orderMap = useMemo(() => {
    if (!savedOutputOrder || savedOutputOrder.length === 0) return new Map<string, number>();
    return new Map(savedOutputOrder.map((cell, idx) => [normalizeKey(cell), idx]));
  }, [savedOutputOrder]);

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

    const mapped = normalizedOutputs.map((o: any) => {
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

    // Ordenar según savedOutputOrder si existe
    if (orderMap.size > 0) {
      return mapped.sort((a, b) => {
        const cellA = normalizeKey(a?.nameCell);
        const cellB = normalizeKey(b?.nameCell);
        const orderA = orderMap.has(cellA) ? orderMap.get(cellA)! : 9999;
        const orderB = orderMap.has(cellB) ? orderMap.get(cellB)! : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a?.__pos ?? 0) - (b?.__pos ?? 0);
      });
    }
    return mapped;
  }, [normalizedOutputs, orderedOutputDefinitions, orderMap]);

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

  // Ordenar por celda alfabéticamente (E5, E8, E9, E12...)
  const sortByCell = (arr: any[]): any[] => {
    return [...arr].sort((a, b) => {
      const cellA = (a?.nameCell || a?.name_cell || "").replace(/\$/g, "").toUpperCase();
      const cellB = (b?.nameCell || b?.name_cell || "").replace(/\$/g, "").toUpperCase();
      const colA = cellA.replace(/\d+/g, "");
      const colB = cellB.replace(/\d+/g, "");
      const rowA = parseInt(cellA.replace(/\D+/g, ""), 10) || 0;
      const rowB = parseInt(cellB.replace(/\D+/g, ""), 10) || 0;
      if (colA !== colB) return colA.localeCompare(colB);
      return rowA - rowB;
    });
  };

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

    // ORDENAR cada grupo alfabéticamente por celda (E5, E8, E9, E12...)
    Object.keys(grouped).forEach(comp => {
      grouped[comp] = sortByCell(grouped[comp]);
    });

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

  // Componentes activos según configuración seleccionada (boundProductConfig)
  const activeComponents = useMemo(() => {
    if (boundProductConfig) return getActiveComponents(boundProductConfig);
    return availableComponents;
  }, [boundProductConfig, availableComponents]);

  // Componentes para pestañas: usar activeComponents (filtrados por boundProductConfig), sin "General"
  const tabComponents = useMemo(() => {
    if (!isComposite) return [];
    // Solo mostrar los componentes activos según la configuración seleccionada
    return activeComponents.filter((c) => c !== GENERAL_COMPONENT.value);
  }, [activeComponents, isComposite]);

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

  // Calcular precios por componente - SOLO componentes activos (según configuración)
  const pricesByComponent = useMemo(() => {
    const prices: Record<string, number> = {};

    const priceComponents = activeComponents.filter((c) => c !== GENERAL_COMPONENT.value);

    // Solo recorrer los componentes ACTIVOS de esta configuración
    for (const comp of priceComponents) {
      const componentOutputs = outputsByComponent[comp] || [];
      const priceOutput = componentOutputs.find(
        (o: any) => String(o?.type || o?.outputType || "").toLowerCase() === "price"
      );

      if (priceOutput) {
        const value = parsePrice(String(priceOutput.value ?? "0"));
        prices[comp] = value;
      }
    }

    return prices;
  }, [outputsByComponent, activeComponents]);

  // Precio total calculado (suma de componentes)
  const calculatedTotalPrice = useMemo(() => {
    return Object.values(pricesByComponent).reduce((sum, p) => sum + p, 0);
  }, [pricesByComponent]);

  // Estado local para edición de precio
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [localEditPrice, setLocalEditPrice] = useState("");

  // Sincronizar precio editable con el calculado cuando no hay precio editado
  useEffect(() => {
    if (editablePrice === null || editablePrice === undefined) {
      setLocalEditPrice(calculatedTotalPrice.toFixed(2).replace(".", ","));
    } else {
      setLocalEditPrice(editablePrice.toFixed(2).replace(".", ","));
    }
  }, [calculatedTotalPrice, editablePrice]);

  // Determinar si hay precios de componentes para mostrar
  const hasComponentPrices = Object.keys(pricesByComponent).length > 0;

  // Renderizar sección de precios con desglose por componente
  const renderComponentPrices = () => {
    if (!hasComponentPrices) return null;

    const displayPrice = editablePrice !== null && editablePrice !== undefined 
      ? editablePrice 
      : calculatedTotalPrice;

    const componentCount = Object.keys(pricesByComponent).length;

    return (
      <div className="p-3 rounded-md border bg-card/50 space-y-3">
        {/* Desglose por componente - solo si hay más de 1 */}
        {componentCount > 1 && (
          <>
            <div className="space-y-1">
              {Object.entries(pricesByComponent).map(([comp, price]) => (
                <div key={comp} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{componentLabels[comp] || comp}</span>
                  <span className="font-medium">{formatEUR(price)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border" />
          </>
        )}
        
        {/* Total/Precio editable */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-medium">{componentCount > 1 ? "Total" : "Precio"}</span>
          {isEditingPrice ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={localEditPrice}
                onChange={(e) => setLocalEditPrice(e.target.value)}
                onBlur={() => {
                  setIsEditingPrice(false);
                  const parsed = parsePrice(localEditPrice);
                  if (onPriceChange && parsed !== calculatedTotalPrice) {
                    onPriceChange(parsed);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingPrice(false);
                    const parsed = parsePrice(localEditPrice);
                    if (onPriceChange && parsed !== calculatedTotalPrice) {
                      onPriceChange(parsed);
                    }
                  }
                  if (e.key === "Escape") {
                    setIsEditingPrice(false);
                    setLocalEditPrice(displayPrice.toFixed(2).replace(".", ","));
                  }
                }}
                className="w-24 h-8 text-right text-sm"
                autoFocus
              />
              <span className="text-sm">€</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingPrice(true)}
              className="px-2 py-1 rounded-full bg-accent text-accent-foreground text-lg font-semibold hover:bg-accent/80 transition-colors cursor-pointer"
              title="Clic para editar"
            >
              {formatEUR(displayPrice)}
            </button>
          )}
        </div>
        
        {/* Indicador si el precio fue modificado */}
        {editablePrice !== null && editablePrice !== undefined && editablePrice !== calculatedTotalPrice && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Calculado:</span>
            <span className="text-muted-foreground line-through">{formatEUR(calculatedTotalPrice)}</span>
          </div>
        )}
      </div>
    );
  };

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
      {/* Precio: usar desglose por componentes si hay, sino el renderPrice normal */}
      {hasComponentPrices ? renderComponentPrices() : (renderPrice && renderPrice())}

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
              const label = componentLabels[comp] || comp;
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
                    No hay resultados para {componentLabels[comp] || comp}.
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

