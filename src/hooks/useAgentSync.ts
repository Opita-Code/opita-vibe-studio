/**
 * useAgentSync — Bridges agentStore → chatStore.
 *
 * Subscribes to the agentBus and propagates execution state
 * changes into the active assistant message's `agentExecution` field.
 *
 * This is THE bridge between the two stores, maintaining separation
 * of concerns (agentStore = ephemeral execution, chatStore = persisted messages).
 *
 * Usage: Call once in ChatPanel. It auto-cleans on unmount.
 */

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import { agentBus, type AgentBusEvent } from "@/stores/agent";
import type {
  AgentExecutionGoal,
  AgentExecutionStep,
  AgentFileChange,
} from "@/lib/types";

/**
 * Synchronizes agent execution events to the last assistant message.
 *
 * @param activeMessageId - The ID of the assistant message currently being streamed.
 *   When null/undefined, sync is paused (no active execution).
 */
export function useAgentSync(activeMessageId: string | null | undefined) {
  const msgIdRef = useRef(activeMessageId);
  msgIdRef.current = activeMessageId;

  useEffect(() => {
    const unsub = agentBus.subscribe((event: AgentBusEvent) => {
      const msgId = msgIdRef.current;
      if (!msgId) return;

      const store = useChatStore.getState();

      switch (event.type) {
        case "phase":
          store.updateMessageExecution(msgId, { phase: event.phase });
          break;

        case "progress":
          store.updateMessageExecution(msgId, {
            progress: Math.max(0, Math.min(100, event.percent)),
          });
          break;

        case "roadmap": {
          const goals: AgentExecutionGoal[] = event.goals.map((g) => ({
            id: g.id,
            label: g.label,
            status: g.status,
            progress: g.progress,
          }));
          store.updateMessageExecution(msgId, { roadmap: goals });
          break;
        }

        case "step": {
          // Get current execution, append step
          const session = store.sessions[store.activeSessionId];
          const msg = session?.messages.find((m) => m.id === msgId);
          const currentSteps = msg?.agentExecution?.steps ?? [];

          const newStep: AgentExecutionStep = {
            id: event.step.id,
            icon: event.step.icon,
            label: event.step.label,
            detail: event.step.detail,
            status: event.step.status,
            timestamp: event.step.timestamp,
          };

          // Update existing step or append new one
          const existingIdx = currentSteps.findIndex(
            (s) => s.id === newStep.id
          );
          const updatedSteps =
            existingIdx >= 0
              ? currentSteps.map((s, i) => (i === existingIdx ? newStep : s))
              : [...currentSteps, newStep];

          store.updateMessageExecution(msgId, { steps: updatedSteps });
          break;
        }

        case "file-changed": {
          const session2 = store.sessions[store.activeSessionId];
          const msg2 = session2?.messages.find((m) => m.id === msgId);
          const currentFiles = msg2?.agentExecution?.filesChanged ?? [];

          const fileChange: AgentFileChange = {
            path: event.path,
            action: event.action,
          };

          // Deduplicate by path
          const existingFileIdx = currentFiles.findIndex(
            (f) => f.path === event.path
          );
          const updatedFiles =
            existingFileIdx >= 0
              ? currentFiles.map((f, i) =>
                  i === existingFileIdx ? fileChange : f
                )
              : [...currentFiles, fileChange];

          store.updateMessageExecution(msgId, { filesChanged: updatedFiles });
          break;
        }

        case "done":
          store.setMessageStatus(msgId, "done");
          break;

        case "error":
          store.updateMessageExecution(msgId, { error: event.message });
          store.setMessageStatus(msgId, "error");
          break;

        case "awaiting-confirmation":
          store.updateMessageExecution(msgId, {
            confirmation: {
              completedPhase: event.completedPhase,
              nextPhase: event.nextPhase,
              summary: event.summary,
            },
          });
          store.setMessageStatus(msgId, "awaiting-confirmation");
          break;
      }
    });

    return unsub;
  }, []); // Stable — msgIdRef handles the dynamic ID
}
