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

      {/* Items Table - Estilo Holded */}
      <section className="mb-12">
        <table className="w-full border-collapse border-t border-b border-gray-900">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">CONCEPTO</th>
              <th className="text-right py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-24">PRECIO</th>
              <th className="text-center py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-20">UNIDADES</th>
              <th className="text-right py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-24">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, index: number) => (
              <React.Fragment key={index}>
                <tr className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-medium">{item.name}</p>
                  </td>
                  <td className="py-3 text-right font-medium whitespace-nowrap">{fmtEUR(item.price || 0)}</td>
                  <td className="py-3 text-center">{item.quantity || 1}</td>
                  <td className="py-3 text-right font-medium whitespace-nowrap">{fmtEUR((item.price || 0) * (item.quantity || 1))}</td>
                </tr>
                {item.prompts && item.prompts.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td colSpan={4} className="pl-6 py-2">
                      <div className="text-xs text-gray-700 space-y-1">
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
