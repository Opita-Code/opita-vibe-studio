// ═════════════════════════════════════════════════════════════════
// Task 11.1 — E2E vibe-coding loop
// ═════════════════════════════════════════════════════════════════
//
// NOTE: These tests were written for the legacy pipeline API
// (entender→construir→verificar with IPC file writes and
// buildPreviewContent). The architecture has since migrated to:
//
// 1. Agent Orchestrator (src/agent/) — replaces pipeline for 
//    complex workflows
// 2. VibeLens (Sandpack) — replaces buildPreviewContent for live 
//    preview
//
// The core pipeline tests still pass (tests/pipeline/pipeline.test.ts).
// These integration tests need a full rewrite to test the new
// orchestrator-based flow, which is tracked as a separate SDD cycle.
//
// TODO: Rewrite as orchestrator E2E tests once the agent system
// is fully stabilized.
// ═════════════════════════════════════════════════════════════════

import { describe, it } from "vitest";

describe("11.1 E2E: Full vibe-coding loop", () => {
  it.skip("should run entender→construir→verificar and emit result with files", () => {
    // TODO: Rewrite for Agent Orchestrator
  });

  it.skip("should write files via IPC when pipeline produces file events", () => {
    // TODO: Rewrite for Agent Orchestrator
  });

  it.skip("should emit file_created events for each written file", () => {
    // TODO: Rewrite for Agent Orchestrator
  });
});

describe("11.1 E2E: buildPreviewContent with pipeline output", () => {
  it.skip("should render HTML file content from pipeline output", () => {
    // TODO: buildPreviewContent is now a stub — VibeLens handles preview
  });

  it.skip("should render CSS file content from pipeline output", () => {
    // TODO: buildPreviewContent is now a stub — VibeLens handles preview
  });

  it.skip("should render JS file content from pipeline output", () => {
    // TODO: buildPreviewContent is now a stub — VibeLens handles preview
  });

  it.skip("should show placeholder for empty content", () => {
    // TODO: buildPreviewContent is now a stub — VibeLens handles preview
  });
});

describe("11.1 E2E: Pipeline retry writes files each attempt", () => {
  it.skip("should call writeFile on retry when verificar returns reintentar", () => {
    // TODO: Rewrite for Agent Orchestrator
  });
});
