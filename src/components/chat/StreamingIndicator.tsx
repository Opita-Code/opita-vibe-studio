import { useState, useEffect } from "react";

const VIBE_PHRASES = [
  "Afinando el aura del código...",
  "Inyectando flow en los componentes...",
  "Destilando lógica premium...",
  "Calculando la estética del algoritmo...",
  "Calibrando el flujo de trabajo...",
  "Conectando las vibras del backend...",
  "Compilando con extra Vibe...",
  "Diseñando píxeles telepáticamente...",
  "Alineando los divs (mentira, estamos en backend)...",
  "Sincronizando frecuencias de la base de datos...",
  "Preparando el lienzo digital...",
  "Invocando los espíritus de la sintaxis...",
  "Haciendo magia con TypeScript..."
];

/**
 * Indicador animado de "pensando..." premium con estilo Glass & Glow.
 */
export function StreamingIndicator() {
  const [phrase, setPhrase] = useState(VIBE_PHRASES[0]);

  useEffect(() => {
    // Escoger una frase aleatoria inicial distinta de la primera si se desea, 
    // pero para empezar suave, empezamos con la primera y luego iteramos.
    let currentIndex = Math.floor(Math.random() * VIBE_PHRASES.length);
    setPhrase(VIBE_PHRASES[currentIndex]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % VIBE_PHRASES.length;
      setPhrase(VIBE_PHRASES[currentIndex]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm bg-obsidian-900/60 border border-white/5 backdrop-blur-3xl px-4 py-3 shadow-xl relative overflow-hidden transition-all duration-300">
        <div className="absolute inset-0 bg-aura-cyan/5 animate-pulse mix-blend-screen pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-4 h-4 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-aura-cyan rounded-full animate-ping opacity-20"></div>
            <div className="w-2 h-2 bg-gradient-to-br from-aura-cyan to-aura-purple rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></div>
          </div>
          <span className="text-sm font-medium bg-gradient-to-r from-aura-cyan to-aura-purple bg-clip-text text-transparent opacity-90 transition-opacity duration-300">
            {phrase}
          </span>
        </div>
      </div>
    </div>
  );
}
