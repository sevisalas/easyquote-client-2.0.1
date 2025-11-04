import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Template3Props {
  data: any;
}

export default function Template3({ data }: Template3Props) {
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

  return (
    <div className="bg-white p-12 min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Helvetica, sans-serif' }}>
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
      
      {/* Minimalist Header */}
      <header className="mb-12">
        <div className="flex justify-between items-start border-b border-gray-900 pb-6">
          <div>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo" className="h-12 mb-4" />
            )}
            <h1 className="text-sm font-light tracking-widest uppercase text-gray-500">Presupuesto</h1>
            <p className="text-3xl font-light mt-1">{quote.quote_number || '-'}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-light mb-2">{config.companyName || 'Mi Empresa'}</h2>
            <p className="text-sm text-gray-600">
              {quote.created_at ? format(new Date(quote.created_at), 'dd MMM yyyy', { locale: es }) : '-'}
            </p>
          </div>
        </div>
      </header>

      {/* Customer & Quote Info - Side by side */}
      <section className="grid grid-cols-2 gap-8 mb-12">
        <div>
          <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider text-gray-500">Cliente</h3>
          <p className="font-medium text-lg mb-1">{customer.name || 'Cliente'}</p>
          {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
          {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
          {customer.address && <p className="text-sm text-gray-600 mt-1">{customer.address}</p>}
        </div>
        {(quote.title || quote.description) && (
          <div>
            {quote.title && <h3 className="font-medium text-lg mb-2">{quote.title}</h3>}
            {quote.description && <p className="text-sm text-gray-700 leading-relaxed">{quote.description}</p>}
          </div>
        )}
      </section>

      {/* Items - Minimalist Table */}
      <section className="mb-12">
        <div className="border-t border-b border-gray-900">
          <div className="grid grid-cols-12 py-3 border-b border-gray-200">
            <div className="col-span-9">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Concepto</h3>
            </div>
            <div className="col-span-3 text-right">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Importe</h3>
            </div>
          </div>
          {items.map((item: any, index: number) => (
            <div key={index} className="grid grid-cols-12 py-4 border-b border-gray-100">
              <div className="col-span-9">
                <div className="flex gap-3 items-start">
                  {item.images && item.images.length > 0 && (
                    <img 
                      src={item.images[0]} 
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded border border-gray-300 flex-shrink-0"
                      crossOrigin="anonymous"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-2">{item.name}</p>
                    {item.color && (
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-4 h-4 rounded border border-gray-300 flex-shrink-0" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-gray-600">Color: {item.color}</span>
                      </div>
                    )}
                    {item.description && (
                      <div className="text-xs text-gray-700 space-y-0.5">
                        {item.description.split('\n').map((line: string, i: number) => {
                          if (!line.trim()) return null;
                          if (line.includes('Tallas:')) {
                            return <div key={i} className="mt-1 font-medium">{line}</div>;
                          }
                          const parts = line.split('•').map(p => p.trim()).filter(Boolean);
                          if (parts.length > 1) {
                            return (
                              <div key={i} className="space-y-0.5">
                                {parts.map((part, j) => (
                                  <div key={j}>• {part}</div>
                                ))}
                              </div>
                            );
                          }
                          return <div key={i}>{line}</div>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-3 text-right">
                <p className="font-medium">{fmtEUR(item.price || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Totals - Minimalist */}
      <section className="ml-auto w-80 mb-12">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{fmtEUR(quote.subtotal || 0)}</span>
          </div>
          {quote.tax_amount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">IVA (21%)</span>
              <span className="font-medium">{fmtEUR(quote.tax_amount || 0)}</span>
            </div>
          )}
          {quote.discount_amount > 0 && (
            <div className="flex justify-between py-2 text-gray-600">
              <span>Descuento</span>
              <span className="font-medium">-{fmtEUR(quote.discount_amount || 0)}</span>
            </div>
          )}
          <div className="flex justify-between pt-4 border-t-2 border-gray-900">
            <span className="font-medium text-lg uppercase tracking-wide">Total</span>
            <span className="font-medium text-2xl">{fmtEUR(quote.final_price || 0)}</span>
          </div>
        </div>
      </section>

      {/* Notes */}
      {quote.notes && (
        <section className="mb-8">
          <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider text-gray-500">Notas</h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
        </section>
      )}

      {/* Footer */}
      {config.footerText && (
        <footer className="mt-auto pt-8">
          <p className="text-xs text-gray-500 text-center leading-relaxed">{config.footerText}</p>
        </footer>
      )}
    </div>
  );
}
