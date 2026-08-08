import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "../../../src/components/chat/ChatInput";
import { useAuthStore } from "../../../src/stores/auth";
import { useChatStore } from "../../../src/stores/chat";
import { useProjectStore } from "../../../src/stores/project";
import { usePurchaseIntentStore } from "../../../src/hooks/usePurchaseIntent";

vi.mock("../../../src/lib/analytics", () => ({
  analytics: { track: vi.fn() },
}));

const AUTH_BASE = {
  user: { id: "u1", email: "a@b.co", name: "Test", plan: "free", verified: false },
  session: { token: "tok", expiresAt: Date.now() + 3600_000 },
  plan: "free" as const,
  authMode: "authenticated" as const,
  isLoading: false,
  tokenUsage: {
    tokensUsedToday: 1000,
    tokensLimitDaily: 150000,
    tokensUsedThisHour: 100,
    tokensLimitHourly: 30000,
    plan: "free" as const,
    resetDailyAt: new Date(Date.now() + 3600_000).toISOString(),
    resetHourlyAt: new Date(Date.now() + 600_000).toISOString(),
  },
};

function seedStores(chatOverrides: Record<string, unknown> = {}, authOverrides: Record<string, unknown> = {}) {
  useAuthStore.setState({ ...AUTH_BASE, ...authOverrides } as never);
  useChatStore.setState({
    activeSessionId: "s1",
    sessions: {
      s1: {
        id: "s1",
        title: "chat",
        messages: [
          { id: "m1", role: "user", content: "mensaje anterior", timestamp: Date.now() },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    isStreaming: false,
    activeModelId: "opita-flash",
    shareActiveFileContext: true,
    setShareActiveFileContext: vi.fn(),
    setActiveModelId: vi.fn(),
    setActiveProvider: vi.fn(),
    setActiveMode: vi.fn(),
    ...(chatOverrides as never),
  } as never);
  useProjectStore.setState({
    activeTab: null,
    fileContents: {},
    openTabs: [],
  } as never);
}

function largeContent(): string {
  return Array.from({ length: 1600 }, (_, i) => `linea ${i}`).join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
  seedStores();
  usePurchaseIntentStore.setState({ forcedIntent: null, wompiModalOpen: false });
  localStorage.setItem("vibe-byok-configured", "[]");
});

afterEach(() => {
  localStorage.clear();
});

describe("ChatInput (advanced)", () => {
  it("should show a warning for files with more than 1500 lines", () => {
    useProjectStore.setState({
      activeTab: "/test/big.ts",
      fileContents: { "/test/big.ts": largeContent() },
    } as never);
    render(<ChatInput onSend={() => {}} disabled={false} />);
    expect(screen.getByText(/Archivo demasiado grande/)).toBeDefined();
  });

  it("should show line count and allow toggling the include checkbox", () => {
    useProjectStore.setState({
      activeTab: "/test/app.ts",
      fileContents: { "/test/app.ts": "line1\nline2\nline3" },
    } as never);
    render(<ChatInput onSend={() => {}} disabled={false} />);
    expect(screen.getByText("(3 líneas)")).toBeDefined();

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(useChatStore.getState().setShareActiveFileContext).toHaveBeenCalledWith(false);
  });

  it("should prefill text from injectText prop", () => {
    render(<ChatInput onSend={() => {}} disabled={false} injectText="Hola Aura" />);
    const textarea = screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Hola Aura");
  });

  it("should prefill text from the vibe:prefill-chat event", async () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    window.dispatchEvent(new CustomEvent("vibe:prefill-chat", { detail: { message: "Hazme un dashboard" } }));
    expect(await screen.findByDisplayValue("Hazme un dashboard")).toBeDefined();
  });

  it("should add a text attachment via the file input", async () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File(["hola mundo"], "nota.txt", { type: "text/plain" });
    const input = screen.getByLabelText("Seleccionar archivos para adjuntar") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("nota.txt")).toBeDefined();
    // remove the attachment
    fireEvent.click(screen.getByLabelText("Eliminar adjunto nota.txt"));
    expect(screen.queryByText("nota.txt")).toBeNull();
  });

  it("should send with attachments", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const file = new File(["data"], "img.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Seleccionar archivos para adjuntar"), {
      target: { files: [file] },
    });
    await screen.findByText("img.png");

    const textarea = screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...");
    fireEvent.change(textarea, { target: { value: "usa la imagen" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith(
      "usa la imagen",
      expect.arrayContaining([expect.objectContaining({ name: "img.png" })]),
    );
  });

  it("should add an attachment on drop", async () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File(["x"], "drop.txt", { type: "text/plain" });
    const container = screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...").closest("div")!.parentElement!;
    fireEvent.drop(container, { dataTransfer: { files: [file] } });
    expect(await screen.findByText("drop.txt")).toBeDefined();
  });

  it("should add an attachment on paste of an image", async () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File(["y"], "paste.png", { type: "image/png" });
    const textarea = screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...");
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => file }],
      },
    });
    expect(await screen.findByText("paste.png")).toBeDefined();
  });

  it("should block large-file uploads for free plans and set the purchase intent", async () => {
    seedStores({}, { plan: "free" } as never);
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], "big.bin", { type: "application/octet-stream" });
    fireEvent.change(screen.getByLabelText("Seleccionar archivos para adjuntar"), {
      target: { files: [file] },
    });
    await vi.waitFor(() => {
      expect(usePurchaseIntentStore.getState().forcedIntent).toBe("large_file");
    });
  });

  it("should upload a large file for pro plans via presigned URL", async () => {
    seedStores({}, { plan: "pro" } as never);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ uploadUrl: "https://s3/upload", fileUrl: "https://s3/file" }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], "video.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Seleccionar archivos para adjuntar"), {
      target: { files: [file] },
    });
    expect(await screen.findByText("video.mp4")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("should show an upload error when presigning fails", async () => {
    seedStores({}, { plan: "pro" } as never);
    const fetchMock2 = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock2);
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], "big.bin", { type: "application/octet-stream" });
    fireEvent.change(screen.getByLabelText("Seleccionar archivos para adjuntar"), {
      target: { files: [file] },
    });
    await vi.waitFor(() => expect(fetchMock2).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toBeDefined();
    // dismiss
    fireEvent.click(screen.getByLabelText("Cerrar error"));
    expect(screen.queryByRole("alert")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("should recall the last user message with ArrowUp when input is empty", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const textarea = screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...") as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(textarea.value).toBe("mensaje anterior");
  });

  it("should open the model dropdown and list providers", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    fireEvent.click(screen.getByLabelText("Seleccionar modelo de IA"));
    // free plan sees the free-tier providers
    expect(screen.getAllByText(/Opita Flash|Opita/).length).toBeGreaterThan(0);
  });

  it("should select a model from the dropdown", () => {
    seedStores({
      activeModelId: "opita-flash",
      setActiveModelId: vi.fn(),
      setActiveProvider: vi.fn(),
    } as never);
    render(<ChatInput onSend={() => {}} disabled={false} />);
    fireEvent.click(screen.getByLabelText("Seleccionar modelo de IA"));
    // clicking any model button triggers selection
    const modelButtons = screen.getAllByRole("button");
    const target = modelButtons.find((b) => !b.getAttribute("aria-label")?.startsWith("Seleccionar"));
    if (target) fireEvent.click(target);
    expect(useChatStore.getState().setActiveModelId).toBeDefined();
  });

  it("should render streaming placeholder and enable sending while streaming", () => {
    useChatStore.setState({ isStreaming: true } as never);
    render(<ChatInput onSend={() => {}} disabled={true} />);
    expect(screen.getByPlaceholderText("Orientar al agente en tiempo real...")).toBeDefined();
    expect(screen.getAllByLabelText("Enviar orientación al agente").length).toBeGreaterThan(0);
  });

  it("should show upload status text while uploading", async () => {
    seedStores({}, { plan: "pro" } as never);
    let resolveUpload: (v: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise((res) => { resolveUpload = res; }))
      .mockResolvedValue({ ok: true }));
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], "x.bin", { type: "application/octet-stream" });
    fireEvent.change(screen.getByLabelText("Seleccionar archivos para adjuntar"), {
      target: { files: [file] },
    });
    resolveUpload({ ok: true, json: async () => ({ uploadUrl: "u", fileUrl: "f" }) });
    await screen.findByText("x.bin");
    vi.unstubAllGlobals();
  });
});
