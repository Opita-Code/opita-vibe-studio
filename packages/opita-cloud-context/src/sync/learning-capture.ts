/**
 * LearningCapture — bridges app-level learning events to SDK LearningEvent types.
 *
 * The app's learning engine produces events like "tip_shown", "code_pattern", etc.
 * This module converts them to the canonical SDK `LearningEvent` type (with id,
 * ISO timestamp, source, and structured data) and stores them for sync.
 *
 * Supports:
 * - Event capture with optional extra data
 * - In-memory event storage with filtering
 * - Handler registration/subscription for integration with the SyncEngine
 */
import type { LearningEvent } from "../types";

export interface AppLearningEvent {
  type: string;
  concept: string;
  timestamp: number;
}

export interface LearningCaptureOptions {
  /** Source identifier (e.g. "vibe-studio") */
  source: string;
}

export interface LearningEventFilter {
  type?: string;
  concept?: string;
}

export type LearningEventHandler = (event: LearningEvent) => void;
export type Unsubscribe = () => void;

export class LearningCapture {
  private events: LearningEvent[] = [];
  private handlers: Set<LearningEventHandler> = new Set();
  private source: string;

  constructor(options: LearningCaptureOptions) {
    this.source = options.source;
  }

  /**
   * Capture a learning event from the app's learning engine.
   * Converts to SDK LearningEvent type with generated ID, ISO timestamp, and structured data.
   *
   * @param appEvent - The app-level learning event
   * @param extraData - Optional additional data to include in the event
   * @returns The captured SDK LearningEvent
   */
  capture(
    appEvent: AppLearningEvent,
    extraData?: Record<string, unknown>,
  ): LearningEvent {
    const event: LearningEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type: appEvent.type,
      data: {
        concept: appEvent.concept,
        ...extraData,
      },
      timestamp: new Date(appEvent.timestamp).toISOString(),
      source: this.source,
    };

    this.events.push(event);

    // Notify all registered handlers
    for (const handler of this.handlers) {
      handler(event);
    }

    return event;
  }

  /**
   * Get all captured events, optionally filtered.
   */
  getEvents(filter?: LearningEventFilter): LearningEvent[] {
    let result = this.events;

    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type);
    }
    if (filter?.concept) {
      result = result.filter((e) => e.data.concept === filter.concept);
    }

    return result;
  }

  /**
   * Clear all stored events.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Register a handler that is called on every capture.
   * Returns an unsubscribe function.
   */
  onCapture(handler: LearningEventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
