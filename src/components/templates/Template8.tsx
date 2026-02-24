import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import React from 'react';

interface Template8Props {
  data: any;
}

const PAGE_STYLE: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  width: '210mm',
  height: '296mm',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#ffffff',
  margin: '0',
  padding: '0',
};

// Anebri brand colors (placeholder — update when branding is confirmed)
const BRAND = {
  primary: '#1a3a5c',      // dark navy
  accent: '#2563eb',        // blue accent
  accentLight: '#eff6ff',   // light blue bg
  accentBorder: '#bfdbfe',  // blue border
  totalColor: '#2563eb',
  headerBg: '#2563eb',
};

export default function Template8({ data }: Template8Props) {
  const quote = data.quote || {};
  const customer = data.customer || {};
  const items = data.items || [];

  const fmtEUR = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div data-template8-page style={PAGE_STYLE}>
      {/* Background image — replace with Anebri background when available */}
      {/* <img src="/assets/anebri-page1-bg.png" alt="" style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '296mm', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }} /> */}

      <style>{`
        [data-template8-page] [data-logo-container] img {
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

      {/* Cabecera: Logo */}
      <div data-logo-container style={{ margin: 0, padding: '12px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', position: 'relative', zIndex: 1 }}>
        {/* Replace with Anebri logo when available */}
        <div style={{ height: '100px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: BRAND.primary, letterSpacing: '2px' }}>ANEBRI</span>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: '5px 20px 0 35px', position: 'relative', zIndex: 1 }}>
        {/* Info presupuesto + cliente */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: BRAND.primary, marginBottom: '4px' }}>
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
              background: BRAND.accentLight,
              border: `1px solid ${BRAND.accentBorder}`,
              borderRadius: '3px',
              padding: '10px 14px',
              minWidth: '280px',
            }}
          >
            <p style={{ fontSize: '9px', color: BRAND.accent, fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase' }}>
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

        {/* Tabla de items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: BRAND.headerBg, color: 'white' }}>
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
                            <img key={imgIdx} src={imgUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'cover', border: '1px solid #e5e7eb' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ))}
                        </div>
                      )}
                      <span style={{ fontWeight: 'bold', fontSize: '10px' }}>{item.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px' }}>{fmtEUR(item.price || 0)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px' }}>{item.quantity || 1}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 'bold' }}>{fmtEUR((item.price || 0) * (item.quantity || 1))}</td>
                </tr>
                {(!item.prompts || item.prompts.length === 0) && item.description && (
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td colSpan={4} style={{ padding: '3px 8px 3px 20px' }}>
                      <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4', whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: item.description.replace(/\n/g, '<br/>') }} />
                    </td>
                  </tr>
                )}
                {item.prompts && item.prompts.length > 0 && (
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td colSpan={4} style={{ padding: '3px 8px 3px 20px' }}>
                      <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4' }}>
                        {item.prompts.map((prompt: any, pIdx: number) => (
                          <div key={pIdx}><span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{prompt.label}:</span> {prompt.value}</div>
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
                          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', marginBottom: '1px' }}>── {comp.alias} ──</div>
                          <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.4', paddingLeft: '8px' }}>
                            {comp.prompts.map((p: any, pIdx: number) => (
                              <div key={pIdx}><span style={{ fontWeight: 600 }}>{p.label}:</span> {p.value}</div>
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

        {/* Totales */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: BRAND.totalColor, borderTop: `2px solid ${BRAND.totalColor}`, paddingTop: '6px' }}>
            <span>TOTAL:</span>
            <span>{fmtEUR(quote.final_price || 0)}</span>
          </div>
        </div>

        {/* Notas */}
        {quote.notes && (
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ fontSize: '9px', fontWeight: 'bold', color: BRAND.primary, textTransform: 'uppercase', marginBottom: '2px' }}>Notas</h3>
            <p style={{ fontSize: '9px', color: '#444', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Datos Anebri - abajo derecha */}
      <div
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '15px',
          fontSize: '8px',
          color: '#555',
          lineHeight: '1.5',
          textAlign: 'right',
          zIndex: 1,
        }}
      >
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '10px', color: BRAND.primary }}>ANEBRI</p>
        <p style={{ margin: 0 }}>Dirección por confirmar</p>
        <p style={{ margin: 0 }}>info@anebri.com</p>
        <p style={{ margin: 0 }}>www.anebri.com</p>
      </div>
    </div>
  );
}
