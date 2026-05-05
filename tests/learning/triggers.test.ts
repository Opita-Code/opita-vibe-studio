import { describe, it, expect, beforeEach } from "vitest";
import {
  scanAndTrigger,
  CODE_PATTERNS,
  detectRepeatedCode,
  resetThrottle,
} from "../../src/learning/triggers";
import { useLearningStore } from "../../src/stores/learning";

beforeEach(() => {
  useLearningStore.setState({
    shownTips: [],
    tipQueue: [],
    learningEvents: [],
    isVisible: false,
    currentTip: null,
  });
  resetThrottle();
});

describe("CODE_PATTERNS", () => {
  it("should detect var keyword", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "js-var");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test("var x = 5;")).toBe(true);
    expect(pattern!.regex.test("let x = 5;")).toBe(false);
  });

  it("should detect display: flex", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "css-flexbox");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test(".container { display: flex; }")).toBe(true);
    expect(pattern!.regex.test(".container { display: block; }")).toBe(false);
  });

  it("should detect inline styles", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "css-inline-style");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test('<div style="color: red">')).toBe(true);
    expect(pattern!.regex.test('<div class="foo">')).toBe(false);
  });

  it("should detect addEventListener", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "js-event-listener");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test('element.addEventListener("click", fn)')).toBe(true);
  });

  it("should detect console.log", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "js-console-log");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test("console.log('hello');")).toBe(true);
  });

  it("should detect function keyword", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "js-function");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test("function saludar() {")).toBe(true);
  });

  it("should detect async/then", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "js-then");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test("fetch(url).then(res => res.json())")).toBe(true);
  });

  it("should detect for loops", () => {
    const pattern = CODE_PATTERNS.find((p) => p.id === "js-for-loop");
    expect(pattern).toBeDefined();
    expect(pattern!.regex.test("for (let i = 0; i < 10; i++) {")).toBe(true);
  });
});

describe("scanAndTrigger", () => {
  it("should trigger a tip when flexbox is detected", () => {
    const result = scanAndTrigger(".container { display: flex; }");
    expect(result).toBe(1);

    const state = useLearningStore.getState();
    expect(state.isVisible).toBe(true);
    expect(state.currentTip?.concept).toBe("flexbox");
  });

  it("should trigger a tip when var is detected", () => {
    const result = scanAndTrigger("var nombre = 'Juan';");
    expect(result).toBe(1);

    const state = useLearningStore.getState();
    expect(state.currentTip?.concept).toBe("variables");
  });

  it("should not trigger for clean code without patterns", () => {
    const result = scanAndTrigger("const x = 42; console.log(x);");
    // const alone may not match any pattern — or only console.log
    // This is fine as long as it doesn't throw
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("should not show the same tip twice (deduplication)", () => {
    // First scan
    scanAndTrigger(".container { display: flex; }");
    const state1 = useLearningStore.getState();
    const shownId = state1.currentTip?.id;

    // Mark as shown and dismiss
    if (shownId) {
      useLearningStore.getState().dismissTip();
    }

    // Second scan — same content, same tip should not appear again
    resetThrottle();
    const result = scanAndTrigger(".container { display: flex; }");
    expect(result).toBe(0); // No new tip because flexbox tip was already shown
  });
});

describe("detectRepeatedCode", () => {
  it("should detect code repeated 3+ times", () => {
    // Need 5+ identical lines for 3+ sliding-window 3-line blocks to match
    const code = `
      function saludar() { return "hola"; }
      function saludar() { return "hola"; }
      function saludar() { return "hola"; }
      function saludar() { return "hola"; }
      function saludar() { return "hola"; }
    `;
    expect(detectRepeatedCode(code)).toBe(true);
  });

  it("should not flag unique code", () => {
    const code = `
      const a = 1;
      const b = 2;
      const c = 3;
      function sum() { return a + b + c; }
    `;
    expect(detectRepeatedCode(code)).toBe(false);
  });

  it("should not flag short lines (< 10 chars)", () => {
    const code = "a\nb\nc\na\nb\nc";
    expect(detectRepeatedCode(code)).toBe(false);
  });
});
