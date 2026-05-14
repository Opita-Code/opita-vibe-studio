/**
 * Tests for LearningEvent capture — bridges app-level learning events to SDK types.
 *
 * Strict TDD: RED phase — tests describe behavior first, implementation follows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LearningCapture } from "../sync/learning-capture";

describe("LearningCapture", () => {
  let capture: LearningCapture;

  beforeEach(() => {
    capture = new LearningCapture({ source: "vibe-studio" });
  });

  // ──────────────────────────────────────────────
  // Event capture
  // ──────────────────────────────────────────────

  it("should capture a learning event", () => {
    const event = capture.capture({
      type: "trigger_match",
      concept: "flexbox",
      timestamp: Date.now(),
    });

    expect(event).toBeDefined();
    expect(event.type).toBe("trigger_match");
    expect(event.source).toBe("vibe-studio");
  });

  it("should assign a unique ID to each captured event", () => {
    const event1 = capture.capture({
      type: "tip_shown",
      concept: "css-grid",
      timestamp: 1000,
    });
    const event2 = capture.capture({
      type: "tip_shown",
      concept: "flexbox",
      timestamp: 2000,
    });

    expect(event1.id).not.toBe(event2.id);
  });

  it("should include concept in data field", () => {
    const event = capture.capture({
      type: "code_pattern",
      concept: "js-arrow",
      timestamp: Date.now(),
    });

    expect(event.data).toEqual({ concept: "js-arrow" });
  });

  it("should convert numeric timestamp to ISO string", () => {
    const ts = 1715000000000;
    const event = capture.capture({
      type: "test",
      concept: "test",
      timestamp: ts,
    });

    expect(event.timestamp).toBe(new Date(ts).toISOString());
  });

  it("should allow extra data to be passed alongside the event", () => {
    const event = capture.capture(
      { type: "file_created", concept: "react-component", timestamp: Date.now() },
      { filePath: "/src/Button.tsx", language: "tsx" },
    );

    expect(event.data.concept).toBe("react-component");
    expect(event.data.filePath).toBe("/src/Button.tsx");
    expect(event.data.language).toBe("tsx");
  });

  // ──────────────────────────────────────────────
  // Event storage
  // ──────────────────────────────────────────────

  it("should store captured events and return them", () => {
    capture.capture({ type: "a", concept: "x", timestamp: 100 });
    capture.capture({ type: "b", concept: "y", timestamp: 200 });

    const events = capture.getEvents();
    expect(events).toHaveLength(2);
  });

  it("should clear all stored events", () => {
    capture.capture({ type: "a", concept: "x", timestamp: 100 });
    capture.clear();

    expect(capture.getEvents()).toHaveLength(0);
  });

  it("should return stored events in capture order", () => {
    capture.capture({ type: "first", concept: "a", timestamp: 100 });
    capture.capture({ type: "second", concept: "b", timestamp: 200 });

    const events = capture.getEvents();
    expect(events[0].type).toBe("first");
    expect(events[1].type).toBe("second");
  });

  // ──────────────────────────────────────────────
  // Event handler registration
  // ──────────────────────────────────────────────

  it("should invoke registered handler on capture", () => {
    const handler = vi.fn();
    capture.onCapture(handler);

    const event = capture.capture({
      type: "test", concept: "test", timestamp: Date.now(),
    });

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("should support multiple handlers", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    capture.onCapture(handler1);
    capture.onCapture(handler2);

    capture.capture({ type: "multi", concept: "test", timestamp: Date.now() });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("should allow unregistering a handler", () => {
    const handler = vi.fn();
    const unregister = capture.onCapture(handler);
    unregister();

    capture.capture({ type: "no-call", concept: "test", timestamp: Date.now() });

    expect(handler).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Filtering
  // ──────────────────────────────────────────────

  it("should filter events by type", () => {
    capture.capture({ type: "tip_shown", concept: "a", timestamp: 100 });
    capture.capture({ type: "code_pattern", concept: "b", timestamp: 200 });
    capture.capture({ type: "tip_shown", concept: "c", timestamp: 300 });

    const filtered = capture.getEvents({ type: "tip_shown" });
    expect(filtered).toHaveLength(2);
  });

  it("should filter events by concept", () => {
    capture.capture({ type: "a", concept: "flexbox", timestamp: 100 });
    capture.capture({ type: "b", concept: "grid", timestamp: 200 });

    const filtered = capture.getEvents({ concept: "flexbox" });
    expect(filtered).toHaveLength(1);
  });

  it("should return empty array when no events match filter", () => {
    capture.capture({ type: "a", concept: "x", timestamp: 100 });

    const filtered = capture.getEvents({ type: "nonexistent" });
    expect(filtered).toEqual([]);
  });
});
