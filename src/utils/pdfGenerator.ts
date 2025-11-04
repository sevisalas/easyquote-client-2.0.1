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

    // Format items with descriptions
    const formattedItems = (quote.items || []).map((item: any) => {
      // Extraer información relevante
      const quantities: any[] = [];
      const images: string[] = [];
      const colorHex: string | null = null;
      const otherDetails: string[] = [];
      
      // Procesar prompts
      if (item.prompts && Array.isArray(item.prompts)) {
        item.prompts.forEach((prompt: any) => {
          const label = prompt.label || '';
          const value = String(prompt.value || '');
          
          // Filtrar URLs de imágenes
          if (value.startsWith('http') && (value.includes('.jpg') || value.includes('.png') || value.includes('.jpeg'))) {
            // No mostrar URLs de imágenes en el PDF
            return;
          }
          
          // Filtrar códigos de color
          if (value.startsWith('#')) {
            // No mostrar códigos hex
            return;
          }
          
          // Agrupar cantidades (tallas, etc.)
          if (label.toLowerCase().includes('men') || label.toLowerCase().includes('women') || 
              label.toLowerCase().includes('small') || label.toLowerCase().includes('medium') ||
              label.toLowerCase().includes('large') || label.toLowerCase().includes('xl')) {
            const qty = parseInt(value);
            if (qty > 0) {
              quantities.push(`${label}: ${value}`);
            }
            return;
          }
          
          // Solo agregar detalles relevantes (no cantidades 0, no URLs, no colores)
          if (value !== '0' && value.trim() !== '') {
            otherDetails.push(`${label}: ${value}`);
          }
        });
      }
      
      // Procesar outputs (solo los relevantes para el cliente)
      const relevantOutputs: string[] = [];
      if (item.outputs && Array.isArray(item.outputs)) {
        item.outputs.forEach((output: any) => {
          const name = String(output.name || '').toLowerCase();
          const type = String(output.type || '').toLowerCase();
          
          // Filtrar precios y totales (ya se muestran arriba)
          if (type.includes('price') || name.includes('precio') || name.includes('price') || 
              name.includes('total') || type.includes('tax')) {
            return;
          }
          
          // Filtrar imágenes de producto
          if (type.includes('image') || String(output.value).startsWith('http')) {
            return;
          }
          
          // Agregar outputs descriptivos
          if (output.value && String(output.value).trim() !== '') {
            relevantOutputs.push(`${output.name}: ${output.value}`);
          }
        });
      }
      
      // Construir descripción compacta
      let description = '';
      
      // Detalles del producto
      if (otherDetails.length > 0) {
        description += otherDetails.slice(0, 5).join(' • ');
      }
      
      // Cantidades/tallas (si existen)
      if (quantities.length > 0) {
        description += (description ? '\n' : '') + 'Tallas: ' + quantities.join(', ');
      }
      
      // Outputs relevantes
      if (relevantOutputs.length > 0) {
        description += (description ? '\n' : '') + relevantOutputs.join(' • ');
      }

      return {
        name: item.product_name || item.name || 'Producto',
        description: description || item.description || '',
        price: item.price || 0
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
    await new Promise(resolve => setTimeout(resolve, 1000));

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
