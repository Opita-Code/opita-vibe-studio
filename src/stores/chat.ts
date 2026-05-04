import { create } from "zustand";
import type { Message } from "@/lib/types";

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
  setStreaming: (streaming: boolean) => void;
  setActiveProvider: (provider: string) => void;
  setPipelinePhase: (phase: "entender" | "construir" | "verificar" | null) => void;
  clearMessages: () => void;
}

// ─── Store ─────────────────────────────────────────────────────

export type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,
  activeProvider: "deepseek",
  pipelinePhase: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  appendToLastMessage: (content) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const updated = [...state.messages];
      const last = { ...updated[updated.length - 1] };
      last.content += content;
      updated[updated.length - 1] = last;
      return { messages: updated };
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setActiveProvider: (provider) => set({ activeProvider: provider }),

  setPipelinePhase: (phase) => set({ pipelinePhase: phase }),

  clearMessages: () => set({ messages: [] }),
}));
