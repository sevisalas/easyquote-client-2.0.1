import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

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
    <div className="bg-white p-6 min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Helvetica, sans-serif' }}>
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
      <header className="mb-4">
        <div className="flex justify-between items-start border-b border-gray-900 pb-3">
          <div>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo" className="h-10 mb-2" />
            )}
            <h1 className="text-xs font-light tracking-widest uppercase text-gray-500">Presupuesto</h1>
            <p className="text-2xl font-light mt-0.5">{quote.quote_number || '-'}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-light mb-1">{config.companyName || 'Mi Empresa'}</h2>
            <p className="text-xs text-gray-600">
              {quote.created_at ? format(new Date(quote.created_at), 'dd MMM yyyy', { locale: es }) : '-'}
            </p>
          </div>
        </div>
      </header>

      {/* Customer & Quote Info - Side by side */}
      <section className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-xs font-semibold mb-1.5 uppercase tracking-wider text-gray-500">Cliente</h3>
          <p className="font-medium text-sm mb-0.5">{customer.name || 'Cliente'}</p>
          {customer.email && <p className="text-xs text-gray-600">{customer.email}</p>}
          {customer.phone && <p className="text-xs text-gray-600">{customer.phone}</p>}
          {customer.address && <p className="text-xs text-gray-600 mt-0.5">{customer.address}</p>}
        </div>
        {(quote.title || quote.description) && (
          <div>
            {quote.title && <h3 className="font-medium text-sm mb-1">{quote.title}</h3>}
            {quote.description && <p className="text-xs text-gray-700 leading-tight">{quote.description}</p>}
          </div>
        )}
      </section>

      {/* Items Table - Estilo Holded */}
      <section className="mb-4">
        <table className="w-full border-collapse border-t border-b border-gray-900">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">CONCEPTO</th>
              <th className="text-right py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 w-20">PRECIO</th>
              <th className="text-center py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 w-16">UNID.</th>
              <th className="text-right py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 w-20">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, index: number) => (
              <React.Fragment key={index}>
                {/* Fila principal del producto */}
                <tr className="border-b border-gray-100">
                  <td className="py-1.5">
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
                      <p className="font-medium text-xs leading-tight">{item.name}</p>
                    </div>
                  </td>
                  <td className="py-1.5 text-right font-medium text-xs whitespace-nowrap">{fmtEUR(item.price || 0)}</td>
                  <td className="py-1.5 text-center text-xs">{item.quantity || 1}</td>
                  <td className="py-1.5 text-right font-medium text-xs whitespace-nowrap">{fmtEUR((item.price || 0) * (item.quantity || 1))}</td>
                </tr>
                {/* Prompts debajo en fila separada */}
                {item.prompts && item.prompts.length > 0 && (
                  <tr className="border-b border-gray-100">
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

      {/* Totals - Minimalist */}
      <section className="ml-auto w-56 mb-4">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{fmtEUR(quote.subtotal || 0)}</span>
          </div>
          {quote.tax_amount > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-gray-600">IVA (21%)</span>
              <span className="font-medium">{fmtEUR(quote.tax_amount || 0)}</span>
            </div>
          )}
          {quote.discount_amount > 0 && (
            <div className="flex justify-between py-1 text-gray-600">
              <span>Descuento</span>
              <span className="font-medium">-{fmtEUR(quote.discount_amount || 0)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t-2 border-gray-900">
            <span className="font-medium text-sm uppercase tracking-wide">Total</span>
            <span className="font-medium text-base">{fmtEUR(quote.final_price || 0)}</span>
          </div>
        </div>
      </section>

      {/* Notes */}
      {quote.notes && (
        <section className="mb-3">
          <h3 className="text-xs font-semibold mb-1.5 uppercase tracking-wider text-gray-500">Notas</h3>
          <p className="text-xs text-gray-700 leading-tight whitespace-pre-wrap">{quote.notes}</p>
        </section>
      )}

      {/* Footer */}
      {config.footerText && (
        <footer className="mt-auto pt-3">
          <p className="text-[10px] text-gray-500 text-center leading-tight">{config.footerText}</p>
        </footer>
      )}
    </div>
  );
}
