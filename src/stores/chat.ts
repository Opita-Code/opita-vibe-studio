import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import * as idb from "idb-keyval";
import type { Message } from "@/lib/types";

// ─── IndexedDB Storage Adapter ─────────────────────────────────
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await idb.get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idb.set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await idb.del(name);
  },
};

// ─── Constants ─────────────────────────────────────────────────
export const MAX_CONTEXT_MESSAGES = 50; // Increased since we persist

// ─── Types ─────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

// ─── State ─────────────────────────────────────────────────────

interface ChatState {
  sessions: Record<string, ChatSession>;
  activeSessionId: string;
  isStreaming: boolean;
  isExecutingMCP: boolean;
  activeProvider: string;
  activeModelId: string;
  pipelinePhase: "entender" | "construir" | "verificar" | null;
  useSubagent: boolean;
  subagentInstructions: string;
}

// Transient state (not persisted)
interface ChatTransientState {
  abortController: AbortController | null;
}

// ─── Actions ───────────────────────────────────────────────────

interface ChatActions {
  // Session management
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  
  // Message mutations
  addMessage: (message: Message) => void;
  appendToLastMessage: (content: string) => void;
  replaceLastMessageContent: (content: string) => void;
  editMessage: (messageId: string, newContent: string) => void;
  
  // Transient & Flags
  setStreaming: (streaming: boolean) => void;
  setExecutingMCP: (executing: boolean) => void;
  setAbortController: (ac: AbortController | null) => void;
  abortStreaming: () => void;
  setActiveProvider: (provider: string) => void;
  setActiveModelId: (modelId: string) => void;
  setPipelinePhase: (phase: "entender" | "construir" | "verificar" | null) => void;
  setUseSubagent: (use: boolean) => void;
  setSubagentInstructions: (instructions: string) => void;
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

export type ChatStore = ChatState & ChatTransientState & ChatActions;

const generateId = () => crypto.randomUUID();

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      // Persisted State
      sessions: {
        "default": {
          id: "default",
          title: "Nueva conversación",
          messages: [],
          updatedAt: Date.now()
        }
      },
      activeSessionId: "default",
      isStreaming: false,
      isExecutingMCP: false,
      activeProvider: "deepseek",
      activeModelId: "deepseek-chat",
      pipelinePhase: null,
      useSubagent: true,
      subagentInstructions: "",

      // Transient State
      abortController: null,

      // Actions
      createNewSession: () =>
        set((state) => {
          const id = generateId();
          return {
            sessions: {
              ...state.sessions,
              [id]: { id, title: "Nueva conversación", messages: [], updatedAt: Date.now() },
            },
            activeSessionId: id,
          };
        }),

      switchSession: (id) =>
        set((state) => {
          if (!state.sessions[id]) return state;
          return { activeSessionId: id };
        }),

      deleteSession: (id) =>
        set((state) => {
          const newSessions = { ...state.sessions };
          delete newSessions[id];
          
          let newActive = state.activeSessionId;
          if (newActive === id) {
            const remaining = Object.keys(newSessions);
            if (remaining.length > 0) {
              newActive = remaining[0];
            } else {
              // Create a fresh default if all deleted
              const freshId = generateId();
              newSessions[freshId] = { id: freshId, title: "Nueva conversación", messages: [], updatedAt: Date.now() };
              newActive = freshId;
            }
          }
          return { sessions: newSessions, activeSessionId: newActive };
        }),

      addMessage: (message) =>
        set((state) => {
          const session = state.sessions[state.activeSessionId];
          if (!session) return state;

          const updatedMessages = [...session.messages, message];
          // Update title if it's the first user message
          let newTitle = session.title;
          if (session.messages.length === 0 && message.role === "user") {
            newTitle = message.content.slice(0, 40) + (message.content.length > 40 ? "..." : "");
          }

          return {
            sessions: {
              ...state.sessions,
              [session.id]: {
                ...session,
                title: newTitle,
                messages: updatedMessages.length > MAX_CONTEXT_MESSAGES
                  ? updatedMessages.slice(-MAX_CONTEXT_MESSAGES)
                  : updatedMessages,
                updatedAt: Date.now()
              }
            }
          };
        }),

      appendToLastMessage: (content) =>
        set((state) => {
          const session = state.sessions[state.activeSessionId];
          if (!session || session.messages.length === 0) return state;
          
          const updatedMessages = [...session.messages];
          const last = { ...updatedMessages[updatedMessages.length - 1] };
          last.content += content;
          updatedMessages[updatedMessages.length - 1] = last;

          return {
            sessions: {
              ...state.sessions,
              [session.id]: { ...session, messages: updatedMessages, updatedAt: Date.now() }
            }
          };
        }),

      replaceLastMessageContent: (content) =>
        set((state) => {
          const session = state.sessions[state.activeSessionId];
          if (!session || session.messages.length === 0) return state;
          
          const updatedMessages = [...session.messages];
          const last = { ...updatedMessages[updatedMessages.length - 1] };
          last.content = content;
          updatedMessages[updatedMessages.length - 1] = last;

          return {
            sessions: {
              ...state.sessions,
              [session.id]: { ...session, messages: updatedMessages, updatedAt: Date.now() }
            }
          };
        }),

      editMessage: (messageId, newContent) =>
        set((state) => {
          const session = state.sessions[state.activeSessionId];
          if (!session) return state;
          
          const index = session.messages.findIndex(m => m.id === messageId);
          if (index === -1) return state;
          
          // Truncate messages after the edited one
          const updatedMessages = session.messages.slice(0, index + 1);
          const editedMessage = { ...updatedMessages[index], content: newContent };
          updatedMessages[index] = editedMessage;

          return {
            sessions: {
              ...state.sessions,
              [session.id]: { ...session, messages: updatedMessages, updatedAt: Date.now() }
            }
          };
        }),

      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setExecutingMCP: (executing) => set({ isExecutingMCP: executing }),
      setAbortController: (ac) => set({ abortController: ac }),
      
      abortStreaming: () =>
        set((state) => {
          if (state.abortController) {
            state.abortController.abort();
          }
          return { isStreaming: false, isExecutingMCP: false, abortController: null };
        }),
        
      setActiveProvider: (provider) => set({ activeProvider: provider }),
      setActiveModelId: (modelId) => set({ activeModelId: modelId }),
      setPipelinePhase: (phase) => set({ pipelinePhase: phase }),
      setUseSubagent: (use) => set({ useSubagent: use }),
      setSubagentInstructions: (instructions) => set({ subagentInstructions: instructions }),
      
      clearMessages: () =>
        set((state) => {
          const session = state.sessions[state.activeSessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [session.id]: { ...session, messages: [], updatedAt: Date.now() }
            }
          };
        }),
    }),
    {
      name: "vibe-studio-chat",
      storage: createJSONStorage(() => idbStorage),
      // Only persist these keys
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        activeModelId: state.activeModelId,
        useSubagent: state.useSubagent,
        subagentInstructions: state.subagentInstructions,
      }),
    }
  )
);
