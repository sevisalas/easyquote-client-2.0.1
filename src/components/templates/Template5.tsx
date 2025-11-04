import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template5Props {
  data: any;
}

export default function Template5({ data }: Template5Props) {
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

  const brandColor = config.brandColor || '#ec4899';

  return (
    <div className="bg-white min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
      
      {/* Creative Header with angled design */}
      <header className="relative pb-12 pt-8 px-8 overflow-hidden">
        <div 
          className="absolute inset-0 transform -skew-y-3 origin-top-left"
          style={{ 
            background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%)` 
          }}
        ></div>
        <div className="relative z-10 text-white">
          <div className="flex justify-between items-start">
            <div>
              {config.logoUrl && (
                <img src={config.logoUrl} alt="Logo" className="h-14 mb-3" />
              )}
              <h1 className="text-3xl font-bold mb-1">{config.companyName || 'Mi Empresa'}</h1>
            </div>
            <div className="text-right bg-white/20 backdrop-blur-sm p-4 rounded-lg">
              <h2 className="text-lg font-bold mb-1">PRESUPUESTO</h2>
              <p className="text-sm">#{quote.quote_number || '-'}</p>
              <p className="text-xs opacity-90 mt-1">
                {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-8 pb-8">
        {/* Customer Info - Creative Card */}
        <section className="mb-6 -mt-6 relative z-20">
          <div className="bg-white shadow-lg rounded-lg p-5 border-t-4" style={{ borderTopColor: brandColor }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: brandColor }}>
                {(customer.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-60">Cliente</h3>
                <p className="font-bold text-lg mb-1">{customer.name || 'Cliente'}</p>
                {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
                {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
                {customer.address && <p className="text-sm text-gray-600 mt-1">{customer.address}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Quote Info */}
        {(quote.title || quote.description) && (
          <section className="mb-6">
            {quote.title && (
              <h3 className="font-bold text-2xl mb-2 bg-clip-text text-transparent" 
                  style={{ backgroundImage: `linear-gradient(135deg, ${brandColor}, ${brandColor}aa)` }}>
                {quote.title}
              </h3>
            )}
            {quote.description && <p className="text-sm text-gray-700 leading-relaxed">{quote.description}</p>}
          </section>
        )}

        {/* Items - Creative Cards */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-wider opacity-60">
            Servicios Incluidos
          </h3>
          <div className="space-y-3">
            {items.map((item: any, index: number) => (
              <div key={index} className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-lg shadow-sm border-l-4" 
                   style={{ borderLeftColor: brandColor }}>
                <div className="flex gap-4 items-start">
                  {item.images && item.images.length > 0 && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {item.images.map((img: string, imgIdx: number) => (
                        <img 
                          key={imgIdx}
                          src={img} 
                          alt={`${item.name} ${imgIdx + 1}`}
                          className="w-20 h-20 object-cover rounded border border-gray-300"
                          crossOrigin="anonymous"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" 
                            style={{ backgroundColor: brandColor }}>
                        {index + 1}
                      </span>
                      <p className="font-bold text-base">{item.name}</p>
                    </div>
                    {item.prompts && item.prompts.length > 0 && (
                      <div className="text-sm text-gray-700 ml-11 space-y-1">
                        {item.prompts.map((prompt: any, pIdx: number) => (
                          <div key={pIdx}>
                            <span className="font-medium">{prompt.label}:</span> {prompt.value}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="font-bold text-xl whitespace-nowrap" style={{ color: brandColor }}>{fmtEUR(item.price || 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Totals - Creative */}
        <section className="mb-8">
          <div className="ml-auto w-80 bg-gradient-to-br from-gray-50 to-white p-6 rounded-lg shadow-lg border-2" style={{ borderColor: brandColor }}>
            <div className="space-y-3">
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
                <div className="flex justify-between text-sm text-green-600">
                  <span>Ahorro:</span>
                  <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-4 border-t-2 items-center" style={{ borderColor: brandColor }}>
                <span className="font-bold text-lg uppercase tracking-wide">Total:</span>
                <span className="font-bold text-3xl" style={{ color: brandColor }}>{fmtEUR(quote.final_price || 0)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="mb-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-l-4 border-orange-400 p-5 rounded-r-lg">
              <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-orange-700">
                💡 Notas Importantes
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
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
