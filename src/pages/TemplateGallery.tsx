import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { templates } from '@/utils/templateRegistry';
import QuoteTemplate from '@/components/QuoteTemplate';
import { generatePDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'pdf_template_config';

export default function TemplateGallery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);

  useEffect(() => {
    document.title = 'Galería de Plantillas | Presupuestos';
  }, []);

  useEffect(() => {
    // Get data from location state or localStorage
    const stateData = location.state?.quoteData;
    const quoteId = location.state?.quoteId;
    
    if (stateData) {
      prepareQuoteData(stateData);
    } else if (quoteId) {
      fetchQuoteData(quoteId);
    } else {
      // Try to load from localStorage as fallback
      const stored = localStorage.getItem('temp_quote_data');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          prepareQuoteData(parsed);
        } catch (error) {
          console.error('Error parsing stored quote data:', error);
          toast.error('No se encontraron datos del presupuesto');
          navigate('/presupuestos');
        }
      } else {
        toast.error('No se encontraron datos del presupuesto');
        navigate('/presupuestos');
      }
    }
  }, [location, navigate]);

  const fetchQuoteData = async (quoteId: string) => {
    try {
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
      
      prepareQuoteData(quote);
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('Error al cargar el presupuesto');
      navigate('/presupuestos');
    }
  };

  const prepareQuoteData = (rawData: any) => {
    // Get PDF template configuration from localStorage
    const configRaw = localStorage.getItem(STORAGE_KEY);
    const config = configRaw ? JSON.parse(configRaw) : {};

    // Format items with descriptions built from prompts and outputs
    const formattedItems = (rawData.items || []).map((item: any) => {
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
      
      // Add outputs to description (excluding price fields)
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

    const formatted = {
      config,
      quote: {
        quote_number: rawData.quote_number,
        created_at: rawData.created_at,
        title: rawData.title,
        description: rawData.description,
        notes: rawData.notes,
        subtotal: rawData.subtotal || 0,
        tax_amount: rawData.tax_amount || 0,
        discount_amount: rawData.discount_amount || 0,
        final_price: rawData.final_price || 0,
        valid_until: rawData.valid_until
      },
      customer: rawData.customer || {
        name: 'Cliente',
        email: '',
        phone: '',
        address: ''
      },
      items: formattedItems
    };

    setQuoteData(formatted);
  };

  const handleDownloadPDF = async () => {
    if (!quoteData) {
      toast.error('No hay datos para generar el PDF');
      return;
    }

    setIsGenerating(true);
    try {
      await generatePDF('quote-preview', {
        filename: `presupuesto-${quoteData.quote.quote_number || 'draft'}.pdf`,
        quality: 2
      });
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!quoteData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div className="h-6 w-px bg-border"></div>
            <h1 className="text-lg font-semibold">Selecciona una Plantilla</h1>
          </div>
          <Button 
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isGenerating ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Template Selector */}
        <section className="mb-6">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`flex-shrink-0 snap-start transition-all ${
                  selectedTemplate === template.id
                    ? 'ring-4 ring-primary scale-105'
                    : 'ring-2 ring-border hover:ring-primary/50'
                } rounded-lg overflow-hidden`}
              >
                <div className="w-48 bg-card">
                  <div className="aspect-[210/297] bg-muted flex items-center justify-center">
                    <div className="text-center p-4">
                      <p className="font-semibold mb-1">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                  <div className="p-2 text-center text-sm font-medium">
                    {selectedTemplate === template.id ? '✓ Seleccionada' : 'Seleccionar'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Preview */}
        <section>
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
            Vista Previa
          </h2>
          <div className="bg-muted/30 p-8 rounded-lg overflow-auto">
            <div id="quote-preview" className="mx-auto shadow-2xl">
              <QuoteTemplate 
                data={quoteData} 
                templateNumber={selectedTemplate} 
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
