import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template4Props {
  data: any;
}

export default function Template4({ data }: Template4Props) {
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

  const accentColor = config.brandColor || '#1e40af';

  return (
    <div className="bg-gray-50 min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Georgia, serif' }}>
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
      
      {/* Corporate Header */}
      <header className="bg-white p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          {config.logoUrl && (
            <img src={config.logoUrl} alt="Logo" className="h-10" />
          )}
          <div className="text-right">
            <h1 className="text-lg font-serif font-bold" style={{ color: accentColor }}>
              {config.companyName || 'Mi Empresa'}
            </h1>
          </div>
        </div>
        <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }}></div>
      </header>

      <div className="p-4">
        {/* Document Info Banner */}
        <div className="bg-white p-3 shadow-sm mb-3 rounded-sm">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: accentColor }}>
                Presupuesto
              </h2>
              <p className="text-lg font-serif font-bold">{quote.quote_number || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Fecha</p>
              <p className="text-xs font-semibold">
                {quote.created_at ? format(new Date(quote.created_at), 'dd MMM yyyy', { locale: es }) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <section className="bg-white p-3 shadow-sm mb-3 rounded-sm">
          <div className="flex items-start gap-2">
            <div className="w-0.5 h-12" style={{ backgroundColor: accentColor }}></div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accentColor }}>
                Cliente
              </h3>
              <p className="font-serif font-bold text-sm mb-0.5">{customer.name || 'Cliente'}</p>
              {customer.email && <p className="text-xs text-gray-600">{customer.email}</p>}
              {customer.phone && <p className="text-xs text-gray-600">{customer.phone}</p>}
              {customer.address && <p className="text-xs text-gray-600">{customer.address}</p>}
            </div>
          </div>
        </section>

        {/* Quote Description */}
        {(quote.title || quote.description) && (
          <section className="bg-white p-3 shadow-sm mb-3 rounded-sm">
            {quote.title && (
              <h3 className="font-serif font-bold text-sm mb-1" style={{ color: accentColor }}>
                {quote.title}
              </h3>
            )}
            {quote.description && (
              <p className="text-xs text-gray-700 leading-tight">{quote.description}</p>
            )}
          </section>
        )}

        {/* Items */}
        <section className="bg-white p-3 shadow-sm mb-3 rounded-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: accentColor }}>
            Detalle de Conceptos
          </h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr style={{ backgroundColor: accentColor }} className="text-white">
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
                          <p className="font-semibold text-xs leading-tight">{item.name}</p>
                        </div>
                      </td>
                      <td className="p-1.5 text-right text-xs whitespace-nowrap">{fmtEUR(item.price || 0)}</td>
                      <td className="p-1.5 text-center text-xs">{item.quantity || 1}</td>
                      <td className="p-1.5 text-right font-semibold text-xs whitespace-nowrap">{fmtEUR((item.price || 0) * (item.quantity || 1))}</td>
                    </tr>
                    {/* Prompts debajo en fila separada */}
                    {item.prompts && item.prompts.length > 0 && (
                      <tr className="border-b border-gray-300">
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

        {/* Totals */}
        <section className="bg-white p-3 shadow-sm mb-3 rounded-sm ml-auto w-56">
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
              <div className="flex justify-between text-xs text-red-600">
                <span>Descuento:</span>
                <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t-2 font-bold text-sm" style={{ borderColor: accentColor, color: accentColor }}>
              <span>TOTAL:</span>
              <span>{fmtEUR(quote.final_price || 0)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="bg-white p-3 shadow-sm mb-3 rounded-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accentColor }}>
              Observaciones
            </h3>
            <p className="text-xs text-gray-700 leading-tight whitespace-pre-wrap">{quote.notes}</p>
          </section>
        )}

        {/* Footer */}
        {config.footerText && (
          <footer className="bg-white p-3 shadow-sm rounded-sm">
            <p className="text-[10px] text-gray-600 text-center leading-tight">{config.footerText}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
