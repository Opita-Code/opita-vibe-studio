import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { initiateSSO } from "@/auth/sso";
import logoSvg from "@/assets/logo-symbol.svg";

// ─── Props ──────────────────────────────────────────────────────

interface LoginScreenProps {
  /** Callback cuando el usuario completa el login o elige modo invitado */
  onAuthenticated?: () => void;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Pantalla de inicio de sesión.
 *
 * Para el MVP:
 * - Campo de email + botón "Iniciar sesión con Vibe Studio"
 * - Loading state mientras se autentica
 * - Error state con retry
 * - "Continuar sin cuenta" para modo invitado (free)
 *
 * En producción:
 * - Redirige al navegador del sistema para SSO OAuth 2.0
 * - Callback recibe el token y completa la autenticación
 *
 * Brand: muestra el símbolo SVG de Vibe Studio y el nombre "Vibe Studio"
 */
export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useAuthStore((s) => s.login);
  const enableGuestMode = useAuthStore((s) => s.enableGuestMode);

  const handleSSOLogin = useCallback(async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico para continuar");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await initiateSSO(email.trim());
      if (result) {
        login(result.user, result.session);
        onAuthenticated?.();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [email, login, onAuthenticated]);

  const handleGuestMode = useCallback(() => {
    // Modo invitado: sin autenticación, plan free
    enableGuestMode();
    onAuthenticated?.();
  }, [enableGuestMode, onAuthenticated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !isLoading) {
        handleSSOLogin();
      }
    },
    [handleSSOLogin, isLoading],
  );

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-2">
          <img src={logoSvg} alt="Vibe Studio" className="h-16 w-16" />
          <h1 className="text-xl font-bold text-[#d4d4d4]">Vibe Studio</h1>
          <p className="text-center text-sm text-[#969696]">
            Vibecodea en español. Aprende sin darte cuenta.
          </p>
        </div>

        {/* Formulario de login */}
        <div className="flex w-full flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="tu@email.com"
            disabled={isLoading}
            autoFocus
            className="w-full rounded border border-[#444] bg-[#2d2d2d] px-4 py-2.5 text-sm text-[#d4d4d4] placeholder-[#616161] outline-none transition-colors focus:border-[var(--vibe-indigo)] focus:ring-1 focus:ring-[var(--vibe-indigo)] disabled:opacity-50"
          />

          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={handleSSOLogin}
            disabled={isLoading || !email.trim()}
            style={{ backgroundColor: "var(--vibe-indigo)" }}
            className="flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-medium text-white hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión con Vibe Studio"
            )}
          </button>
        </div>

        {/* Separador */}
        <div className="flex w-full items-center gap-2">
          <div className="h-px flex-1 bg-[#333]" />
          <span className="text-xs text-[#616161]">o</span>
          <div className="h-px flex-1 bg-[#333]" />
        </div>

        {/* Modo invitado */}
        <button
          onClick={handleGuestMode}
          disabled={isLoading}
          style={{ color: "var(--vibe-indigo)" }}
          className="text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          Continuar sin cuenta
        </button>

        {/* Footer info */}
        <p className="text-center text-xs text-[#616161]">
          Al continuar, aceptás nuestros{" "}
          <span className="text-[var(--vibe-indigo)]">términos y condiciones</span>.
        </p>
      </div>
    </div>
  );
}
