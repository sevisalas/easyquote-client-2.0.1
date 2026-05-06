import { renderQuotePdfFromRawData } from "@/utils/pdfGenerator";
import { portalSupabase } from "@/pages/PortalLogin";

/**
 * Generates and downloads the same PDF as the in-app generator, but for the
 * public client portal. Uses an edge function (`portal-quote-pdf-data`) that
 * validates the portal token and returns the raw data needed to render the
 * configured template (1-9) with the tenant's logo, brand color, footer, etc.
 */
export const generatePortalQuotePDF = async (
  token: string,
  filename: string,
): Promise<void> => {
  const { data, error } = await portalSupabase.functions.invoke(
    "portal-quote-pdf-data",
    { body: { token } },
  );

  if (error) throw new Error(error.message || "No se pudo cargar el presupuesto");
  if (!data || (data as any).error) {
    throw new Error((data as any)?.error || "No se pudo cargar el presupuesto");
  }

  await renderQuotePdfFromRawData(data as any, { filename });
};