

## Ajustar tamaño del logo en Template 7

El logo PNG ya ha sido recortado (sin márgenes blancos internos). Ahora hay que aumentar el ancho del logo en el código para que se vea grande y prominente.

### Cambio

**Archivo:** `src/components/templates/Template7.tsx`

- Cambiar el ancho del logo de `220px` a `350px` (ahora que no tiene márgenes internos, este tamaño mostrara un logo grande y visible sin desperdiciar espacio)
- Mantener el padding del contenedor reducido (`20px 40px 10px`)

### Detalle tecnico

Linea actual:
```tsx
style={{ width: '220px', objectFit: 'contain' }}
```

Se cambia a:
```tsx
style={{ width: '350px', objectFit: 'contain' }}
```

No hay otros cambios necesarios. La altura fija de la pagina (`296mm`) y el `overflow: hidden` ya estan correctos para evitar la segunda pagina.

