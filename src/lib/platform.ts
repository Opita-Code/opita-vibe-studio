// ─── Platform Detection ──────────────────────────────────────────

/**
 * Detects if the app is running inside a Tauri WebView
 * by checking for the Tauri runtime API.
 */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined
  );
}

/**
 * Returns the current platform identifier.
 */
export function getPlatform(): "tauri" | "browser" {
  return isTauri() ? "tauri" : "browser";
}
