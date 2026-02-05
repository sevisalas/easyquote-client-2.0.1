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

function getCandidateLabel(rows: any[][], row: number, col: number): string | null {
  const at = (r: number, c: number) => stringifyCell(rows?.[r]?.[c]);

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

    // Matriz 2D para acceso rápido por fila/columna
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as any[][];

    for (const cell of Array.from(wanted)) {
      const pos = parseA1(cell);
      if (!pos) {
        wanted.delete(cell);
        continue;
      }
      const { rowIndex, colIndex } = pos;
      const candidate = getCandidateLabel(rows, rowIndex, colIndex);
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

async function downloadExcelAsArrayBuffer(params: {
  token: string;
  subscriberId: string;
  fileId: string;
  fileName: string;
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
      subscriberId: params.subscriberId,
      fileId: params.fileId,
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

  const excelFilesRes = await invokeEasyQuoteFunction<EasyQuoteExcelFile[]>("easyquote-excel-files", {
    token,
  });
  if (excelFilesRes.error) return {};
  const files = Array.isArray(excelFilesRes.data) ? excelFilesRes.data : [];

  const file = files.find((f) => productInFile(f, productId));
  if (!file?.id) return {};

  // Necesarios para descargar
  const subscriberId = file.subscriberId;
  const fileName = file.fileName;
  if (!subscriberId || !fileName) return {};

  const cacheKey = `easyquote:excel-prompt-labels:${file.id}:${file.dateModified ?? "0"}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    // ignore
  }

  const arrayBuffer = await downloadExcelAsArrayBuffer({
    token,
    subscriberId,
    fileId: file.id,
    fileName,
  });

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const labelMap = tryResolveFromWorkbook(workbook, uniqueCells);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(labelMap));
  } catch {
    // ignore
  }

  return labelMap;
}
