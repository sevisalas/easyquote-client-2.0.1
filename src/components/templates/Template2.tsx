import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Template2Props {
  data: any;
}

export default function Template2({ data }: Template2Props) {
  const config = data.config || {};
  const quote = data.quote || {};
  const customer = data.customer || {};
  const items = data.items || [];
  
  const fmtEUR = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const primaryColor = config.brandColor || '#8b5cf6';

  return (
    <div className="bg-white min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Watermark for Draft */}
      {quote.status === 'draft' && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '120px',
            fontWeight: 'bold',
            color: 'rgba(0, 0, 0, 0.08)',
            zIndex: 10,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          BORRADOR
        </div>
      )}
      
      {/* Modern Header with gradient */}
      <header className="p-8 text-white" style={{ 
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` 
      }}>
        <div className="flex justify-between items-start">
          <div>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo" className="h-14 mb-3" />
            )}
            <h1 className="text-3xl font-bold mb-1">{config.companyName || 'Mi Empresa'}</h1>
          </div>
          <div className="text-right bg-white/10 p-4 rounded-lg backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-1">PRESUPUESTO</h2>
            <p className="text-sm opacity-90">#{quote.quote_number || '-'}</p>
            <p className="text-sm opacity-90">
              {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Customer Info - Modern Card */}
        <section className="mb-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-lg border-l-4" style={{ borderLeftColor: primaryColor }}>
            <h3 className="text-xs font-semibold mb-3 uppercase tracking-wide text-gray-700">
              Facturar a
            </h3>
            <p className="font-bold text-lg mb-1">{customer.name || 'Cliente'}</p>
            {customer.email && <p className="text-sm text-gray-600 mb-0.5">{customer.email}</p>}
            {customer.phone && <p className="text-sm text-gray-600 mb-0.5">{customer.phone}</p>}
            {customer.address && <p className="text-sm text-gray-600">{customer.address}</p>}
          </div>
        </section>

        {/* Quote Info */}
        {(quote.title || quote.description) && (
          <section className="mb-6">
            {quote.title && <h3 className="font-bold text-xl mb-2 text-gray-900">{quote.title}</h3>}
            {quote.description && <p className="text-sm text-gray-700 leading-relaxed">{quote.description}</p>}
          </section>
        )}

        {/* Items - Modern List */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wide text-gray-700">
            Detalle de Servicios
          </h3>
          <div className="space-y-3">
            {items.map((item: any, index: number) => (
              <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold mb-1">{item.description || item.name || item.product_name || 'Producto'}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-lg text-gray-900">{fmtEUR(item.price || 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Totals - Modern Card */}
        <section className="ml-auto w-72 mb-8">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-lg space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{fmtEUR(quote.subtotal || 0)}</span>
            </div>
            {quote.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IVA (21%):</span>
                <span className="font-semibold">{fmtEUR(quote.tax_amount || 0)}</span>
              </div>
            )}
            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Descuento:</span>
                <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t-2 border-gray-300">
              <span className="font-bold text-xl">TOTAL:</span>
              <span className="font-bold text-2xl text-gray-900">{fmtEUR(quote.final_price || 0)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="mb-6">
            <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded">
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-gray-700">
                Notas Importantes
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          </section>
        )}

        {/* Footer */}
        {config.footerText && (
          <footer className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-relaxed">{config.footerText}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
