// ─── Opita Telemetry SDK ────────────────────────────────────────
// Lightweight, zero-dependency client telemetry for all Opita Code products.
// Handles session tracking, automatic metadata capture, event batching,
// and delivery to the centralized /core/events/ingest endpoint.

export type ProductId = "vibe-studio" | "opitacode-web" | "opita-barber";

export interface TelemetryConfig {
  /** Which product is sending the events */
  productId: ProductId;
  /** Override the default ingestion endpoint */
  endpoint?: string;
  /** Source tag for backward-compat with existing analytics (landing | app) */
  source?: "landing" | "app";
  /** Max events to buffer before flushing (default: 10) */
  batchSize?: number;
  /** Max milliseconds before auto-flush (default: 5000) */
  flushIntervalMs?: number;
  /** Enable console.debug logging */
  debug?: boolean;
}

interface QueuedEvent {
  type: string;
  timestamp: string;
  data: Record<string, any>;
  source: string;
}

const DEFAULT_ENDPOINT = "https://api.opitacode.com/core/events/ingest";
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;

let config: TelemetryConfig | null = null;
let sessionId: string = "";
let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return generateUUID();
  const KEY = "opita_session_id";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = generateUUID();
    sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

function getMetadata(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    url: window.location.href,
    referrer: document.referrer || "",
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    language: navigator.language,
  };
}

function log(...args: any[]) {
  if (config?.debug) console.debug("[opita-telemetry]", ...args);
}

// ─── Flush Logic ────────────────────────────────────────────────

async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;

  const eventsToSend = eventQueue.splice(0);
  const endpoint = config?.endpoint || DEFAULT_ENDPOINT;

  const payload = {
    sessionId,
    productId: config?.productId,
    events: eventsToSend,
  };

  log("Flushing", eventsToSend.length, "events");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // Survives page unload
    });

    if (!response.ok) {
      log("Flush failed:", response.status);
      // Re-queue failed events at the front
      eventQueue.unshift(...eventsToSend);
    }
  } catch (err) {
    log("Flush error:", err);
    eventQueue.unshift(...eventsToSend);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  const interval = config?.flushIntervalMs || DEFAULT_FLUSH_INTERVAL_MS;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, interval);
}

// ─── Public API ─────────────────────────────────────────────────

export const Telemetry = {
  /**
   * Initialize the telemetry SDK. Must be called before any .track() calls.
   */
  init(cfg: TelemetryConfig): void {
    config = cfg;
    sessionId = getSessionId();
    log("Initialized for", cfg.productId, "| session:", sessionId);

    // Auto-flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
      window.addEventListener("pagehide", () => flush());
    }

    // Auto page_view
    Telemetry.track("page_view", getMetadata());

    // Auto session_start
    Telemetry.track("session_start", getMetadata());
  },

  /**
   * Track a custom event.
   */
  track(eventType: string, payload: Record<string, any> = {}): void {
    if (!config) {
      console.warn("[opita-telemetry] Not initialized. Call Telemetry.init() first.");
      return;
    }

    const event: QueuedEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data: { ...payload, ...getMetadata() },
      source: config.source || (config.productId === "vibe-studio" ? "app" : "landing"),
    };

    eventQueue.push(event);
    log("Queued:", eventType);

    const batchSize = config.batchSize || DEFAULT_BATCH_SIZE;
    if (eventQueue.length >= batchSize) {
      flush();
    } else {
      scheduleFlush();
    }
  },

  /**
   * Force-flush all queued events immediately.
   */
  async flush(): Promise<void> {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flush();
  },

  /**
   * Link the current anonymous session to an authenticated user.
   * Emits a silent `session_identify` event so the backend can
   * correlate pre-login and post-login activity.
   */
  identify(userId: string): void {
    if (!config) return;
    Telemetry.track("session_identify", { userId, previousSessionId: sessionId });
    // Keep the same sessionId so pre/post login events stay grouped
    log("Identified user:", userId);
  },

  /**
   * Clear the current session (e.g. on logout).
   * Flushes pending events, then generates a fresh sessionId.
   */
  reset(): void {
    flush();
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("opita_session_id");
    }
    sessionId = generateUUID();
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("opita_session_id", sessionId);
    }
    log("Session reset. New session:", sessionId);
  },
};
