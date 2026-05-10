import { useAuthStore } from "@/stores/auth";
import {
  PLAN_NAMES,
  PLAN_FEATURES,
  PLAN_LIMITS,
  getRemainingPrompts,
  formatRenewalDate,
} from "@/lib/tokens";

// ─── Props ──────────────────────────────────────────────────────

interface PlanCardProps {
  /** Clase CSS adicional */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Tarjeta de información del plan actual.
 *
 * Muestra:
 * - Nombre del plan
 * - Límite de prompts
 * - Lista de características
 * - Botón de upgrade
 * - Fecha de renovación
 *
 * Se integra con `useAuthStore` para datos del plan actual.
 */
export function PlanCard({ className = "" }: PlanCardProps) {
  const plan = useAuthStore((s) => s.plan);
  const tokenUsage = useAuthStore((s) => s.tokenUsage);

  const remaining = getRemainingPrompts(tokenUsage);
  const limit = PLAN_LIMITS[plan];
  const renewalDate = formatRenewalDate(tokenUsage.billingPeriodEnd);
  const features = PLAN_FEATURES[plan] ?? [];
  const isFree = plan === "free";

  return (
    <div className={`rounded-lg border border-[#333] bg-[#252526] p-4 ${className}`}>
      {/* Encabezado */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#d4d4d4]">{PLAN_NAMES[plan]}</h3>
          <p className="text-xs text-[#969696]">
            {remaining}/{limit} prompts restantes
          </p>
        </div>

        {/* Badge del plan */}
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
            isFree ? "bg-[#333] text-[#969696]" : "text-[var(--vibe-indigo)]"
          }`}
          style={
            isFree ? undefined : { backgroundColor: "var(--vibe-indigo)", opacity: 0.2 }
          }
        >
          {plan}
        </span>
      </div>

      {/* Límite de prompts */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[#969696]">Prompts este mes</span>
          <span className="text-[#d4d4d4]">
            {tokenUsage.promptsUsed}/{limit}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#333]">
          <div
            className="h-full rounded-full bg-[#4ec9b0] transition-all"
            style={{
              width: `${Math.min(100, (tokenUsage.promptsUsed / limit) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Características */}
      <div className="mb-4">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#616161]">
          Incluye
        </p>
        <ul className="flex flex-col gap-1">
          {features.slice(0, 4).map((feature, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-[#d4d4d4]">
              <span className="mt-0.5 text-[#4ec9b0]">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Botón de upgrade (solo plan free) */}
      {isFree && (
        <button
          onClick={() => {
            // En producción: abrir página de planes/pricing
            // Para MVP: mostrar un mensaje o redirigir
            alert(
              "Próximamente: planes Estudiante, Creador y Pro. " +
                "Mientras tanto, configura BYOK para más prompts.",
            );
          }}
          style={{ backgroundColor: "var(--vibe-indigo)" }}
          className="w-full rounded px-3 py-2 text-xs font-medium text-white hover:opacity-80 transition-opacity"
        >
          Actualizar plan
        </button>
      )}

      {/* Fecha de renovación */}
      <p className="mt-3 text-[10px] text-[#616161]">Se renueva el {renewalDate}</p>
    </div>
  );
}
