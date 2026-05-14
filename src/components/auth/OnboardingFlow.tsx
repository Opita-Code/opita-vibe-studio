import vibeBannerUrl from "@/assets/vibe-banner.png";
import vibeLogoUrl from "@/assets/vibe-logo.svg";
export function OnboardingFlow({ onEnterGuest, onLogin }: { onEnterGuest: () => void, onLogin: () => void }) {

  return (
    <div className="flex h-full w-full flex-col text-white/90 bg-obsidian-900 relative overflow-y-auto overflow-x-hidden items-center justify-start pt-12 pb-24">
      {/* Background Orbs with Zen Flow animation */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-aura-purple/5 mix-blend-screen filter blur-[100px] animate-blob pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-aura-cyan/5 mix-blend-screen filter blur-[100px] animate-blob-reverse delay-2000 pointer-events-none"></div>

      <div className="z-10 w-full max-w-3xl flex flex-col items-center">
        
        {/* Banner Hero */}
        <div className="flex justify-center w-full mb-6 px-4 opacity-0 animate-fade-up shrink-0" style={{ animationDelay: '100ms' }}>
          <img 
            src={vibeBannerUrl} 
            alt="Vibe Studio" 
            className="w-full max-w-xl max-h-[35vh] object-cover rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] border border-white/5 pointer-events-none" 
          />
        </div>
        
        <h1 className="mt-4 text-4xl md:text-5xl font-extrabold mb-4 text-center tracking-tight text-white/90 opacity-0 animate-fade-up" style={{ animationDelay: '300ms' }}>
          Vibecodea en español.
        </h1>
        
        {/* Subtitle */}
        <p className="text-base md:text-lg text-white/50 mb-10 text-center max-w-xl px-4 font-light opacity-0 animate-fade-up" style={{ animationDelay: '500ms' }}>
          El primer IDE diseñado para que aprendas a programar con Inteligencia Artificial sin darte cuenta.
        </p>

        {/* Card */}
        <div className="flex justify-center w-full px-6 opacity-0 animate-fade-up shrink-0" style={{ animationDelay: '700ms' }}>
          <div className="bg-obsidian-800/60 backdrop-blur-3xl border border-white/5 p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.1)] flex flex-col relative overflow-hidden group max-w-md w-full items-center text-center hover:border-aura-purple/30 transition-all duration-500 hover:shadow-[0_0_50px_rgba(168,85,247,0.2)]">
            <div className="absolute inset-0 bg-gradient-to-br from-aura-purple/10 to-aura-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="relative mb-5 transform group-hover:scale-110 transition-transform duration-500">
              <div className="absolute inset-0 bg-aura-cyan/20 blur-xl rounded-full animate-pulse"></div>
              <img src={vibeLogoUrl} alt="Vibe Studio" className="relative h-12 w-12 drop-shadow-lg pointer-events-none" />
            </div>
            
            <h2 className="text-xl font-semibold text-white/90 mb-2 relative z-10">Entra al flujo</h2>
            <p className="text-sm font-light text-white/50 mb-8 relative z-10">
              Inicia gratis sin cuenta, o inicia sesión para sincronizar tus proyectos en la nube.
            </p>
            
            <div className="flex flex-col gap-3 w-full relative z-10">
              <button 
                onClick={onEnterGuest}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-aura-cyan to-aura-purple text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] rounded-xl font-semibold text-sm transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]"
              >
                Comenzar sin cuenta
              </button>
              <button 
                onClick={onLogin}
                className="w-full py-3 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-semibold text-sm transition-all duration-300 ease-out"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="mt-16 text-white/30 text-sm font-medium flex items-center gap-8 opacity-0 animate-fade-in" style={{ animationDelay: '1000ms' }}>
          <span className="flex items-center gap-2 transition-colors hover:text-white/60">
            <kbd className="bg-obsidian-800 px-2 py-1 rounded text-xs border border-white/5 shadow-inner font-mono">Ctrl</kbd> 
            + 
            <kbd className="bg-obsidian-800 px-2 py-1 rounded text-xs border border-white/5 shadow-inner font-mono">,</kbd> 
            Ajustes
          </span>
          <span className="flex items-center gap-2 transition-colors hover:text-white/60">
            <kbd className="bg-obsidian-800 px-2 py-1 rounded text-xs border border-white/5 shadow-inner font-mono">Ctrl</kbd> 
            + 
            <kbd className="bg-obsidian-800 px-2 py-1 rounded text-xs border border-white/5 shadow-inner font-mono">B</kbd> 
            Archivos
          </span>
        </div>
      </div>
    </div>
  );
}
