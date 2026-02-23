import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template7Props {
  data: any;
}

// Colors extracted from the original Campillo letterhead
const GREEN_PRIMARY = '#6a9e3a'; // Bright green from the gradient bar & waves
const GREEN_DARK = '#4a7c2e';   // Darker green accent

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
          fontFamily: 'Arial, Helvetica, sans-serif',
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

        {/* ── BARRA VERDE SUPERIOR (fina, degradada) ── */}
        <div
          style={{
            height: '8px',
            background: `linear-gradient(90deg, ${GREEN_PRIMARY} 0%, ${GREEN_DARK} 50%, ${GREEN_PRIMARY} 100%)`,
          }}
        />

        {/* ── LOGO CAMPILLO (arriba izquierda) ── */}
        <div style={{ padding: '12px 24px 0 24px' }}>
          <img
            src="/assets/campillo-logo.png"
            alt="Campillo Nevado S.A. - Artes Gráficas"
            style={{ height: '90px' }}
            crossOrigin="anonymous"
          />
        </div>

        {/* ── TEXTO VERTICAL REGISTRO MERCANTIL (izquierda) ── */}
        <div
          style={{
            position: 'absolute',
            left: '4px',
            top: '140px',
            bottom: '120px',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '6.5px',
            color: '#888',
            lineHeight: '1.3',
            letterSpacing: '0.3px',
          }}
        >
          Inscrita en el Reg. Merc. nº 1 de Madrid. Tomo 781, General, 756 de la Sección 3ª, Folio 37, Hoja 67855-1, Inscripción 1ª.
        </div>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <div style={{ padding: '16px 28px 16px 28px' }}>
          {/* Info presupuesto + cliente */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a3a5c', marginBottom: '4px' }}>
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
                background: '#f7faf5',
                border: `1px solid #d0dfc8`,
                borderRadius: '3px',
                padding: '8px 12px',
                minWidth: '200px',
              }}
            >
              <p style={{ fontSize: '9px', color: GREEN_DARK, fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase' }}>
                Cliente
              </p>
              <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a' }}>{customer.name || 'Cliente'}</p>
              {customer.email && <p style={{ fontSize: '9px', color: '#555' }}>{customer.email}</p>}
              {customer.phone && <p style={{ fontSize: '9px', color: '#555' }}>{customer.phone}</p>}
              {customer.address && <p style={{ fontSize: '9px', color: '#555' }}>{customer.address}</p>}
            </div>
          </div>

          {/* Título/Descripción */}
          {(quote.title || quote.description) && (
            <div style={{ marginBottom: '10px' }}>
              {quote.title && <h3 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px', color: '#1a1a1a' }}>{quote.title}</h3>}
              {quote.description && <p style={{ fontSize: '10px', color: '#444' }}>{quote.description}</p>}
            </div>
          )}

          {/* ── TABLA DE ITEMS ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: GREEN_PRIMARY, color: 'white' }}>
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
                color: GREEN_DARK,
                borderTop: `2px solid ${GREEN_DARK}`,
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
              <h3 style={{ fontSize: '9px', fontWeight: 'bold', color: '#1a3a5c', textTransform: 'uppercase', marginBottom: '2px' }}>
                Notas
              </h3>
              <p style={{ fontSize: '9px', color: '#444', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{quote.notes}</p>
            </div>
          )}
        </div>

        {/* ── PIE: OLA VERDE DERECHA + DATOS ALINEADOS A LA DERECHA ── */}
        <footer
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {/* SVG ola verde orgánica (lado derecho, como el original) */}
          <svg
            viewBox="0 0 800 120"
            style={{ width: '100%', display: 'block' }}
            preserveAspectRatio="none"
          >
            {/* Ola clara de fondo */}
            <path
              d="M300,120 C400,40 500,80 600,30 C650,10 700,20 800,0 L800,120 Z"
              fill={GREEN_PRIMARY}
              opacity="0.15"
            />
            {/* Ola más oscura */}
            <path
              d="M400,120 C480,70 550,90 650,40 C700,20 750,25 800,15 L800,120 Z"
              fill={GREEN_PRIMARY}
              opacity="0.3"
            />
          </svg>

          {/* Datos de contacto alineados a la derecha */}
          <div
            style={{
              textAlign: 'right',
              padding: '4px 28px 14px 28px',
              fontSize: '9px',
              color: '#333',
              lineHeight: '1.6',
            }}
          >
            <div>Desierto de Tabernas, 8</div>
            <div>28320 PINTO (Madrid)</div>
            <div>Teléf. 91 560 93 34</div>
            <div>contabilidad@campillonevado.es</div>
            <div>www.campillonevado.es</div>
          </div>
        </footer>
      </div>

      {/* ===== PÁGINA 2 - CONDICIONES DE VENTA (solo si hay texto) ===== */}
      {termsPageText && (
        <div
          data-terms-page="true"
          className="bg-white relative"
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            width: '210mm',
            minHeight: '297mm',
            position: 'relative',
            overflow: 'hidden',
            pageBreakBefore: 'always',
          }}
        >
          {/* Barra verde superior */}
          <div
            style={{
              height: '8px',
              background: `linear-gradient(90deg, ${GREEN_PRIMARY} 0%, ${GREEN_DARK} 50%, ${GREEN_PRIMARY} 100%)`,
            }}
          />

          {/* Contenido condiciones */}
          <div style={{ padding: '40px 60px 120px 60px' }}>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1a1a1a',
                marginBottom: '28px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Condiciones de venta
            </h2>
            <div
              style={{
                fontSize: '10px',
                color: '#333',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
              }}
            >
              {termsPageText}
            </div>
          </div>

          {/* Cláusula LOPD al pie */}
          <footer
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              borderTop: '2px solid #1a3a5c',
              padding: '8px 28px 12px 28px',
              backgroundColor: '#f8f8f8',
            }}
          >
            <p style={{ fontSize: '7px', fontWeight: 'bold', color: '#1a3a5c', marginBottom: '4px', textTransform: 'uppercase' }}>
              Ley orgánica de protección de datos de carácter personal. Cláusula informativa clientes - albaranes o facturas
            </p>
            <p style={{ fontSize: '6.5px', color: '#555', lineHeight: '1.5' }}>
              De conformidad con lo que establece la Ley Orgánica 15/1999 de Protección de Datos de Carácter Personal, le informamos que sus datos personales serán incorporados a un fichero bajo la responsabilidad de ARTES GRÁFICAS CAMPILLO NEVADO S.A., con la finalidad de poder atender los compromisos derivados de la relación que mantenemos con usted.
            </p>
            <p style={{ fontSize: '6.5px', color: '#555', lineHeight: '1.5', marginTop: '2px' }}>
              Puede ejercer sus derechos de acceso, cancelación, rectificación y oposición mediante un escrito a la dirección: C/ ANTONIO GONZÁLEZ PORRAS, 35-37 - 28019 MADRID.
            </p>
            <p style={{ fontSize: '6.5px', color: '#555', lineHeight: '1.5', marginTop: '2px' }}>
              Si en el período de 30 días no nos comunica lo contrario, entenderemos que sus datos no han sido modificados, que se compromete a notificarnos cualquier variación y que tenemos su consentimiento para tratarlos para la finalidad mencionada con anterioridad así como, para poder enviarle información de carácter promocional o publicitario, que consideremos pueda ser de su interés, a la dirección de correo postal que nos ha proporcionado.
            </p>
          </footer>
        </div>
      )}
    </>
  );
}
