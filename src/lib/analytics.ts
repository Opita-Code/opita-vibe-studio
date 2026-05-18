/**
 * Vibe Studio Analytics SDK — Lightweight event tracker for Opita Sync.
 *
 * Design principles:
 * - Consent-aware: events tagged with consent level, filtered at query time
 * - Batch-oriented: accumulates events in memory, flushes periodically or on threshold
 * - Non-blocking: never throws, never blocks UI, fire-and-forget
 * - Privacy-first: no fingerprinting, random sessionId per visit
 *
 * Usage:
 *   import { analytics } from "@/lib/analytics";
 *   analytics.track("chat_message_sent", { model_id: "gemini-2.5-flash", message_length: 42 });
 */

// ─── Types ──────────────────────────────────────────────────────

export type EventType =
  | "page_view"
  | "cta_click"
  | "download_click"
  | "checkout_intent"
  | "session_start"
  | "chat_message_sent"
  | "project_created"
  | "project_saved"
  | "upgrade_prompt_shown"
  | "checkout_completed"
  | "login_method"
  | "feature_used"
  | "error_encountered"
  | "onboarding_step";

export type ConsentLevel = "basic" | "rich";

interface AnalyticsEvent {
  type: EventType;
  source: "app";
  data: Record<string, unknown>;
  consent: ConsentLevel;
  timestamp: string;
}

interface AnalyticsConfig {
  /** API endpoint for event ingestion */
  endpoint: string;
  /** Max events before auto-flush */
  batchSize: number;
  /** Flush interval in milliseconds */
  flushIntervalMs: number;
  /** Whether to include credentials (cookies) in fetch */
  withCredentials: boolean;
}

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_CONFIG: AnalyticsConfig = {
  endpoint: "https://api.opitacode.com/core/events/ingest",
  batchSize: 15,
  flushIntervalMs: 30_000, // 30 seconds
  withCredentials: true,
};

const SESSION_KEY = "vibe-analytics-session";

// ─── Tracker ────────────────────────────────────────────────────

class VibeAnalytics {
  private queue: AnalyticsEvent[] = [];
  private sessionId: string;
  private config: AnalyticsConfig;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private richConsentEnabled = false;
  private enabled = true;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.getOrCreateSessionId();
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the tracker. Call once on app mount.
   * Starts the flush timer and tracks session_start.
   */
  init(options?: { richConsent?: boolean }): void {
    if (options?.richConsent !== undefined) {
      this.richConsentEnabled = options.richConsent;
    }

    // Use localhost endpoint for development
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        this.config.endpoint = "http://localhost:3000/core/events/ingest";
      }
    }

    // Start periodic flush
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);

    // Flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush();
        }
      });
    }
  }

  /**
   * Clean up timers. Call on app unmount.
   */
  destroy(): void {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ─── Configuration ─────────────────────────────────────────

  /**
   * Update rich consent status (from consent store toggle).
   */
  setRichConsent(enabled: boolean): void {
    this.richConsentEnabled = enabled;
  }

  /**
   * Disable all tracking (e.g., during testing).
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // ─── Tracking ──────────────────────────────────────────────

  /**
   * Track a basic-consent event (always collected).
   */
  track(type: EventType, data: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    this.queue.push({
      type,
      source: "app",
      data,
      consent: "basic",
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track a rich-consent event (only collected when user opted in).
   */
  trackRich(type: EventType, data: Record<string, unknown> = {}): void {
    if (!this.enabled || !this.richConsentEnabled) return;

    this.queue.push({
      type,
      source: "app",
      data,
      consent: "rich",
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  // ─── Flush ─────────────────────────────────────────────────

  /**
   * Send all queued events to the backend.
   * Uses sendBeacon for page unload, fetch for normal flush.
   */
  flush(): void {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    const payload = JSON.stringify({
      events,
      sessionId: this.sessionId,
    });

    // Use sendBeacon for reliability during page unload
    if (typeof navigator !== "undefined" && navigator.sendBeacon && document.visibilityState === "hidden") {
      try {
        navigator.sendBeacon(this.config.endpoint, payload);
        return;
      } catch {
        // Fall through to fetch
      }
    }

    // Normal fetch (fire-and-forget)
    fetch(this.config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: this.config.withCredentials ? "include" : "omit",
      keepalive: true, // Ensures request completes even if page navigates
    }).catch(() => {
      // Silently fail — analytics should never block the user
    });
  }

  // ─── Helpers ───────────────────────────────────────────────

  private getOrCreateSessionId(): string {
    if (typeof sessionStorage === "undefined") {
      return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  /** Expose sessionId for debugging */
  getSessionId(): string {
    return this.sessionId;
  }
}

// ─── Singleton Export ───────────────────────────────────────────

export const analytics = new VibeAnalytics();
