import { motion } from "framer-motion";
import { Sparkles, Code2, Wand2, TerminalSquare, LayoutTemplate } from "lucide-react";

export function EmptyPreviewState({ 
  actionButton, 
  statusText 
}: { 
  actionButton?: React.ReactNode;
  statusText?: string;
} = {}) {
  const features = [
    { icon: <Code2 className="w-5 h-5" />, title: "Live Coding", desc: "Preview instantáneo mientras programas" },
    { icon: <Wand2 className="w-5 h-5" />, title: "Vibe AI", desc: "Motor de inteligencia artificial nativo" },
    { icon: <TerminalSquare className="w-5 h-5" />, title: "Zen Flow", desc: "Experiencia inmersiva y sin distracciones" },
    { icon: <LayoutTemplate className="w-5 h-5" />, title: "OpenSpec", desc: "Desarrollo impulsado por especificaciones" }
  ];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-obsidian-950 overflow-hidden font-sans">
      {/* Animated Background Orbs */}
      <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-aura-purple/20 mix-blend-screen filter blur-[100px] animate-blob pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-aura-cyan/20 mix-blend-screen filter blur-[100px] animate-blob-reverse delay-2000 pointer-events-none"></div>
      
      {/* Interactive Floating Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center max-w-3xl px-6"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
          className="w-24 h-24 rounded-3xl bg-obsidian-900/60 border border-white/10 shadow-[0_0_50px_rgba(168,85,247,0.2)] flex items-center justify-center mb-8 backdrop-blur-2xl relative group cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-aura-purple/20 to-aura-cyan/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"></div>
          <Sparkles className="w-10 h-10 text-white/90 drop-shadow-lg" />
        </motion.div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Vibe
          </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-aura-purple to-aura-cyan ml-3">
            Studio
          </span>
        </h1>
        
        <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
          Tu espacio de trabajo listo. 
          <br/>
          Comienza a escribir código o pídele a Vibe AI que construya el futuro por ti.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + idx * 0.1, duration: 0.5 }}
              className="flex items-start gap-4 p-4 rounded-2xl bg-obsidian-900/40 border border-white/5 hover:border-aura-cyan/30 hover:bg-obsidian-800/60 transition-all backdrop-blur-xl group cursor-default shadow-lg"
            >
              <div className="p-3 rounded-xl bg-black/40 text-slate-300 group-hover:text-aura-cyan group-hover:scale-110 transition-all">
                {feature.icon}
              </div>
              <div className="text-left flex flex-col justify-center">
                <h3 className="font-semibold text-slate-200 mb-1 text-sm">{feature.title}</h3>
                <p className="text-xs text-slate-500">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dynamic Action Button or Status */}
        {(actionButton || statusText) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12 flex flex-col items-center"
          >
            {actionButton}
            {statusText && !actionButton && (
              <p className="text-xs text-slate-500 font-medium tracking-widest uppercase mt-4">
                {statusText}
              </p>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Subtle footer indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 flex items-center gap-2 text-xs font-mono text-slate-600 uppercase tracking-widest"
      >
        <span className="w-2 h-2 rounded-full bg-aura-cyan animate-pulse"></span>
        Zen Flow Engine Active
      </motion.div>
    </div>
  );
}
