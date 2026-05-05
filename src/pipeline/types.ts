// ─── Pipeline Phase Enum ─────────────────────────────────────────

export const PIPELINE_PHASES = ["entender", "construir", "verificar"] as const;

export type PipelinePhase = (typeof PIPELINE_PHASES)[number];

// ─── Phase Message (typed, consumed by stores, hidden from UI) ──

export interface PhaseMessage {
  phase: PipelinePhase;
  status: "in_progress" | "done" | "error";
  data: Record<string, unknown>;
}

// ─── Entender Phase Output ──────────────────────────────────────

export interface EntenderOutput {
  /** Descripción del plan en lenguaje natural */
  plan: string;
  /** Lista de archivos que se crearán o modificarán */
  files: string[];
  /** Problemas potenciales identificados */
  issues: string[];
}

// ─── Construir Phase Output ─────────────────────────────────────

export interface FileOutput {
  /** Ruta del archivo relativa al proyecto */
  path: string;
  /** Contenido del archivo */
  content: string;
}

export interface ConstruirOutput {
  /** Archivos generados */
  files: FileOutput[];
  /** Resumen de lo que se generó */
  summary: string;
  /** Texto completo del asistente (para mostrar en el chat) */
  fullResponse: string;
}

// ─── Verificar Phase Output ─────────────────────────────────────

export interface VerificarOutput {
  /** "ok" si pasa la verificación, "reintentar" si necesita corrección */
  status: "ok" | "reintentar";
  /** Razón del reintento (si aplica) */
  reason?: string;
  /** Detalles adicionales de la verificación */
  details?: string;
}

// ─── Pipeline Events (consumidos por ChatPanel) ─────────────────

export type PipelineEvent =
  | { type: "phase_change"; phase: PipelinePhase }
  | { type: "file_created"; path: string }
  | { type: "result"; content: string; files: FileOutput[] }
  | { type: "error"; message: string }
  | { type: "retry"; attempt: number; reason: string };
