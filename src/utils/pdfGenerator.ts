import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import React from 'react';
import { createRoot } from 'react-dom/client';

const STORAGE_KEY = 'pdf_template_config';

export interface PDFGeneratorOptions {
  filename?: string;
  quality?: number;
}

// Get saved template configuration
const getTemplateConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Error loading template config:', error);
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
    const { data: quote, error } = await supabase
      .from('quotes')
      .select(`
        *,
        items:quote_items(*),
        customer:customers(*)
      `)
      .eq('id', quoteId)
      .single();

    if (error) throw error;

    // Get template configuration
    const config = getTemplateConfig();

    // Format items with descriptions
    const formattedItems = (quote.items || []).map((item: any) => {
      let description = '';
      
      // Build description from prompts
      if (item.prompts && typeof item.prompts === 'object') {
        const promptEntries = Object.entries(item.prompts);
        if (promptEntries.length > 0) {
          description = promptEntries
            .map(([key, promptData]: [string, any]) => {
              if (promptData && typeof promptData === 'object' && 'label' in promptData && 'value' in promptData) {
                return `${promptData.label}: ${promptData.value}`;
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }
      }
      
      // Add outputs
      if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
        const outputsText = item.outputs
          .filter((out: any) => {
            const name = String(out.name || '').toLowerCase();
            const type = String(out.type || '').toLowerCase();
            return !type.includes('price') && !name.includes('precio') && !name.includes('price');
          })
          .map((out: any) => `${out.name}: ${out.value}`)
          .join('\n');
        
        if (outputsText) {
          description += (description ? '\n' : '') + outputsText;
        }
      }

      // Add item additionals
      if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
        const additionalsText = item.item_additionals
          .map((additional: any) => {
            const value = additional.value || 0;
            const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
            return `${additional.name}: ${formattedValue}€`;
          })
          .join('\n');
        
        if (additionalsText) {
          description += (description ? '\n' : '') + additionalsText;
        }
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
        valid_until: quote.valid_until
      },
      customer: quote.customer || {
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

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Capture as canvas
    const canvas = await html2canvas(container.firstChild as HTMLElement, {
      scale: quality,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Clean up
    root.unmount();
    document.body.removeChild(container);

    // Create PDF
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};
