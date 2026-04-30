import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';
import { paginateTemplate7Items } from './template7Pagination';

const formatPdfDescription = (value?: string) =>
  String(value ?? '')
    .replace(/^%+\s*(.+?)\s*%+$/gm, '── $1 ──')
    .replace(/%%\s*([^%\n]+?)\s*%%/g, '── $1 ──');

interface Template9Props {
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

const PRICE_COLUMN_WIDTH = '110px';
const QTY_COLUMN_WIDTH = '70px';

export default function Template9({ data }: Template9Props) {
  const quote = data.quote || {};
  const customer = data.customer || {};
  const items = data.items || [];
  const quoteAdditionals = data.quote_additionals || [];
  const paginatedPages = paginateTemplate7Items({ items, quote, quoteAdditionals, reserveFooterShare: 0.22 });

  const fmtEUR = (amount: number) => {
    const parts = Number(amount || 0).toFixed(2).split('.');
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

  const taxRate = quote.tax_amount > 0 && quote.subtotal > 0
    ? Math.round((quote.tax_amount / quote.subtotal) * 100)
    : 21;

  return (
    <>
      {paginatedPages.map((page, pageIndex) => {
        const isLastPage = pageIndex === paginatedPages.length - 1;

        return (
          <div data-template9-page data-terms-page key={`template9-page-${pageIndex}`} style={PAGE_STYLE}>
            {/* Watermark BORRADOR */}
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

            {/* Cabecera: Logo izquierda + título derecha */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '20px 28px 8px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div data-logo-container>
                <img
                  src="/assets/campillo-logo.png?v=20260224c"
                  alt="Campillo Nevado"
                  style={{ height: '78px', width: 'auto', display: 'block', margin: 0, padding: 0 }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 400, color: '#3a3a3a', margin: 0, letterSpacing: '0.5px' }}>
                  PRESUPUESTO
                </h1>
                <p style={{ fontSize: '14px', color: '#9a9a9a', margin: '2px 0 0', fontWeight: 300 }}>
                  {quote.quote_number || '-'}
                </p>
              </div>
            </div>

            {/* Bloque fechas + cliente (sin recuadros) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '24px 28px 14px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ fontSize: '11px', color: '#3a3a3a', lineHeight: '1.7' }}>
                <div>
                  <span style={{ color: '#6a6a6a' }}>Fecha: </span>
                  <span>{quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}</span>
                </div>
                {quote.valid_until && (
                  <div>
                    <span style={{ color: '#6a6a6a' }}>Fecha vencimiento: </span>
                    <span>{format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: es })}</span>
                  </div>
                )}
                <div>
                  <span style={{ color: '#6a6a6a' }}>Ref: </span>
                  <span>{quote.reference || ''}</span>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#3a3a3a', lineHeight: '1.6', textAlign: 'left', minWidth: '260px' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px' }}>{customer.name || 'Cliente'}</p>
                {customer.tax_id && <p style={{ margin: 0 }}>{customer.tax_id}</p>}
                {customer.address && (() => {
                  const parts = customer.address.split(',').map((s: string) => s.trim()).filter(Boolean);
                  if (parts.length >= 4) {
                    const street = parts.slice(0, -3).join(', ');
                    const cpCity = `${parts[parts.length - 2] || ''} ${parts[parts.length - 3] || ''}`.trim();
                    const provCountry = [parts[parts.length - 1]].filter(Boolean).join(', ');
                    return (
                      <>
                        {street && <p style={{ margin: 0 }}>{street}</p>}
                        {cpCity && <p style={{ margin: 0 }}>{cpCity}</p>}
                        {provCountry && <p style={{ margin: 0 }}>{provCountry}</p>}
                      </>
                    );
                  }
                  return <p style={{ margin: 0 }}>{customer.address}</p>;
                })()}
              </div>
            </div>

            {/* Título / descripción */}
            {(quote.title || quote.description) && (
              <div style={{ padding: '0 28px 6px', position: 'relative', zIndex: 1 }}>
                {quote.title && <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: '#1a1a1a' }}>{quote.title}</h3>}
                {quote.description && <p style={{ fontSize: '11px', color: '#444', margin: '2px 0 0' }}>{quote.description}</p>}
              </div>
            )}

            {/* Tabla items */}
            <div style={{ padding: '0 28px', position: 'relative', zIndex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f3f3', color: '#3a3a3a' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #e5e5e5' }}>CONCEPTO</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 'bold', width: QTY_COLUMN_WIDTH, borderBottom: '1px solid #e5e5e5' }}>UNIDADES</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '11px', fontWeight: 'bold', width: PRICE_COLUMN_WIDTH, borderBottom: '1px solid #e5e5e5' }}>SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((item: any, index: number) => {
                    const hasMulti = item.multi_extra && item.multi_extra.length > 0;
                    const customPriceNum = parseFloat(String(item.price ?? 0).toString().replace(/\./g, '').replace(',', '.')) || 0;
                    const hideItemAmounts = item.isCustomProduct === true && customPriceNum <= 0;

                    return (
                      <React.Fragment key={index}>
                        {/* Nombre */}
                        <tr>
                          <td style={{ padding: '8px 10px 2px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              {item.images && item.images.length > 0 && (
                                <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                  {item.images.map((imgUrl: string, imgIdx: number) => (
                                    <img key={imgIdx} src={imgUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'cover', border: '1px solid #e5e7eb' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ))}
                                </div>
                              )}
                              <span style={{ fontWeight: 'bold', fontSize: '11.5px', color: '#1a1a1a' }}>{item.name}</span>
                            </div>
                          </td>
                          <td></td>
                          <td></td>
                        </tr>
                        {/* Descripción */}
                        {(!item.prompts || item.prompts.length === 0) && item.description && (
                          <tr>
                            <td colSpan={3} style={{ padding: '2px 10px 2px 22px' }}>
                              <div style={{ fontSize: '10.5px', color: '#555', lineHeight: '1.45', whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: formatPdfDescription(item.description).replace(/\n/g, '<br/>') }} />
                            </td>
                          </tr>
                        )}
                        {/* Prompts */}
                        {item.prompts && item.prompts.length > 0 && (
                          <tr>
                            <td colSpan={3} style={{ padding: '2px 10px 2px 22px' }}>
                              <div style={{ fontSize: '10.5px', color: '#555', lineHeight: '1.45' }}>
                                {item.prompts.map((prompt: any, pIdx: number) => (
                                  <div key={pIdx}><span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{prompt.label}:</span> {prompt.value}</div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Components */}
                        {item.components && item.components.length > 0 && (
                          <tr>
                            <td colSpan={3} style={{ padding: '2px 10px 2px 22px' }}>
                              {item.components.map((comp: any, cIdx: number) => (
                                <div key={cIdx} style={{ marginBottom: '4px' }}>
                                  <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', marginBottom: '1px' }}>── {comp.alias} ──</div>
                                  <div style={{ fontSize: '10.5px', color: '#555', lineHeight: '1.45', paddingLeft: '8px' }}>
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
                          <tr>
                            <td colSpan={3} style={{ padding: '2px 10px 2px 22px' }}>
                              <div style={{ fontSize: '10.5px', color: '#555', lineHeight: '1.45' }}>
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
                                      <span style={{ fontWeight: 600 }}>{adj.name}:</span>{' '}
                                      {fmtEUR(subtotal)}{detail}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Q1 row */}
                        <tr style={{ borderBottom: hasMulti ? 'none' : '1px solid #e5e5e5' }}>
                          <td style={{ padding: '4px 10px 8px' }}></td>
                          <td style={{ padding: '4px 10px 8px', textAlign: 'right', fontSize: '11px', color: '#3a3a3a' }}>
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
                          <td style={{ padding: '4px 10px 8px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', color: '#1a1a1a' }}>
                            {!hideItemAmounts ? fmtEUR(item.price || 0) : ''}
                          </td>
                        </tr>
                        {/* Multi-qty rows */}
                        {!hideItemAmounts && hasMulti && item.multi_extra.map((me: any, meIdx: number) => (
                          <tr key={`multi-${meIdx}`} style={{ borderBottom: meIdx === item.multi_extra.length - 1 ? '1px solid #e5e5e5' : 'none' }}>
                            <td style={{ padding: '4px 10px 8px' }}></td>
                            <td style={{ padding: '4px 10px 8px', textAlign: 'right', fontSize: '11px', color: '#3a3a3a' }}>
                              {new Intl.NumberFormat('es-ES').format(me.qty)}
                            </td>
                            <td style={{ padding: '4px 10px 8px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', color: '#1a1a1a' }}>
                              {fmtEUR(me.price || 0)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {/* Quote additionals globales */}
                  {page.showSummary && quoteAdditionals.length > 0 && quoteAdditionals.map((adj: any, aIdx: number) => {
                    let amount = adj.value;
                    let label = adj.name;
                    if (adj.type === 'percentage') {
                      amount = ((quote.subtotal || 0) * adj.value) / 100;
                      label = `${adj.name} (${adj.value}%)`;
                    }
                    return (
                      <tr key={`qa-${aIdx}`} style={{ borderBottom: '1px solid #e5e5e5' }}>
                        <td colSpan={2} style={{ padding: '6px 10px', fontSize: '11px', color: '#555' }}>{label}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{fmtEUR(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totales tipo factura: Base + Total */}
              {page.showSummary && (items.length > 0 || quote.tax_amount > 0) && (
                <div style={{ marginTop: '14px', borderTop: '1px solid #e5e5e5', paddingTop: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', color: '#3a3a3a', width: '50%' }}>BASE IMPONIBLE</th>
                        <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', color: '#3a3a3a', width: '50%' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                        <td style={{ textAlign: 'center', padding: '4px 10px 8px', fontSize: '11.5px', color: '#1a1a1a' }}>{fmtEUR(quote.subtotal || quote.final_price || 0)}</td>
                        <td style={{ textAlign: 'center', padding: '4px 10px 8px', fontSize: '11.5px', color: '#1a1a1a' }}>
                          {fmtEUR((Number(quote.subtotal || quote.final_price || 0)) - Number(quote.discount_amount || 0))}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12.5px', color: '#1a1a1a', fontWeight: 'bold' }}>{fmtEUR(quote.subtotal || quote.final_price || 0)}</td>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: '12.5px', color: '#1a1a1a', fontWeight: 'bold' }}>
                          {fmtEUR((Number(quote.subtotal || quote.final_price || 0)) - Number(quote.discount_amount || 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notas */}
              {page.showNotes && quote.notes && (
                <div style={{ marginTop: '14px' }}>
                  <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a', textTransform: 'uppercase', marginBottom: '4px' }}>Notas</h3>
                  <p style={{ fontSize: '10.5px', color: '#444', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>{quote.notes}</p>
                </div>
              )}

              {/* Texto legal configurable (forma de pago, etc.) - solo última página */}
              {isLastPage && data.config?.footerText && (
                <div
                  style={{ marginTop: '20px', fontSize: '10.5px', color: '#3a3a3a', lineHeight: '1.5' }}
                  dangerouslySetInnerHTML={{ __html: data.config.footerText }}
                />
              )}
            </div>

            {/* Footer corporativo Campillo */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '14px',
                padding: '10px 28px 0',
                borderTop: '1px solid #e5e5e5',
                margin: '0 28px',
                textAlign: 'center',
                fontSize: '8.5px',
                color: '#7a7a7a',
                lineHeight: '1.4',
                zIndex: 1,
              }}
            >
              <p style={{ margin: 0 }}>Inscrita en el Reg. Merc. nº de Madrid. Tomo 781, General, de la Sección 3ª, Folio 37, Hoja 67855-1, Inscripción 1ª.</p>
              <p style={{ margin: 0 }}>CAMPILLO NEVADO S.A. A78094166 c/ Desierto de tabernas, 8</p>
              <p style={{ margin: 0 }}>Pinto (28320), Madrid, España +34 91 560 93 34 contabilidad@campillonevado.es</p>
            </div>

            {/* Paginación */}
            <div
              style={{
                position: 'absolute',
                right: '28px',
                bottom: '4px',
                fontSize: '8.5px',
                color: '#7a7a7a',
                zIndex: 2,
              }}
            >
              {pageIndex + 1}/{paginatedPages.length}
            </div>
          </div>
        );
      })}
    </>
  );
}