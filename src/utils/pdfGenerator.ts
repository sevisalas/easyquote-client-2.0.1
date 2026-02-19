import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';
import { createRoot } from 'react-dom/client';

export interface PDFGeneratorOptions {
  filename?: string;
  quality?: number;
}

// Get saved template configuration from Supabase
const getTemplateConfig = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    const { data, error } = await supabase
      .from('pdf_configurations')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!error && data) {
      return {
        selectedTemplate: data.selected_template || 1,
        companyName: data.company_name || '',
        logoUrl: data.logo_url || '',
        brandColor: data.brand_color || '#0ea5e9',
        footerText: data.footer_text || ''
      };
    }
  }
  
  return {
    selectedTemplate: 1,
    companyName: '',
    logoUrl: '',
    brandColor: '#0ea5e9',
    footerText: ''
  };
};

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
  
  // Map: productId -> Set of hidden prompt names (normalized for comparison)
  // We store BOTH the prompt_name (cell ref like B21) AND the label (human name like "Tarifa")
  // because saved prompts may only have labels, not cell refs.
  const normalize = (v: string) => String(v ?? '').replace(/\$/g, '').trim().toUpperCase();
  
  const hiddenMap = new Map<string, Set<string>>();
  settings.forEach((s: any) => {
    if (!hiddenMap.has(s.easyquote_product_id)) {
      hiddenMap.set(s.easyquote_product_id, new Set());
    }
    const set = hiddenMap.get(s.easyquote_product_id)!;
    set.add(normalize(s.prompt_name));
    // Also add the human label if available
    if (s.label) {
      set.add(normalize(s.label));
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

    // Capture as canvas with better quality
    const canvas = await html2canvas(container.firstChild as HTMLElement, {
      scale: quality,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794, // A4 width in pixels at 96 DPI
      windowHeight: 1123 // A4 height in pixels at 96 DPI
    });

    // Clean up
    root.unmount();
    document.body.removeChild(container);

    // Create PDF with proper dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate scaling to fit content
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Scale to fit page width
    const ratio = pdfWidth / imgWidth;
    const scaledHeight = imgHeight * ratio;
    
    // If content fits in one page
    if (scaledHeight <= pdfHeight) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, scaledHeight);
    } else {
      // Content spans multiple pages
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      let heightLeft = scaledHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position = heightLeft - scaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
      }
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};
