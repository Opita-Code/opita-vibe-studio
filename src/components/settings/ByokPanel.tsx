import { useState, useEffect, useCallback } from "react";
import {
  getByokProviderDisplayInfo,
  saveProviderKey,
  deleteProviderKey,
  testProviderConnection,
  BYOK_PROVIDERS,
} from "@/lib/byok-store";
import type { ProviderDisplayInfo, ProviderDefinition } from "@/lib/byok-store";
import type { OAuthTokens } from "@/lib/chatgpt-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Link as LinkIcon, AlertCircle, CheckCircle2, ChevronRight, Zap, Copy, ExternalLink, Loader2 } from "lucide-react";

export function ByokPanel() {
  const [providers, setProviders] = useState<ProviderDisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

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

  const handleProviderSelect = (id: string) => {
    if (selectedProvider === id) {
      setSelectedProvider(null);
    } else {
      setSelectedProvider(id);
      setApiKey("");
      setEndpoint("");
      setSaveError(null);
      setSaveSuccess(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!selectedProvider) return;
    if (!apiKey.trim()) {
      setSaveError("La Llave de Acceso es requerida");
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
      const valid = await testProviderConnection(
        selectedProvider,
        apiKey.trim(),
        endpoint.trim() || undefined,
      );

      if (!valid) {
        setSaveError("Llave de Acceso inválida. Verifica que sea correcta.");
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
      setSelectedProvider(null); // Collapse form
      await loadProviders();
    } catch (err) {
      setSaveError(`Error al guardar: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [apiKey, endpoint, selectedProvider, loadProviders]);

  const handleDelete = useCallback(
    async (providerId: string) => {
      await deleteProviderKey(providerId);
      await loadProviders();
    },
    [loadProviders],
  );

  const handleTestConnection = useCallback(async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const { getProviderKey } = await import("@/lib/byok-store");
      const entry = await getProviderKey(providerId);
      if (!entry) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? { ...p, status: "error", errorMessage: "No hay llave configurada" }
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

  const getDef = (id: string): ProviderDefinition | undefined =>
    BYOK_PROVIDERS.find((p) => p.id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 h-64">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-aura-cyan border-t-transparent" />
      </div>
    );
  }

  const configuredProviders = providers.filter((p) => p.configured);
  const unconfiguredProviders = providers.filter((p) => !p.configured);

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-200 mb-2 flex items-center gap-2">
          Conexiones IA
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
          Conecta tus proveedores de Inteligencia Artificial favoritos. Esto te permite utilizar sus modelos más avanzados directamente en Vibe Studio de forma segura y local, sin gastar los tokens de tu plan de Opita.
        </p>
      </div>

      {/* Conexiones Activas */}
      {configuredProviders.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            Tus Conexiones Activas
          </h3>
          <div className="grid gap-3">
            {configuredProviders.map((provider) => {
              const def = getDef(provider.id);
              return (
                <div
                  key={provider.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/5 bg-obsidian-900/50 p-4 transition-all hover:bg-obsidian-800/80 backdrop-blur-md"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-slate-200">
                      {def?.name ?? provider.name}
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <StatusDot status={provider.status} />
                      {provider.status === "connected" ? (
                        <span className="text-emerald-400 font-medium">Conectado</span>
                      ) : provider.status === "error" ? (
                        <span className="text-red-400 font-medium">Fallo de conexión</span>
                      ) : (
                        <span className="text-amber-400 font-medium">Verificando...</span>
                      )}
                      {provider.maskedKey && (
                        <span className="text-slate-500 font-mono bg-black/30 px-1.5 py-0.5 rounded border border-white/5">{provider.maskedKey}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(provider.id)}
                      disabled={testingProvider === provider.id}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-aura-cyan bg-aura-cyan/10 hover:bg-aura-cyan/20 border border-aura-cyan/20 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {testingProvider === provider.id ? "Probando..." : "Probar Conexión"}
                    </button>
                    <button
                      onClick={() => handleDelete(provider.id)}
                      className="rounded-md p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Desconectar proveedor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proveedores Disponibles */}
      {unconfiguredProviders.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Zap size={16} className="text-aura-purple drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            Disponibles para Conectar
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unconfiguredProviders.map((provider) => {
              const def = getDef(provider.id);
              const isSelected = selectedProvider === provider.id;

              return (
                <div key={provider.id} className="flex flex-col rounded-xl overflow-hidden border border-white/5 bg-obsidian-900/40 backdrop-blur-md transition-all hover:border-white/10 shadow-lg">
                  <button
                    onClick={() => handleProviderSelect(provider.id)}
                    className={`w-full text-left p-4 flex items-center justify-between transition-colors ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}`}
                  >
                    <div>
                      <span className="text-sm font-bold text-slate-200 block mb-0.5">{def?.name ?? provider.name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{def?.category}</span>
                    </div>
                    <ChevronRight size={18} className={`text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-aura-cyan' : ''}`} />
                  </button>

                  {/* Formulario Expandible */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/20"
                      >
                        <div className="p-4 flex flex-col gap-4">
                          
                          {/* ChatGPT / Codex OAuth */}
                          {provider.id === "chatgpt-web" && (
                            <ChatGPTAuthBlock
                              onSuccess={async (tokens) => {
                                setSaveError(null);
                                setSaving(true);
                                try {
                                  await saveProviderKey("chatgpt-web", tokens.accessToken, undefined, {
                                    refreshToken: tokens.refreshToken,
                                    expiresAt: tokens.expiresAt,
                                  });
                                  setSaveSuccess(true);
                                  setSelectedProvider(null);
                                  await loadProviders();
                                } catch (err) {
                                  setSaveError("Error al guardar: " + String(err));
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              onError={(msg) => setSaveError(msg)}
                            />
                          )}

                          {/* Custom Endpoint URL */}
                          {def?.requiresEndpoint && (
                            <div>
                              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                URL del Endpoint
                              </label>
                              <input
                                type="url"
                                value={endpoint}
                                onChange={(e) => { setEndpoint(e.target.value); setSaveError(null); }}
                                placeholder="https://mi-llm.example.com/v1"
                                className="w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-aura-cyan transition-colors"
                              />
                            </div>
                          )}

                          {/* Llave de Acceso Input */}
                          <div>
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400 flex justify-between items-center">
                              <span>Llave de Acceso (API Key)</span>
                              {def?.docsUrl && (
                                <a href={def.docsUrl} target="_blank" rel="noreferrer" className="text-aura-cyan hover:underline flex items-center gap-1 normal-case tracking-normal">
                                  <LinkIcon size={10} /> Dónde obtenerla
                                </a>
                              )}
                            </label>
                            <input
                              type="password"
                              value={apiKey}
                              onChange={(e) => { setApiKey(e.target.value); setSaveError(null); }}
                              placeholder={provider.id === 'chatgpt-web' ? "O pega tu session token manualmente..." : "sk-..."}
                              className="w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-aura-cyan transition-colors font-mono"
                            />
                          </div>

                          {saveError && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                              <AlertCircle size={14} className="shrink-0 mt-0.5" /> 
                              <span className="leading-relaxed">{saveError}</span>
                            </div>
                          )}

                          {saveSuccess && (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2">
                              <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> 
                              <span className="leading-relaxed">¡Conexión establecida con éxito!</span>
                            </div>
                          )}

                          <button
                            onClick={handleSave}
                            disabled={saving || !apiKey.trim()}
                            className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-aura-cyan to-aura-purple hover:opacity-90 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-aura-cyan/20"
                          >
                            {saving ? "Verificando Conexión..." : "Conectar Proveedor"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ProviderDisplayInfo["status"] }) {
  const colors: Record<string, string> = {
    connected: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    not_configured: "bg-slate-600",
    error: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
    verifying: "bg-amber-400 animate-pulse",
  };

  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? "bg-slate-600"}`} />;
}

// ─── ChatGPT Auth Block (multi-platform) ─────────────────────
//
// Tauri  → PKCE with localhost redirect (seamless)
// Web    → Device Code Flow (code + link shown to user)

function ChatGPTAuthBlock({
  onSuccess,
  onError,
}: {
  onSuccess: (tokens: OAuthTokens) => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<{
    userCode: string;
    verificationUri: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const isTauriEnv =
    typeof window !== "undefined" && "__TAURI__" in window;

  const handleAuth = useCallback(async () => {
    setLoading(true);
    setDeviceCode(null);
    setCopied(false);

    try {
      const { startAuth, pollForDeviceToken } = await import(
        "@/lib/chatgpt-auth"
      );
      const result = await startAuth();

      if (result.type === "tokens") {
        // Tauri PKCE → got tokens immediately
        onSuccess(result.tokens);
        setLoading(false);
        return;
      }

      // Web/Mobile → Device Code Flow
      setDeviceCode({
        userCode: result.pending.userCode,
        verificationUri: result.pending.verificationUri,
      });

      // Poll in background
      const tokens = await pollForDeviceToken(result.pending);
      onSuccess(tokens);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setDeviceCode(null);
    }
  }, [onSuccess, onError]);

  const handleCopy = useCallback(() => {
    if (deviceCode?.userCode) {
      navigator.clipboard.writeText(deviceCode.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [deviceCode]);

  return (
    <div className="p-3 rounded-lg bg-aura-purple/10 border border-aura-purple/20 text-xs text-aura-purple flex flex-col gap-2">
      <span className="font-semibold block">
        Conexión con Codex (ChatGPT Plus):
      </span>

      {!deviceCode ? (
        <>
          <p className="text-slate-300 leading-relaxed">
            {isTauriEnv
              ? "Se abrirá una ventana segura. Solo inicia sesión en tu cuenta de ChatGPT y nosotros capturaremos tu sesión de forma local."
              : "Conecta tu cuenta de ChatGPT Plus para usar Codex. Se mostrará un código que deberás ingresar en OpenAI."}
          </p>
          <button
            type="button"
            onClick={handleAuth}
            disabled={loading}
            className="mt-1 w-full py-2 bg-aura-purple/20 hover:bg-aura-purple/30 text-aura-purple border border-aura-purple/40 font-semibold rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Conectando..." : "Iniciar Sesión en ChatGPT"}
          </button>
        </>
      ) : (
        /* Device Code Flow UI */
        <div className="flex flex-col gap-3">
          <p className="text-slate-300 leading-relaxed">
            Abre el siguiente enlace e ingresa el código:
          </p>

          {/* User code display */}
          <div className="flex items-center justify-between bg-black/30 rounded-lg px-4 py-3 border border-aura-purple/30">
            <span className="font-mono text-lg tracking-[0.3em] text-white font-bold">
              {deviceCode.userCode}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Copiar código"
            >
              {copied ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <Copy size={16} className="text-slate-400" />
              )}
            </button>
          </div>

          {/* Verification link */}
          <a
            href={deviceCode.verificationUri}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 py-2 bg-aura-purple/20 hover:bg-aura-purple/30 border border-aura-purple/40 rounded-md transition-colors font-semibold"
          >
            <ExternalLink size={14} />
            Abrir OpenAI
          </a>

          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={12} className="animate-spin" />
            <span>Esperando que completes el inicio de sesión...</span>
          </div>
        </div>
      )}
    </div>
  );
}
