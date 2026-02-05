import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";

type EasyQuoteExcelFile = {
  id: string;
  fileName?: string;
  dateModified?: string;
  subscriberId?: string;
  products?: any[];
};

type EasyQuoteProduct = {
  id?: string;
  productId?: string;
  excelFileId?: string;
  excelfileId?: string;
  excel_file_id?: string;
  excelFile?: { id?: string };
  [k: string]: unknown;
};

function isA1CellRef(value: string): boolean {
  return /^[A-Z]+\d+$/i.test(value.trim());
}

function colLettersToIndex(col: string): number {
  const letters = col.toUpperCase();
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseA1(a1: string): { rowIndex: number; colIndex: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(a1.trim());
  if (!m) return null;
  const colIndex = colLettersToIndex(m[1]);
  const rowIndex = Number(m[2]) - 1;
  if (colIndex < 0 || !Number.isFinite(rowIndex) || rowIndex < 0) return null;
  return { rowIndex, colIndex };
}

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function looksLikeUsefulLabel(label: string): boolean {
  const v = label.trim();
  if (!v) return false;
  if (isA1CellRef(v)) return false;
  // Evitar números sueltos
  if (/^\d+(?:[\.,]\d+)?$/.test(v)) return false;
  // Evitar símbolos sueltos
  if (/^[^\p{L}\p{N}]+$/u.test(v)) return false;
  return v.length >= 2;
}

function getCandidateLabelFromSheet(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const at = (r: number, c: number) => {
    if (r < 0 || c < 0) return "";
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = (sheet as any)?.[addr];
    // `w` es el valor formateado; `v` el valor crudo
    return stringifyCell(cell?.w ?? cell?.v ?? "");
  };

  // Caso especial EasyQuote: promptCell en columna B (índice 1) contiene la etiqueta directamente
  // EasyQuote usa B como celda de etiqueta, no como input
  if (col === 1) {
    const selfValue = at(row, col);
    if (looksLikeUsefulLabel(selfValue)) return selfValue;
  }

  // Heurística típica: etiqueta a la izquierda del input
  for (let dx = 1; dx <= 3; dx++) {
    const v = at(row, col - dx);
    if (looksLikeUsefulLabel(v)) return v;
  }

  // Alternativas: arriba / arriba-izquierda
  for (let dy = 1; dy <= 2; dy++) {
    const v1 = at(row - dy, col);
    if (looksLikeUsefulLabel(v1)) return v1;
    const v2 = at(row - dy, col - 1);
    if (looksLikeUsefulLabel(v2)) return v2;
  }

  return null;
}

function tryResolveFromWorkbook(workbook: XLSX.WorkBook, promptCells: string[]): Record<string, string> {
  const wanted = new Set(promptCells.filter(Boolean));
  const out: Record<string, string> = {};

  for (const sheetName of workbook.SheetNames) {
    if (wanted.size === 0) break;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    for (const cell of Array.from(wanted)) {
      const pos = parseA1(cell);
      if (!pos) {
        wanted.delete(cell);
        continue;
      }
      const { rowIndex, colIndex } = pos;
      // IMPORTANTE:
      // No podemos usar sheet_to_json + índices porque el recorte por !ref y los blank rows
      // desplazan los índices y rompen la correspondencia A1.
      const candidate = getCandidateLabelFromSheet(sheet, rowIndex, colIndex);
      if (candidate) {
        out[cell] = candidate;
        wanted.delete(cell);
      }
    }
  }

  return out;
}

function productInFile(file: EasyQuoteExcelFile, productId: string): boolean {
  const products = Array.isArray(file.products) ? file.products : [];
  return products.some((p: any) => {
    const id = p?.id ?? p?.productId ?? p?.product_id;
    return String(id) === String(productId);
  });
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function extractExcelFileIdFromProduct(product: EasyQuoteProduct | null | undefined): string | null {
  if (!product) return null;

  const direct = pickFirstString(
    (product as any).excelFileId,
    (product as any).excelfileId,
    (product as any).excel_file_id,
    (product as any).ExcelFileId,
    (product as any).ExcelFileID,
  );
  if (direct) return direct;

  const nested = pickFirstString((product as any)?.excelFile?.id, (product as any)?.ExcelFile?.id);
  return nested ?? null;
}

async function getExcelFileDetailsForProduct(params: {
  token: string;
  productId: string;
}): Promise<{ fileId: string; fileName?: string; subscriberId?: string; dateModified?: string } | null> {
  const { token, productId } = params;

  // 1) Encontrar el Excel asociado al producto (fuente: products)
  const productsRes = await invokeEasyQuoteFunction<EasyQuoteProduct[]>("easyquote-products", {
    token,
    includeInactive: true,
  });
  if (productsRes.error) return null;

  const products = Array.isArray(productsRes.data) ? productsRes.data : [];
  const product = products.find((p) => String(p?.id ?? p?.productId) === String(productId));
  const fileId = extractExcelFileIdFromProduct(product);
  if (!fileId) return null;

  // 2) Pedir detalle del excel (suele traer fileName/subscriberId/dateModified)
  const fileRes = await invokeEasyQuoteFunction<any>("easyquote-excel-files", {
    token,
    fileId,
  });
  if (fileRes.error) return null;

  const file = fileRes.data ?? {};
  const fileName = pickFirstString(file.fileName, file.FileName, file.filename, file.name);
  const subscriberId = pickFirstString(file.subscriberId, file.subscriberID, file.subscriber_id, file.SubscriberId);
  const dateModified = pickFirstString(file.dateModified, file.DateModified, file.modifiedAt, file.updatedAt);

  return { fileId, fileName, subscriberId, dateModified };
}

async function downloadExcelAsArrayBuffer(params: {
  token: string;
  fileId: string;
  subscriberId?: string;
  fileName?: string;
}): Promise<ArrayBuffer> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sesión no válida (falta token de Supabase)");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/easyquote-download-file`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      token: params.token,
      fileId: params.fileId,
      subscriberId: params.subscriberId,
      fileName: params.fileName,
    }),
  });

  if (!res.ok) {
    // Intentar leer JSON, si no, texto
    const text = await res.text();
    throw new Error(text || `No se pudo descargar el Excel (${res.status})`);
  }

  return await res.arrayBuffer();
}

/**
 * Resuelve labels “humanos” a partir del Excel real (source of truth), usando promptCell (A1).
 * Cachea por (fileId + dateModified) para que se invalide automáticamente al cambiar el Excel.
 */
export async function resolveLivePromptCellLabels(params: {
  token: string;
  productId: string;
  promptCells: string[];
}): Promise<Record<string, string>> {
  const { token, productId, promptCells } = params;
  const uniqueCells = Array.from(new Set(promptCells.filter(Boolean)));
  if (!token || !productId || uniqueCells.length === 0) return {};

  // Estrategia principal: producto -> excelFileId -> excel file detail
  let excelDetails = await getExcelFileDetailsForProduct({ token, productId });

  // Fallback legacy: intentar inferir relación producto→excel mediante "products" dentro del listado de excel files
  if (!excelDetails) {
    const excelFilesRes = await invokeEasyQuoteFunction<EasyQuoteExcelFile[]>("easyquote-excel-files", {
      token,
    });
    if (!excelFilesRes.error) {
      const files = Array.isArray(excelFilesRes.data) ? excelFilesRes.data : [];
      const file = files.find((f) => productInFile(f, productId));
      if (file?.id) {
        // Intentar enriquecer con el detalle del archivo (para obtener subscriberId/fileName/dateModified)
        const detailRes = await invokeEasyQuoteFunction<any>("easyquote-excel-files", {
          token,
          fileId: file.id,
        });
        const detail = !detailRes.error ? (detailRes.data ?? {}) : {};

        excelDetails = {
          fileId: file.id,
          fileName: pickFirstString(file.fileName, detail.fileName, detail.FileName, detail.filename, detail.name),
          subscriberId: pickFirstString(file.subscriberId, detail.subscriberId, detail.subscriberID, detail.subscriber_id),
          dateModified: pickFirstString(file.dateModified, detail.dateModified, detail.DateModified, detail.modifiedAt, detail.updatedAt),
        };
      }
    }
  }

  if (!excelDetails?.fileId) return {};
  const subscriberId = excelDetails.subscriberId;
  const fileName = excelDetails.fileName;
  // Ojo: algunos entornos no devuelven subscriberId/fileName en listados; la edge function puede resolverlo por fileId.

  const cacheKey = excelDetails.dateModified
    ? `easyquote:excel-prompt-labels:${excelDetails.fileId}:${excelDetails.dateModified}`
    : null;
  if (cacheKey) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          const obj = parsed as Record<string, string>;
          // Importante: NO aceptar cachés vacías (pueden venir de intentos fallidos y bloquean futuras resoluciones)
          if (Object.keys(obj).length > 0) return obj;
        }
      }
    } catch {
      // ignore
    }
  }

  const arrayBuffer = await downloadExcelAsArrayBuffer({
    token,
    fileId: excelDetails.fileId,
    subscriberId,
    fileName,
  });

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const labelMap = tryResolveFromWorkbook(workbook, uniqueCells);

  if (cacheKey) {
    try {
      // No cachear mapas vacíos (evita que un fallo temporal congele el resultado)
      if (labelMap && Object.keys(labelMap).length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(labelMap));
      }
    } catch {
      // ignore
    }
  }

  return labelMap;
}
