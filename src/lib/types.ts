// ─── File System ───────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  extension?: string;
  size?: number;
  modifiedAt?: string;
}

// ─── Chat ──────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  name: string;
  contentType: string; // "image/png", "text/plain", etc.
  data: string; // Base64 for images, raw text for text files
  size?: number;
}

export interface SubagentStep {
  id: string;
  tool: string;
  target: string;
  phrase: string;
  timestamp: number;
}

// ─── Agent Execution (embedded in Message) ─────────────────────

export type AgentExecutionStatus =
  | "running"
  | "done"
  | "error"
  | "awaiting-confirmation";

export interface AgentExecutionGoal {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  progress?: number;
  /** Texto opcional para mostrar en el estado done (colapsable) */
  detail?: string;
}

export interface AgentExecutionStep {
  id: string;
  icon: string;
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
  timestamp: number;
}

export interface AgentFileChange {
  path: string;
  action: "created" | "modified" | "deleted";
  linesChanged?: number;
}

/**
 * Embeds agent execution state inside a message.
 * Each assistant message with active agent work becomes a mini-dashboard.
 */
export interface AgentExecution {
  /** Current agent phase (user-facing label) */
  phase: string;
  /** Overall progress 0-100 */
  progress: number;
  /** Inline roadmap goals */
  roadmap: AgentExecutionGoal[];
  /** Tool execution steps */
  steps: AgentExecutionStep[];
  /** Files modified during this execution */
  filesChanged: AgentFileChange[];
  /** Execution lifecycle status */
  status: AgentExecutionStatus;
  /** When execution started */
  startedAt: number;
  /** When execution completed (if done) */
  completedAt?: number;
  /** Error message (if status === "error") */
  error?: string;
  /** Confirmation context (if status === "awaiting-confirmation") */
  confirmation?: {
    /** What completed */
    completedPhase: string;
    /** What comes next */
    nextPhase: string;
    /** User-facing summary */
    summary: string;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** If the message contains file operations, list paths here */
  filePaths?: string[];
  attachments?: Attachment[];
  subagentSteps?: SubagentStep[];
  /** Accumulated reasoning/thinking tokens from the model */
  reasoning?: string;
  /** Embedded agent execution state — makes this bubble a mini-dashboard */
  agentExecution?: AgentExecution;
  /**
   * Delivery status for user messages.
   * "pending" = agent has not started reading the message yet (Cancel/Edit available).
   * "sent"    = agent started processing — no more cancellation from the message itself.
   * undefined = historical messages without tracked status.
   */
  deliveryStatus?: "pending" | "sent";
}

export interface ChatChunk {
  type: "text" | "code" | "reasoning" | "file_create" | "file_update" | "done" | "error" | "mcp_tool_request";
  content: string;
  language?: string;
  filePath?: string;
  tool?: string;
  args?: any;
  errorType?: "network" | "rate-limit" | "abort" | "server";
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  pipelinePhase?: "entender" | "construir" | "verificar";
  action?: string;
  subagentId?: string;
  customInstructions?: string;
  signal?: AbortSignal;
}

// ─── AI Providers ──────────────────────────────────────────────

export type ProviderTier = "free" | "byok" | "opita";

export interface AIProvider {
  id: string;
  name: string;
  tier: ProviderTier;
  chat(messages: Message[], options: ChatOptions): AsyncGenerator<ChatChunk>;
  countTokens(messages: Message[]): number;
  validateKey?(key: string): Promise<boolean>;
}

export interface ProviderConfig {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  model: string;
}

// ─── Token Usage & Plans ───────────────────────────────────────

export interface TokenUsage {
  tokensUsedToday: number;
  tokensLimitDaily: number;
  tokensUsedThisHour: number;
  tokensLimitHourly: number;
  plan: UserPlan;
  resetDailyAt: string;
  resetHourlyAt: string;
}

export type UserPlan = "free" | "estudiante" | "pro";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: UserPlan;
  verified: boolean;
}

export interface Session {
  token: string;
  expiresAt: number;
  refreshToken?: string;
}

// ─── Learning ──────────────────────────────────────────────────

export interface LearningTip {
  id: string;
  concept: string;
  question: string;
  explanation: string;
  tags: string[];
  triggerEvent?: string;
}

export interface LearningEvent {
  type: string;
  concept: string;
  timestamp: number;
}

// ─── Config ────────────────────────────────────────────────────

export interface AppConfig {
  theme: "dark" | "light";
  fontSize: number;
  autoSave: boolean;
  activeProviderId: string;
  providers: ProviderConfig[];
}

// ─── Gamification ──────────────────────────────────────────────

export interface GamificationProfile {
  totalXp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string;
  earnedQuota: number;
  /** Effective daily quota = base plan quota + earned quota (after decay) */
  effectiveDailyQuota: number;
}

export interface MissionCompletionCriteria {
  /** Which event type triggers progress */
  eventType: import("./vibe-events").VibeEventType;
  /** How many events needed to complete */
  count: number;
  /** Optional: must complete within this time window (ms) */
  within?: number;
  /** Optional: filter by event properties */
  filter?: Record<string, string>;
}

export interface Mission {
  id: string;
  type: "aprender" | "construir" | "explorar";
  period?: "daily" | "weekly";
  title: string;
  description: string;
  xpReward: number;
  quotaReward: number;
  difficulty: "novato" | "intermedio" | "avanzado";
  completed: boolean;
  completedAt?: string;
  /** Auto-validation criteria — if present, mission completes automatically */
  completionCriteria?: MissionCompletionCriteria;
  /** Real-time progress (0-100) — updated by MissionTracker */
  progress?: number;
}

export interface MilestoneProgress {
  level: number;
  badge: string;
  label: string;
  unlocked: boolean;
  unlockedAt?: string;
  reward: { type: "quota_boost" | "badge"; value: number };
}

