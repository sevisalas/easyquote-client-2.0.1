import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';
import { paginateTemplate7Items } from './template7Pagination';

interface Template7Props {
  data: any;
}

const PAGE_STYLE: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  width: '210mm',
  height: '297mm',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#ffffff',
  margin: '0',
  padding: '0',
};

const PRICE_COLUMN_WIDTH = '112px';
const TOTALS_BLOCK_WIDTH = '280px';

export default function Template7({ data }: Template7Props) {
  const quote = data.quote || {};
  const customer = data.customer || {};
  const items = data.items || [];
  const quoteAdditionals = data.quote_additionals || [];
  const paginatedPages = paginateTemplate7Items({ items, quote, quoteAdditionals });

  const fmtEUR = (amount: number) => {
    const parts = amount.toFixed(2).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intPart},${parts[1]}\u00A0€`;
  };

  const getItemQuantity = (item: any) => {
    if (item.displayQuantity != null && item.displayQuantity !== '') return item.displayQuantity;
    if (item.prompts && item.prompts.length > 0) {
      const qtyPrompt = item.prompts.find((p: any) => 
        p.label?.toLowerCase().includes('cantidad') || p.label?.toLowerCase().includes('ejemplares')
      );
      if (qtyPrompt?.value != null && qtyPrompt.value !== '') return qtyPrompt.value;
    }
    if (item.quantity != null && item.quantity !== '') return item.quantity;
    return null;
  };

  const hasSubtotalDifference = (quote.tax_amount > 0) || (quote.discount_amount > 0);

  return (
    <>
      {paginatedPages.map((page, pageIndex) => (
    <div data-template7-page data-terms-page key={`template7-page-${pageIndex}`} style={PAGE_STYLE}>
      {/* Background image */}
      <img
        src="/assets/campillo-page1-bg.png?v=20260224b"
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '210mm',
          height: '296mm',
          objectFit: 'cover',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <style>{`
        [data-template7-page] [data-logo-container] img {
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      {/* Watermark for Draft */}
      {quote.status === 'draft' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '100px',
            fontWeight: 'bold',
            color: 'rgba(0, 0, 0, 0.06)',
            zIndex: 10,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          BORRADOR
        </div>
      )}

      {/* Cabecera: Solo Logo */}
      <div data-logo-container style={{ margin: 0, padding: '4px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', position: 'relative', zIndex: 1 }}>
        <img
          src="/assets/campillo-logo.png?v=20260224c"
          alt="Campillo Nevado"
          style={{ height: '74px', width: 'auto', display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* Contenido */}
      <div style={{ padding: '0 20px 0 35px', position: 'relative', zIndex: 1 }}>
        {/* Info presupuesto + cliente */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a3a5c', marginBottom: '2px' }}>
              PRESUPUESTO
            </h2>
            <p style={{ fontSize: '12px', color: '#555' }}>Nº {quote.quote_number || '-'}</p>
            <p style={{ fontSize: '12px', color: '#555' }}>
              Fecha: {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
            </p>
            {quote.valid_until && (
              <p style={{ fontSize: '12px', color: '#555' }}>
                Válido hasta: {format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: es })}
              </p>
            )}
          </div>
          <div
            style={{
              background: '#f7faf5',
              border: '1px solid #d0dfc8',
              borderRadius: '3px',
              padding: '8px 12px',
              minWidth: '264px',
            }}
          >
            <p style={{ fontSize: '11px', color: '#4a7c2e', fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase' }}>
              Cliente
            </p>
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a' }}>{customer.name || 'Cliente'}</p>
            {customer.address && (() => {
              const parts = customer.address.split(',').map((s: string) => s.trim());
              if (parts.length >= 4) {
                const street = parts.slice(0, -3).join(', ');
                const cpCity = [parts[parts.length - 2], parts[parts.length - 3]].filter(Boolean).join(' ');
                const provCountry = [parts[parts.length - 1]].filter(Boolean).join(', ');
                return (
                  <>
                    <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{street}</p>
                    <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{cpCity}</p>
                    {provCountry && <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{provCountry}</p>}
                  </>
                );
              }
              return <p style={{ fontSize: '11px', color: '#555' }}>{customer.address}</p>;
            })()}
          </div>
        </div>

        {/* Título y descripción del presupuesto */}
        {(quote.title || quote.description) && (
          <div style={{ marginBottom: '4px' }}>
            {quote.title && <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '1px', color: '#1a1a1a' }}>{quote.title}</h3>}
            {quote.description && <p style={{ fontSize: '11px', color: '#444', margin: 0 }}>{quote.description}</p>}
          </div>
        )}

        {/* Tabla de items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#6a9e3a', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold' }}>CONCEPTO</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', width: '55px' }}>UNID.</th>
               <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', width: PRICE_COLUMN_WIDTH }}>PRECIO</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((item: any, index: number) => {
              const hasMulti = item.multi_extra && item.multi_extra.length > 0;
              // For custom products: only hide qty/price when BOTH are empty (user didn't fill them).
              // If the user provided a price (or quantity), we must show it.
              const customPriceNum = parseFloat(String(item.price ?? 0).toString().replace(/\./g, '').replace(',', '.')) || 0;
              const customQtyRaw = item.quantity ?? item.displayQuantity;
              const customQtyNum = customQtyRaw == null || customQtyRaw === ''
                ? 0
                : (parseFloat(String(customQtyRaw).replace(/\./g, '').replace(',', '.')) || 0);
              const hideItemAmounts = item.isCustomProduct === true && customPriceNum <= 0 && customQtyNum <= 0;

              return (
              <React.Fragment key={index}>
                {/* Item name row */}
                <tr style={{ borderBottom: 'none' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      {item.images && item.images.length > 0 && (
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                          {item.images.map((imgUrl: string, imgIdx: number) => (
                            <img key={imgIdx} src={imgUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'cover', border: '1px solid #e5e7eb' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ))}
                        </div>
                      )}
                      <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{item.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px' }}></td>
                  <td style={{ padding: '6px 8px' }}></td>
                </tr>
                {/* Description */}
                {(!item.prompts || item.prompts.length === 0) && item.description && (
                  <tr style={{ borderBottom: 'none' }}>
                    <td colSpan={3} style={{ padding: '3px 8px 3px 20px' }}>
                      <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.4', whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: item.description.replace(/\n/g, '<br/>') }} />
                    </td>
                  </tr>
                )}
                {/* Prompts */}
                {item.prompts && item.prompts.length > 0 && (
                  <tr style={{ borderBottom: 'none' }}>
                    <td colSpan={3} style={{ padding: '3px 8px 3px 20px' }}>
                      <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.4' }}>
                        {item.prompts.map((prompt: any, pIdx: number) => (
                          <div key={pIdx}><span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{prompt.label}:</span> {prompt.value}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Components */}
                {item.components && item.components.length > 0 && (
                  <tr style={{ borderBottom: 'none' }}>
                    <td colSpan={3} style={{ padding: '3px 8px 3px 20px' }}>
                      {item.components.map((comp: any, cIdx: number) => (
                        <div key={cIdx} style={{ marginBottom: '4px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', marginBottom: '1px' }}>── {comp.alias} ──</div>
                          <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.4', paddingLeft: '8px' }}>
                            {comp.prompts.map((p: any, pIdx: number) => (
                              <div key={pIdx}><span style={{ fontWeight: 600 }}>{p.label}:</span> {p.value}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
                {/* Item additionals */}
                {item.item_additionals && item.item_additionals.length > 0 && (
                  <tr style={{ borderBottom: 'none' }}>
                    <td colSpan={3} style={{ padding: '3px 8px 3px 20px' }}>
                      <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.4' }}>
                        {item.item_additionals.map((adj: any, aIdx: number) => {
                          const qty = getItemQuantity(item);
                          const numQty = typeof qty === 'string' ? parseFloat(qty.replace(/\./g, '').replace(',', '.')) : (qty || 1);
                          let subtotal = adj.value;
                          let detail = '';
                          if (adj.type === 'percentage') {
                            const itemPrice = parseFloat(String(item.price || 0).replace(/\./g, '').replace(',', '.')) || 0;
                            subtotal = (itemPrice * adj.value) / 100;
                            detail = ` (${adj.value}%)`;
                          } else if (adj.type === 'quantity_multiplier') {
                            subtotal = adj.value * numQty;
                            detail = ` (${adj.value} €/ud × ${numQty})`;
                          } else if (adj.type === 'capacity_divider') {
                            const cap = adj.capacity_value || 1;
                            const units = Math.ceil(numQty / cap);
                            subtotal = adj.value * units;
                            detail = ` (${adj.value} € × ${units} uds)`;
                          }
                          return (
                            <div key={aIdx}>
                              <span style={{ fontWeight: 600 }}>
                                {adj.name}:
                              </span>{' '}
                              {fmtEUR(subtotal)}{detail}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Q1 price row */}
                <tr style={{ borderBottom: hasMulti ? 'none' : '1px solid #ddd' }}>
                  <td style={{ padding: '4px 8px' }}></td>
                  <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '12px' }}>
                    {!hideItemAmounts && (() => {
                      const quantity = getItemQuantity(item);
                      if (quantity == null || quantity === '') return '';
                      const numericQuantity = typeof quantity === 'string'
                        ? parseFloat(String(quantity).replace(/\./g, '').replace(',', '.'))
                        : quantity;
                      return Number.isFinite(numericQuantity)
                        ? new Intl.NumberFormat('es-ES').format(numericQuantity)
                        : String(quantity);
                    })()}
                  </td>
                   <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', width: PRICE_COLUMN_WIDTH, minWidth: PRICE_COLUMN_WIDTH }}>
                    {!hideItemAmounts ? fmtEUR(item.price || 0) : ''}
                  </td>
                </tr>
                {/* Additional quantity rows */}
                {!hideItemAmounts && hasMulti && item.multi_extra.map((me: any, meIdx: number) => {
                  let adjTotal = 0;
                  const adjs = item._raw_additionals || item.item_additionals || [];
                  adjs.forEach((adj: any) => {
                    const qtyIndex = meIdx + 1;
                    let baseValue = (adj.type === 'net_amount' && Array.isArray(adj.multiValues) && adj.multiValues[qtyIndex] != null)
                      ? adj.multiValues[qtyIndex] : adj.value;
                    let subtotal = baseValue;
                    if (adj.type === 'percentage') subtotal = (me.price * adj.value) / 100;
                    else if (adj.type === 'quantity_multiplier') subtotal = adj.value * me.qty;
                    else if (adj.type === 'capacity_divider') subtotal = adj.value * Math.ceil(me.qty / (adj.capacity_value || 1));
                    adjTotal += adj.is_discount ? -subtotal : subtotal;
                  });
                  return (
                    <tr key={`multi-${meIdx}`} style={{ borderBottom: meIdx === item.multi_extra.length - 1 ? '1px solid #ddd' : 'none' }}>
                      <td style={{ padding: '4px 8px' }}></td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '12px' }}>
                        {new Intl.NumberFormat('es-ES').format(me.qty)}
                      </td>
                       <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', width: PRICE_COLUMN_WIDTH, minWidth: PRICE_COLUMN_WIDTH }}>
                        {fmtEUR(me.price + adjTotal)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
              );
            })}
            {page.showSummary && quoteAdditionals.length > 0 && quoteAdditionals.map((adj: any, aIdx: number) => {
              let amount = adj.value;
              let label = adj.name;
              if (adj.type === 'percentage') {
                amount = ((quote.subtotal || 0) * adj.value) / 100;
                label = `${adj.name} (${adj.value}%)`;
              }
              return (
                <tr key={`qa-${aIdx}`} style={{ borderBottom: '1px solid #ddd' }}>
                  <td colSpan={2} style={{ padding: '6px 8px' }}>
                    <span style={{ fontSize: '12px', color: '#555' }}>
                      {label}
                    </span>
                  </td>
                   <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', width: PRICE_COLUMN_WIDTH, minWidth: PRICE_COLUMN_WIDTH }}>
                    {fmtEUR(amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totales */}
        {page.showSummary && (items.length > 1 || quoteAdditionals.length > 0 || quote.tax_amount > 0 || quote.discount_amount > 0) && (
          <div style={{ marginLeft: 'auto', width: TOTALS_BLOCK_WIDTH, minWidth: TOTALS_BLOCK_WIDTH, marginBottom: '14px' }}>
            {hasSubtotalDifference && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                <span style={{ color: '#666' }}>Subtotal:</span>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, minWidth: PRICE_COLUMN_WIDTH, textAlign: 'right' }}>{fmtEUR(quote.subtotal || 0)}</span>
              </div>
            )}
            {quote.tax_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                <span style={{ color: '#666' }}>IVA (21%):</span>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, minWidth: PRICE_COLUMN_WIDTH, textAlign: 'right' }}>{fmtEUR(quote.tax_amount || 0)}</span>
              </div>
            )}
            {quote.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#dc2626', marginBottom: '3px' }}>
                <span>Descuento:</span>
                <span style={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: PRICE_COLUMN_WIDTH, textAlign: 'right' }}>-{fmtEUR(quote.discount_amount || 0)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '15px', fontWeight: 'bold', color: '#4a7c2e', borderTop: '2px solid #4a7c2e', paddingTop: '6px', gap: '16px' }}>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>TOTAL (sin I.V.A.):</span>
              <span style={{ whiteSpace: 'nowrap', flex: '0 0 auto', minWidth: '132px', textAlign: 'right' }}>{fmtEUR(quote.final_price || 0)}</span>
            </div>
          </div>
        )}

        {/* Notas */}
        {page.showSummary && quote.notes && (
          <div style={{ marginBottom: '6px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#1a3a5c', textTransform: 'uppercase', marginBottom: '2px' }}>Notas</h3>
            <p style={{ fontSize: '11px', color: '#444', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Texto legal configurable - izquierda, mitad de ancho */}
      {page.showSummary && data.config?.footerText && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '20px',
            width: '50%',
            fontSize: '8.5px',
            color: '#666',
            lineHeight: '1.25',
            textAlign: 'left',
            zIndex: 1,
          }}
          dangerouslySetInnerHTML={{ __html: data.config.footerText }}
        />
      )}

      {/* Datos Campillo - abajo derecha */}
      <div
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '8px',
          fontSize: '9px',
          color: '#555',
          lineHeight: '1.3',
          textAlign: 'right',
          zIndex: 1,
        }}
      >
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11px', color: '#1a3a5c' }}>CAMPILLO NEVADO S.A.</p>
        <p style={{ margin: 0 }}>Desierto de Tabernas, 8</p>
        <p style={{ margin: 0 }}>28320 PINTO (Madrid)</p>
        <p style={{ margin: 0 }}>Teléf. 91 560 93 34</p>
        <p style={{ margin: 0 }}>contabilidad@campillonevado.es</p>
        <p style={{ margin: 0 }}>www.campillonevado.es</p>
      </div>
    </div>
      ))}
    </>
  );
}