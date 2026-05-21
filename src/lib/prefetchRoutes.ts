/**
 * Prefetch en background de los chunks de rutas más usadas.
 * Se llama tras el login para que al navegar el JS ya esté en caché.
 * Usa `requestIdleCallback` para no competir con el render inicial.
 */
const idle = (cb: () => void) => {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 4000 });
  else setTimeout(cb, 1500);
};

let started = false;

export function prefetchCommonRoutes() {
  if (started) return;
  started = true;
  idle(() => {
    // Rutas más usadas en el día a día: presupuestos, pedidos, clientes
    import("@/pages/QuotesList").catch(() => {});
    import("@/pages/SalesOrdersList").catch(() => {});
    import("@/pages/Clientes").catch(() => {});
    import("@/pages/QuoteNew").catch(() => {});
    import("@/pages/QuoteDetail").catch(() => {});
    import("@/pages/SalesOrderDetail").catch(() => {});
  });
}