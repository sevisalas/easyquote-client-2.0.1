import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
    <div className="bg-white min-h-[297mm] w-[210mm] mx-auto" style={{ fontFamily: 'Times New Roman, serif' }}>
      {/* Executive Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-700 text-white p-8">
        <div className="flex justify-between items-start border-b border-white/20 pb-6">
          <div>
            {config.logoUrl && (
              <img src={config.logoUrl} alt="Logo" className="h-16 mb-3" />
            )}
            <h1 className="text-2xl font-serif font-bold tracking-wide">{config.companyName || 'Mi Empresa'}</h1>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-2 opacity-80">Presupuesto</h2>
            <p className="text-3xl font-serif font-bold">{quote.quote_number || '-'}</p>
            <p className="text-xs mt-2 opacity-80">
              {quote.created_at ? format(new Date(quote.created_at), 'dd MMMM yyyy', { locale: es }) : '-'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Document Title */}
        <section className="mb-8 text-center">
          <div className="inline-block border-t-2 border-b-2 border-slate-800 py-3 px-8">
            <h2 className="text-2xl font-serif font-bold text-slate-800">PROPUESTA COMERCIAL</h2>
          </div>
        </section>

        {/* Customer Info - Executive Style */}
        <section className="mb-8">
          <div className="bg-slate-50 p-6 border-l-4 border-slate-800">
            <h3 className="text-xs font-semibold mb-4 uppercase tracking-widest text-slate-600">
              Estimado Cliente
            </h3>
            <p className="font-serif font-bold text-xl mb-2 text-slate-800">{customer.name || 'Cliente'}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
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
          <section className="mb-8">
            <div className="prose max-w-none">
              {quote.title && (
                <h3 className="font-serif font-bold text-xl text-slate-800 mb-3">{quote.title}</h3>
              )}
              {quote.description && (
                <p className="text-sm text-slate-700 leading-relaxed">{quote.description}</p>
              )}
            </div>
          </section>
        )}

        {/* Items - Executive Table */}
        <section className="mb-8">
          <h3 className="text-xs font-semibold mb-4 uppercase tracking-widest text-slate-600">
            Detalle de Servicios Profesionales
          </h3>
          <div className="border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left p-4 text-sm font-semibold uppercase tracking-wide">Concepto</th>
                  <th className="text-right p-4 text-sm font-semibold uppercase tracking-wide w-40">Importe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-4 border-b border-slate-100">
                      <p className="font-serif font-semibold text-slate-800 mb-1">
                        {item.description || item.name || item.product_name || 'Producto'}
                      </p>
                    </td>
                    <td className="p-4 border-b border-slate-100 text-right">
                      <p className="font-semibold text-slate-800">{fmtEUR(item.price || 0)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Totals - Executive Style */}
        <section className="mb-8">
          <div className="ml-auto w-96">
            <div className="bg-slate-800 text-white p-6 space-y-3">
              <div className="flex justify-between text-sm opacity-90">
                <span>Subtotal:</span>
                <span className="font-semibold">{fmtEUR(quote.subtotal || 0)}</span>
              </div>
              {quote.tax_amount > 0 && (
                <div className="flex justify-between text-sm opacity-90">
                  <span>IVA (21%):</span>
                  <span className="font-semibold">{fmtEUR(quote.tax_amount || 0)}</span>
                </div>
              )}
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-300">
                  <span>Descuento:</span>
                  <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-white/30 text-xl font-serif font-bold">
                <span>TOTAL:</span>
                <span>{fmtEUR(quote.final_price || 0)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="mb-8">
            <div className="bg-amber-50 border border-amber-200 p-5">
              <h3 className="text-xs font-semibold mb-3 uppercase tracking-widest text-amber-900">
                Términos y Condiciones
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
            </div>
          </section>
        )}

        {/* Footer */}
        {config.footerText && (
          <footer className="mt-12 pt-6 border-t-2 border-slate-800">
            <p className="text-xs text-slate-600 text-center leading-relaxed font-serif">{config.footerText}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
