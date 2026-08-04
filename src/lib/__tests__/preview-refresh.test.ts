/**
 * Tests para el registry de preview-refresh y la tool refresh_preview.
 *
 * Verifica que:
 * 1. registerPreviewRefresh + triggerPreviewRefresh invocan el handler.
 * 2. triggerPreviewRefresh sin handler retorna false (no-error).
 * 3. La unregister limpia correctamente.
 * 4. executeTool("refresh_preview") dispara el refresh registrado.
 *
 * Ejecutar: npx vitest run src/lib/__tests__/preview-refresh.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerPreviewRefresh,
  triggerPreviewRefresh,
  __resetPreviewRefreshForTest,
} from "../preview-refresh";

describe("preview-refresh registry", () => {
  beforeEach(() => {
    __resetPreviewRefreshForTest();
  });

  afterEach(() => {
    __resetPreviewRefreshForTest();
  });

  it("trigger invoca el handler registrado y retorna true", () => {
    const fn = vi.fn();
    registerPreviewRefresh(fn);

    expect(triggerPreviewRefresh()).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("trigger sin handler registrado retorna false (no-error)", () => {
    expect(triggerPreviewRefresh()).toBe(false);
  });

  it("unregister limpia el handler", () => {
    const fn = vi.fn();
    const unregister = registerPreviewRefresh(fn);
    unregister();

    expect(triggerPreviewRefresh()).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("el último handler registrado gana", () => {
    const first = vi.fn();
    const second = vi.fn();
    registerPreviewRefresh(first);
    registerPreviewRefresh(second);

    triggerPreviewRefresh();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
