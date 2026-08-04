/**
 * @opita/dark-memory-bridge
 *
 * Bridge TypeScript que expone dark-memory (MCP v2.9.3-alpha) como
 * backend de memoria/RAG para el harness Aura de Vibe Studio.
 *
 * Reemplaza los stubs `memory_search` / `memory_save` con una API
 * real: recall BM25, save con kind canónico, session lifecycle,
 * y entity extraction.
 */

export { DarkMemoryBridge } from "./client";
export {
  createTransport,
  HttpTransport,
  MemoryTransport,
  TauriTransport,
  isTauriAvailable,
} from "./transport";
export type { TransportFactoryOptions } from "./transport";

export type {
  AgentMemoryRow,
  BridgeHealth,
  BridgeTransport,
  DarkMemoryBridgeConfig,
  ListMemoryInput,
  ListScope,
  MemoryEntity,
  MemoryKind,
  MemoryType,
  RecallInput,
  RecallItem,
  SaveMemoryInput,
  SessionContextResult,
  SessionInfo,
  TransportKind,
} from "./types";
