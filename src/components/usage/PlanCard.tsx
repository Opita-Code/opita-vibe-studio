import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useGamificationStore } from "@/stores/gamification";
import {
  PLAN_NAMES,
  PLAN_FEATURES,
  PLAN_LIMITS,
  getRemainingTokens,
  getUsagePercent,
  getHoursUntilDailyReset,
  formatTokenCount,
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
 * - Nombre del plan con badge
 * - Límite de tokens diarios (base + earned)
 * - Lista de características
 * - Botón de upgrade (plan free/estudiante)
 * - Gamification stats si tiene perfil
 *
 * Se integra con `useAuthStore` y `useGamificationStore`.
 */
export function PlanCard({ className = "" }: PlanCardProps) {
  const plan = useAuthStore((s) => s.plan);
  const tokenUsage = useAuthStore((s) => s.tokenUsage);
  const profile = useGamificationStore((s) => s.profile);

  const remaining = getRemainingTokens(tokenUsage);
  const percent = getUsagePercent(tokenUsage);
  const limit = PLAN_LIMITS[plan];
  const hoursUntilReset = getHoursUntilDailyReset(tokenUsage.resetDailyAt);
  const features = PLAN_FEATURES[plan] ?? [];
  const isFree = plan === "free";
  const canUpgrade = plan !== "pro";

  // Earned quota from gamification
  const earnedQuota = profile?.earnedQuota ?? 0;
  const effectiveDaily = tokenUsage.tokensLimitDaily || limit.daily;

  return (
    <div className={`rounded-xl border border-white/5 bg-obsidian-800/60 backdrop-blur-xl p-4 ${className}`}>
      {/* Encabezado */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{PLAN_NAMES[plan]}</h3>
          <p className="text-xs text-white/40">
            {formatTokenCount(remaining)} de {formatTokenCount(effectiveDaily)} tokens disponibles
          </p>
        </div>

        {/* Badge del plan */}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isFree
              ? "bg-white/5 text-white/40"
              : "bg-gradient-to-r from-aura-cyan/20 to-aura-purple/20 text-aura-cyan border border-aura-cyan/20"
          }`}
        >
          {plan === "pro" ? "PRO" : plan === "estudiante" ? "EST" : "FREE"}
        </span>
      </div>

      {/* Barra de tokens */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-white/40">Tokens hoy</span>
          <span className="text-white/70 tabular-nums">
            {formatTokenCount(tokenUsage.tokensUsedToday)}/{formatTokenCount(effectiveDaily)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-aura-cyan to-aura-purple transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        {/* Earned quota indicator */}
        {earnedQuota > 0 && (
          <p className="mt-1 text-[10px] text-aura-cyan/60">
            +{formatTokenCount(earnedQuota)} ganados con misiones
          </p>
        )}
      </div>

      {/* Características */}
      <div className="mb-4">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/25">
          Incluye
        </p>
        <ul className="flex flex-col gap-1">
          {features.slice(0, 4).map((feature, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-white/70">
              <span className="mt-0.5 text-aura-cyan">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Botón de upgrade */}
      {canUpgrade && (
        <button
          onClick={() => {
            // TODO: Cycle backlog/in-app-payments will replace this with Wompi widget
            useUIStore.setState({ statusMessage: "Próximamente: upgrade in-app. Mientras tanto, visita vibe.opitacode.com" });
          }}
          className="w-full rounded-xl px-3 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-aura-cyan/80 to-aura-purple/80 hover:from-aura-cyan hover:to-aura-purple transition-all duration-300 active:scale-[0.98] shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]"
        >
          {isFree ? "Subir a Estudiante" : "Subir a Pro"}
        </button>
      )}

      {/* Tiempo de renovación */}
      <p className="mt-3 text-[10px] text-white/25">Se renueva en {hoursUntilReset}h</p>
    </div>
  );
}
