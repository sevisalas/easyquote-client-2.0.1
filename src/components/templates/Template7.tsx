import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template7Props {
  data: any;
}

const CAMPILLO_GREEN = '#4a7c59';
const CAMPILLO_GREEN_LIGHT = '#6b9e5a';

export default function Template7({ data }: Template7Props) {
  const config = data.config || {};
  const quote = data.quote || {};
  const customer = data.customer || {};
  const items = data.items || [];
  const termsPageText = config.termsPageText || '';

  const fmtEUR = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <>
      {/* ===== PÁGINA 1 - PRESUPUESTO ===== */}
      <div
        className="bg-white relative"
        style={{
          fontFamily: 'Arial, sans-serif',
          width: '210mm',
          minHeight: '297mm',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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

        {/* ── CABECERA VERDE DEGRADADA ── */}
        <header
          style={{
            background: `linear-gradient(135deg, ${CAMPILLO_GREEN} 0%, ${CAMPILLO_GREEN_LIGHT} 100%)`,
            color: 'white',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.85 }}>
              Artes Gráficas
            </span>
            <img
              src="/lovable-uploads/logo_transparente.png"
              alt="Campillo Nevado"
              style={{ height: '40px' }}
              crossOrigin="anonymous"
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
              CAMPILLO NEVADO S.A.
            </div>
            <div style={{ fontSize: '9px', opacity: 0.8 }}>NIF: A-28083293</div>
          </div>
        </header>

        {/* ── TEXTO VERTICAL REGISTRO MERCANTIL (izquierda) ── */}
        <div
          style={{
            position: 'absolute',
            left: '2px',
            top: '80px',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '6px',
            color: '#999',
            lineHeight: '1.2',
            maxHeight: '80%',
          }}
        >
          Reg. Mercantil de Madrid. Tomo 1.848, Libro 0, Folio 189, Sección 8ª, Hoja M-33.228
        </div>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <div style={{ padding: '16px 28px 16px 28px' }}>
          {/* Info presupuesto + cliente */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: CAMPILLO_GREEN, marginBottom: '4px' }}>
                PRESUPUESTO
              </h2>
              <p style={{ fontSize: '10px', color: '#555' }}>Nº {quote.quote_number || '-'}</p>
              <p style={{ fontSize: '10px', color: '#555' }}>
                Fecha: {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
              </p>
              {quote.valid_until && (
                <p style={{ fontSize: '10px', color: '#555' }}>
                  Válido hasta: {format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: es })}
                </p>
              )}
            </div>
            <div
              style={{
                background: '#f5f9f5',
                border: `1px solid ${CAMPILLO_GREEN}33`,
                borderRadius: '4px',
                padding: '8px 12px',
                minWidth: '200px',
              }}
            >
              <p style={{ fontSize: '9px', color: CAMPILLO_GREEN, fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase' }}>
                Cliente
              </p>
              <p style={{ fontSize: '11px', fontWeight: 'bold' }}>{customer.name || 'Cliente'}</p>
              {customer.email && <p style={{ fontSize: '9px', color: '#555' }}>{customer.email}</p>}
              {customer.phone && <p style={{ fontSize: '9px', color: '#555' }}>{customer.phone}</p>}
              {customer.address && <p style={{ fontSize: '9px', color: '#555' }}>{customer.address}</p>}
            </div>
          </div>

          {/* Título/Descripción */}
          {(quote.title || quote.description) && (
            <div style={{ marginBottom: '10px' }}>
              {quote.title && <h3 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>{quote.title}</h3>}
              {quote.description && <p style={{ fontSize: '10px', color: '#444' }}>{quote.description}</p>}
            </div>
          )}

          {/* ── TABLA DE ITEMS ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: CAMPILLO_GREEN, color: 'white' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '10px', fontWeight: 'bold' }}>CONCEPTO</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '10px', fontWeight: 'bold', width: '70px' }}>PRECIO</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '10px', fontWeight: 'bold', width: '50px' }}>UNID.</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: '10px', fontWeight: 'bold', width: '80px' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => (
                <React.Fragment key={index}>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        {item.images && item.images.length > 0 && (
                          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                            {item.images.map((imgUrl: string, imgIdx: number) => (
                              <img
                                key={imgIdx}
                                src={imgUrl}
                                alt=""
                                style={{ width: '30px', height: '30px', objectFit: 'cover', border: '1px solid #e5e7eb' }}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ))}
                          </div>
                        )}
                        <span style={{ fontWeight: 'bold', fontSize: '10px' }}>{item.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px' }}>{fmtEUR(item.price || 0)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>{item.quantity || 1}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>
                      {fmtEUR((item.price || 0) * (item.quantity || 1))}
                    </td>
                  </tr>
                  {item.prompts && item.prompts.length > 0 && (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td colSpan={4} style={{ padding: '3px 8px 3px 20px' }}>
                        <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4' }}>
                          {item.prompts.map((prompt: any, pIdx: number) => (
                            <div key={pIdx}>
                              <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{prompt.label}:</span> {prompt.value}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {item.components && item.components.length > 0 && (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td colSpan={4} style={{ padding: '3px 8px 3px 20px' }}>
                        {item.components.map((comp: any, cIdx: number) => (
                          <div key={cIdx} style={{ marginBottom: '4px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', marginBottom: '1px' }}>
                              ── {comp.alias} ──
                            </div>
                            <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4', paddingLeft: '8px' }}>
                              {comp.prompts.map((p: any, pIdx: number) => (
                                <div key={pIdx}>
                                  <span style={{ fontWeight: 600 }}>{p.label}:</span> {p.value}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* ── TOTALES ── */}
          <div style={{ marginLeft: 'auto', width: '200px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
              <span style={{ color: '#666' }}>Subtotal:</span>
              <span style={{ fontWeight: 500 }}>{fmtEUR(quote.subtotal || 0)}</span>
            </div>
            {quote.tax_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                <span style={{ color: '#666' }}>IVA (21%):</span>
                <span style={{ fontWeight: 500 }}>{fmtEUR(quote.tax_amount || 0)}</span>
              </div>
            )}
            {quote.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#dc2626', marginBottom: '3px' }}>
                <span>Descuento:</span>
                <span>-{fmtEUR(quote.discount_amount || 0)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                fontWeight: 'bold',
                color: CAMPILLO_GREEN,
                borderTop: `2px solid ${CAMPILLO_GREEN}`,
                paddingTop: '6px',
              }}
            >
              <span>TOTAL:</span>
              <span>{fmtEUR(quote.final_price || 0)}</span>
            </div>
          </div>

          {/* Notas */}
          {quote.notes && (
            <div style={{ marginBottom: '10px' }}>
              <h3 style={{ fontSize: '9px', fontWeight: 'bold', color: CAMPILLO_GREEN, textTransform: 'uppercase', marginBottom: '2px' }}>
                Notas
              </h3>
              <p style={{ fontSize: '9px', color: '#444', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{quote.notes}</p>
            </div>
          )}
        </div>

        {/* ── PIE CON OLAS VERDES ── */}
        <footer
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {/* SVG wave decoration */}
          <svg viewBox="0 0 800 60" style={{ width: '100%', display: 'block' }}>
            <path
              d="M0,30 C200,60 400,0 800,30 L800,60 L0,60 Z"
              fill={CAMPILLO_GREEN}
              opacity="0.3"
            />
            <path
              d="M0,40 C200,10 400,50 800,20 L800,60 L0,60 Z"
              fill={CAMPILLO_GREEN}
              opacity="0.6"
            />
          </svg>
          <div
            style={{
              backgroundColor: CAMPILLO_GREEN,
              color: 'white',
              padding: '6px 24px',
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              fontSize: '8px',
            }}
          >
            <span>Desierto de Tabernas, 8 / 28320 PINTO (Madrid)</span>
            <span>Telef. 91 560 93 34</span>
            <span>contabilidad@campillonevado.es</span>
            <span>www.campillonevado.es</span>
          </div>
        </footer>
      </div>

      {/* ===== PÁGINA 2 - CONDICIONES DE VENTA (solo si hay texto) ===== */}
      {termsPageText && (
        <div
          data-terms-page="true"
          className="bg-white relative"
          style={{
            fontFamily: 'Arial, sans-serif',
            width: '210mm',
            minHeight: '297mm',
            position: 'relative',
            overflow: 'hidden',
            pageBreakBefore: 'always',
          }}
        >
          {/* Cabecera repetida */}
          <header
            style={{
              background: `linear-gradient(135deg, ${CAMPILLO_GREEN} 0%, ${CAMPILLO_GREEN_LIGHT} 100%)`,
              color: 'white',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.85 }}>
                Artes Gráficas
              </span>
              <img
                src="/lovable-uploads/logo_transparente.png"
                alt="Campillo Nevado"
                style={{ height: '40px' }}
                crossOrigin="anonymous"
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
                CAMPILLO NEVADO S.A.
              </div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>NIF: A-28083293</div>
            </div>
          </header>

          {/* Contenido condiciones */}
          <div style={{ padding: '24px 28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: CAMPILLO_GREEN, marginBottom: '16px', textAlign: 'center', textTransform: 'uppercase' }}>
              Condiciones de venta
            </h2>
            <div
              style={{
                fontSize: '9px',
                color: '#333',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}
            >
              {termsPageText}
            </div>
          </div>

          {/* Pie repetido */}
          <footer
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
          >
            <svg viewBox="0 0 800 60" style={{ width: '100%', display: 'block' }}>
              <path d="M0,30 C200,60 400,0 800,30 L800,60 L0,60 Z" fill={CAMPILLO_GREEN} opacity="0.3" />
              <path d="M0,40 C200,10 400,50 800,20 L800,60 L0,60 Z" fill={CAMPILLO_GREEN} opacity="0.6" />
            </svg>
            <div
              style={{
                backgroundColor: CAMPILLO_GREEN,
                color: 'white',
                padding: '6px 24px',
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                fontSize: '8px',
              }}
            >
              <span>Desierto de Tabernas, 8 / 28320 PINTO (Madrid)</span>
              <span>Telef. 91 560 93 34</span>
              <span>contabilidad@campillonevado.es</span>
              <span>www.campillonevado.es</span>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
