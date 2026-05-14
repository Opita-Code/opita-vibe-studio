import { useState, useCallback } from "react";
import { initiateSSO, loginWithPassword, registerWithPassword } from "@/auth/sso";
import vibeLogoUrl from "@/assets/vibe-logo.svg";

// ─── Props ──────────────────────────────────────────────────────

interface LoginScreenProps {
  /** Callback cuando el usuario completa el login o elige modo invitado */
  onAuthenticated?: () => void;
  /** Callback para cerrar el modal */
  onClose?: () => void;
}

type AuthMode = "magic" | "password";
type PasswordView = "login" | "register";

// ─── Component ──────────────────────────────────────────────────

export function LoginScreen({ onClose, onAuthenticated }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<AuthMode>("password");
  const [passwordView, setPasswordView] = useState<PasswordView>("login");

  const clearError = () => setError(null);

  const handleMagicLinkLogin = useCallback(async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico para continuar");
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await initiateSSO(email.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handlePasswordAuth = useCallback(async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico");
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña");
      return;
    }
    if (passwordView === "register" && password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      if (passwordView === "register") {
        await registerWithPassword(email.trim(), password, name.trim() || undefined);
      } else {
        await loginWithPassword(email.trim(), password);
      }
      // Auth store gets synced by restoreSession() inside the functions
      onAuthenticated?.();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [email, password, name, passwordView]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !isLoading && !success) {
        if (mode === "magic") {
          handleMagicLinkLogin();
        } else {
          handlePasswordAuth();
        }
      }
    },
    [handleMagicLinkLogin, handlePasswordAuth, isLoading, success, mode]
  );

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-obsidian-900">
      {/* Elementos de fondo tipo "Zen Flow" */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-aura-purple/5 mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-aura-cyan/5 mix-blend-screen filter blur-[100px] animate-blob-reverse delay-2000"></div>
      </div>

      {/* Botón cerrar */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-white/40 hover:text-white transition-colors z-10 flex items-center gap-2 text-sm font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-md"
          aria-label="Volver atrás"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Volver
        </button>
      )}
      
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-6">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-4 mb-2 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-aura-cyan/20 blur-xl rounded-full animate-pulse"></div>
            <img src={vibeLogoUrl} alt="Vibe Studio" className="relative h-20 w-20" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Vibe Studio</h1>
          <p className="text-center text-sm font-light text-white/50">
            Vibecodea en español. Aprende sin darte cuenta.
          </p>
        </div>

        {success ? (
          <div className="w-full flex flex-col items-center gap-4 animate-fade-in p-6 bg-white/5 border border-aura-cyan/30 rounded-xl">
            <svg className="w-12 h-12 text-aura-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="text-center">
              <h3 className="text-lg font-medium text-white/90">Revisa tu correo</h3>
              <p className="text-sm text-white/60 mt-1">
                Hemos enviado un enlace mágico a <strong>{email}</strong>.
                Haz clic en él para iniciar sesión.
              </p>
            </div>
            <button
              onClick={() => setSuccess(false)}
              className="mt-2 text-xs text-aura-cyan/70 hover:text-aura-cyan transition-colors"
            >
              Intentar con otro correo
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
            {/* ─── Auth Mode Tabs ─── */}
            <div className="flex w-full rounded-xl bg-white/5 border border-white/5 p-1 gap-1">
              <button
                onClick={() => { setMode("password"); clearError(); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                  mode === "password"
                    ? "bg-white/10 text-white/90 shadow-sm"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Contraseña
              </button>
              <button
                onClick={() => { setMode("magic"); clearError(); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                  mode === "magic"
                    ? "bg-white/10 text-white/90 shadow-sm"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Enlace Mágico
              </button>
            </div>

            <div className="flex w-full flex-col gap-3">
              {/* Name field — only for register */}
              {mode === "password" && passwordView === "register" && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Tu nombre"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-white/5 bg-obsidian-800/80 px-4 py-3 text-sm text-white/90 placeholder-white/30 outline-none transition-all focus:border-aura-purple/50 focus:ring-1 focus:ring-aura-purple/50 focus:bg-white/5 disabled:opacity-50 shadow-inner"
                />
              )}

              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                onKeyDown={handleKeyDown}
                placeholder="tu@email.com"
                disabled={isLoading}
                autoFocus
                className="w-full rounded-xl border border-white/5 bg-obsidian-800/80 px-4 py-3 text-sm text-white/90 placeholder-white/30 outline-none transition-all focus:border-aura-purple/50 focus:ring-1 focus:ring-aura-purple/50 focus:bg-white/5 disabled:opacity-50 shadow-inner"
              />

              {/* Password field — only for password mode */}
              {mode === "password" && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  onKeyDown={handleKeyDown}
                  placeholder={passwordView === "register" ? "Contraseña (mín. 8 caracteres)" : "Contraseña"}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-white/5 bg-obsidian-800/80 px-4 py-3 text-sm text-white/90 placeholder-white/30 outline-none transition-all focus:border-aura-purple/50 focus:ring-1 focus:ring-aura-purple/50 focus:bg-white/5 disabled:opacity-50 shadow-inner"
                />
              )}

              {error && (
                <p className="text-xs text-red-400 font-medium" role="alert">
                  {error}
                </p>
              )}

              {mode === "magic" ? (
                <button
                  onClick={handleMagicLinkLogin}
                  disabled={isLoading || !email.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura-cyan to-aura-purple px-4 py-3 text-sm font-medium text-white disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                >
                  {isLoading ? "Enviando..." : "Recibir Enlace Mágico"}
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePasswordAuth}
                    disabled={isLoading || !email.trim() || !password}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura-cyan to-aura-purple px-4 py-3 text-sm font-medium text-white disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                  >
                    {isLoading
                      ? "Procesando..."
                      : passwordView === "register"
                        ? "Crear Cuenta"
                        : "Iniciar Sesión"
                    }
                  </button>
                  <button
                    onClick={() => { setPasswordView(passwordView === "login" ? "register" : "login"); clearError(); }}
                    className="text-xs text-center text-aura-cyan/60 hover:text-aura-cyan transition-colors"
                  >
                    {passwordView === "login"
                      ? "¿No tienes cuenta? Regístrate"
                      : "¿Ya tienes cuenta? Inicia sesión"
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        

        {/* Footer links */}
        <p className="text-center text-[11px] font-light text-white/40 animate-fade-up mt-4" style={{ animationDelay: "300ms" }}>
          Al continuar, aceptas nuestros{" "}
          <a
            href="https://opitacode.com/legal/terminos.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-aura-cyan/70 hover:text-aura-cyan hover:underline transition-colors"
          >
            términos
          </a>{" "}
          y la{" "}
          <a
            href="https://opitacode.com/legal/privacidad.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-aura-cyan/70 hover:text-aura-cyan hover:underline transition-colors"
          >
            política de privacidad
          </a>
          .
        </p>
      </div>
    </div>
  );
}
