import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageBubble, parseFileRef } from "../../../src/components/chat/MessageBubble";
import type { Message, AgentExecution } from "../../../src/lib/types";

// ── Project store mock (workspace file tree for file-ref detection) ──
let mockProjectState: Record<string, unknown> = {};

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(mockProjectState),
    { getState: () => mockProjectState },
  ),
}));

function makeMsg(overrides: Partial<Message> & { role: Message["role"] }): Message {
  return {
    id: "msg-1",
    content: "",
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeExecution(status: AgentExecution["status"], overrides: Partial<AgentExecution> = {}): AgentExecution {
  return {
    phase: "building",
    progress: 50,
    roadmap: [
      { id: "g1", label: "Analizar", status: "done" },
      { id: "g2", label: "Construir", status: "active" },
    ],
    steps: [
      { id: "s1", icon: "🔍", label: "Leer archivos", status: "done", timestamp: Date.now() },
      { id: "s2", icon: "✏️", label: "Escribir", status: "running", timestamp: Date.now() },
    ],
    filesChanged: [{ path: "src/App.tsx", action: "modified", linesChanged: 5 }],
    status,
    startedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProjectState = {
    workspaces: [
      {
        id: "ws-1",
        name: "test",
        path: "/test",
        files: [
          { name: "src", path: "/test/src", type: "directory", children: [
            { name: "app.ts", path: "/test/src/app.ts", type: "file", extension: "ts" },
          ]},
        ],
        isGitRepo: false,
        gitBranch: null,
      },
    ],
    activeWorkspaceId: "ws-1",
    openDiffMode: vi.fn(async () => {}),
  };

  // clipboard mock
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MessageBubble (advanced)", () => {
  it("should render pending actions for user messages with deliveryStatus pending", () => {
    const onCancel = vi.fn();
    const onEdit = vi.fn();
    const msg = makeMsg({ role: "user", content: "hazlo", deliveryStatus: "pending" });
    render(<MessageBubble message={msg} onCancel={onCancel} onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText("Cancelar mensaje"));
    expect(onCancel).toHaveBeenCalledWith("msg-1");
    fireEvent.click(screen.getByLabelText("Editar mensaje"));
    expect(onEdit).toHaveBeenCalledWith("msg-1");
  });

  it("should copy user message content via clipboard button", async () => {
    const msg = makeMsg({ role: "user", content: "texto a copiar" });
    render(<MessageBubble message={msg} />);
    fireEvent.click(screen.getByLabelText("Copiar mensaje"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("texto a copiar");
    vi.advanceTimersByTime(2100);
  });

  it("should copy assistant response via copy button", () => {
    const msg = makeMsg({ role: "assistant", content: "respuesta" });
    render(<MessageBubble message={msg} />);
    fireEvent.click(screen.getByLabelText("Copiar respuesta"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("respuesta");
  });

  it("should render thinking content when isThinking is true", () => {
    const msg = makeMsg({ role: "assistant", content: "" });
    render(<MessageBubble message={msg} isThinking={true} />);
    expect(screen.getByText(/Afinando el aura|Inyectando flow|Destilando|Calculando|Calibrando|Conectando|Compilando|Diseñando|Sincronizando|Preparando|Invocando|Haciendo|Consultando|Alineando|Optimizando/)).toBeDefined();
  });

  it("should render reasoning accordion from message.reasoning", () => {
    const msg = makeMsg({ role: "assistant", content: "Respuesta final", reasoning: "Pensé mucho aquí" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Razonamiento")).toBeDefined();
    fireEvent.click(screen.getByText("Razonamiento"));
    expect(screen.getByText("Pensé mucho aquí")).toBeDefined();
  });

  it("should parse legacy <think> tags and strip them from content", () => {
    const msg = makeMsg({ role: "assistant", content: "<think>analizando</think>Respuesta visible" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Respuesta visible")).toBeDefined();
    expect(screen.queryByText("<think>analizando</think>")).toBeNull();
  });

  it("should render legacy subagent steps and open diff mode on modifying steps", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "Resumen",
      subagentSteps: [
        { id: "t1", tool: "write_local_file", target: "src/app.ts", phrase: "Escribí archivo", timestamp: Date.now() },
        { id: "t2", tool: "read_file", target: "src/readme.md", phrase: "Leí archivo", timestamp: Date.now() },
      ],
    });
    render(<MessageBubble message={msg} />);
    // accordion is collapsed by default — expand it first (fix spec 899: typo operaciones)
    fireEvent.click(screen.getByText("2 operaciones"));
    expect(screen.getByText("Escribí archivo")).toBeDefined();
    expect(screen.getByText("Leí archivo")).toBeDefined();
    fireEvent.click(screen.getByText("Escribí archivo"));
    expect(mockProjectState.openDiffMode).toHaveBeenCalledWith("src/app.ts");
  });

  it("should render empty bubble with reasoning accordion only", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "",
      reasoning: "solo razonamiento",
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Razonamiento")).toBeDefined();
  });

  it("should render execution dashboard for empty assistant message with agentExecution", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "",
      agentExecution: makeExecution("running"),
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Construyendo...")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
    expect(screen.getByText("Analizar")).toBeDefined();
    // InlineSteps header shows the active step while live
    fireEvent.click(screen.getByText("Escribir"));
    expect(screen.getByText("Leer archivos")).toBeDefined();
  });

  it("should render agent execution header inside the bubble for non-done status", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "Voy avanzando",
      agentExecution: makeExecution("running"),
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Construyendo...")).toBeDefined();
    expect(screen.getByText("Analizar")).toBeDefined();
    expect(screen.getByText("Escribir")).toBeDefined();
  });

  it("should render completed agent execution with file change summary", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "Listo",
      agentExecution: makeExecution("done", { progress: 100 }),
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("App.tsx")).toBeDefined();
    expect(screen.getByText("1 archivo")).toBeDefined();
    fireEvent.click(screen.getByText("App.tsx"));
    expect(mockProjectState.openDiffMode).toHaveBeenCalledWith("src/App.tsx");
  });

  it("should render awaiting-confirmation execution with confirmation card", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "¿Confirmas?",
      agentExecution: makeExecution("awaiting-confirmation", {
        confirmation: { completedPhase: "build", nextPhase: "apply", summary: "Cambios listos" },
      }),
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Cambios listos")).toBeDefined();
  });

  it("should render execution error message", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "Algo falló",
      agentExecution: makeExecution("error", { error: "Error de conexión" }),
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText(/Error de conexión/)).toBeDefined();
  });

  it("should render sections via SectionRenderer when sections present", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "",
      sections: [
        { id: "sec1", type: "text", content: "Contenido de sección" },
        { id: "sec2", type: "summary", content: "Resumen ejecutivo" },
      ],
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Contenido de sección")).toBeDefined();
    expect(screen.getByText("Resumen ejecutivo")).toBeDefined();
  });

  it("should render a FileRefChip for inline code matching a workspace file", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "Abre `src/app.ts` para verlo",
    });
    render(<MessageBubble message={msg} />);
    // FileRefChip renders the basename as clickable text
    expect(screen.getByText("app.ts")).toBeDefined();
  });

  it("should return null for empty tool-only assistant message with no context", () => {
    mockProjectState = { ...mockProjectState, workspaces: [], activeWorkspaceId: null };
    const msg = makeMsg({ role: "assistant", content: "  " });
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("parseFileRef", () => {
  it("should parse a valid file reference with matching workspace file", () => {
    const result = parseFileRef("src/app.ts:42-58", new Set(["/test/src/app.ts"]));
    expect(result).toEqual({ path: "src/app.ts", line: 42, endLine: 58 });
  });

  it("should parse a file reference without line numbers", () => {
    const result = parseFileRef("src/app.ts", new Set(["src/app.ts"]));
    expect(result).toEqual({ path: "src/app.ts", line: undefined, endLine: undefined });
  });

  it("should return null for a non-code text", () => {
    expect(parseFileRef("hola mundo", new Set(["hola"]) )).toBeNull();
  });

  it("should return null when the file is not in the workspace", () => {
    expect(parseFileRef("src/other.ts", new Set(["src/app.ts"]))).toBeNull();
  });

  it("should return null for unsupported extensions", () => {
    expect(parseFileRef("image.png", new Set(["image.png"]))).toBeNull();
  });

  it("should handle backslash separators", () => {
    const result = parseFileRef("src\\app.ts", new Set(["src/app.ts"]));
    expect(result).toEqual({ path: "src/app.ts", line: undefined, endLine: undefined });
  });
});
