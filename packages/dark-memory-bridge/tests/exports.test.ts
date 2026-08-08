/**
 * DarkMemoryBridge — surface de exports del paquete.
 *
 * Cubre src/index.ts (re-exports públicos) para que el módulo raíz no
 * quede como hueco de coverage.
 */

import { describe, it, expect } from "vitest";
import * as bridge from "../src";

describe("package exports (src/index.ts)", () => {
  it("expone DarkMemoryBridge", () => {
    expect(typeof bridge.DarkMemoryBridge).toBe("function");
  });

  it("expone los transports y helpers", () => {
    expect(typeof bridge.createTransport).toBe("function");
    expect(typeof bridge.HttpTransport).toBe("function");
    expect(typeof bridge.MemoryTransport).toBe("function");
    expect(typeof bridge.TauriTransport).toBe("function");
    expect(typeof bridge.isTauriAvailable).toBe("function");
  });
});
