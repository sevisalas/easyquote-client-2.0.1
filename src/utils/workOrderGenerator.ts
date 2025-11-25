import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import React from 'react';
import { createRoot } from 'react-dom/client';

export interface WorkOrderPDFOptions {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  orderDate?: string;
  deliveryDate?: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    prompts?: Array<{ id: string; label: string; value: any; order: number }>;
    outputs?: Array<{ name: string; type: string; value: any }>;
    description?: string;
  }>;
  filename?: string;
  quality?: number;
}

export const generateWorkOrderPDF = async (
  options: WorkOrderPDFOptions
): Promise<void> => {
  const { 
    orderNumber,
    customerName,
    orderDate,
    deliveryDate,
    items,
    filename = `OT-${orderNumber}.pdf`, 
    quality = 2 
  } = options;

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Generate a page for each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Create temporary container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width in pixels at 96 DPI
      document.body.appendChild(container);

      // Dynamically import and render WorkOrderItem
      const { WorkOrderItem } = await import('@/components/production/WorkOrderItem');
      
      const root = createRoot(container);
      root.render(
        React.createElement(WorkOrderItem, {
          item,
          orderNumber,
          customerName,
          orderDate,
          deliveryDate,
          itemIndex: i
        })
      );

      // Wait for render and images to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture as canvas
      const canvas = await html2canvas(container.firstChild as HTMLElement, {
        scale: quality,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123
      });

      // Clean up
      root.unmount();
      document.body.removeChild(container);

      // Add page to PDF (add new page if not first item)
      if (i > 0) {
        pdf.addPage();
      }

      // Calculate scaling to fit content
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // If content fits in one page
      if (scaledHeight <= pdfHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, scaledHeight);
      } else {
        // Content spans multiple pages
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
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating work order PDF:', error);
    throw new Error('Failed to generate work order PDF');
  }
};
