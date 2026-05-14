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

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** If the message contains file operations, list paths here */
  filePaths?: string[];
  attachments?: Attachment[];
}

export interface ChatChunk {
  type: "text" | "code" | "file_create" | "file_update" | "done" | "error" | "mcp_tool_request";
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
  promptsUsed: number;
  promptsLimit: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
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
