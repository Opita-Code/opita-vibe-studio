import { useSandpack } from "@codesandbox/sandpack-react";
import { AlertCircle, RefreshCw, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/project";
import { EmptyPreviewState } from "./EmptyPreviewState";

export function VibeSandpackOverlay({ onDismiss }: { onDismiss?: () => void }) {
  const { sandpack } = useSandpack();
  const error = sandpack.error;
  const status = sandpack.status as string;

  const errorObj = error as any;
  const title = errorObj?.title || "Error de Compilación";
  const desc = errorObj?.message || "Vibe Engine no pudo compilar el código.";
  const errorMsg = errorObj?.message || "Verifica la sintaxis e inténtalo de nuevo.";

  const isDirty = useProjectStore((s) => Object.keys(s.isDirty).length > 0);
  const [coverActive, setCoverActive] = useState(true);

  // Auto-dismiss cuando el usuario empieza a trabajar (isDirty == true)
  useEffect(() => {
    if (isDirty && coverActive && status === "running") {
      setCoverActive(false);
      onDismiss?.();
    }
  }, [isDirty, coverActive, status, onDismiss]);

  const handleManualDismiss = () => {
    setCoverActive(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {coverActive && !error && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617] text-white"
        >
          <EmptyPreviewState 
            actionButton={
              status === "running" ? (
                <button 
                  onClick={handleManualDismiss}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-full transition-all duration-300 text-sm font-semibold border border-white/10 hover:border-aura-purple/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-md cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white/80" />
                  Mostrar Vista Previa
                </button>
              ) : undefined
            }
            statusText={
              status === "initializing" ? "Descargando entorno..." : 
              status === "loading" ? "Compilando dependencias..." :
              "Motor Listo"
            }
          />
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 z-[100] p-6 bg-[#020617] flex flex-col items-center justify-center overflow-hidden"
        >
          <div className="max-w-lg w-full bg-red-950/20 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(239,68,68,0.1)]">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            
            <h3 className="text-red-200 font-bold text-xl mb-3">{title}</h3>
            <p className="text-red-300/70 text-sm mb-8 leading-relaxed">{desc}</p>
            
            <div className="w-full bg-[#050505] rounded-xl p-5 text-left overflow-auto text-xs font-mono text-red-300/60 mb-8 max-h-48 border border-white/5 shadow-inner">
              {errorMsg}
            </div>

            <button 
              onClick={() => window.location.reload()} 
              className="flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-200 px-6 py-3 rounded-xl transition-all duration-300 text-sm font-semibold border border-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
            >
              <RefreshCw className="w-4 h-4" />
              Reiniciar Motor
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
