import { motion } from "framer-motion";
import { Monitor, ArrowLeft } from "lucide-react";

export function MobileNotSupportedScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-obsidian-950 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-sm w-full bg-obsidian-900 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center relative overflow-hidden"
      >
        {/* Glow de fondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-aura-cyan/20 blur-[60px] pointer-events-none" />

        <div className="w-16 h-16 bg-obsidian-800 border border-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative z-10">
          <Monitor className="w-8 h-8 text-aura-cyan" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-3 tracking-tight relative z-10">
          Optimizado para Escritorio
        </h1>
        
        <p className="text-slate-400 text-[15px] leading-relaxed mb-8 relative z-10">
          Vibe Studio es una herramienta profesional de alto rendimiento diseñada para fluir con pantallas amplias y teclados físicos. Por favor, ábrelo desde tu computadora para obtener la mejor experiencia.
        </p>

        <a
          href="/"
          className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative z-10"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400" />
          Volver al Inicio
        </a>
      </motion.div>
    </div>
  );
}
