import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptsForm, { extractPrompts, type PromptDef } from "./PromptsForm";
import { GENERAL_COMPONENT, useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { useProductPromptSettings } from "@/hooks/useProductPromptSettings";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { type BoundProductConfig, getActiveComponents } from "./BoundProductConfigSelector";

const DEBUG_COMPONENT_TABS = false;
const debugLog = (...args: any[]) => {
  if (DEBUG_COMPONENT_TABS) console.log(...args);
};

interface ComponentTabsPromptsFormProps {
  product: any;
  productId: string;
  values: Record<string, any>;
  onChange: (id: string, value: any, label: string) => void;
  onCommit?: (id: string, value: any, label: string) => void;
  showAllPrompts?: boolean;
  onComponentChange?: (component: string) => void;
  /** Configuración de producto encuadernado (filtra qué componentes mostrar) */
  boundProductConfig?: BoundProductConfig | null;
  /** Si el usuario es admin (puede ver prompts admin_only) */
  isAdmin?: boolean;
  /** Callback para devolver los prompts marcados como "force_result" para mostrarlos en sección aparte */
  onForceResultPrompts?: (prompts: PromptDef[]) => void;
}

// Labels dinámicos para componentes según la configuración
function getComponentLabels(boundProductConfig?: BoundProductConfig | null): Record<string, string> {
  switch (boundProductConfig) {
    case "same_paper":
      // Solo hay interior_1, llamarlo "Contenido"
      return {
        general: "General",
        interior_1: "Contenido"
      };
    case "cover_1_interior":
      // Cubierta + Interior (sin números)
      return {
        general: "General",
        cubierta: "Cubierta",
        interior_1: "Interior"
      };
    default:
      // Todos los componentes o sin configuración
      return {
        general: "General",
        cubierta: "Cubierta",
        interior_1: "Interior 1",
        interior_2: "Interior 2"
      };
  }
}

// Export para compatibilidad (labels por defecto)
export const COMPONENT_LABELS = getComponentLabels(null);

// Orden predefinido de componentes (el orden en que aparecen para ser activados)
const COMPONENT_ORDER = ["cubierta", "interior_1", "interior_2"];

function getPromptCell(op: any): string | undefined {
  return op?.promptCell ?? op?.prompt_cell ?? op?.cell ?? op?.promptcell;
}

function normalizePromptName(v: any): string {
  return String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
}

function extractCellRef(v: any): string | undefined {
  const s = String(v ?? "").replace(/\$/g, "").toUpperCase();
  const m = s.match(/\b[A-Z]{1,3}\d{1,4}\b/);
  return m?.[0];
}

export default function ComponentTabsPromptsForm({
  product,
  productId,
  values,
  onChange,
  onCommit,
  showAllPrompts = false,
  onComponentChange,
  boundProductConfig,
  isAdmin = false,
  onForceResultPrompts
}: ComponentTabsPromptsFormProps) {
  const {
    isComposite,
    enabledComponents,
    getPromptComponent,
    isLoading
  } = useProductComponentSettings(productId);

  // Obtener configuración de prompts (admin_only, hide_in_documents, force_result)
  const { isPromptAdminOnly, isPromptForceResult, isLoading: isPromptSettingsLoading, promptSettings } = useProductPromptSettings(productId);

  // Obtener componentes activos según la configuración de producto encuadernado
  const activeComponents = useMemo(() => {
    if (boundProductConfig) {
      return getActiveComponents(boundProductConfig);
    }
    // Si no hay configuración, mostrar todos los componentes habilitados
    return ["general", ...enabledComponents];
  }, [boundProductConfig, enabledComponents]);

  const {
    data: promptDefinitions = [],
    isLoading: isPromptDefinitionsLoading,
  } = useQuery({
    queryKey: ["easyquote-prompts-definitions", productId],
    queryFn: async () => {
      if (!productId) return [];
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any[]>("easyquote-prompts", {
        token,
        productId
      });
      if (error) {
        console.error("[ComponentTabsPromptsForm] Error fetching prompt definitions", error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    // Necesitamos las definiciones también en productos NO compuestos para poder mapear UUID -> celda
    // y así aplicar correctamente la restricción admin_only (sin depender de labels).
    enabled: !!productId,
    staleTime: 30 * 60 * 1000, // 30 minutos - las definiciones de prompts casi nunca cambian
    gcTime: 60 * 60 * 1000, // 1 hora en cache
    refetchOnWindowFocus: false
  });

  // Usamos siempre los prompts del producto (pricing) porque tienen los labels (promptText) y currentValue.
  // Las definiciones (promptDefinitions) solo se usan para mapear UUID -> celda (B12, B36...) para la agrupación.

  // Construir lookup: UUID -> promptCell (celda normalizada)
  // Clave primaria: el UUID del prompt
  // Valor: la celda normalizada (ej: "B10")
  const promptCellLookup = useMemo(() => {
    const map = new Map<string, string>();

    debugLog("[ComponentTabs] Building promptCellLookup from", promptDefinitions?.length, "definitions");

    for (const p of promptDefinitions as any[]) {
      const rawCell = getPromptCell(p);
      const cell = extractCellRef(rawCell) ?? normalizePromptName(rawCell);

      debugLog("[ComponentTabs] Prompt def:", {
        id: p?.id,
        rawCell,
        cell,
        name: p?.name,
        promptText: p?.promptText,
      });

      if (!cell) continue;

      // Indexar por UUID (la clave principal que viene del pricing)
      const uuid = String(p?.id ?? "").trim();
      if (uuid) {
        map.set(uuid, cell);
        map.set(uuid.toUpperCase(), cell);
        map.set(uuid.toLowerCase(), cell);
      }

      // También indexar por otras claves para compatibilidad
      const keys = [
        p?.key,
        p?.code,
        p?.slug,
        p?.name,
        // Muy importante: en algunos productos el ID de definición no coincide con el UUID del pricing,
        // pero el texto (promptText) sí, así que lo usamos como clave adicional.
        (p as any)?.promptText,
        (p as any)?.prompt_text,
        getPromptCell(p)
      ];
      for (const k of keys) {
        const kn = extractCellRef(k) ?? normalizePromptName(k);
        if (kn) map.set(kn, cell);
      }

      // Asegurar que la propia celda también está indexada
      map.set(cell, cell);
    }

    debugLog("[ComponentTabs] promptCellLookup size:", map.size);
    return map;
  }, [promptDefinitions]);

  // Fallback extra: si falla el mapeo por definiciones, usar las etiquetas personalizadas
  // guardadas en Supabase (product_prompt_settings.label -> product_prompt_settings.prompt_name).
  // Esto permite detectar force_result aunque EasyQuote cambie UUIDs o falten promptCells en pricing.
  const promptNameByCustomLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of (promptSettings ?? []) as any[]) {
      const lbl = String(s?.label ?? "").trim();
      const promptName = String(s?.prompt_name ?? "").trim();
      if (!lbl || !promptName) continue;
      map.set(normalizePromptName(lbl), promptName);
    }
    return map;
  }, [promptSettings]);

  const getPromptAdminKey = (prompt: PromptDef): string => {
    const idStr = String(prompt.id).trim();

    // Primero intentar buscar por UUID directamente (la clave más confiable)
    const cellFromUuid = promptCellLookup.get(idStr);
    if (cellFromUuid) {
      debugLog("[ComponentTabs] getPromptAdminKey found by UUID:", { id: idStr, cell: cellFromUuid });
      return cellFromUuid;
    }

    // Buscar también por UUID en mayúsculas/minúsculas
    const cellFromUuidLower = promptCellLookup.get(idStr.toLowerCase());
    const cellFromUuidUpper = promptCellLookup.get(idStr.toUpperCase());
    if (cellFromUuidLower) return cellFromUuidLower;
    if (cellFromUuidUpper) return cellFromUuidUpper;

    // Fallback: intentar mapear por etiqueta custom (Supabase) -> prompt_name (celda)
    // (Ej: "Forzar máquina" -> "B22")
    const labelText = String((prompt as any)?.label ?? "").trim();
    const cleanedLabelText = labelText.replace(/^campo\s+/i, "").trim();
    const labelFromSettings = cleanedLabelText
      ? promptNameByCustomLabel.get(normalizePromptName(cleanedLabelText))
      : undefined;
    if (labelFromSettings) {
      debugLog("[ComponentTabs] getPromptAdminKey found by custom label setting:", {
        id: idStr,
        labelText,
        promptName: labelFromSettings,
      });
      return labelFromSettings;
    }

    // Fallback adicional: en algunos productos el pricing trae UUIDs que no están en las definiciones,
    // pero el label (promptText) sí coincide. Intentar mapear por texto descriptivo.
    const labelTextNorm = labelText ? normalizePromptName(labelText) : "";
    const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(labelText);
    const isCellLike = /^[A-Z]{1,3}\d{1,4}$/.test(labelTextNorm);
    if (labelTextNorm && !isUuidLike && !isCellLike) {
      const cellFromLabelText = promptCellLookup.get(labelTextNorm);
      if (cellFromLabelText) {
        debugLog("[ComponentTabs] getPromptAdminKey found by label text:", { id: idStr, labelText, cell: cellFromLabelText });
        return cellFromLabelText;
      }
    }

    // Fallback: intentar extraer celda del id o label
    const idNorm = extractCellRef(idStr) ?? normalizePromptName(idStr);
    const labelCell = extractCellRef((prompt as any)?.label);

    const cellFromId = idNorm ? promptCellLookup.get(idNorm) : undefined;
    const cellFromLabel = labelCell ? (promptCellLookup.get(labelCell) ?? labelCell) : undefined;

    const result = cellFromId ?? cellFromLabel ?? extractCellRef(idStr) ?? labelCell ?? idNorm ?? idStr;
    debugLog("[ComponentTabs] getPromptAdminKey fallback:", { id: idStr, result, idNorm, labelCell });

    // Importante: NO usar el texto del label (p.ej. "Tarifa"); solo referencias de celda/ids.
    return result;
  };

  // Separar prompts: regulares vs force_result
  // IMPORTANTE: Depende de promptSettings y promptDefinitions para recalcularse cuando se carguen
  const { prompts, forceResultPrompts } = useMemo(() => {
    const allPrompts = extractPrompts(product);

    // Filtrar admin_only si no es admin
    const accessiblePrompts = isAdmin 
      ? allPrompts 
      : allPrompts.filter((prompt) => !isPromptAdminOnly(getPromptAdminKey(prompt)));

    // Si los settings o definiciones están cargando, no separar force_result todavía
    // (se recalculará cuando los datos cambien)
    if (isPromptSettingsLoading || isPromptDefinitionsLoading) {
      return { prompts: accessiblePrompts, forceResultPrompts: [] };
    }

    // Separar prompts normales de force_result
    const regular: PromptDef[] = [];
    const forceResult: PromptDef[] = [];
    const forceResultCellsSeen = new Set<string>();

    for (const prompt of accessiblePrompts) {
      const key = getPromptAdminKey(prompt);
      if (isPromptForceResult(key)) {
        forceResult.push(prompt);
        forceResultCellsSeen.add(key);
      } else {
        regular.push(prompt);
      }
    }

    // IMPORTANTE: Añadir prompts force_result de las DEFINICIONES que NO estén en el pricing.
    // Esto soluciona el problema de prompts como "Tira y retira" que tienen visibilidad condicional
    // y el API no los devuelve si están ocultos, pero aún así deben aparecer como opción restrictiva.
    for (const setting of (promptSettings ?? []) as any[]) {
      if (!setting?.force_result) continue;
      const cellKey = normalizePromptName(setting.prompt_name);
      // Solo añadir si no lo vimos ya desde el pricing
      if (forceResultCellsSeen.has(cellKey)) continue;
      // Verificar admin_only
      if (!isAdmin && setting.admin_only) continue;

      // Buscar la definición completa en promptDefinitions para obtener metadata (tipo, opciones, etc.)
      const def = (promptDefinitions as any[]).find((d: any) => {
        const defCell = extractCellRef(getPromptCell(d)) ?? normalizePromptName(getPromptCell(d));
        return defCell === cellKey;
      });

      if (!def) continue; // Sin definición no podemos renderizar el prompt

      // Construir un PromptDef mínimo desde la definición
      const rawType = String(def?.promptType ?? def?.type ?? "text").toLowerCase();
      let type: PromptDef["type"] = "text";
      if (rawType.includes("checkbox") || rawType.includes("boolean")) type = "checkbox";
      else if (rawType.includes("drop") || rawType.includes("select")) type = "select";
      else if (rawType.includes("number") || rawType.includes("int")) type = "number";

      const options = (def?.valueOptions ?? def?.options ?? []).map((o: any) => {
        if (typeof o === "string") return { value: o, label: o };
        return { value: String(o?.value ?? o), label: String(o?.label ?? o?.value ?? o) };
      });

      const promptDef: PromptDef = {
        id: def?.id ?? cellKey,
        label: setting.label ?? def?.promptText ?? def?.name ?? cellKey,
        type,
        options: options.length > 0 ? options : undefined,
        default: def?.currentValue ?? def?.default ?? def?.defaultValue,
      };

      forceResult.push(promptDef);
      forceResultCellsSeen.add(cellKey);
    }

    return { prompts: regular, forceResultPrompts: forceResult };
  }, [product, isAdmin, isPromptAdminOnly, isPromptForceResult, promptCellLookup, promptSettings, isPromptSettingsLoading, isPromptDefinitionsLoading, promptDefinitions]);

  // Notificar los prompts force_result al componente padre
  useEffect(() => {
    if (onForceResultPrompts) {
      onForceResultPrompts(forceResultPrompts);
    }
  }, [forceResultPrompts, onForceResultPrompts]);

  // Construir lista de componentes disponibles: siempre "general" + los habilitados ordenados
  // Pero filtrados por boundProductConfig si está definido
  const availableComponents = useMemo(() => {
    if (!isComposite) return [GENERAL_COMPONENT.value];
    
    // Ordenar los componentes habilitados según el orden predefinido
    const sortedEnabled = [...enabledComponents].sort((a, b) => {
      const indexA = COMPONENT_ORDER.indexOf(a);
      const indexB = COMPONENT_ORDER.indexOf(b);
      // Si no está en el orden predefinido, ponerlo al final
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });
    
    // Si hay configuración de producto encuadernado, filtrar componentes
    if (boundProductConfig) {
      const filtered = sortedEnabled.filter(comp => activeComponents.includes(comp));
      return [GENERAL_COMPONENT.value, ...filtered];
    }
    
    return [GENERAL_COMPONENT.value, ...sortedEnabled];
  }, [enabledComponents, isComposite, boundProductConfig, activeComponents]);

  // Agrupar prompts por componente
  const promptsByComponent = useMemo(() => {
    const grouped: Record<string, PromptDef[]> = {};

    // Inicializar todos los componentes
    availableComponents.forEach(comp => {
      grouped[comp] = [];
    });

    // Obtener los prompts originales del producto para acceder a promptCell
    // Nota: en QuoteItem/ProductTestPage el objeto "pricing" NO trae promptCell.
    // Para poder mapear id(UUID) -> promptCell, usamos promptDefinitions (easyquote-prompts).
    const originalPrompts: any[] = Array.isArray(promptDefinitions) && promptDefinitions as any[] || Array.isArray(product?.prompts) && product.prompts || Array.isArray(product?.pricing?.prompts) && product.pricing.prompts || [];

    // Asignar cada prompt a su componente
    prompts.forEach((prompt) => {
      const idStr = String(prompt.id);
      const idNorm = extractCellRef(idStr) ?? normalizePromptName(idStr);
      const labelCell = extractCellRef((prompt as any)?.label);

      const promptCellFromDefs =
        (idNorm ? promptCellLookup.get(idNorm) : undefined) ??
        (labelCell ? (promptCellLookup.get(labelCell) ?? labelCell) : undefined);

      // Buscar el prompt original (si existe) para extraer más metadata
      const originalPrompt = originalPrompts.find((op: any) => {
        const keys = [op?.id, getPromptCell(op), op?.key, op?.name, op?.code, op?.slug]
          .filter(Boolean)
          .map(String);
        if (keys.includes(idStr)) return true;
        const keyCells = keys.map((k) => extractCellRef(k)).filter(Boolean);
        return (
          (labelCell && keyCells.includes(labelCell)) ||
          (promptCellFromDefs && keyCells.includes(promptCellFromDefs))
        );
      });

      const identifierCandidates = [
        promptCellFromDefs,
        getPromptCell(originalPrompt),
        originalPrompt?.key,
        originalPrompt?.id,
        (prompt as any)?.label,
        prompt.id,
      ];

      const promptIdentifier =
        identifierCandidates.map((v) => extractCellRef(v)).find(Boolean) ??
        identifierCandidates.map((v) => normalizePromptName(v)).find(Boolean) ??
        idStr;

      const component = getPromptComponent(promptIdentifier);

      // Si hay boundProductConfig y el componente NO está en activeComponents, EXCLUIR el prompt
      // (excepto "general" que siempre se muestra)
      if (boundProductConfig && component !== "general" && !activeComponents.includes(component)) {
        // No incluir este prompt - pertenece a un componente excluido
        return;
      }

      // Si el componente asignado existe en los disponibles, usarlo; sino, poner en general
      if (grouped[component]) {
        grouped[component].push(prompt);
      } else {
        grouped[GENERAL_COMPONENT.value].push(prompt);
      }
    });
    return grouped;
  }, [prompts, availableComponents, getPromptComponent, product, promptDefinitions, promptCellLookup, boundProductConfig, activeComponents]);

  // Contar prompts por componente (solo para habilitar/deshabilitar tabs)
  const countByComponent = useMemo(() => {
    const counts: Record<string, number> = {};
    availableComponents.forEach(comp => {
      counts[comp] = promptsByComponent[comp]?.length || 0;
    });
    return counts;
  }, [promptsByComponent, availableComponents]);

  // Crear un "producto virtual" para cada componente con solo sus prompts
  const createComponentProduct = (componentPrompts: PromptDef[]) => {
    return {
      ...product,
      prompts: componentPrompts.map(p => {
        // Buscar el prompt original en product.prompts para preservar toda la metadata
        const original = (product?.prompts || []).find((op: any) => [op?.id, getPromptCell(op), op?.key, op?.name, op?.code].filter(Boolean).map(String).includes(String(p.id)));
        return original || p;
      })
    };
  };

  // Componentes para pestañas (sin "general") - SOLO mostrar tabs que tengan prompts asignados
  const tabComponents = useMemo(() => {
    return availableComponents
      .filter(c => c !== GENERAL_COMPONENT.value)
      .filter(c => (promptsByComponent[c]?.length || 0) > 0);
  }, [availableComponents, promptsByComponent]);
  const generalPrompts = useMemo(() => promptsByComponent[GENERAL_COMPONENT.value] || [], [promptsByComponent]);
  const initialTab = useMemo(() => {
    for (const comp of tabComponents) {
      if ((countByComponent[comp] || 0) > 0) return comp;
    }
    return tabComponents[0] || "";
  }, [tabComponents, countByComponent]);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Notificar cambio de componente al padre
  useEffect(() => {
    if (onComponentChange && activeTab) {
      onComponentChange(activeTab);
    }
  }, [activeTab, onComponentChange]);

  // Mantener activeTab válido cuando cambien componentes o conteos
  useEffect(() => {
    if (!tabComponents.length) return;
    if (!activeTab || !tabComponents.includes(activeTab)) {
      setActiveTab(initialTab);
    }
  }, [activeTab, tabComponents, initialTab]);

  // Si NO es un producto compuesto (o está cargando), renderizar el formulario normal
  // (pero aseguramos que los hooks se llamen siempre para evitar "Rendered more hooks")
  if (!isComposite || isLoading) {
    // Para productos NO compuestos, también aplicamos el filtro admin_only (sin depender de nombres/labels).
    const productForForm = product ? { ...product, prompts } : product;
    return <PromptsForm product={productForForm} values={values} onChange={onChange} onCommit={onCommit} showAllPrompts={showAllPrompts} />;
  }

  // Si no hay componentes (solo general), mostramos el título y el formulario general a ancho completo
  if (tabComponents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-medium whitespace-nowrap">Configuración del Producto</h3>
        </div>
        {generalPrompts.length > 0 && (
          <PromptsForm 
            product={createComponentProduct(generalPrompts)} 
            values={values} 
            onChange={onChange} 
            onCommit={onCommit} 
            showAllPrompts={showAllPrompts}
            singleColumn
          />
        )}
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
      {/* Header con título y pestañas a la misma altura */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="font-medium whitespace-nowrap">Configuración del producto</h3>

        <TabsList className="flex-wrap h-auto gap-1 md:w-auto">
          {tabComponents.map(comp => {
            const count = countByComponent[comp];
            const labels = getComponentLabels(boundProductConfig);
            const label = labels[comp] || comp;
            return (
              <TabsTrigger 
                key={comp} 
                value={comp} 
                className="relative flex items-center" 
                disabled={count === 0}
              >
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {/* Contenido: dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Columna izquierda: General (siempre visible) */}
        {generalPrompts.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4 self-start">
            <PromptsForm
              product={createComponentProduct(generalPrompts)}
              values={values}
              onChange={onChange}
              onCommit={onCommit}
              showAllPrompts={showAllPrompts}
              singleColumn
            />
          </div>
        )}

        {/* Columna derecha: Componentes con contenido de pestañas */}
        <div className="rounded-lg border border-border bg-card p-4 self-start">
          {tabComponents.map(comp => {
            const componentPrompts = promptsByComponent[comp] || [];
            const labels = getComponentLabels(boundProductConfig);
            return (
              <TabsContent key={comp} value={comp} className="mt-0">
                {componentPrompts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No hay campos asignados a {labels[comp] || comp}.
                  </p>
                ) : (
                  <PromptsForm
                    product={createComponentProduct(componentPrompts)}
                    values={values}
                    onChange={onChange}
                    onCommit={onCommit}
                    showAllPrompts={showAllPrompts}
                    singleColumn
                  />
                )}
              </TabsContent>
            );
          })}
        </div>
      </div>
    </Tabs>
  );
}
