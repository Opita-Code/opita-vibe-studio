/**
 * DonutProgress — Minimal SVG donut chart for agent progress.
 *
 * Renders a circular progress indicator with percentage text.
 * Uses Aura theme colors with smooth spring animations.
 */
import { motion } from "framer-motion";

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
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{
        filter: percent < 100 ? "drop-shadow(0 0 6px rgba(34,211,238,0.3))" : "none"
      }}
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
      <motion.circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        className="text-cyan-400"
        stroke="currentColor"
        transform={`rotate(-90 ${center} ${center})`}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ type: "spring", stiffness: 100, damping: 20, mass: 1 }}
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
    </motion.svg>
  );
}
