import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
      <header className="bg-white p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          {config.logoUrl && (
            <img src={config.logoUrl} alt="Logo" className="h-16" />
          )}
          <div className="text-right">
            <h1 className="text-2xl font-serif font-bold mb-1" style={{ color: accentColor }}>
              {config.companyName || 'Mi Empresa'}
            </h1>
          </div>
        </div>
        <div className="h-1 w-full" style={{ backgroundColor: accentColor }}></div>
      </header>

      <div className="p-8">
        {/* Document Info Banner */}
        <div className="bg-white p-6 shadow-sm mb-6 rounded-sm">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: accentColor }}>
                Presupuesto
              </h2>
              <p className="text-2xl font-serif font-bold">{quote.quote_number || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fecha</p>
              <p className="text-sm font-semibold">
                {quote.created_at ? format(new Date(quote.created_at), 'dd MMMM yyyy', { locale: es }) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <section className="bg-white p-6 shadow-sm mb-6 rounded-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-1 h-16" style={{ backgroundColor: accentColor }}></div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: accentColor }}>
                Cliente
              </h3>
              <p className="font-serif font-bold text-lg mb-1">{customer.name || 'Cliente'}</p>
              {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
              {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
              {customer.address && <p className="text-sm text-gray-600 mt-1">{customer.address}</p>}
            </div>
          </div>
        </section>

        {/* Quote Description */}
        {(quote.title || quote.description) && (
          <section className="bg-white p-6 shadow-sm mb-6 rounded-sm">
            {quote.title && (
              <h3 className="font-serif font-bold text-xl mb-2" style={{ color: accentColor }}>
                {quote.title}
              </h3>
            )}
            {quote.description && (
              <p className="text-sm text-gray-700 leading-relaxed">{quote.description}</p>
            )}
          </section>
        )}

        {/* Items */}
        <section className="bg-white p-6 shadow-sm mb-6 rounded-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: accentColor }}>
            Detalle de Conceptos
          </h3>
          <table className="w-full">
            <thead>
              <tr className="border-b-2" style={{ borderColor: accentColor }}>
                <th className="text-left py-3 text-xs uppercase tracking-wide font-semibold" style={{ color: accentColor }}>
                  Concepto
                </th>
                <th className="text-right py-3 text-xs uppercase tracking-wide font-semibold w-32" style={{ color: accentColor }}>
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-4">
                    <p className="font-semibold mb-1">{item.description || item.name || item.product_name || 'Producto'}</p>
                  </td>
                  <td className="py-4 text-right font-semibold">{fmtEUR(item.price || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="bg-white p-6 shadow-sm mb-6 rounded-sm ml-auto w-96">
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
              <div className="flex justify-between text-sm text-red-600">
                <span>Descuento:</span>
                <span className="font-semibold">-{fmtEUR(quote.discount_amount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t-2 font-bold text-xl" style={{ borderColor: accentColor, color: accentColor }}>
              <span>TOTAL:</span>
              <span>{fmtEUR(quote.final_price || 0)}</span>
            </div>
          </div>
        </section>

        {/* Notes */}
        {quote.notes && (
          <section className="bg-white p-6 shadow-sm mb-6 rounded-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: accentColor }}>
              Observaciones
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </section>
        )}

        {/* Footer */}
        {config.footerText && (
          <footer className="bg-white p-6 shadow-sm rounded-sm">
            <p className="text-xs text-gray-600 text-center leading-relaxed">{config.footerText}</p>
          </footer>
        )}
      </div>
    </div>
  );
}
