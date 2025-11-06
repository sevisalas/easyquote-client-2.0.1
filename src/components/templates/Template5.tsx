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
      <header className="relative pb-6 pt-4 px-4 overflow-hidden">
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
                <img src={config.logoUrl} alt="Logo" className="h-10 mb-1" />
              )}
              <h1 className="text-xl font-bold">{config.companyName || 'Mi Empresa'}</h1>
            </div>
            <div className="text-right bg-white/20 backdrop-blur-sm p-2 rounded-lg">
              <h2 className="text-sm font-bold mb-0.5">PRESUPUESTO</h2>
              <p className="text-xs">#{quote.quote_number || '-'}</p>
              <p className="text-[10px] opacity-90">
                {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 pb-4">
        {/* Customer Info - Creative Card */}
        <section className="mb-3 -mt-3 relative z-20">
          <div className="bg-white shadow-lg rounded-lg p-2 border-t-4" style={{ borderTopColor: brandColor }}>
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brandColor }}>
                {(customer.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-[10px] font-semibold mb-0.5 uppercase tracking-wide opacity-60">Cliente</h3>
                <p className="font-bold text-sm mb-0.5">{customer.name || 'Cliente'}</p>
                {customer.email && <p className="text-xs text-gray-600">{customer.email}</p>}
                {customer.phone && <p className="text-xs text-gray-600">{customer.phone}</p>}
                {customer.address && <p className="text-xs text-gray-600">{customer.address}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Quote Info */}
        {(quote.title || quote.description) && (
          <section className="mb-3">
            {quote.title && (
              <h3 className="font-bold text-sm mb-1" style={{ color: brandColor }}>
                {quote.title}
              </h3>
            )}
            {quote.description && <p className="text-xs text-gray-700 leading-tight">{quote.description}</p>}
          </section>
        )}

        {/* Items Table */}
        <section className="mb-3">
          <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider opacity-60">
            Servicios Incluidos
          </h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr style={{ backgroundColor: brandColor }} className="text-white">
                <th className="text-left p-1.5 text-xs font-semibold">CONCEPTO</th>
                <th className="text-right p-1.5 text-xs font-semibold w-20">PRECIO</th>
                <th className="text-center p-1.5 text-xs font-semibold w-16">UNID.</th>
                <th className="text-right p-1.5 text-xs font-semibold w-20">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => (
                <React.Fragment key={index}>
                  {/* Fila principal del producto */}
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5">
                      <div className="flex items-start gap-1.5">
                        {/* Miniaturas de imágenes */}
                        {item.images && item.images.length > 0 && (
                          <div className="flex gap-0.5 flex-shrink-0">
                            {item.images.map((imgUrl: string, imgIdx: number) => (
                              <img 
                                key={imgIdx}
                                src={imgUrl} 
                                alt="" 
                                className="w-8 h-8 object-cover border border-gray-200"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ))}
                          </div>
                        )}
                        <p className="font-bold text-xs leading-tight">{item.name}</p>
                      </div>
                    </td>
                    <td className="p-1.5 text-right font-bold text-xs whitespace-nowrap" style={{ color: brandColor }}>{fmtEUR(item.price || 0)}</td>
                    <td className="p-1.5 text-center text-xs">{item.quantity || 1}</td>
                    <td className="p-1.5 text-right font-bold text-xs whitespace-nowrap" style={{ color: brandColor }}>{fmtEUR((item.price || 0) * (item.quantity || 1))}</td>
                  </tr>
                  {/* Prompts debajo en fila separada */}
                  {item.prompts && item.prompts.length > 0 && (
                    <tr className="border-b border-gray-300 bg-gray-50/50">
                      <td colSpan={4} className="pl-4 py-1">
                        <div className="text-[10px] text-gray-700 space-y-0.5 leading-tight">
                          {item.prompts.map((prompt: any, pIdx: number) => (
                            <div key={pIdx}>
                              <span className="font-medium uppercase">{prompt.label}:</span> {prompt.value}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals - Creative */}
        <section className="mb-3">
          <div className="ml-auto w-56 bg-gradient-to-br from-gray-50 to-white p-2 rounded-lg shadow-lg border-2" style={{ borderColor: brandColor }}>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{fmtEUR(quote.subtotal || 0)}</span>
              </div>
              {quote.tax_amount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">IVA (21%):</span>
                  <span className="font-semibold">{fmtEUR(quote.tax_amount || 0)}</span>
                </div>
              )}
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Ahorro:</span>
                  <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t-2 items-center" style={{ borderColor: brandColor }}>
                <span className="font-bold text-sm uppercase tracking-wide">Total:</span>
                <span className="font-bold text-base" style={{ color: brandColor }}>{fmtEUR(quote.final_price || 0)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="mb-3">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-l-4 border-orange-400 p-2 rounded-r-lg">
              <h3 className="text-xs font-semibold mb-1 uppercase tracking-wide text-orange-700">
                💡 Notas
              </h3>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-tight">{quote.notes}</p>
            </div>
          </section>
        )}

        {/* Footer */}
        {config.footerText && (
          <footer className="mt-3 pt-2 border-t border-gray-200">
            <p className="text-[10px] text-gray-500 text-center leading-tight">{config.footerText}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
