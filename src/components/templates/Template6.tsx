import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template6Props {
  data: any;
}

export default function Template6({ data }: Template6Props) {
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
    <div className="bg-white min-h-[297mm] w-[210mm] mx-auto relative" style={{ fontFamily: 'Times New Roman, serif' }}>
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
      
      {/* Executive Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-700 text-white p-4">
        <div className="flex justify-between items-start border-b border-white/20 pb-3">
          <div>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo" className="h-10 mb-1" />
            )}
            <h1 className="text-lg font-serif font-bold tracking-wide">{config.companyName || 'Mi Empresa'}</h1>
          </div>
          <div className="text-right">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-1 opacity-80">Presupuesto</h2>
            <p className="text-xl font-serif font-bold">{quote.quote_number || '-'}</p>
            <p className="text-xs opacity-80">
              {quote.created_at ? format(new Date(quote.created_at), 'dd MMM yyyy', { locale: es }) : '-'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-4">
        {/* Document Title */}
        <section className="mb-3 text-center">
          <div className="inline-block border-t border-b border-slate-800 py-1.5 px-4">
            <h2 className="text-sm font-serif font-bold text-slate-800">PROPUESTA COMERCIAL</h2>
          </div>
        </section>

        {/* Customer Info - Executive Style */}
        <section className="mb-3">
          <div className="bg-slate-50 p-3 border-l-4 border-slate-800">
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-widest text-slate-600">
              Estimado Cliente
            </h3>
            <p className="font-serif font-bold text-sm mb-1 text-slate-800">{customer.name || 'Cliente'}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {customer.email && (
                <div>
                  <span className="text-slate-500">Email:</span>
                  <p className="font-medium text-slate-700">{customer.email}</p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <span className="text-slate-500">Teléfono:</span>
                  <p className="font-medium text-slate-700">{customer.phone}</p>
                </div>
              )}
              {customer.address && (
                <div className="col-span-2">
                  <span className="text-slate-500">Dirección:</span>
                  <p className="font-medium text-slate-700">{customer.address}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quote Description */}
        {(quote.title || quote.description) && (
          <section className="mb-3">
            {quote.title && (
              <h3 className="font-serif font-bold text-sm text-slate-800 mb-1">{quote.title}</h3>
            )}
            {quote.description && (
              <p className="text-xs text-slate-700 leading-tight">{quote.description}</p>
            )}
          </section>
        )}

        {/* Items - Executive Table */}
        <section className="mb-3">
          <h3 className="text-xs font-semibold mb-2 uppercase tracking-widest text-slate-600">
            Detalle de Servicios
          </h3>
          <table className="w-full border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-white">
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
                  <tr className={index % 2 === 0 ? 'bg-white border-b border-slate-300' : 'bg-slate-50 border-b border-slate-300'}>
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
                        <p className="font-serif font-semibold text-xs leading-tight text-slate-800">{item.name}</p>
                      </div>
                    </td>
                    <td className="p-1.5 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">{fmtEUR(item.price || 0)}</td>
                    <td className="p-1.5 text-center text-xs">{item.quantity || 1}</td>
                    <td className="p-1.5 text-right text-xs font-bold text-slate-800 whitespace-nowrap">{fmtEUR((item.price || 0) * (item.quantity || 1))}</td>
                  </tr>
                  {/* Prompts debajo en fila separada */}
                  {item.prompts && item.prompts.length > 0 && (
                    <tr className={index % 2 === 0 ? 'bg-white border-b border-slate-300' : 'bg-slate-50 border-b border-slate-300'}>
                      <td colSpan={4} className="pl-4 py-1">
                        <div className="text-[10px] text-slate-700 space-y-0.5 leading-tight">
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

        {/* Totals - Executive Style */}
        <section className="mb-3">
          <div className="ml-auto w-56">
            <div className="bg-slate-800 text-white p-2 space-y-1">
              <div className="flex justify-between text-xs opacity-90">
                <span>Subtotal:</span>
                <span className="font-semibold">{fmtEUR(quote.subtotal || 0)}</span>
              </div>
              {quote.tax_amount > 0 && (
                <div className="flex justify-between text-xs opacity-90">
                  <span>IVA (21%):</span>
                  <span className="font-semibold">{fmtEUR(quote.tax_amount || 0)}</span>
                </div>
              )}
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-green-300">
                  <span>Descuento:</span>
                  <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-white/30 text-sm font-serif font-bold">
                <span>TOTAL:</span>
                <span>{fmtEUR(quote.final_price || 0)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="mb-3">
            <div className="bg-amber-50 border border-amber-200 p-2">
              <h3 className="text-xs font-semibold mb-1 uppercase tracking-widest text-amber-900">
                Términos y Condiciones
              </h3>
              <p className="text-xs text-slate-700 leading-tight whitespace-pre-wrap">{quote.notes}</p>
            </div>
          </section>
        )}

        {/* Footer */}
        {config.footerText && (
          <footer className="mt-3 pt-2 border-t-2 border-slate-800">
            <p className="text-[10px] text-slate-600 text-center leading-tight font-serif">{config.footerText}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
