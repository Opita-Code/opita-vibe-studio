import { create } from "zustand";
import { useAuthStore } from "@/stores/auth";
import { isLimitReached, getUsagePercent } from "@/lib/tokens";

export type IntentType = "token_warning" | "token_limit" | "pro_model" | "large_file" | "storage_limit" | null;

interface PurchaseIntentState {
  forcedIntent: IntentType;
  setForcedIntent: (intent: IntentType) => void;
  wompiModalOpen: boolean;
  setWompiModalOpen: (open: boolean) => void;
}

export const usePurchaseIntentStore = create<PurchaseIntentState>((set) => ({
  forcedIntent: null,
  setForcedIntent: (intent) => set({ forcedIntent: intent }),
  wompiModalOpen: false,
  setWompiModalOpen: (open) => set({ wompiModalOpen: open }),
}));

export function usePurchaseIntent() {
  const tokenUsage = useAuthStore((s) => s.tokenUsage);
  const plan = useAuthStore((s) => s.plan);
  
  const forcedIntent = usePurchaseIntentStore((s) => s.forcedIntent);
  const setForcedIntent = usePurchaseIntentStore((s) => s.setForcedIntent);
  const wompiModalOpen = usePurchaseIntentStore((s) => s.wompiModalOpen);
  const setWompiModalOpen = usePurchaseIntentStore((s) => s.setWompiModalOpen);

  let activeIntent: IntentType = null;

  if (forcedIntent) {
    activeIntent = forcedIntent;
  } else if (plan === "free" || plan === "estudiante") {
    // Verificar uso de tokens para mostrar advertencias automáticas
    if (tokenUsage && isLimitReached(tokenUsage)) {
      activeIntent = "token_limit";
    } else if (tokenUsage && getUsagePercent(tokenUsage) >= 80) {
      activeIntent = "token_warning";
    }
  }

  const clearIntent = () => setForcedIntent(null);
  
  return {
    intent: activeIntent,
    plan,
    clearIntent,
    setIntent: setForcedIntent,
    isModalOpen: wompiModalOpen,
    openModal: () => setWompiModalOpen(true),
    closeModal: () => setWompiModalOpen(false)
  };
}

export function getNudgeForIntent(intent: IntentType, plan: string) {
  if (!intent) return null;
  
  const targetPlan = plan === "free" ? "Estudiante" : "Vibe Pro";
  
  switch (intent) {
    case "token_warning":
      return { message: `Te queda poco saldo para hoy. Sube a ${targetPlan} para no interrumpir tu flujo.`, type: "warning" as const };
    case "token_limit":
      return { message: `Has alcanzado tu límite de tokens. Actualiza a ${targetPlan} para continuar.`, type: "warning" as const };
    case "pro_model":
      return { message: "Este modelo avanzado requiere Vibe Pro.", type: "info" as const };
    case "large_file":
      return { message: "Subir archivos >5MB requiere Vibe Pro Storage.", type: "warning" as const };
    case "storage_limit":
      return { message: `El tamaño de tu proyecto excede tu límite. Actualiza a ${targetPlan} para más espacio.`, type: "warning" as const };
    default:
      return null;
  }
}
