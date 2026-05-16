/**
 * useAgentHandler — Bridge between the Orchestrator and the UI.
 *
 * This hook replaces the 345-line `sendMessage()` function in ChatPanel.
 * It calls `orchestrator.handleMessage()`, iterates the AgentEvent stream,
 * and maps each event to the appropriate store mutation.
 *
 * The ChatPanel becomes a thin shell: it calls `send(text)` and
 * the hook handles everything else.
 */

import { useCallback, useRef } from "react";
import { useChatStore, getContextMessages } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { isLimitReached } from "@/lib/tokens";
import { handleMessage, classifyIntent, type OrchestratorConfig } from "@/agent/orchestrator";
import { detectIdea, createIdea, saveIdea, matchCompletedWork, updateIdeaStatus } from "@/agent/idea-backlog";
import type { Attachment } from "@/lib/types";
import type { AgentEvent, AgentStep, RoadmapGoal, FileSummary } from "@/agent/types";
import { useGamificationStore } from "@/stores/gamification";
import { useAgentStore } from "@/stores/agent";
import { vibeEvents } from "@/lib/vibe-events";

// ─── Types ─────────────────────────────────────────────────────

export interface AgentHandlerState {
  /** Currently active roadmap goals */
  roadmap: RoadmapGoal[];
  /** Accumulated tool execution steps */
  steps: AgentStep[];
  /** Current phase label */
  phaseLabel: string | null;
  /** Progress percentage (0-100) */
  progress: number;
}

// ─── Hook ──────────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

/**
 * Hook that handles sending messages through the agent orchestrator.
 *
 * Returns a `send` function that the ChatPanel calls.
 * All state updates are done through Zustand stores.
 */
export function useAgentHandler() {
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string, attachments?: Attachment[], isRetry = false) => {
      const chatStore = useChatStore.getState();
      const authStore = useAuthStore.getState();
      const projectStore = useProjectStore.getState();

      // ─── Guard: Token Limit ───────────────────────────────
      if (!isRetry && isLimitReached(authStore.tokenUsage)) {
        chatStore.addMessage({
          id: generateId(),
          role: "assistant",
          content:
            "⚠️ Llegaste al límite de tokens de tu plan.\n\n" +
            "Puedes:\n" +
            "1. **Actualizar plan** → más tokens diarios\n" +
            "2. **Configurar BYOK** → tus tokens no cuentan en el límite\n\n" +
            "Los tokens se renuevan cada día.",
          timestamp: Date.now(),
        });
        return;
      }

      // ─── Guard: Auth ──────────────────────────────────────
      if (authStore.authMode === "unauthenticated") {
        window.location.href = `https://cuenta.opitacode.com/login?return_to=${encodeURIComponent(window.location.href)}`;
        return;
      }

      // ─── Add User Message ─────────────────────────────────
      if (!isRetry) {
        chatStore.addMessage({
          id: generateId(),
          role: "user",
          content: text,
          timestamp: Date.now(),
          attachments,
        });

        // ─── Idea Detection (silent capture) ─────────────────
        // If the user casually mentions an idea, save it without
        // interrupting the conversation flow.
        if (detectIdea(text)) {
          const idea = createIdea(
            text,
            useChatStore.getState().activeSessionId
          );
          saveIdea(idea).catch(() => {
            // Non-critical — don't break the flow
          });
        }
      }

      // ─── Create Assistant Message Placeholder ─────────────
      const assistantMsgId = generateId();
      chatStore.addMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });

      // ─── Prepare ──────────────────────────────────────────
      chatStore.setStreaming(true);
      const ac = new AbortController();
      abortRef.current = ac;
      chatStore.setAbortController(ac);

      let accumulatedContent = "";

      try {
        // Get conversation context
        const state = useChatStore.getState();
        const session = state.sessions[state.activeSessionId];
        const messages = session?.messages || [];
        const context = getContextMessages(messages);

        const hasProjectOpen = projectStore.workspaces.length > 0;

        // ─── Pre-classify intent for UI decisions ─────────────
        // Only activate the heavy execution UI (activity bar, roadmap,
        // progress) for explore/code intents. Chat is lightweight.
        const preIntent = classifyIntent(text, hasProjectOpen);
        if (preIntent !== "chat") {
          useAgentStore.getState().startExecution();
        }

        // ─── Build Orchestrator Config ────────────────────────
        const plan = (authStore.plan || "free") as "free" | "estudiante" | "pro";

        const config: OrchestratorConfig = {
          providerId: chatStore.activeProvider,
          modelId: chatStore.activeModelId,
          plan,
          executionMode: chatStore.executionMode === "automatic" ? "auto" : "interactive",
          signal: ac.signal,
          customInstructions: chatStore.subagentInstructions || undefined,
          hasProjectOpen,
          testRunner: null, // TODO: from context-loader
          hasGit: false, // TODO: detect git
        };

        // ─── Iterate Agent Events ─────────────────────────────
        let completedFiles: FileSummary[] = [];

        for await (const event of handleMessage(text, context, config)) {
          if (ac.signal.aborted) break;
          processEvent(event, assistantMsgId, accumulatedContent, (c) => {
            accumulatedContent = c;
          });

          // Track completed files for idea matching
          if (event.type === "done" && event.summary.length > 0) {
            completedFiles = event.summary;
          }
        }

        // ─── Idea Backlog Matching ────────────────────────────
        // After completing work, check if any backlog ideas match
        if (completedFiles.length > 0) {
          matchCompletedWork(
            text,
            completedFiles.map((f) => f.path)
          ).then((matches) => {
            for (const match of matches) {
              updateIdeaStatus(
                match.id,
                "implementada",
                `Implementada automáticamente durante la sesión`,
                text.slice(0, 100)
              ).catch(() => {});
            }
          }).catch(() => {});
        }

        // ─── Post-send ────────────────────────────────────────
        if (!isRetry) {
          authStore.fetchTokenUsage();
          // Award passive XP for chat interaction (debounced 30s)
          useGamificationStore.getState().awardPassiveXP("chat_message");
          // Emit event for mission tracking
          vibeEvents.emit({
            type: "chat_sent",
            model: chatStore.activeModelId || "unknown",
            tokensUsed: 0, // actual count not available here
          });
          // Track agent usage mode
          if (preIntent !== "chat") {
            vibeEvents.emit({
              type: "agent_used",
              mode: config.executionMode === "auto" ? "autonomous" : "interactive",
            });
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorMsg =
            err instanceof Error ? err.message : "Error de conexión";
          useChatStore
            .getState()
            .appendToLastMessage(
              `\n\n⚠️ ${errorMsg}\n<!--RETRY_NETWORK-->`
            );
        }
      } finally {
        useChatStore.getState().setStreaming(false);
        useChatStore.getState().setAbortController(null);
        useChatStore.getState().setPipelinePhase(null);
        useChatStore.getState().setExecutingMCP(false);
        useAgentStore.getState().endExecution();
        abortRef.current = null;
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    useChatStore.getState().setStreaming(false);
    useChatStore.getState().setPipelinePhase(null);
    useChatStore.getState().setExecutingMCP(false);
    useAgentStore.getState().endExecution();
  }, []);

  return { send, abort };
}

// ─── Event Processor ───────────────────────────────────────────

/**
 * Maps an AgentEvent to the appropriate store mutation.
 * This is the core translation layer between the agent system and the UI.
 */
function processEvent(
  event: AgentEvent,
  _assistantMsgId: string,
  accumulatedContent: string,
  setAccumulated: (content: string) => void
): void {
  const chatStore = useChatStore.getState();
  const agentStore = useAgentStore.getState();

  switch (event.type) {
    case "text":
      accumulatedContent += event.content;
      setAccumulated(accumulatedContent);
      chatStore.replaceLastMessageContent(accumulatedContent);
      break;

    case "thinking":
      // Internal thinking — update agent phase
      agentStore.setPhase("thinking");
      break;

    case "thinking_visible":
      // Reasoning tokens — accumulate separately from content for proper UI rendering
      chatStore.appendReasoningToLastMessage(event.content);
      break;

    case "step":
      agentStore.addStep(event.step);
      if (event.step.status === "running") {
        chatStore.setExecutingMCP(true);
      } else {
        agentStore.updateStepStatus(event.step.id, event.step.status);
        chatStore.setExecutingMCP(false);
      }
      break;

    case "file_changed": {
      agentStore.addFileChange({ path: event.path, action: event.action });
      const fileName = event.path.split(/[/\\]/).pop() ?? event.path;
      const ext = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
      const actionEmoji =
        event.action === "created"
          ? "\u2705"
          : event.action === "modified"
            ? "\uD83D\uDD27"
            : "\uD83D\uDDD1\uFE0F";
      accumulatedContent += `\n\n${actionEmoji} ${event.action === "created" ? "Creado" : event.action === "modified" ? "Modificado" : "Eliminado"}: \`${fileName}\``;
      setAccumulated(accumulatedContent);
      chatStore.replaceLastMessageContent(accumulatedContent);
      // Emit event for mission tracking
      if (event.action === "created") {
        vibeEvents.emit({ type: "file_created", filename: fileName, language: ext });
      } else if (event.action === "modified") {
        vibeEvents.emit({ type: "file_edited", filename: fileName, linesChanged: 0 });
      }
      break;
    }

    case "phase":
      agentStore.setPhase(event.phase);
      chatStore.setPipelinePhase(
        event.phase === "building"
          ? "construir"
          : event.phase === "verifying"
            ? "verificar"
            : event.phase === "thinking"
              ? "entender"
              : null
      );
      break;

    case "roadmap":
      agentStore.setRoadmap(event.goals);
      break;

    case "roadmap_update":
      agentStore.updateGoal(event.goalId, event.status, event.progress);
      break;

    case "progress":
      agentStore.setProgress(event.percent);
      break;

    case "error":
      accumulatedContent += `\n\n\u26A0\uFE0F ${event.message}`;
      setAccumulated(accumulatedContent);
      chatStore.replaceLastMessageContent(accumulatedContent);
      break;

    case "done":
      agentStore.endExecution();
      chatStore.setPipelinePhase(null);
      chatStore.setExecutingMCP(false);
      if (event.summary.length > 0) {
        const fileList = event.summary
          .map((f) => `- \`${f.path}\` (${f.action})`)
          .join("\n");
        accumulatedContent += `\n\n---\n**Archivos modificados:**\n${fileList}`;
        setAccumulated(accumulatedContent);
        chatStore.replaceLastMessageContent(accumulatedContent);
      }
      break;
  }
}
