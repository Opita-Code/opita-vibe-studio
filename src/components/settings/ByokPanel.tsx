import { useState, useEffect, useCallback } from "react";
import {
  getByokProviderDisplayInfo,
  saveProviderKey,
  deleteProviderKey,
  testProviderConnection,
} from "@/lib/byok-store";
import type { ProviderDisplayInfo } from "@/lib/byok-store";

// ─── Provider Definitions ───────────────────────────────────────

interface ProviderDefinition {
  id: string;
  name: string;
  docsUrl?: string;
  requiresEndpoint: boolean;
}

const BYOK_PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    docsUrl: "https://platform.openai.com/api-keys",
    requiresEndpoint: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    docsUrl: "https://openrouter.ai/keys",
    requiresEndpoint: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    docsUrl: "https://console.anthropic.com/",
    requiresEndpoint: false,
  },
  {
    id: "custom",
    name: "Endpoint Personalizado",
    requiresEndpoint: true,
  },
];

// ─── Component ──────────────────────────────────────────────────

/**
 * Panel de configuración BYOK (Bring Your Own Key).
 *
 * Permite:
 * - Ver proveedores soportados con estado
 * - Agregar API key con validación
 * - Ver key enmascarada
 * - Eliminar key con confirmación
 * - Probar conexión
 * - Configurar endpoint personalizado (URL + key)
 *
 * Almacenamiento: localStorage (MVP fallback).
 * En producción: SQLite encriptado via Tauri store plugin.
 */
export function ByokPanel() {
  const [providers, setProviders] = useState<ProviderDisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado del formulario de agregar key
  const [selectedProvider, setSelectedProvider] = useState<string>("openai");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Confirmación de eliminación
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // ── Cargar estado inicial ──────────────────────────────────
  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const info = await getByokProviderDisplayInfo();
      setProviders(info);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // ── Proveedor seleccionado cambia → resetear formulario ────
  const handleProviderChange = useCallback((id: string) => {
    setSelectedProvider(id);
    setApiKey("");
    setEndpoint("");
    setSaveError(null);
    setSaveSuccess(false);

    // Si el proveedor ya está configurado, precargar endpoint
    // (La key no se precarga por seguridad)
    const prov = BYOK_PROVIDERS.find((p) => p.id === id);
    if (prov?.requiresEndpoint) {
      // Dejar que el usuario ingrese la URL
    }
  }, []);

  // ── Guardar key ────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      setSaveError("La API key es requerida");
      return;
    }

    if (selectedProvider === "custom" && !endpoint.trim()) {
      setSaveError("La URL del endpoint es requerida");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Validar key antes de guardar
      const valid = await testProviderConnection(
        selectedProvider,
        apiKey.trim(),
        endpoint.trim() || undefined,
      );

      if (!valid) {
        setSaveError("API key inválida. Verifica que sea correcta.");
        return;
      }

      await saveProviderKey(
        selectedProvider,
        apiKey.trim(),
        endpoint.trim() || undefined,
      );

      setSaveSuccess(true);
      setApiKey("");
      setEndpoint("");
      await loadProviders();
    } catch (err) {
      setSaveError(`Error al guardar: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [apiKey, endpoint, selectedProvider, loadProviders]);

  // ── Eliminar key ───────────────────────────────────────────
  const handleDelete = useCallback(
    async (providerId: string) => {
      await deleteProviderKey(providerId);
      setConfirmDelete(null);
      await loadProviders();
    },
    [loadProviders],
  );

  // ── Probar conexión ────────────────────────────────────────
  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      // Para probar, necesitamos la key. Si ya está configurada,
      // obtenemos la key almacenada.
      const { getProviderKey } = await import("@/lib/byok-store");
      const entry = await getProviderKey(providerId);
      if (!entry) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? { ...p, status: "error", errorMessage: "No hay key configurada" }
              : p,
          ),
        );
        return;
      }

      const ok = await testProviderConnection(providerId, entry.key, entry.endpoint);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                status: ok ? "connected" : "error",
                errorMessage: ok ? undefined : "Error de conexión",
              }
            : p,
        ),
      );
    } catch (err) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, status: "error", errorMessage: String(err) } : p,
        ),
      );
    } finally {
      setTestingProvider(null);
    }
  }, []);

  // ── Obtener definición de proveedor ────────────────────────
  const getDef = (id: string): ProviderDefinition | undefined =>
    BYOK_PROVIDERS.find((p) => p.id === id);

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--vibe-indigo)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-[#d4d4d4]">Bring Your Own Key (BYOK)</h2>
      <p className="text-xs text-[#969696]">
        Configura tus propias API keys para usar modelos adicionales. Las keys se
        almacenan de forma segura.
      </p>

      {/* Lista de proveedores configurados */}
      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const def = getDef(provider.id);
          return (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded border border-[#333] bg-[#2d2d2d] px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-[#d4d4d4]">
                  {def?.name ?? provider.name}
                </span>

                {provider.configured ? (
                  <div className="flex items-center gap-2 text-xs">
                    <StatusDot status="connected" />
                    <span className="text-[#4ec9b0]">Conectada</span>
                    {provider.maskedKey && (
                      <span className="text-[#616161]">{provider.maskedKey}</span>
                    )}
                    {provider.endpoint && (
                      <span className="text-[#616161]">{provider.endpoint}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs">
                    <StatusDot status="not_configured" />
                    <span className="text-[#616161]">No configurado</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Botón probar conexión */}
                {provider.configured && (
                  <button
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testingProvider === provider.id}
                    aria-label={`Probar conexión con ${def?.name ?? provider.name}`}
                    className="rounded px-2 py-1 text-xs text-[var(--vibe-indigo)] transition-colors hover:bg-[#333] disabled:opacity-50"
                    title="Probar conexión"
                  >
                    {testingProvider === provider.id ? "..." : "Probar"}
                  </button>
                )}

                {/* Botón eliminar */}
                {provider.configured && (
                  <>
                    {confirmDelete === provider.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(provider.id)}
                          aria-label={`Confirmar eliminación de ${def?.name ?? provider.name}`}
                          className="rounded px-2 py-1 text-xs text-red-400 transition-colors hover:bg-[#333]"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          aria-label="Cancelar eliminación"
                          className="rounded px-2 py-1 text-xs text-[#969696] transition-colors hover:bg-[#333]"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(provider.id)}
                        aria-label={`Eliminar key de ${def?.name ?? provider.name}`}
                        className="rounded px-2 py-1 text-xs text-[#969696] transition-colors hover:bg-[#333] hover:text-red-400"
                        title="Eliminar key"
                      >
                        Eliminar
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulario para agregar key */}
      <div className="rounded border border-[#333] bg-[#2d2d2d] p-3">
        <h3 className="mb-2 text-xs font-medium text-[#d4d4d4]">Agregar API key</h3>

        {/* Selector de proveedor */}
        <div className="mb-2">
          <label
            htmlFor="byok-provider"
            className="mb-1 block text-[10px] uppercase tracking-wider text-[#616161]"
          >
            Proveedor
          </label>
          <select
            id="byok-provider"
            value={selectedProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full rounded border border-[#444] bg-[#3c3c3c] px-3 py-1.5 text-xs text-[#d4d4d4] outline-none focus:border-[var(--vibe-indigo)]"
          >
            {BYOK_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Campo de endpoint (solo custom) */}
        {selectedProvider === "custom" && (
          <div className="mb-2">
            <label
              htmlFor="byok-endpoint"
              className="mb-1 block text-[10px] uppercase tracking-wider text-[#616161]"
            >
              URL del endpoint
            </label>
            <input
              id="byok-endpoint"
              type="url"
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value);
                setSaveError(null);
              }}
              placeholder="https://mi-llm.example.com/v1"
              className="w-full rounded border border-[#444] bg-[#3c3c3c] px-3 py-1.5 text-xs text-[#d4d4d4] placeholder-[#616161] outline-none focus:border-[var(--vibe-indigo)]"
            />
          </div>
        )}

        {/* Campo de API key */}
        <div className="mb-2">
          <label
            htmlFor="byok-api-key"
            className="mb-1 block text-[10px] uppercase tracking-wider text-[#616161]"
          >
            API Key
          </label>
          <input
            id="byok-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaveError(null);
            }}
            placeholder={
              selectedProvider === "custom"
                ? "Ingresa tu API key"
                : `sk-... (${getDef(selectedProvider)?.name ?? "proveedor"})`
            }
            className="w-full rounded border border-[#444] bg-[#3c3c3c] px-3 py-1.5 text-xs text-[#d4d4d4] placeholder-[#616161] outline-none focus:border-[var(--vibe-indigo)]"
          />
        </div>

        {/* Link a docs */}
        {getDef(selectedProvider)?.docsUrl && (
          <a
            href={getDef(selectedProvider)!.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 block text-[10px] text-[var(--vibe-indigo)] underline"
          >
            ¿Dónde obtengo mi API key?
          </a>
        )}

        {/* Error */}
        {saveError && (
          <p className="mb-2 text-xs text-red-400" role="alert">
            {saveError}
          </p>
        )}

        {/* Success */}
        {saveSuccess && (
          <p className="mb-2 text-xs text-[#4ec9b0]">✅ Key guardada correctamente</p>
        )}

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          style={{ backgroundColor: "var(--vibe-indigo)" }}
          className="w-full rounded px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Validando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ─── Status Dot ─────────────────────────────────────────────────

function StatusDot({ status }: { status: ProviderDisplayInfo["status"] }) {
  const colors: Record<string, string> = {
    connected: "bg-[#4ec9b0]",
    not_configured: "bg-[#616161]",
    error: "bg-red-500",
    verifying: "bg-yellow-500",
  };

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? "bg-[#616161]"}`}
    />
  );
}
