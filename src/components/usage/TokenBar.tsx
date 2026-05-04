import { useAuthStore } from "@/stores/auth";
import {
  getRemainingPrompts,
  isLimitReached,
  getUsagePercent,
  formatRenewalDate,
  getDaysUntilRenewal,
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
 * Barra de progreso de uso de tokens/prompts.
 *
 * Muestra:
 * - "127/200 tokens este mes"
 * - Barra de progreso visual
 * - Warning al 80%
 * - Límite alcanzado con mensaje de renovación
 *
 * Se integra con `useAuthStore` para obtener el uso actual.
 */
export function TokenBar({ className = "", compact = false }: TokenBarProps) {
  const plan = useAuthStore((s) => s.plan);
  const tokenUsage = useAuthStore((s) => s.tokenUsage);

  const remaining = getRemainingPrompts(tokenUsage);
  const percent = getUsagePercent(tokenUsage);
  const limitReached = isLimitReached(tokenUsage);
  const renewalDate = formatRenewalDate(tokenUsage.billingPeriodEnd);
  const daysUntilRenewal = getDaysUntilRenewal(tokenUsage.billingPeriodEnd);
  const isWarning = percent >= 80 && !limitReached;

  // Color de la barra según estado
  const barColor = limitReached
    ? "bg-red-500"
    : isWarning
      ? "bg-yellow-500"
      : "bg-[#4ec9b0]";

  // Texto de estado
  const statusText = limitReached
    ? `Sin tokens. Se renuevan en ${daysUntilRenewal} día${daysUntilRenewal !== 1 ? "s" : ""}`
    : isWarning
      ? `Te quedan ${remaining} tokens`
      : `${remaining} tokens disponibles`;

  if (compact) {
    return (
      <span className={`text-xs ${className}`}>
        {tokenUsage.promptsUsed}/{tokenUsage.promptsLimit}{" "}
        <span className="text-[#969696]">({PLAN_NAMES[plan]})</span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Texto de uso */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#d4d4d4]">
          {tokenUsage.promptsUsed}/{tokenUsage.promptsLimit} prompts este mes
        </span>
        <span
          className={
            limitReached
              ? "text-red-400"
              : isWarning
                ? "text-yellow-400"
                : "text-[#969696]"
          }
        >
          {statusText}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#333]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(100, percent)}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Fecha de renovación */}
      <span className="text-xs text-[#616161]">Se renuevan el {renewalDate}</span>
    </div>
  );
}
