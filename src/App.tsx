import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { EditorPanel } from "@/components/layout/EditorPanel";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { StatusBar } from "@/components/layout/StatusBar";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { restoreSession } from "@/auth/sso";

function App() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const chatVisible = useUIStore((s) => s.chatVisible);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const toggleChat = useUIStore((s) => s.toggleChat);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const setLoading = useAuthStore((s) => s.setLoading);

  const [sessionRestored, setSessionRestored] = useState(false);

  // ── Restaurar sesión al iniciar ──────────────────────────
  useEffect(() => {
    async function tryRestore() {
      setLoading(true);
      try {
        const result = await restoreSession();
        if (result) {
          login(result.user, result.session);
        }
      } catch {
        // No hay sesión guardada — mostrar login
      } finally {
        setLoading(false);
        setSessionRestored(true);
      }
    }
    tryRestore();
  }, [login, setLoading]);

  // ── Ctrl+B: toggle chat panel ───────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleChat]);

  // ── Resize handlers ─────────────────────────────────────
  const handleSidebarResize = useCallback(
    (delta: number) => {
      setSidebarWidth(sidebarWidth + delta);
    },
    [sidebarWidth, setSidebarWidth],
  );

  // ── Loading state ───────────────────────────────────────
  if (!sessionRestored) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--vibe-indigo)] border-t-transparent" />
          <span className="text-sm text-[#969696]">Cargando...</span>
        </div>
      </div>
    );
  }

  // ── Login screen (no autenticado) ───────────────────────
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // ── Layout principal ────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] text-[#d4d4d4]">
      {/* Panel principal: sidebar | editor | chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar izquierdo — explorador de archivos */}
        <Sidebar width={sidebarWidth} />

        {/* Handle de redimensionamiento del sidebar */}
        <ResizeHandle onResize={handleSidebarResize} />

        {/* Centro — editor + vista previa */}
        <EditorPanel />

        {/* Chat lateral derecho (toggleable) */}
        {chatVisible && <ChatPanel width={320} />}
      </div>

      {/* Barra de estado inferior */}
      <StatusBar />
    </div>
  );
}

export default App;
