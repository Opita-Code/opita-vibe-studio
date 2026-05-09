/**
 * Indicador animado de "escribiendo..." con tres puntos pulsantes.
 */
export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      <span className="text-sm text-[#969696]">Vibe Studio está escribiendo</span>
      <span className="flex gap-1">
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#969696]"
          style={{ animation: "blink 1.4s ease-in-out infinite" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#969696]"
          style={{ animation: "blink 1.4s ease-in-out infinite", animationDelay: "0.2s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#969696]"
          style={{ animation: "blink 1.4s ease-in-out infinite", animationDelay: "0.4s" }}
        />
      </span>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
