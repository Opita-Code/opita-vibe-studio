import type { LearningEvent } from "../types";

export interface DecayOptions {
  /** Half-life in milliseconds. Defaults to 7 days. */
  halfLifeMs?: number;
  /** Minimum relevance threshold before pruning. Defaults to 0.15. */
  minRelevance?: number;
  /** Frequency gate time window in milliseconds. Defaults to 72 hours. */
  frequencyWindowMs?: number;
  /** Minimum occurrences required in the window. Defaults to 3. */
  minOccurrences?: number;
}

export class ContextDecayEngine {
  private halfLifeMs: number;
  private minRelevance: number;
  private frequencyWindowMs: number;
  private minOccurrences: number;

  constructor(options: DecayOptions = {}) {
    this.halfLifeMs = options.halfLifeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    this.minRelevance = options.minRelevance ?? 0.15;
    this.frequencyWindowMs = options.frequencyWindowMs ?? 72 * 60 * 60 * 1000; // 72 hours
    this.minOccurrences = options.minOccurrences ?? 3;
  }

  /**
   * Decays and filters user learning events.
   * Prunes decayed events (relevance < minRelevance).
   * Filters out concepts that do not pass the frequency gate.
   *
   * @param events - Raw array of learning events
   * @param now - Current timestamp reference (for testing repeatability)
   */
  decay(events: LearningEvent[], now: Date = new Date()): LearningEvent[] {
    const nowMs = now.getTime();

    // 1. Time-decay pruning
    const nonDecayed = events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      if (isNaN(eventTime)) return false; // Ignore corrupt dates

      const ageMs = Math.max(0, nowMs - eventTime);
      const relevance = Math.pow(2, -ageMs / this.halfLifeMs);
      return relevance >= this.minRelevance;
    });

    // 2. Frequency gating
    // First, count occurrences of each concept in the 72-hour window
    const windowStart = nowMs - this.frequencyWindowMs;
    const counts: Record<string, number> = {};

      for (const event of nonDecayed) {
        const concept = event.data?.concept as string;
        if (!concept) continue;

        const eventTime = new Date(event.timestamp).getTime();
        if (eventTime >= windowStart && eventTime <= nowMs) {
          counts[concept] = (counts[concept] ?? 0) + 1;
        }
      }

    // Filter events: keep only those whose concept passes the gate
    return nonDecayed.filter(event => {
      const concept = event.data?.concept as string;
      if (!concept) return true; // Events without concepts are kept as baseline
      return (counts[concept] ?? 0) >= this.minOccurrences;
    });
  }
}
