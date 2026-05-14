/**
 * Platform Detector
 *
 * Detects the current runtime environment:
 * - "tauri"   → Running inside a Tauri WebView (window.__TAURI__ exists)
 * - "browser" → Running in a standard browser
 * - "node"    → Running in Node.js (no window object)
 */

export type Platform = "tauri" | "browser" | "node";

/**
 * Detect the current platform at runtime.
 *
 * Checks are ordered from most specific to most general:
 * 1. Tauri — window.__TAURI__ is set by the Tauri runtime
 * 2. Browser — window is available (jsdom, real browser, etc.)
 * 3. Node — no window at all
 */
export function detectPlatform(): Platform {
  if (typeof window !== "undefined") {
    if ((window as unknown as Record<string, unknown>).__TAURI__ !== undefined) {
      return "tauri";
    }
    return "browser";
  }
  return "node";
}
