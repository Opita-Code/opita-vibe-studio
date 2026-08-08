/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Opita Telemetry SDK — unit tests.
 *
 * El SDK usa estado module-level (config, cola de eventos, timer de flush),
 * así que cada test parte de un módulo fresco vía vi.resetModules().
 * Se mockean los globals de browser (window/document/navigator/screen/
 * sessionStorage) y `fetch`, nunca se toca red real.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalCrypto = globalThis.crypto;

function setGlobalCrypto(value: unknown) {
  Object.defineProperty(globalThis, "crypto", { value, configurable: true, writable: true });
}

let Telemetry: any;

function installBrowserGlobals(opts?: { sessionValue?: string }) {
  const store = new Map<string, string>();
  if (opts?.sessionValue !== undefined) store.set("opita_session_id", opts.sessionValue);

  const listeners: Record<string, () => void> = {};
  (globalThis as any).window = {
    location: { href: "https://app.opitacode.com/app" },
    addEventListener: (ev: string, cb: () => void) => {
      listeners[ev] = cb;
    },
  };
  (globalThis as any).document = { referrer: "https://opitacode.com/", visibilityState: "visible" };
  (globalThis as any).navigator = { userAgent: "vitest-agent", language: "es-CO" };
  (globalThis as any).screen = { width: 1280, height: 720 };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  return { store, listeners };
}

function mockFetch(ok = true, status = 200) {
  const fn = vi.fn();
  if (ok) fn.mockResolvedValue({ ok: true, status });
  else fn.mockResolvedValue({ ok: false, status });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Telemetry = (await import("../src/index")).Telemetry;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).navigator;
  delete (globalThis as any).screen;
  delete (globalThis as any).sessionStorage;
  setGlobalCrypto(originalCrypto);
});

describe("Telemetry", () => {
  it("init + flush envía page_view y session_start al endpoint por defecto", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.opitacode.com/core/events/ingest");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const payload = JSON.parse(init.body);
    expect(payload.productId).toBe("vibe-studio");
    expect(payload.sessionId).toBeTruthy();
    expect(payload.events.map((e: any) => e.type)).toEqual(["page_view", "session_start"]);
  });

  it("track antes de init advierte y no encola nada", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = mockFetch();
    Telemetry.track("algo", { x: 1 });
    expect(warn).toHaveBeenCalled();
    await Telemetry.flush();
    expect(fetchMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("al alcanzar batchSize hace flush inmediato", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio", batchSize: 2, flushIntervalMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await Telemetry.flush();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.events.length).toBe(2);
  });

  it("flush con cola vacía no llama fetch", async () => {
    const fetchMock = mockFetch();
    await Telemetry.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flush con respuesta no-ok re-encola los eventos", async () => {
    const fetchMock = mockFetch(false, 500);
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await Telemetry.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload.events.length).toBe(2);
  });

  it("flush cuando fetch lanza re-encola los eventos", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await Telemetry.flush();
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload.events.length).toBe(2);
  });

  it("usa el endpoint custom de config", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "opita-barber", endpoint: "https://custom.example/ingest" });
    await Telemetry.flush();
    expect(fetchMock.mock.calls[0][0]).toBe("https://custom.example/ingest");
  });

  it("deriva source 'app' para vibe-studio", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.events[0].source).toBe("app");
  });

  it("deriva source 'landing' para otros productos", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "opita-barber" });
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.events[0].source).toBe("landing");
  });

  it("config.source overridea el derivado por producto", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio", source: "landing" });
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.events[0].source).toBe("landing");
  });

  it("identify trackea session_identify con previousSessionId", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    Telemetry.identify("user-123");
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    const ident = p.events.find((e: any) => e.type === "session_identify");
    expect(ident).toBeDefined();
    expect(ident.data.userId).toBe("user-123");
    expect(ident.data.previousSessionId).toBe(p.sessionId);
  });

  it("identify sin init es no-op", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = mockFetch();
    Telemetry.identify("user");
    await Telemetry.flush();
    expect(fetchMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reset limpia sessionStorage y regenera sessionId", async () => {
    const g = installBrowserGlobals();
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    const oldSession = g.store.get("opita_session_id");
    expect(oldSession).toBeTruthy();

    Telemetry.reset();
    const newSession = g.store.get("opita_session_id");
    expect(newSession).toBeTruthy();
    expect(newSession).not.toBe(oldSession);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reset sin sessionStorage no lanza", async () => {
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    Telemetry.reset();
    await Telemetry.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("usa fallback de generateUUID cuando crypto.randomUUID no existe", async () => {
    setGlobalCrypto({});
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.42);
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    expect(randomSpy).toHaveBeenCalled();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    randomSpy.mockRestore();
  });

  it("reutiliza sessionId existente en sessionStorage", async () => {
    installBrowserGlobals({ sessionValue: "sess-existente" });
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.sessionId).toBe("sess-existente");
  });

  it("registra listeners window y pagehide dispara flush", async () => {
    const g = installBrowserGlobals();
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    expect(g.listeners.visibilitychange).toBeTypeOf("function");
    expect(g.listeners.pagehide).toBeTypeOf("function");

    g.listeners.pagehide();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await Telemetry.flush();
  });

  it("visibilitychange con estado hidden dispara flush", async () => {
    const g = installBrowserGlobals();
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    (globalThis as any).document.visibilityState = "hidden";
    g.listeners.visibilitychange();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await Telemetry.flush();
  });

  it("captura metadata del browser en los eventos", async () => {
    installBrowserGlobals();
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.events[0].data.url).toBe("https://app.opitacode.com/app");
    expect(p.events[0].data.referrer).toBe("https://opitacode.com/");
    expect(p.events[0].data.userAgent).toBe("vitest-agent");
    expect(p.events[0].data.screenResolution).toBe("1280x720");
  });

  it("referrer vacío se normaliza a string vacío", async () => {
    installBrowserGlobals();
    (globalThis as any).document.referrer = "";
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio" });
    await Telemetry.flush();
    const p = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(p.events[0].data.referrer).toBe("");
  });

  it("loguea con console.debug cuando debug:true", async () => {
    const dbg = vi.spyOn(console, "debug").mockImplementation(() => {});
    mockFetch();
    Telemetry.init({ productId: "vibe-studio", debug: true });
    await Telemetry.flush();
    expect(dbg).toHaveBeenCalled();
    dbg.mockRestore();
  });

  it("no loguea con debug:false", async () => {
    const dbg = vi.spyOn(console, "debug").mockImplementation(() => {});
    mockFetch();
    Telemetry.init({ productId: "vibe-studio", debug: false });
    await Telemetry.flush();
    expect(dbg).not.toHaveBeenCalled();
    dbg.mockRestore();
  });

  it("auto-flush por flushIntervalMs", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch();
    Telemetry.init({ productId: "vibe-studio", flushIntervalMs: 100 });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
