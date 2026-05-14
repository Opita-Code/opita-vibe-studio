/**
 * Context Capture — captures app context for cloud sync.
 *
 * Progressive capture strategy:
 * - **Basic context** (theme, language, skill level, auth mode): ALWAYS captured,
 *   never gated by consent. These are needed for the app to function properly.
 * - **Rich context** (learning events, projects, file types): ONLY captured when
 *   the user has explicitly opted in via the privacy consent toggle.
 *
 * This module provides pure functions for snapshotting context, plus React hooks
 * for automatic capture on state changes.
 */
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useConsentStore } from "@/stores/consent";
import { useLearningStore } from "@/stores/learning";

// ─── Context Key Constants ─────────────────────────────────────

/**
 * Keys that are ALWAYS captured regardless of consent.
 * These are basic functional preferences.
 */
export const BASIC_CONTEXT_KEYS = [
  "theme",
  "language",
  "skillLevel",
  "authMode",
  "activeView",
] as const;

/**
 * Keys that are ONLY captured when the user opts in.
 */
export const RICH_CONTEXT_KEYS = [
  "learningEvents",
  "activeModel",
] as const;

// ─── Types ─────────────────────────────────────────────────────

export interface BasicContextData {
  theme: string;
  language: string;
  skillLevel: string;
  authMode: string;
  activeView: string;
  [key: string]: unknown;
}

export interface RichContextData {
  learningEvents: Array<{ type: string; concept: string; timestamp: number }>;
  activeModel: string;
  projects?: string[];
  fileTypes?: string[];
  [key: string]: unknown;
}

// ─── Capture Utilities (Pure Functions) ────────────────────────

/**
 * Capture basic context snapshot from stores.
 * ALWAYS captured — never gated by consent.
 */
export function captureBasicContext(): BasicContextData {
  const ui = useUIStore.getState();
  const auth = useAuthStore.getState();

  return {
    theme: "dark", // Vibe Studio is always dark mode
    language: "es",
    skillLevel: "beginner",
    authMode: auth.authMode,
    activeView: ui.activeView,
  };
}

/**
 * Capture rich context snapshot from stores.
 * ONLY captured when the user has opted in via consent.
 *
 * @returns RichContextData if consent is ON, null otherwise
 */
export function captureRichContext(): RichContextData | null {
  const consent = useConsentStore.getState();
  if (!consent.richConsent) return null;

  const ui = useUIStore.getState();
  const learning = useLearningStore.getState();

  return {
    learningEvents: learning.learningEvents.map((e) => ({
      type: e.type,
      concept: e.concept,
      timestamp: e.timestamp,
    })),
    activeModel: ui.activeModel,
    projects: [],
    fileTypes: [],
  };
}

/**
 * Get a flat key-value snapshot of basic context.
 * Always returns data regardless of consent.
 */
export function getBasicContextSnapshot(): Record<string, unknown> {
  const ctx = captureBasicContext();
  const snapshot: Record<string, unknown> = {};
  for (const key of BASIC_CONTEXT_KEYS) {
    if (key in ctx) {
      snapshot[key] = ctx[key];
    }
  }
  return snapshot;
}

/**
 * Get a flat key-value snapshot of rich context.
 * Returns null when consent is OFF.
 */
export function getRichContextSnapshot(): Record<string, unknown> | null {
  const ctx = captureRichContext();
  if (!ctx) return null;

  const snapshot: Record<string, unknown> = {};
  for (const key of RICH_CONTEXT_KEYS) {
    if (key in ctx) {
      snapshot[key] = ctx[key];
    }
  }
  return snapshot;
}

/**
 * Check if rich context capture is currently allowed.
 */
export function isRichCaptureAllowed(): boolean {
  return useConsentStore.getState().richConsent;
}

// ─── React Hooks ────────────────────────────────────────────────

/**
 * React hook that provides a reactive snapshot of basic context.
 * Always returns data regardless of consent. Re-renders on store changes.
 * Uses Zustand's built-in subscription mechanism for stable references.
 */
export function useBasicContextCapture(): BasicContextData {
  const authMode = useAuthStore((s) => s.authMode);
  const activeView = useUIStore((s) => s.activeView);

  return {
    theme: "dark",
    language: "es",
    skillLevel: "beginner",
    authMode,
    activeView,
  };
}

/**
 * React hook that provides a reactive snapshot of rich context.
 * Returns null when consent is OFF. Re-renders on store changes.
 */
export function useRichContextCapture(): RichContextData | null {
  const richConsent = useConsentStore((s) => s.richConsent);
  const activeModel = useUIStore((s) => s.activeModel);
  const learningEvents = useLearningStore((s) => s.learningEvents);

  if (!richConsent) return null;

  return {
    learningEvents: learningEvents.map((e) => ({
      type: e.type,
      concept: e.concept,
      timestamp: e.timestamp,
    })),
    activeModel,
    projects: [],
    fileTypes: [],
  };
}
