// ─── Vibe Event Bus ────────────────────────────────────────────
//
// Lightweight pub/sub event system for tracking user actions.
// Used by the gamification engine to auto-validate missions
// and award XP based on REAL user behavior.
//

// ─── Event Types ────────────────────────────────────────────────

export type VibeEvent =
  | { type: "chat_sent"; model: string; tokensUsed: number }
  | { type: "file_created"; filename: string; language: string }
  | { type: "file_edited"; filename: string; linesChanged: number }
  | { type: "preview_opened"; duration?: number }
  | { type: "template_used"; templateId: string }
  | { type: "project_exported"; format: "zip" | "deploy" }
  | { type: "agent_used"; mode: "interactive" | "autonomous" }
  | { type: "error_fixed"; errorType: string }
  | { type: "component_created"; name: string; hasProps: boolean };

export type VibeEventType = VibeEvent["type"];

// ─── Listener Type ──────────────────────────────────────────────

type EventListener = (event: VibeEvent) => void;

// ─── Bus Singleton ──────────────────────────────────────────────

class VibeEventBusImpl {
  private listeners = new Map<VibeEventType | "*", Set<EventListener>>();
  private sessionCounts = new Map<VibeEventType, number>();

  /**
   * Subscribe to a specific event type, or "*" for all events.
   * Returns an unsubscribe function.
   */
  on(type: VibeEventType | "*", listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.off(type, listener);
  }

  off(type: VibeEventType | "*", listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  /**
   * Emit an event. Notifies type-specific listeners + wildcard listeners.
   * Automatically increments session-local counters.
   */
  emit(event: VibeEvent): void {
    // Increment session counter
    const current = this.sessionCounts.get(event.type) || 0;
    this.sessionCounts.set(event.type, current + 1);

    // Notify type-specific listeners
    this.listeners.get(event.type)?.forEach((fn) => fn(event));
    // Notify wildcard listeners
    this.listeners.get("*")?.forEach((fn) => fn(event));
  }

  /**
   * Get session-local count for an event type.
   * Resets when page is refreshed (intentional — session-scoped).
   */
  getCount(type: VibeEventType): number {
    return this.sessionCounts.get(type) || 0;
  }

  /**
   * Reset all session counters. Called at midnight or session boundary.
   */
  resetCounts(): void {
    this.sessionCounts.clear();
  }
}

/** Global event bus singleton */
export const vibeEvents = new VibeEventBusImpl();
