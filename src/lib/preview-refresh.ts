/**
 * Preview Refresh Registry — bridge entre el ejecutor de tools (módulo TS
 * plano, sin React) y el componente LivePreview (React).
 *
 * El agente (build/chat) puede llamar a la tool `refresh_preview`; el
 * ejecutor dispara triggerPreviewRefresh(), que invoca el handler que
 * LivePreview registró al montar. Si el preview no está montado, la tool
 * responde con un aviso (no-error) en vez de fallar.
 */

type RefreshFn = () => void;

let handler: RefreshFn | null = null;

/** LivePreview la llama en mount para exponer su refresh al ejecutor. */
export function registerPreviewRefresh(fn: RefreshFn): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/**
 * Dispara el refresh del preview. Retorna true si un handler estaba
 * registrado (preview montado), false si no.
 */
export function triggerPreviewRefresh(): boolean {
  if (handler) {
    handler();
    return true;
  }
  return false;
}

/** Test hook — limpia el handler entre tests. */
export function __resetPreviewRefreshForTest(): void {
  handler = null;
}
