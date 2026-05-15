/**
 * Utilidad compartida para extraer mensajes de error legibles.
 * Evita exponer stack traces o "[object Object]" al usuario.
 */

/**
 * Extrae un mensaje legible de cualquier error.
 * Funciona con Error, strings, objetos con .message, etc.
 */
export function extractErrorMessage(err: unknown, fallback = "Error desconocido"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}
