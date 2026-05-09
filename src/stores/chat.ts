import { create } from "zustand";
import type { Message } from "@/lib/types";

// ─── Constants ─────────────────────────────────────────────────
export const MAX_CONTEXT_MESSAGES = 20;

// ─── State ─────────────────────────────────────────────────────

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  activeProvider: string;
  pipelinePhase: "entender" | "construir" | "verificar" | null;
}

// ─── Actions ───────────────────────────────────────────────────

interface ChatActions {
  addMessage: (message: Message) => void;
  appendToLastMessage: (content: string) => void;
  replaceLastMessageContent: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setActiveProvider: (provider: string) => void;
  setPipelinePhase: (phase: "entender" | "construir" | "verificar" | null) => void;
  clearMessages: () => void;
}

// ─── Selectors ─────────────────────────────────────────────────

export function getContextMessages(messages: Message[]): Message[] {
  return messages.slice(-MAX_CONTEXT_MESSAGES);
}

export function getContextCount(messages: Message[]): number {
  return Math.min(messages.length, MAX_CONTEXT_MESSAGES);
}

// ─── Store ─────────────────────────────────────────────────────

export type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,
  activeProvider: "deepseek",
  pipelinePhase: null,

  addMessage: (message) =>
    set((state) => {
      const updated = [...state.messages, message];
      // Mantener solo los últimos MAX_CONTEXT_MESSAGES
      return {
        messages: updated.length > MAX_CONTEXT_MESSAGES
          ? updated.slice(-MAX_CONTEXT_MESSAGES)
          : updated,
      };
    }),

  appendToLastMessage: (content) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const updated = [...state.messages];
      const last = { ...updated[updated.length - 1] };
      last.content += content;
      updated[updated.length - 1] = last;
      return { messages: updated };
    }),

  replaceLastMessageContent: (content) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const updated = [...state.messages];
      const last = { ...updated[updated.length - 1] };
      last.content = content;
      updated[updated.length - 1] = last;
      return { messages: updated };
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setActiveProvider: (provider) => set({ activeProvider: provider }),

  setPipelinePhase: (phase) => set({ pipelinePhase: phase }),

  clearMessages: () => set({ messages: [] }),
}));
