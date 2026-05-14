import { useState } from "react";
import { SandpackPreview } from "@codesandbox/sandpack-react";
import { VibeSandpackOverlay } from "./VibeSandpackOverlay";

export function VibeEnginePreview() {
  const [isReady, setIsReady] = useState(false);

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden">
      {/* Nuestro Overlay Personalizado con botón manual y despido inteligente */}
      <VibeSandpackOverlay onDismiss={() => setIsReady(true)} />

      {/* 
        Mantenemos el iframe oculto (opacity 0) hasta que esté completamente listo.
        Usamos opacity en lugar de conditional rendering para que el bundler interno
        no se interrumpa ni reinicie.
      */}
      <div
        className="w-full h-full transition-opacity duration-700 ease-in-out"
        style={{
          opacity: isReady ? 1 : 0,
          pointerEvents: isReady ? "auto" : "none",
        }}
      >
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showNavigator={false}
          className="bg-[#020617] h-full w-full border-none"
          style={{ height: "100%", flex: 1, backgroundColor: "#020617" }}
        />
      </div>

      {/* 
        Inyección de estilos globales para matar elementos residuales
        del framework interno de Sandpack
      */}
      <style>{`
        .sp-overlay, .sp-loading-overlay, .sp-error-overlay { display: none !important; }
        .sp-preview-iframe { border: none !important; background-color: #020617 !important; }
        .sp-navigator { display: none !important; }
        .sp-layout { border: none !important; background-color: transparent !important; }
      `}</style>
    </div>
  );
}
