import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { getEasyQuoteToken, invokeEasyQuoteFunction } from '@/lib/easyquoteApi';

export interface PDFGeneratorOptions {
  filename?: string;
  quality?: number;
}

// Get saved template configuration from Supabase
const getTemplateConfig = async () => {
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

  // Get organization_id from sessionStorage
  let orgId: string | null = null;
  const stored = sessionStorage.getItem('selectedOrganization');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      orgId = parsed.id || null;
    } catch { /* ignore */ }
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
  
  // Query with organization filter
  let query = supabase
    .from('pdf_configurations')
    .select('*')
    .eq('user_id', user.id);
  
  if (orgId) {
    query = query.eq('organization_id', orgId);
  }
  
  const { data, error } = await query.maybeSingle();
  
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
      .eq('user_id', user.id)
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
const getHiddenPromptSettings = async (): Promise<Map<string, Set<string>>> => {
  // Get organization_id from sessionStorage first
  let orgId: string | null = null;
  const stored = sessionStorage.getItem('selectedOrganization');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      orgId = parsed.id || null;
    } catch {
      // continue to fallback
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
        items:quote_items(*)
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

    // Get template configuration
    const config = await getTemplateConfig();

    // Get hidden prompt settings for quotes
    const hiddenPromptSettings = await getHiddenPromptSettings();

    // Format items - mantener orden original de prompts, filtrando los ocultos
    const formattedItems = (quote.items || []).map((item: any) => {
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

      // Extract component details from composite_data
      const componentSections: Array<{alias: string, prompts: Array<{label: string, value: string}>}> = [];
      if (item.composite_data?.components) {
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

      return {
        name: item.product_name || item.name || 'Producto',
        prompts: promptsFormatted,
        price: item.price || 0,
        quantity: item.quantity || 1,
        images: images,
        components: componentSections
      };
    });

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
      items: formattedItems
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

    // Check if template has multiple pages (e.g., Template7 with terms page)
    const pages = container.querySelectorAll('[data-terms-page]');
    const hasMultiplePages = pages.length > 0;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

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
          scale: quality,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const ratio = pdfWidth / canvas.width;
        const scaledHeight = canvas.height * ratio;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(scaledHeight, pdfHeight));
      }
    } else {
      // Single-page or overflow template (existing logic)
      const canvas = await html2canvas(container.firstChild as HTMLElement, {
        scale: quality,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight) {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, scaledHeight);
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
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
