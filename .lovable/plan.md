

# Mostrar hora de creación, envío y aprobación en el listado de presupuestos

## Resumen

Actualmente la tabla `quotes` no tiene columnas `sent_at` ni `approved_at`. Se necesita:
1. Añadir esas columnas a la BD
2. Registrar automáticamente la fecha/hora cuando cambia el estado
3. Mostrar las horas en el listado (desktop y mobile)

## Cambios

### 1. Migración SQL -- añadir columnas `sent_at` y `approved_at`

```sql
ALTER TABLE quotes ADD COLUMN sent_at timestamptz;
ALTER TABLE quotes ADD COLUMN approved_at timestamptz;
```

Ademas, un trigger que las rellene automáticamente al cambiar el status:

```sql
CREATE OR REPLACE FUNCTION set_quote_status_timestamps()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') AND NEW.sent_at IS NULL THEN
    NEW.sent_at = now();
  END IF;
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') AND NEW.approved_at IS NULL THEN
    NEW.approved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_status_timestamps
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_quote_status_timestamps();
```

### 2. `src/pages/QuotesList.tsx`

- Añadir `sent_at, approved_at, updated_at` al select de `fetchQuotes`
- En la columna "Fecha" del desktop, mostrar fecha + hora de creación (formato `dd/MM/yyyy HH:mm`)
- Añadir subtext debajo con iconos: icono de envío + hora si `sent_at` existe, icono de check + hora si `approved_at` existe
- En el Excel export, incluir columnas "Hora creación", "Fecha envío", "Fecha aprobación"

### 3. `src/components/quotes/QuoteCard.tsx` (mobile)

- Cambiar la sección "Fecha" para mostrar hora además de fecha
- Añadir líneas con `sent_at` y `approved_at` cuando existan, con iconos `Send` y `CheckCircle2`

### Diseño visual (desktop)

La columna "Fecha" se amplía ligeramente y muestra:

```text
19/03/2026 14:32          ← created_at con hora
  📤 14:45  ✅ 15:10      ← sent_at y approved_at (solo si existen, texto xs muted)
```

### Archivos afectados

| Archivo | Cambio |
|---|---|
| Migración SQL | `sent_at`, `approved_at` + trigger |
| `src/pages/QuotesList.tsx` | Select + display timestamps en tabla y export |
| `src/components/quotes/QuoteCard.tsx` | Display timestamps en tarjeta mobile |

