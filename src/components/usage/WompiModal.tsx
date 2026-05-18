import { useEffect, useRef, useState } from "react";
import { usePurchaseIntent } from "@/hooks/usePurchaseIntent";
import { useAuthStore } from "@/stores/auth";
import { X, Loader2, Zap } from "lucide-react";
import { getPlan, getPlanName } from "@/lib/plan-registry";

export function WompiModal() {
  const { isModalOpen, closeModal, plan } = usePurchaseIntent();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptContainerRef = useRef<HTMLDivElement>(null);

  // El plan destino depende del plan actual (next tier up)
  const currentTier = getPlan(plan).tier;
  const targetPlan = currentTier === 0 ? "VIBE_STUDENT" : "VIBE_PRO";
  const targetPlanName = currentTier === 0 ? getPlanName("estudiante") : getPlanName("pro");
  const targetPlanFeatures = currentTier === 0 
    ? ["250K tokens diarios", "Orquestación SDD", "Sincronización Cloud", "Misiones XP x1.5"]
    : ["1M tokens diarios", "Subagentes Autónomos", "Edición In-Line", "Misiones XP x2"];

  useEffect(() => {
    if (!isModalOpen || !scriptContainerRef.current) return;

    let isMounted = true;
    const fetchSignature = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem("auth-token") || "";
        const backendHost = "https://api.opitacode.com/billing";
        
        const res = await fetch(`${backendHost}/checkout-sign?product=${targetPlan}&userId=${user?.email || "anon"}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error("Error obteniendo configuración de pago");
        
        const data = await res.json();
        if (!isMounted) return;

        // Limpiar contenedor previo
        if (scriptContainerRef.current) {
          scriptContainerRef.current.innerHTML = "";
        }

        // Inyectar el script de Wompi
        const script = document.createElement("script");
        script.src = "https://checkout.wompi.co/widget.js";
        script.setAttribute("data-render", "button");
        script.setAttribute("data-public-key", data.publicKey);
        script.setAttribute("data-currency", data.currency);
        script.setAttribute("data-amount-in-cents", data.amountInCents.toString());
        script.setAttribute("data-reference", data.reference);
        script.setAttribute("data-signature:integrity", data.signature);
        
        // Estilos custom (opcional para Wompi)
        script.setAttribute("data-redirect-url", window.location.href);

        scriptContainerRef.current?.appendChild(script);

      } catch (err: any) {
        if (isMounted) setError(err.message || "Error al inicializar Wompi");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSignature();

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, targetPlan, user?.email]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        
        {/* Decoración superior */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aura-cyan to-aura-purple" />
        
        <button 
          onClick={closeModal}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aura-cyan to-aura-purple flex items-center justify-center text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Mejorar a {targetPlanName}</h2>
              <p className="text-sm text-white/50">Desbloquea todo el poder de Vibe Studio</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Qué incluye</h3>
            <ul className="space-y-2">
              {targetPlanFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="text-aura-cyan mt-0.5">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-center min-h-[50px] justify-center">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando pasarela segura...
              </div>
            )}
            
            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-2 rounded-lg w-full text-center">
                {error}
              </div>
            )}

            {/* Contenedor donde se inyecta el botón de Wompi */}
            <div 
              ref={scriptContainerRef} 
              className={`w-full flex justify-center transition-opacity duration-300 ${loading ? "opacity-0 absolute" : "opacity-100 relative"}`} 
            />
          </div>

          <p className="text-center text-[10px] text-white/30 mt-4">
            Pagos procesados de forma segura por Wompi Bancolombia.
          </p>
        </div>
      </div>
    </div>
  );
}
