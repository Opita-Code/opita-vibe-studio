import { useAuthStore } from "@/stores/auth";
import {
  getRemainingTokens,
  isLimitReached,
  isHourlyLimitReached,
  getUsagePercent,
  getMinutesUntilHourlyReset,
  getHoursUntilDailyReset,
  formatTokenCount,
  PLAN_NAMES,
} from "@/lib/tokens";

// ─── Props ──────────────────────────────────────────────────────

interface TokenBarProps {
  /** Clase CSS adicional */
  className?: string;
  /** Si se muestra compacto (para StatusBar) */
  compact?: boolean;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Barra de progreso de uso de tokens.
 *
 * Muestra:
 * - "45.2K/250K tokens hoy"
 * - Barra de progreso visual con gradiente Aura
 * - Warning al 80%
 * - Límite alcanzado con mensaje de cooldown
 *
 * Se integra con `useAuthStore` para obtener el uso actual.
 */
export function TokenBar({ className = "", compact = false }: TokenBarProps) {
  const plan = useAuthStore((s) => s.plan);
  const tokenUsage = useAuthStore((s) => s.tokenUsage);

  const remaining = getRemainingTokens(tokenUsage);
  const percent = getUsagePercent(tokenUsage);
  const limitReached = isLimitReached(tokenUsage);
  const hourlyLimitReached = isHourlyLimitReached(tokenUsage);
  const isWarning = percent >= 80 && !limitReached;

  // Color de la barra según estado
  const barColor = limitReached || hourlyLimitReached
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-400"
      : "bg-gradient-to-r from-aura-cyan to-aura-purple";

  // Texto de estado
  let statusText: string;
  if (limitReached) {
    const hours = getHoursUntilDailyReset(tokenUsage.resetDailyAt);
    statusText = `Sin tokens. Se renuevan en ${hours}h`;
  } else if (hourlyLimitReached) {
    const minutes = getMinutesUntilHourlyReset(tokenUsage.resetHourlyAt);
    statusText = `Límite horario. Se renueva en ${minutes}min`;
  } else if (isWarning) {
    statusText = `${formatTokenCount(remaining)} tokens restantes`;
  } else {
    statusText = `${formatTokenCount(remaining)} tokens disponibles`;
  }

  if (compact) {
    return (
      <span className={`text-xs ${className}`}>
        {formatTokenCount(tokenUsage.tokensUsedToday)}/{formatTokenCount(tokenUsage.tokensLimitDaily)}{" "}
        <span className="text-white/40">({PLAN_NAMES[plan]})</span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Texto de uso */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/80">
          {formatTokenCount(tokenUsage.tokensUsedToday)}/{formatTokenCount(tokenUsage.tokensLimitDaily)} tokens hoy
        </span>
        <span
          className={
            limitReached || hourlyLimitReached
              ? "text-red-400"
              : isWarning
                ? "text-amber-400"
                : "text-white/40"
          }
        >
          {statusText}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${Math.min(100, percent)}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uso de tokens: ${percent}%`}
        />
      </div>

      {/* Info de renovación */}
      <div className="flex items-center justify-between text-[10px] text-white/25">
        <span>Diario se renueva en {getHoursUntilDailyReset(tokenUsage.resetDailyAt)}h</span>
        <span>Hora se renueva en {getMinutesUntilHourlyReset(tokenUsage.resetHourlyAt)}min</span>
      </div>
    </div>
  );
}
