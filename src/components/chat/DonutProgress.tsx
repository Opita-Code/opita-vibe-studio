/**
 * DonutProgress — Minimal SVG donut chart for agent progress.
 *
 * Renders a circular progress indicator with percentage text.
 * Uses Aura theme colors with smooth CSS transitions.
 */

interface DonutProgressProps {
  /** Progress percentage (0-100) */
  percent: number;
  /** Radius in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to show the center percentage text */
  showText?: boolean;
}

export function DonutProgress({
  percent,
  size = 28,
  strokeWidth = 3,
  showText = true,
}: DonutProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/10"
      />

      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-cyan-400 transition-all duration-500 ease-out"
        stroke="currentColor"
        transform={`rotate(-90 ${center} ${center})`}
      />

      {/* Center text */}
      {showText && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white/60 text-[8px] font-mono font-medium"
        >
          {Math.round(percent)}
        </text>
      )}
    </svg>
  );
}
