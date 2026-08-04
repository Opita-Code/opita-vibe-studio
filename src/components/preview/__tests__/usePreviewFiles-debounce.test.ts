/**
 * Tests para el debounce de usePreviewFiles — VibeLens live preview.
 *
 * Verifica que:
 * 1. El primer render muestra files inmediatamente (sin delay).
 * 2. Cambios rápidos consecutivos NO disparan re-render hasta el debounce (~500ms).
 * 3. Pasado el debounce, los files reflejan el estado final.
 *
 * Ejecutar: npx vitest run src/components/preview/__tests__/usePreviewFiles-debounce.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { usePreviewFiles } from "../usePreviewFiles";

// ─── Store mocks (evita hydration OPFS/persist reales) ──────────

type MockProjectState = {
  fileContents: Record<string, string>;
  activeWorkspaceId: string;
};

const mockProject = vi.hoisted(() => {
  let state: MockProjectState = { fileContents: {}, activeWorkspaceId: "" };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: Partial<MockProjectState>) => {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
});

type MockUIState = {
  previewTarget: string | null;
  vibeLensEnabled: boolean;
};

const mockUI = vi.hoisted(() => {
  let state: MockUIState = { previewTarget: null, vibeLensEnabled: false };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: Partial<MockUIState>) => {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
});

vi.mock("@/stores/project", () => ({
  useProjectStore: <T>(selector: (s: MockProjectState) => T): T =>
    useSyncExternalStore(
      (cb) => mockProject.subscribe(cb),
      () => selector(mockProject.get()),
    ),
}));

vi.mock("@/stores/ui", () => ({
  useUIStore: <T>(selector: (s: MockUIState) => T): T =>
    useSyncExternalStore(
      (cb) => mockUI.subscribe(cb),
      () => selector(mockUI.get()),
    ),
}));

// ─── Helpers ────────────────────────────────────────────────────

function setFiles(files: Record<string, string>) {
  act(() => {
    mockProject.set({ fileContents: files });
  });
}

// ─── Suite ──────────────────────────────────────────────────────

describe("usePreviewFiles debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockProject.set({ fileContents: {}, activeWorkspaceId: "" });
    mockUI.set({ previewTarget: null, vibeLensEnabled: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("muestra files inmediatamente en el primer render (sin debounce)", () => {
    setFiles({ "/src/App.tsx": "export default function App(){return null}" });

    const { result } = renderHook(() => usePreviewFiles());

    expect(result.current.hasPreviewableFiles).toBe(true);
    expect(result.current.fileCount).toBe(1);
    expect(result.current.files["/src/App.tsx"]).toBeDefined();
  });

  it("no re-renderiza durante ráfagas de keystrokes (debounce 500ms)", () => {
    setFiles({ "/src/App.tsx": "v1" });
    const { result } = renderHook(() => usePreviewFiles());
    expect(result.current.files["/src/App.tsx"]).toBe("v1");

    // Ráfaga de escritura: múltiples cambios antes del debounce.
    // Cada setState flushea su re-render (que re-programa el timer);
    // avanzamos el reloj en el act siguiente para no disparar el timer.
    act(() => {
      mockProject.set({ fileContents: { "/src/App.tsx": "v2" } });
    });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => {
      mockProject.set({ fileContents: { "/src/App.tsx": "v3" } });
    });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => {
      mockProject.set({ fileContents: { "/src/App.tsx": "v4" } });
    });

    // Antes del debounce, el preview aún muestra la versión inicial.
    expect(result.current.files["/src/App.tsx"]).toBe("v1");

    // Tras el debounce, refleja el estado final (v4, no v2/v3).
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.files["/src/App.tsx"]).toBe("v4");
  });

  it("el debounce se resetea con cada keystroke (solo dispara tras 500ms de inactividad)", () => {
    setFiles({ "/src/App.tsx": "a" });
    const { result } = renderHook(() => usePreviewFiles());

    // Keystroke + 499ms → no dispara.
    act(() => {
      mockProject.set({ fileContents: { "/src/App.tsx": "b" } });
    });
    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current.files["/src/App.tsx"]).toBe("a");

    // 1ms más → dispara.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.files["/src/App.tsx"]).toBe("b");
  });

  it("detecta template react-ts tras el debounce", () => {
    setFiles({});
    const { result } = renderHook(() => usePreviewFiles());

    act(() => {
      mockProject.set({ fileContents: { "/src/App.tsx": "x", "/src/index.ts": "y" } });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.template).toBe("react-ts");
    expect(result.current.hasPreviewableFiles).toBe(true);
  });
});
