/**
 * BYOK providers (VL-5) — unit tests.
 *
 * Verifica que los 5 providers BYOK (together, groq, mistral, cohere,
 * perplexity) están registrados con sus modelos seleccionables — el
 * hallazgo #12 de la auditoría: las keys se guardaban pero los modelos
 * no aparecían en el selector.
 */

import { describe, it, expect } from "vitest";
import { initializeProviders, getProvider, listProviderIds, getProviderModels } from "../registry";

const BYOK_PROVIDERS = ["together", "groq", "mistral", "cohere", "perplexity"];

describe("BYOK providers registrados (VL-5)", () => {
  it("los 5 providers BYOK están en el registry", () => {
    initializeProviders();
    const ids = listProviderIds();
    for (const id of BYOK_PROVIDERS) {
      expect(ids).toContain(id);
    }
  });

  it("cada provider BYOK expone chat y tier byok", () => {
    initializeProviders();
    for (const id of BYOK_PROVIDERS) {
      const p = getProvider(id);
      expect(p.id).toBe(id);
      expect(p.tier).toBe("byok");
      expect(typeof p.chat).toBe("function");
    }
  });

  it("los modelos BYOK están disponibles en el registry", () => {
    initializeProviders();
    for (const id of BYOK_PROVIDERS) {
      const models = getProviderModels(id);
      expect(models.length).toBeGreaterThan(0);
      // Todos los modelos son tier byok.
      for (const m of models) {
        expect(m.tier).toBe("byok");
        expect(m.providerId).toBe(id);
      }
    }
  });
});
