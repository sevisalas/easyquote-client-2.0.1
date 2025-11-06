import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template1Props {
  data: any;
}

export default function Template1({ data }: Template1Props) {
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
    <div className="bg-white p-6 min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Arial, sans-serif' }}>
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
      
      {/* Header */}
      <header className="flex justify-between items-start mb-4 pb-2 border-b-2" style={{ borderColor: config.brandColor || '#0ea5e9' }}>
        <div>
          {config.logoUrl && (
            <img src={config.logoUrl} alt="Logo" className="h-12 mb-1" />
          )}
          <h1 className="text-xl font-bold" style={{ color: config.brandColor || '#0ea5e9' }}>
            {config.companyName || 'Mi Empresa'}
          </h1>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-semibold mb-0.5">PRESUPUESTO</h2>
          <p className="text-xs text-gray-600">Nº {quote.quote_number || '-'}</p>
          <p className="text-xs text-gray-600">
            Fecha: {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
          </p>
        </div>
      </header>

      {/* Customer Info */}
      <section className="mb-3">
        <h3 className="text-xs font-semibold mb-1 uppercase" style={{ color: config.brandColor || '#0ea5e9' }}>
          Cliente
        </h3>
        <div className="bg-gray-50 p-2 rounded">
          <p className="font-semibold text-sm">{customer.name || 'Cliente'}</p>
          {customer.email && <p className="text-xs text-gray-600">{customer.email}</p>}
          {customer.phone && <p className="text-xs text-gray-600">{customer.phone}</p>}
          {customer.address && <p className="text-xs text-gray-600">{customer.address}</p>}
        </div>
      </section>

      {/* Quote Info */}
      {(quote.title || quote.description) && (
        <section className="mb-3">
          {quote.title && <h3 className="font-semibold text-sm mb-0.5">{quote.title}</h3>}
          {quote.description && <p className="text-xs text-gray-700">{quote.description}</p>}
        </section>
      )}

      {/* Items Table - Estilo Holded */}
      <section className="mb-4">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr style={{ backgroundColor: config.brandColor || '#0ea5e9' }} className="text-white">
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
                  <td className="p-1.5 text-right text-xs font-medium whitespace-nowrap">
                    {fmtEUR(item.price || 0)}
                  </td>
                  <td className="p-1.5 text-center text-xs">
                    {item.quantity || 1}
                  </td>
                  <td className="p-1.5 text-right text-xs font-semibold whitespace-nowrap">
                    {fmtEUR((item.price || 0) * (item.quantity || 1))}
                  </td>
                </tr>
                {/* Prompts debajo en fila separada */}
                {item.prompts && item.prompts.length > 0 && (
                  <tr className="border-b border-gray-300">
                    <td colSpan={4} className="pl-4 pr-1.5 py-1">
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
      <section className="ml-auto w-56 mb-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{fmtEUR(quote.subtotal || 0)}</span>
          </div>
          {quote.tax_amount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">IVA (21%):</span>
              <span className="font-medium">{fmtEUR(quote.tax_amount || 0)}</span>
            </div>
          )}
          {quote.discount_amount > 0 && (
            <div className="flex justify-between text-xs text-red-600">
              <span>Descuento:</span>
              <span>-{fmtEUR(quote.discount_amount || 0)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t-2 font-bold text-sm" style={{ borderColor: config.brandColor || '#0ea5e9', color: config.brandColor || '#0ea5e9' }}>
            <span>TOTAL:</span>
            <span>{fmtEUR(quote.final_price || 0)}</span>
          </div>
        </div>
      </section>

      {/* Notes */}
      {quote.notes && (
        <section className="mb-3">
          <h3 className="text-xs font-semibold mb-1 uppercase" style={{ color: config.brandColor || '#0ea5e9' }}>
            Notas
          </h3>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-tight">{quote.notes}</p>
        </section>
      )}

      {/* Footer */}
      {config.footerText && (
        <footer className="mt-auto pt-3 border-t border-gray-300">
          <p className="text-[10px] text-gray-600 text-center leading-tight">{config.footerText}</p>
        </footer>
      )}
    </div>
  );
}
