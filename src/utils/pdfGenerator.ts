import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { resolveApprovedQuoteItemState } from '@/utils/approvedMultiQuantity';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getEasyQuoteToken, invokeEasyQuoteFunction } from '@/lib/easyquoteApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { paginateTemplate7Items } from '@/components/templates/template7Pagination';

const parsePositiveQuantity = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseLocaleNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseOptionalLocaleNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = parseLocaleNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateMultiRowAdditionalsTotal = (
  additionals: any[],
  qty: number,
  rowIndex: number,
  rawBasePrice: number
): number => {
  if (!Array.isArray(additionals) || additionals.length === 0) return 0;

  return additionals.reduce((sum, additional) => {
    const rawValue = additional?.type === 'net_amount' && Array.isArray(additional?.multiValues)
      ? additional.multiValues[rowIndex] ?? additional.value
      : additional?.value;

    const absoluteValue = Math.abs(parseLocaleNumber(rawValue));
    const isDiscount = additional?.is_discount === true || parseLocaleNumber(rawValue) < 0;

    let subtotal = absoluteValue;

    if (additional?.type === 'percentage') {
      subtotal = (Math.abs(rawBasePrice) * absoluteValue) / 100;
    } else if (additional?.type === 'quantity_multiplier') {
      subtotal = absoluteValue * qty;
    } else if (additional?.type === 'capacity_divider') {
      const capacity = parsePositiveQuantity(additional?.capacity_value) ?? 1;
      subtotal = absoluteValue * Math.ceil(qty / capacity);
    }

    return sum + (isDiscount ? -subtotal : subtotal);
  }, 0);
};

export interface PDFGeneratorOptions {
  filename?: string;
  quality?: number;
}

const PDF_IMAGE_CACHE = new Map<string, Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null>>();

const formatPdfDate = (value?: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy', { locale: es }) : '-';

const formatPdfCurrency = (amount: number) => {
  const parts = Number(amount || 0).toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intPart},${parts[1]} €`;
};

const stripHtmlToPlainText = (value: string) => {
  if (!value) return '';
  const container = document.createElement('div');
  container.innerHTML = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n');
  return (container.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getTemplate9CustomerLines = (customer: any): string[] => {
  const lines: string[] = [];
  if (customer?.name) lines.push(customer.name);
  if (customer?.tax_id) lines.push(customer.tax_id);

  if (customer?.address) {
    const parts = String(customer.address)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (parts.length >= 4) {
      const street = parts.slice(0, -3).join(', ');
      const cpCity = `${parts[parts.length - 2] || ''} ${parts[parts.length - 3] || ''}`.trim();
      const provCountry = [parts[parts.length - 1]].filter(Boolean).join(', ');
      if (street) lines.push(street);
      if (cpCity) lines.push(cpCity);
      if (provCountry) lines.push(provCountry);
    } else {
      lines.push(String(customer.address));
    }
  }

  return lines;
};

const loadImageForPdf = async (url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> => {
  if (!url) return null;
  const absoluteUrl = /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).toString();

  if (!PDF_IMAGE_CACHE.has(absoluteUrl)) {
    PDF_IMAGE_CACHE.set(absoluteUrl, (async () => {
      try {
        const response = await fetch(absoluteUrl);
        if (!response.ok) return null;

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        try {
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = objectUrl;
          });

          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;

          ctx.drawImage(image, 0, 0);
          const isPng = blob.type.includes('png');
          return {
            dataUrl: canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.72),
            format: isPng ? 'PNG' : 'JPEG',
          };
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        return null;
      }
    })());
  }

  return PDF_IMAGE_CACHE.get(absoluteUrl)!;
};

const renderWrappedText = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    fontSize?: number;
    lineHeight?: number;
    style?: 'normal' | 'bold';
    color?: [number, number, number];
    align?: 'left' | 'right' | 'center';
  } = {}
) => {
  const {
    fontSize = 10.5,
    lineHeight = 4.2,
    style = 'normal',
    color = [26, 26, 26],
    align = 'left',
  } = options;

  pdf.setFont('helvetica', style);
  pdf.setFontSize(fontSize);
  pdf.setTextColor(color[0], color[1], color[2]);

  let cursorY = y;
  const paragraphs = String(text ?? '').replace(/\r/g, '').split('\n');

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = paragraph ? pdf.splitTextToSize(paragraph, maxWidth) : [''];
    lines.forEach((line: string) => {
      if (align === 'left') {
        pdf.text(line, x, cursorY);
      } else {
        pdf.text(line, x, cursorY, { align });
      }
      cursorY += lineHeight;
    });

    if (paragraphIndex < paragraphs.length - 1) cursorY += 0.4;
  });

  return cursorY;
};

const renderTemplate9VectorPdf = async (pdf: jsPDF, templateData: any) => {
  const quote = templateData.quote || {};
  const customer = templateData.customer || {};
  const items = templateData.items || [];
  const quoteAdditionals = templateData.quote_additionals || [];
  const pages = paginateTemplate7Items({ items, quote, quoteAdditionals, reserveFooterShare: 0.22 });
  const customerLines = getTemplate9CustomerLines(customer);
  const logo = await loadImageForPdf('/assets/campillo-logo.png?v=20260224c');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;
  const qtyColumnWidth = 26;
  const priceColumnWidth = 42;
  const conceptColumnWidth = contentWidth - qtyColumnWidth - priceColumnWidth;
  const qtyColumnX = marginX + conceptColumnWidth + qtyColumnWidth;
  const priceColumnX = pageWidth - marginX;
  const footerTopY = pageHeight - 20;

  const drawFooter = (pageIndex: number) => {
    pdf.setDrawColor(229, 229, 229);
    pdf.line(marginX, footerTopY, pageWidth - marginX, footerTopY);

    renderWrappedText(pdf, 'Inscrita en el Reg. Merc. nº de Madrid. Tomo 781, General, de la Sección 3ª, Folio 37, Hoja 67855-1, Inscripción 1ª.', pageWidth / 2, footerTopY + 4.5, contentWidth, {
      fontSize: 8.5,
      lineHeight: 3.6,
      color: [122, 122, 122],
      align: 'center',
    });
    renderWrappedText(pdf, 'CAMPILLO NEVADO S.A. A78094166 c/ Desierto de tabernas, 8', pageWidth / 2, footerTopY + 8.2, contentWidth, {
      fontSize: 8.5,
      lineHeight: 3.6,
      color: [122, 122, 122],
      align: 'center',
    });
    renderWrappedText(pdf, 'Pinto (28320), Madrid, España +34 91 560 93 34 contabilidad@campillonevado.es', pageWidth / 2, footerTopY + 11.9, contentWidth, {
      fontSize: 8.5,
      lineHeight: 3.6,
      color: [122, 122, 122],
      align: 'center',
    });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(122, 122, 122);
    pdf.text(`${pageIndex + 1}/${pages.length}`, pageWidth - marginX, pageHeight - 4, { align: 'right' });
  };

  const renderItemImage = async (item: any, x: number, y: number) => {
    const firstImage = Array.isArray(item.images) ? item.images[0] : null;
    if (!firstImage) return 0;
    const image = await loadImageForPdf(firstImage);
    if (!image) return 0;
    try {
      pdf.addImage(image.dataUrl, image.format, x, y, 8, 8);
      return 10;
    } catch {
      return 0;
    }
  };

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) pdf.addPage();
    const page = pages[pageIndex];
    const isLastPage = pageIndex === pages.length - 1;

    if (quote.status === 'draft') {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(64);
      pdf.setTextColor(236, 236, 236);
      pdf.text('BORRADOR', pageWidth / 2, pageHeight / 2, { align: 'center', angle: -45 });
    }

    if (logo) {
      try {
        pdf.addImage(logo.dataUrl, logo.format, marginX, 8, 60, 18);
      } catch {
      }
    }

    renderWrappedText(pdf, 'PRESUPUESTO', pageWidth - marginX, 14, 60, {
      fontSize: 24,
      lineHeight: 8,
      style: 'normal',
      color: [58, 58, 58],
      align: 'right',
    });
    renderWrappedText(pdf, quote.quote_number || '-', pageWidth - marginX, 21.5, 60, {
      fontSize: 12,
      lineHeight: 4.8,
      color: [154, 154, 154],
      align: 'right',
    });

    const metaLines = [
      `Fecha: ${formatPdfDate(quote.created_at)}`,
      ...(quote.valid_until ? [`Fecha vencimiento: ${formatPdfDate(quote.valid_until)}`] : []),
      `Ref: ${quote.reference || ''}`,
    ];

    let leftMetaY = 38;
    metaLines.forEach((line) => {
      leftMetaY = renderWrappedText(pdf, line, marginX, leftMetaY, 82, {
        fontSize: 10.8,
        lineHeight: 4.2,
        color: [58, 58, 58],
      });
    });

    let customerY = 38;
    customerLines.forEach((line, index) => {
      customerY = renderWrappedText(pdf, line, 132, customerY, 70, {
        fontSize: index === 0 ? 11.5 : 10.8,
        lineHeight: 4,
        style: index === 0 ? 'bold' : 'normal',
        color: [58, 58, 58],
      });
    });

    let cursorY = Math.max(leftMetaY, customerY) + 4;

    if (quote.title || quote.description) {
      if (quote.title) {
        cursorY = renderWrappedText(pdf, quote.title, marginX, cursorY, contentWidth, {
          fontSize: 12.5,
          lineHeight: 4.4,
          style: 'bold',
          color: [26, 26, 26],
        });
      }
      if (quote.description) {
        cursorY = renderWrappedText(pdf, quote.description, marginX, cursorY + 0.8, contentWidth, {
          fontSize: 10.5,
          lineHeight: 4,
          color: [68, 68, 68],
        });
      }
      cursorY += 2;
    }

    pdf.setFillColor(243, 243, 243);
    pdf.rect(marginX, cursorY, contentWidth, 8, 'F');
    pdf.setDrawColor(229, 229, 229);
    pdf.line(marginX, cursorY + 8, pageWidth - marginX, cursorY + 8);
    renderWrappedText(pdf, 'CONCEPTO', marginX + 2, cursorY + 5.1, 60, { fontSize: 10.5, style: 'bold', color: [58, 58, 58] });
    renderWrappedText(pdf, 'UNIDADES', qtyColumnX - 2, cursorY + 5.1, qtyColumnWidth, { fontSize: 10.5, style: 'bold', color: [58, 58, 58], align: 'right' });
    renderWrappedText(pdf, 'SUBTOTAL', priceColumnX - 2, cursorY + 5.1, priceColumnWidth, { fontSize: 10.5, style: 'bold', color: [58, 58, 58], align: 'right' });
    cursorY += 11;

    for (const item of page.items) {
      const customPriceNum = parseFloat(String(item.price ?? 0).toString().replace(/\./g, '').replace(',', '.')) || 0;
      const hideItemAmounts = item.isCustomProduct === true && customPriceNum <= 0;
      const imageOffset = await renderItemImage(item, marginX + 2, cursorY - 0.5);
      const textStartX = marginX + 2 + imageOffset;
      const textWidth = conceptColumnWidth - 6 - imageOffset;

      cursorY = renderWrappedText(pdf, item.name || 'Producto', textStartX, cursorY + 3.4, textWidth, {
        fontSize: 11.3,
        lineHeight: 4,
        style: 'bold',
        color: [26, 26, 26],
      });

      const detailLines: string[] = [];

      if ((!item.prompts || item.prompts.length === 0) && item.description) {
        detailLines.push(...String(item.description).split(/\r?\n/));
      }

      if (Array.isArray(item.prompts)) {
        item.prompts.forEach((prompt: any) => {
          detailLines.push(`${String(prompt.label || '').toUpperCase()}: ${prompt.value ?? ''}`);
        });
      }

      if (Array.isArray(item.components)) {
        item.components.forEach((component: any) => {
          detailLines.push(`── ${component.alias} ──`);
          (component.prompts || []).forEach((prompt: any) => {
            detailLines.push(`  ${prompt.label}: ${prompt.value ?? ''}`);
          });
        });
      }

      if (Array.isArray(item.item_additionals)) {
        item.item_additionals.forEach((adj: any) => {
          const qty = item.displayQuantity ?? item.quantity ?? 1;
          const numQty = typeof qty === 'string' ? parseFloat(qty.replace(/\./g, '').replace(',', '.')) : (qty || 1);
          let subtotal = adj.value;
          let detail = '';
          if (adj.type === 'percentage') {
            const itemPrice = parseFloat(String(item.price || 0).replace(/\./g, '').replace(',', '.')) || 0;
            subtotal = (itemPrice * adj.value) / 100;
            detail = ` (${adj.value}%)`;
          } else if (adj.type === 'quantity_multiplier') {
            subtotal = adj.value * numQty;
            detail = ` (${adj.value} €/ud × ${numQty})`;
          } else if (adj.type === 'capacity_divider') {
            const cap = adj.capacity_value || 1;
            const units = Math.ceil(numQty / cap);
            subtotal = adj.value * units;
            detail = ` (${adj.value} € × ${units} uds)`;
          }
          detailLines.push(`${adj.name}: ${formatPdfCurrency(subtotal)}${detail}`);
        });
      }

      if (detailLines.length > 0) {
        cursorY = renderWrappedText(pdf, detailLines.join('\n'), marginX + 6, cursorY + 0.6, conceptColumnWidth - 10, {
          fontSize: 10.2,
          lineHeight: 3.8,
          color: [85, 85, 85],
        });
      }

      const quantity = item.displayQuantity != null && item.displayQuantity !== '' ? item.displayQuantity : item.quantity;
      if (!hideItemAmounts && quantity != null && quantity !== '') {
        const numericQuantity = typeof quantity === 'string'
          ? parseFloat(String(quantity).replace(/\./g, '').replace(',', '.'))
          : quantity;
        const quantityLabel = Number.isFinite(numericQuantity)
          ? new Intl.NumberFormat('es-ES').format(numericQuantity as number)
          : String(quantity);
        renderWrappedText(pdf, quantityLabel, qtyColumnX - 2, cursorY + 0.6, qtyColumnWidth, {
          fontSize: 10.8,
          lineHeight: 3.8,
          color: [58, 58, 58],
          align: 'right',
        });
        renderWrappedText(pdf, formatPdfCurrency(item.price || 0), priceColumnX - 2, cursorY + 0.6, priceColumnWidth, {
          fontSize: 10.8,
          lineHeight: 3.8,
          style: 'bold',
          color: [26, 26, 26],
          align: 'right',
        });
      }

      cursorY += 5.4;

      if (!hideItemAmounts && Array.isArray(item.multi_extra)) {
        item.multi_extra.forEach((row: any) => {
          renderWrappedText(pdf, new Intl.NumberFormat('es-ES').format(row.qty), qtyColumnX - 2, cursorY, qtyColumnWidth, {
            fontSize: 10.8,
            lineHeight: 3.8,
            color: [58, 58, 58],
            align: 'right',
          });
          renderWrappedText(pdf, formatPdfCurrency(row.price || 0), priceColumnX - 2, cursorY, priceColumnWidth, {
            fontSize: 10.8,
            lineHeight: 3.8,
            style: 'bold',
            color: [26, 26, 26],
            align: 'right',
          });
          cursorY += 4.3;
        });
      }

      pdf.setDrawColor(229, 229, 229);
      pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 3;
    }

    if (page.showSummary && quoteAdditionals.length > 0) {
      quoteAdditionals.forEach((adj: any) => {
        let amount = adj.value;
        let label = adj.name;
        if (adj.type === 'percentage') {
          amount = ((quote.subtotal || 0) * adj.value) / 100;
          label = `${adj.name} (${adj.value}%)`;
        }
        renderWrappedText(pdf, label, marginX + 2, cursorY + 1.4, conceptColumnWidth + qtyColumnWidth - 4, {
          fontSize: 10.5,
          lineHeight: 4,
          color: [85, 85, 85],
        });
        renderWrappedText(pdf, formatPdfCurrency(amount), priceColumnX - 2, cursorY + 1.4, priceColumnWidth, {
          fontSize: 10.5,
          lineHeight: 4,
          style: 'bold',
          align: 'right',
        });
        cursorY += 5.2;
        pdf.line(marginX, cursorY - 1.1, pageWidth - marginX, cursorY - 1.1);
      });
      cursorY += 2.2;
    }

    if (page.showSummary && (items.length > 0 || quote.tax_amount > 0)) {
      pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 4;

      const baseX = pageWidth / 2;
      renderWrappedText(pdf, 'BASE IMPONIBLE', pageWidth * 0.25, cursorY, 50, { fontSize: 10.5, style: 'bold', color: [58, 58, 58], align: 'center' });
      renderWrappedText(pdf, 'TOTAL', pageWidth * 0.75, cursorY, 50, { fontSize: 10.5, style: 'bold', color: [58, 58, 58], align: 'center' });
      cursorY += 4.8;
      pdf.line(marginX, cursorY - 1.2, pageWidth - marginX, cursorY - 1.2);

      renderWrappedText(pdf, formatPdfCurrency(quote.subtotal || quote.final_price || 0), pageWidth * 0.25, cursorY + 1, 50, { fontSize: 11, color: [26, 26, 26], align: 'center' });
      renderWrappedText(pdf, formatPdfCurrency((Number(quote.subtotal || quote.final_price || 0)) - Number(quote.discount_amount || 0)), pageWidth * 0.75, cursorY + 1, 50, { fontSize: 11, color: [26, 26, 26], align: 'center' });
      cursorY += 6;
      renderWrappedText(pdf, formatPdfCurrency(quote.subtotal || quote.final_price || 0), pageWidth * 0.25, cursorY, 50, { fontSize: 12.5, style: 'bold', color: [26, 26, 26], align: 'center' });
      renderWrappedText(pdf, formatPdfCurrency((Number(quote.subtotal || quote.final_price || 0)) - Number(quote.discount_amount || 0)), pageWidth * 0.75, cursorY, 50, { fontSize: 12.5, style: 'bold', color: [26, 26, 26], align: 'center' });
      cursorY += 7.5;
    }

    if (page.showNotes && quote.notes) {
      cursorY = renderWrappedText(pdf, 'NOTAS', marginX, cursorY + 1.5, contentWidth, {
        fontSize: 10.5,
        style: 'bold',
        color: [26, 26, 26],
      });
      cursorY = renderWrappedText(pdf, quote.notes, marginX, cursorY, contentWidth, {
        fontSize: 10.2,
        lineHeight: 3.8,
        color: [68, 68, 68],
      });
    }

    if (isLastPage && templateData.config?.footerText) {
      const footerText = stripHtmlToPlainText(templateData.config.footerText);
      if (footerText) {
        renderWrappedText(pdf, footerText, marginX, Math.min(cursorY + 4, footerTopY - 12), contentWidth, {
          fontSize: 10.2,
          lineHeight: 3.8,
          color: [58, 58, 58],
        });
      }
    }

    drawFooter(pageIndex);
  }
};

// Get saved template configuration from Supabase
const getTemplateConfig = async (overrideOrgId?: string | null) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const defaults = {
    selectedTemplate: 1,
    companyName: '',
    logoUrl: '',
    brandColor: '#0ea5e9',
    footerText: '',
    termsPageText: ''
  };
  
  if (!user) return defaults;

  // Use override org if provided (from quote data), else fallback to sessionStorage
  let orgId: string | null = overrideOrgId || null;
  if (!orgId) {
    const stored = sessionStorage.getItem('selectedOrganization');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        orgId = parsed.id || null;
      } catch { /* ignore */ }
    }
  }
  
  // Fallback: resolve org via DB if not in sessionStorage
  if (!orgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('api_user_id', user.id)
      .limit(1);
    
    if (orgData && orgData.length > 0) {
      orgId = orgData[0].id;
    } else {
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);
      
      if (memberData && memberData.length > 0) {
        orgId = memberData[0].organization_id;
      }
    }
  }
  
  console.log('[PDF] getTemplateConfig orgId:', orgId, 'userId:', user.id);
  
  // Query by organization only (shared config for all members)
  if (!orgId) return defaults;
  
  const { data, error } = await supabase
    .from('pdf_configurations')
    .select('*')
    .eq('organization_id', orgId)
    .limit(1)
    .maybeSingle();
  
  console.log('[PDF] getTemplateConfig result:', { data: data ? { company_name: data.company_name, selected_template: data.selected_template } : null, error });
  
  if (!error && data) {
    return {
      selectedTemplate: data.selected_template || 1,
      companyName: data.company_name || '',
      logoUrl: data.logo_url || '',
      brandColor: data.brand_color || '#0ea5e9',
      footerText: data.footer_text || '',
      termsPageText: data.terms_page_text || ''
    };
  }
  
  // If maybeSingle failed (e.g. multiple rows), try with limit
  if (error && orgId) {
    const { data: fallbackData } = await supabase
      .from('pdf_configurations')
      .select('*')
      .eq('organization_id', orgId)
      .limit(1);
    
    if (fallbackData && fallbackData.length > 0) {
      const d = fallbackData[0];
      return {
        selectedTemplate: d.selected_template || 1,
        companyName: d.company_name || '',
        logoUrl: d.logo_url || '',
        brandColor: d.brand_color || '#0ea5e9',
        footerText: d.footer_text || '',
        termsPageText: d.terms_page_text || ''
      };
    }
  }
  
  return defaults;
};

// Check if a string looks like an Excel cell reference (e.g., B19, C5)
const isCellRef = (v: string) => /^[A-Z]+\d+$/i.test(v.trim());

// Get prompt settings for hiding in documents (quotes only)
const getHiddenPromptSettings = async (overrideOrgId?: string | null): Promise<Map<string, Set<string>>> => {
  // Prioritize explicit org (document org), fallback to session org
  let orgId: string | null = overrideOrgId || null;
  if (!orgId) {
    const stored = sessionStorage.getItem('selectedOrganization');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        orgId = parsed.id || null;
      } catch {
        // continue to fallback
      }
    }
  }
  
  // Fallback: query from Supabase if not in sessionStorage
  if (!orgId) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('api_user_id', userData.user.id)
        .limit(1);
      
      if (orgData && orgData.length > 0) {
        orgId = orgData[0].id;
      } else {
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userData.user.id)
          .limit(1);
        
        if (memberData && memberData.length > 0) {
          orgId = memberData[0].organization_id;
        }
      }
    }
  }
  
  if (!orgId) return new Map();
  
  // Obtener api_user_id de la organización para buscar configuración compartida
  const { data: orgInfo } = await supabase
    .from('organizations')
    .select('api_user_id')
    .eq('id', orgId)
    .single();
  
  if (!orgInfo?.api_user_id) return new Map();
  
  // Fetch prompts that should be hidden in documents: hide_in_documents OR admin_only
  const { data: settings, error } = await supabase
    .from('product_prompt_settings')
    .select('easyquote_product_id, prompt_name, label')
    .eq('api_user_id', orgInfo.api_user_id)
    .or('hide_in_documents.eq.true,admin_only.eq.true');

  if (error || !settings) return new Map();
  
  const normalize = (v: string) => String(v ?? '').replace(/\$/g, '').trim().toUpperCase();
  
  const hiddenMap = new Map<string, Set<string>>();
  
  // Find products that need label resolution (cell-ref-only labels)
  const productsNeedingResolution = new Set<string>();
  settings.forEach((s: any) => {
    if (!s.label || s.label === s.prompt_name || isCellRef(s.label)) {
      productsNeedingResolution.add(s.easyquote_product_id);
    }
  });
  
  // Try to resolve cell ref labels via EasyQuote API
  const cellRefToLabel = new Map<string, Map<string, string>>(); // productId -> (cellRef -> humanLabel)
  if (productsNeedingResolution.size > 0) {
    try {
      const token = await getEasyQuoteToken();
      if (token) {
        await Promise.all(
          Array.from(productsNeedingResolution).map(async (productId) => {
            try {
              // Call BOTH APIs in parallel:
              // 1. easyquote-prompts → returns {id: UUID, promptCell: cellRef} (NO promptText)
              // 2. easyquote-pricing → returns {id: UUID, promptText: humanLabel} (HAS promptText)
              const [promptsResult, pricingResult] = await Promise.all([
                invokeEasyQuoteFunction<any[]>('easyquote-prompts', { token, productId }),
                invokeEasyQuoteFunction<any>('easyquote-pricing', { token, productId }),
              ]);
              
              // Build UUID → humanLabel map from pricing API
              const uuidToHumanLabel = new Map<string, string>();
              const pricingPrompts = pricingResult.data?.prompts || [];
              if (Array.isArray(pricingPrompts)) {
                pricingPrompts.forEach((p: any) => {
                  if (p?.id && p?.promptText) {
                    uuidToHumanLabel.set(String(p.id).trim(), String(p.promptText).trim());
                  }
                });
              }
              
              const prompts = promptsResult.data;
              if (Array.isArray(prompts)) {
                const map = new Map<string, string>();
                prompts.forEach((p: any) => {
                  const cell = p.promptCell || p.id;
                  const uuid = String(p.id || '').trim();
                  // Get human label from pricing API (prompts/list doesn't have promptText)
                  const label = uuidToHumanLabel.get(uuid) || p.promptText || p.label || p.name;
                  if (cell && label && label !== cell && !isCellRef(label)) {
                    map.set(normalize(cell), label);
                  }
                });
                cellRefToLabel.set(productId, map);
                
                // Backfill labels in DB for future use
                const labelsToUpdate: { promptName: string; label: string }[] = [];
                settings.filter((s: any) => s.easyquote_product_id === productId).forEach((s: any) => {
                  if (!s.label || s.label === s.prompt_name || isCellRef(s.label)) {
                    const humanLabel = map.get(normalize(s.prompt_name));
                    if (humanLabel) {
                      labelsToUpdate.push({ promptName: s.prompt_name, label: humanLabel });
                    }
                  }
                });
                if (labelsToUpdate.length > 0) {
                  await Promise.all(labelsToUpdate.map(({ promptName, label }) =>
                    supabase.from('product_prompt_settings')
                      .update({ label })
                      .eq('easyquote_product_id', productId)
                      .eq('prompt_name', promptName)
                      .eq('api_user_id', orgInfo.api_user_id)
                  ));
                }
              }
            } catch (e) {
              console.warn(`[PDF] Could not resolve labels for product ${productId}:`, e);
            }
          })
        );
      }
    } catch (e) {
      console.warn('[PDF] Could not get EasyQuote token for label resolution:', e);
    }
  }
  
  // Build hidden map with resolved labels
  settings.forEach((s: any) => {
    if (!hiddenMap.has(s.easyquote_product_id)) {
      hiddenMap.set(s.easyquote_product_id, new Set());
    }
    const set = hiddenMap.get(s.easyquote_product_id)!;
    set.add(normalize(s.prompt_name));
    
    // Add human label if available and real
    if (s.label && s.label !== s.prompt_name && !isCellRef(s.label)) {
      set.add(normalize(s.label));
    }
    
    // Add resolved label from API if we have it
    const resolvedMap = cellRefToLabel.get(s.easyquote_product_id);
    if (resolvedMap) {
      const resolved = resolvedMap.get(normalize(s.prompt_name));
      if (resolved) {
        set.add(normalize(resolved));
      }
    }
  });
  
  return hiddenMap;
};

export const normalizeDescriptionLabel = (value: string): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const isDescriptionLabelHidden = (label: string, hiddenKeys: Set<string>): boolean => {
  if (!hiddenKeys || hiddenKeys.size === 0) return false;

  const normalizedLabel = normalizeDescriptionLabel(label);
  if (!normalizedLabel) return false;

  const normalizedHiddenKeys = Array.from(hiddenKeys)
    .map((key) => normalizeDescriptionLabel(key))
    .filter(Boolean);

  // Extract "base token" of the description label: first word(s) before any
  // parenthesis or unit suffix. Example:
  //   "Lomo mm"        -> "LOMO"
  //   "Lomo (entrada)" -> "LOMO"
  //   "Ancho cms."     -> "ANCHO"
  // This lets us match settings whose stored label diverged from the live
  // EasyQuote promptText (e.g. "Lomo (entrada)" hidden -> still hides
  // "Lomo mm" rendered in the document).
  const baseToken = (s: string): string => {
    const stripped = s.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped.split(' ')[0] ?? '';
  };

  const labelBase = baseToken(normalizedLabel);

  return normalizedHiddenKeys.some((hidden) => {
    // Exact label match
    if (hidden === normalizedLabel) return true;

    // Hide variants with suffixes (e.g. "Lomo" -> "Lomo mm")
    if (normalizedLabel.startsWith(`${hidden} `)) return true;

    // Match by base token (first word before parens/units).
    // Only when the base token is meaningful (>= 3 chars) to avoid
    // false positives on tiny generic words.
    const hiddenBase = baseToken(hidden);
    if (hiddenBase && labelBase && hiddenBase.length >= 3 && hiddenBase === labelBase) {
      return true;
    }

    return false;
  });
};

export const sanitizeDescriptionForDocs = (
  description: string,
  parentHiddenKeys: Set<string>,
  componentHiddenByAlias: Map<string, Set<string>>
): string => {
  if (!description) return '';

  const cleaned: string[] = [];
  let currentSectionAlias = '__PARENT__';

  for (const rawLine of description.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      cleaned.push(rawLine);
      continue;
    }

    const sectionMatch = line.match(/^─+\s*(.+?)\s*─+$/);
    if (sectionMatch) {
      currentSectionAlias = normalizeDescriptionLabel(sectionMatch[1]);
      cleaned.push(rawLine);
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      cleaned.push(rawLine);
      continue;
    }

    const label = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (!value) {
      cleaned.push(rawLine);
      continue;
    }
    if (value.toLowerCase() === 'no') continue;

    const activeHiddenKeys = currentSectionAlias === '__PARENT__'
      ? parentHiddenKeys
      : (componentHiddenByAlias.get(currentSectionAlias) ?? new Set<string>());

    if (isDescriptionLabelHidden(label, activeHiddenKeys)) continue;

    cleaned.push(rawLine);
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Generate PDF from a quote ID
export const generateQuotePDF = async (
  quoteId: string,
  options: PDFGeneratorOptions = {}
): Promise<void> => {
  const { 
    filename = 'presupuesto.pdf', 
    quality = 2 
  } = options;

  try {
    // Fetch quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        items:quote_items(*),
        quote_additionals:quote_additionals(*)
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;

    // Fetch customer data separately if exists
    let customer = null;
    if (quote.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', quote.customer_id)
        .maybeSingle();
      
      if (!customerError) {
        customer = customerData;
      }
    }

    // Get template configuration using the quote's own organization_id
    const config = await getTemplateConfig(quote.organization_id);

    // Get hidden prompt settings for this quote org
    const hiddenPromptSettings = await getHiddenPromptSettings(quote.organization_id);

    // Check organization-level flag: hide ALL prompts in documents
    let hideAllPromptsInDocs = false;
    if (quote.organization_id) {
      const { data: orgFlags } = await supabase
        .from('organizations')
        .select('hide_all_prompts_in_documents')
        .eq('id', quote.organization_id)
        .single();
      hideAllPromptsInDocs = orgFlags?.hide_all_prompts_in_documents === true;
    }
    console.log('[PDF] hideAllPromptsInDocs:', hideAllPromptsInDocs);

    // Get is_quantity settings for all products in this quote
    const quantityPromptMap = new Map<string, string>(); // productId -> prompt_name
    if (quote.organization_id) {
      const { data: orgInfo } = await supabase
        .from('organizations')
        .select('api_user_id')
        .eq('id', quote.organization_id)
        .single();
      if (orgInfo?.api_user_id) {
        const { data: qtySettings } = await supabase
          .from('product_prompt_settings')
          .select('easyquote_product_id, prompt_name')
          .eq('api_user_id', orgInfo.api_user_id)
          .eq('is_quantity', true);
        if (qtySettings) {
          qtySettings.forEach((s: any) => {
            quantityPromptMap.set(s.easyquote_product_id, s.prompt_name);
          });
        }
      }
    }

    // Format items - filter to only accepted items when quote is approved
    const itemsToRender = quote.status === 'approved'
      ? (quote.items || []).filter((item: any) => item.accepted === true)
      : (quote.items || []);
    
    const formattedItems = itemsToRender.map((rawItem: any) => {
      const approvedState = quote.status === 'approved' && rawItem.accepted
        ? resolveApprovedQuoteItemState(rawItem)
        : null;
      const item = approvedState
        ? {
            ...rawItem,
            quantity: approvedState.resolvedQuantity,
            price: approvedState.resolvedPrice,
            outputs: approvedState.resolvedOutputs,
            prompts: approvedState.resolvedPromptsArray,
            description: approvedState.resolvedDescription,
          }
        : rawItem;
      const images: string[] = [];
      const promptsFormatted: Array<{label: string, value: string}> = [];
      
      // Get hidden prompts for this product (normalized keys)
      const hiddenPrompts = item.product_id ? hiddenPromptSettings.get(item.product_id) : null;
      const normalize = (v: string) => String(v ?? '').replace(/\$/g, '').trim().toUpperCase();
      
      // Helper: check if prompt should be hidden (by id OR label)
      const isHidden = (prompt: any): boolean => {
        if (!hiddenPrompts) return false;
        const candidates = [prompt?.id, prompt?.name, prompt?.label].filter(Boolean).map(normalize);
        return candidates.some(c => hiddenPrompts.has(c));
      };

      // Build hidden keys by section for description sanitization
      const parentHiddenPromptKeys = new Set<string>(hiddenPrompts ? Array.from(hiddenPrompts) : []);
      const componentHiddenByAlias = new Map<string, Set<string>>();
      if (item.composite_data?.activeComponents && Array.isArray(item.composite_data.activeComponents)) {
        item.composite_data.activeComponents.forEach((ac: any) => {
          const componentProductId = ac?.component_product_id;
          const componentAlias = ac?.component_alias;
          if (!componentProductId || !componentAlias) return;
          const componentHidden = hiddenPromptSettings.get(componentProductId);
          if (!componentHidden) return;
          componentHiddenByAlias.set(normalizeDescriptionLabel(componentAlias), new Set(componentHidden));
        });
      }

      const safeDescription = sanitizeDescriptionForDocs(
        item.description || '',
        parentHiddenPromptKeys,
        componentHiddenByAlias
      );
      
      // Extract displayQuantity: prefer Q1 from multi, then custom_quantity, then is_quantity prompt, then heuristic
      let displayQuantity: string | number | null = null;
      const qtySettingName = item.product_id ? quantityPromptMap.get(item.product_id) : undefined;
      if (item.multi?.rows?.length > 0) {
        displayQuantity = item.multi.rows[0].qty;
      } else if (item.multi?.qtyInputs?.length > 0) {
        displayQuantity = item.multi.qtyInputs[0];
      } else if (item.prompts && Array.isArray(item.prompts)) {
        if (item.product_id === '__CUSTOM_PRODUCT__') {
          const customQuantityPrompt = item.prompts.find((prompt: any) => String(prompt?.id || prompt?.name || '').trim() === 'custom_quantity');
          if (customQuantityPrompt?.value !== undefined && customQuantityPrompt?.value !== null && customQuantityPrompt.value !== '') {
            displayQuantity = customQuantityPrompt.value;
          }
        }

        // First try: look for the prompt marked as is_quantity in product_prompt_settings
        if (!displayQuantity && qtySettingName) {
          const normalizeKey = (v: string) => String(v ?? '').replace(/\$/g, '').trim().toUpperCase();
          const qtyKey = normalizeKey(qtySettingName);
          const markedPrompt = item.prompts.find((prompt: any) => {
            const label = normalizeKey(prompt.label || '');
            const id = normalizeKey(prompt.id || prompt.name || '');
            return label === qtyKey || id === qtyKey;
          });
          if (markedPrompt?.value) {
            displayQuantity = markedPrompt.value;
          }
        }
        // Fallback: heuristic by label text
        if (!displayQuantity) {
          const qtyPrompt = item.prompts.find((prompt: any) => {
            const label = (prompt.label || '').toLowerCase();
            return label.includes('cantidad') || label.includes('ejemplares');
          });
          if (qtyPrompt?.value) {
            displayQuantity = qtyPrompt.value;
          }
        }
      }

      const isCustomProduct = item.product_id === '__CUSTOM_PRODUCT__';
      const quantityValue = isCustomProduct
        ? parsePositiveQuantity(displayQuantity ?? item.quantity)
        : (item.quantity ?? null);
      const customPromptUnitPrice = item.product_id === '__CUSTOM_PRODUCT__' && Array.isArray(item.prompts)
        ? parseLocaleNumber(item.prompts.find((prompt: any) => String(prompt?.id || prompt?.name || '').trim() === 'custom_unit_price')?.value)
        : 0;
      const normalizedCustomQuantity = isCustomProduct
        ? (quantityValue ?? 1)
        : null;
      const resolvedItemPrice = isCustomProduct
        ? (item.price || 0)
        : (item.price || 0);

      // Extraer imágenes y prompts EN ORDEN
      if (item.prompts && Array.isArray(item.prompts)) {
        item.prompts.forEach((prompt: any) => {
          const label = prompt.label || '';
          const value = String(prompt.value || '');
          
          // Detectar y extraer imágenes (cualquier URL)
          if (value.startsWith('http') || value.startsWith('https://')) {
            images.push(value);
            return; // No incluir URLs en la descripción
          }
          
          // Skip hidden prompts (by id or label)
          if (isHidden(prompt)) {
            return;
          }
          
          // Incluir TODOS los prompts en orden (excepto valores vacíos o 0)
          if (value !== '0' && value.trim() !== '') {
            promptsFormatted.push({ label, value });
          }
        });
      }
      
      // Extraer imágenes de outputs (OutputImage, etc.)
      if (item.outputs && Array.isArray(item.outputs)) {
        item.outputs.forEach((output: any) => {
          const type = String(output.type || '').toLowerCase();
          const value = String(output.value || '');
          
          if (type.includes('image') && (value.startsWith('http') || value.startsWith('https://'))) {
            images.push(value);
          }
        });
      }

      // Extract component details from composite_data — ONLY if description is empty.
      // If user filled the description, it's the sole source of truth for the PDF.
      const componentSections: Array<{alias: string, prompts: Array<{label: string, value: string}>}> = [];
      const descriptionIsEmpty = !item.description || String(item.description).trim() === '';
      if (descriptionIsEmpty && item.composite_data?.components) {
        const componentsMap = item.composite_data.components;
        const activeComponents = item.composite_data.activeComponents || [];
        
        const sortedKeys = Object.keys(componentsMap).sort((a, b) => {
          const orderA = activeComponents.find((ac: any) => a.startsWith(ac.id))?.display_order ?? 99;
          const orderB = activeComponents.find((ac: any) => b.startsWith(ac.id))?.display_order ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.localeCompare(b);
        });
        
        for (const compKey of sortedKeys) {
          const comp = componentsMap[compKey];
          if (!comp) continue;
          const alias = comp.alias || 'Componente';
          const compPrompts = Array.isArray(comp.prompts) ? comp.prompts : [];
          
          // Get hidden prompts for this component's REAL easyquote product id
          // compKey format is "componentId:instanceIndex" - map to component_product_id via activeComponents
          const compId = compKey.split(':')[0];
          const activeComp = activeComponents.find((ac: any) => ac.id === compId);
          const compProductId = activeComp?.component_product_id || compId;
          const compHiddenPrompts = compProductId ? hiddenPromptSettings.get(compProductId) : null;
          const isCompHidden = (p: any): boolean => {
            if (!compHiddenPrompts) return false;
            const candidates = [p?.promptText, p?.label, p?.id].filter(Boolean).map(normalize);
            return candidates.some(c => compHiddenPrompts.has(c));
          };
          
          const compPromptsFormatted = compPrompts
            .filter((p: any) => {
              const val = p?.currentValue ?? p?.value;
              if (val === null || val === undefined || String(val).trim() === '') return false;
              if (String(val).trim().toLowerCase() === 'no') return false;
              if (isCompHidden(p)) return false;
              return true;
            })
            .sort((a: any, b: any) => (a.promptSequence || 0) - (b.promptSequence || 0))
            .map((p: any) => ({
              label: p.promptText || p.label || p.id || '',
              value: String(p.currentValue ?? p.value ?? '')
            }));
          
          if (compPromptsFormatted.length > 0) {
            componentSections.push({ alias, prompts: compPromptsFormatted });
          }
        }
      }

      // Format item_additionals for display
      const rawItemAdditionals = Array.isArray(item.item_additionals) ? item.item_additionals : [];
      const formattedAdditionals = rawItemAdditionals.map((adj: any) => ({
        name: adj.name || '',
        type: adj.type || 'net_amount',
        value: adj.value || 0,
        is_discount: adj.is_discount || false,
        capacity_value: adj.capacity_value || null,
        multiValues: adj.multiValues || null,
      }));

      // Format multi-quantity rows (Q2, Q3, etc.) for informational display
      const multiExtraRows: Array<{qty: number, price: number}> = [];
      if (item.multi?.rows && Array.isArray(item.multi.rows) && item.multi.rows.length > 1) {
        const q1Row = item.multi.rows[0];
        const q1RawBasePrice = parseLocaleNumber(q1Row?.totalStr);
        const q1Qty = parsePositiveQuantity(q1Row?.qty) ?? 1;
        const q1StoredFinalPrice = parseLocaleNumber(item.price);
        const q1AdditionalsTotal = calculateMultiRowAdditionalsTotal(rawItemAdditionals, q1Qty, 0, q1RawBasePrice);
        const inferredTariffMultiplier = q1RawBasePrice > 0
          ? (q1StoredFinalPrice - q1AdditionalsTotal) / q1RawBasePrice
          : 1;
        const safeTariffMultiplier = Number.isFinite(inferredTariffMultiplier) ? inferredTariffMultiplier : 1;
        const modifiedPrices = item.multi?.modifiedPrices && typeof item.multi.modifiedPrices === 'object'
          ? item.multi.modifiedPrices
          : {};

        for (let i = 1; i < item.multi.rows.length; i++) {
          const row = item.multi.rows[i];
          if (row?.qty && row?.totalStr != null) {
            const qty = parsePositiveQuantity(row.qty) ?? 0;
            const rawBasePrice = parseLocaleNumber(row.totalStr);
            const modifiedBasePrice = parseOptionalLocaleNumber(modifiedPrices?.[i]);
            const adjustedBasePrice = modifiedBasePrice ?? (rawBasePrice * safeTariffMultiplier);
            const additionalsTotal = calculateMultiRowAdditionalsTotal(rawItemAdditionals, qty, i, rawBasePrice);
            const finalPrice = adjustedBasePrice + additionalsTotal;

            multiExtraRows.push({
              qty: row.qty,
              price: Number.isFinite(finalPrice) ? finalPrice : 0,
            });
          }
        }
      }

      // If description has content, it's the sole source of truth — no individual prompts or components.
      // If description is empty, show prompts + components as usual.
      if (!descriptionIsEmpty) {
        return {
          product_id: item.product_id,
          isCustomProduct,
          name: item.name || item.product_name || 'Producto',
          description: safeDescription,
          description_manual: item.description_manual === true,
          prompts: [],
          price: resolvedItemPrice,
          quantity: quantityValue,
          displayQuantity: displayQuantity,
          images: images,
          components: [],
          item_additionals: formattedAdditionals,
          multi_extra: multiExtraRows,
        };
      }

      // Description is empty — use prompts + components
      if (hideAllPromptsInDocs) {
        return {
          product_id: item.product_id,
          isCustomProduct,
          name: item.name || item.product_name || 'Producto',
          description: '',
          prompts: [],
          price: resolvedItemPrice,
          quantity: quantityValue,
          displayQuantity: displayQuantity,
          images: images,
          components: componentSections,
          item_additionals: formattedAdditionals,
          multi_extra: multiExtraRows,
        };
      }

      return {
        product_id: item.product_id,
        isCustomProduct,
        name: item.name || item.product_name || 'Producto',
        description: '',
        description_manual: item.description_manual === true,
        prompts: promptsFormatted,
        price: resolvedItemPrice,
        quantity: quantityValue,
        displayQuantity: displayQuantity,
        images: images,
        components: componentSections,
        item_additionals: formattedAdditionals,
        multi_extra: multiExtraRows,
      };
    });

    // Templates 7 & 8 (Campillo/Anebri): hide ITEM adjustments in PDFs
    // but SHOW quote-level adjustments (they appear as separate lines)
    const hideItemAdjustmentsInPdf = config.selectedTemplate === 7 || config.selectedTemplate === 8;

    // Prepare data for template
    const templateData = {
      config,
      quote: {
        quote_number: quote.quote_number,
        created_at: quote.created_at,
        title: quote.title,
        description: quote.description,
        notes: quote.notes,
        subtotal: quote.subtotal || 0,
        tax_amount: quote.tax_amount || 0,
        discount_amount: quote.discount_amount || 0,
        final_price: quote.final_price || 0,
        valid_until: quote.valid_until,
        status: quote.status
      },
      customer: customer || {
        name: 'Cliente',
        email: '',
        phone: '',
        address: ''
      },
      items: hideItemAdjustmentsInPdf
        ? formattedItems.map(item => ({ ...item, _raw_additionals: item.item_additionals, item_additionals: [] }))
        : formattedItems,
      quote_additionals: (quote.quote_additionals || []).map((a: any) => ({
            name: (a.name || '').replace(/\s*Ajuste sobre el presupuesto\s*/gi, '').replace(/\s*Ajuste sobre el pedido\s*/gi, '').trim(),
            type: a.type || 'net_amount',
            value: a.value || 0,
            is_discount: a.is_discount || false,
          })),
    };

    // Create temporary container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    // Dynamically import and render template
    const QuoteTemplate = (await import('@/components/QuoteTemplate')).default;
    
    const root = createRoot(container);
    root.render(
      React.createElement(QuoteTemplate, {
        data: templateData,
        templateNumber: config.selectedTemplate
      })
    );

    // Wait for render and images to load
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if template has multiple pages (e.g., data-terms-page markers)
    const pages = container.querySelectorAll('[data-terms-page]');
    const hasMultiplePages = pages.length > 0;

    const renderScale = quality;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const isTemplate7 = config.selectedTemplate === 7;
    const isTemplate9 = config.selectedTemplate === 9;
    // Template 9 (Campillo Limpia): texto sobre blanco sin fondo PNG → optimizamos peso
    const t9Scale = 1.5;
    const t9Quality = 0.55;
    const effScale = isTemplate9 ? t9Scale : renderScale;
    const jpegQ = isTemplate9 ? t9Quality : 0.65;

    if (hasMultiplePages) {
      // Multi-page template: render each top-level child as a separate PDF page
      const children = container.firstChild
        ? (container.firstChild as HTMLElement).parentElement === container
          ? Array.from(container.children) as HTMLElement[]
          : Array.from((container.firstChild as HTMLElement).children) as HTMLElement[]
        : [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const canvas = await html2canvas(child, {
          scale: effScale,
          useCORS: true,
          logging: false,
          backgroundColor: isTemplate7 ? null : '#ffffff',
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL('image/jpeg', jpegQ);
        const ratio = pdfWidth / canvas.width;
        const scaledHeight = canvas.height * ratio;

        if (i > 0) pdf.addPage();
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(scaledHeight, pdfHeight));
      }
    } else {
      // Single-page or overflow template
      const canvas = await html2canvas(container.firstChild as HTMLElement, {
        scale: effScale,
        useCORS: true,
        logging: false,
        backgroundColor: isTemplate7 ? null : '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight) {
        const imgData = canvas.toDataURL('image/jpeg', jpegQ);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(scaledHeight, pdfHeight));
      } else {
        const imgData = canvas.toDataURL('image/jpeg', jpegQ);
        let heightLeft = scaledHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position = heightLeft - scaledHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
          heightLeft -= pdfHeight;
        }
      }
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};
