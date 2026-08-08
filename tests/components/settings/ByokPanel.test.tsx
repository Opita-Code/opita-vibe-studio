import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitForElementToBeRemoved } from "@testing-library/react";
import { ByokPanel } from "../../../src/components/settings/ByokPanel";
import type { ProviderDisplayInfo } from "../../../src/lib/byok-store";

// ── byok-store mock ─────────────────────────────────────────────
const byokActions = {
  getByokProviderDisplayInfo: vi.fn(async () => []),
  saveProviderKey: vi.fn(async () => {}),
  deleteProviderKey: vi.fn(async () => {}),
  testProviderConnection: vi.fn(async () => true),
  getProviderKey: vi.fn(async () => null),
};

const chatgptAuth = {
  startAuth: vi.fn(),
  pollForDeviceToken: vi.fn(),
};

vi.mock("../../../src/lib/byok-store", () => ({
  getByokProviderDisplayInfo: () => byokActions.getByokProviderDisplayInfo(),
  saveProviderKey: (...args: unknown[]) => byokActions.saveProviderKey(...args),
  deleteProviderKey: (...args: unknown[]) => byokActions.deleteProviderKey(...args),
  testProviderConnection: (...args: unknown[]) => byokActions.testProviderConnection(...args),
  getProviderKey: (...args: unknown[]) => byokActions.getProviderKey(...args),
  BYOK_PROVIDERS: [
    { id: "openai", name: "OpenAI", category: "Principales", docsUrl: "https://platform.openai.com", requiresEndpoint: false },
    { id: "deepseek", name: "Opita AI", category: "Alto Rendimiento", docsUrl: "https://platform.deepseek.com", requiresEndpoint: false },
    { id: "chatgpt-web", name: "ChatGPT Plus (WebAuth)", category: "Principales", docsUrl: "https://chatgpt.com", requiresEndpoint: false },
    { id: "custom", name: "Endpoint Personalizado", category: "Avanzado", requiresEndpoint: true },
  ],
}));

vi.mock("../../../src/lib/chatgpt-auth", () => ({
  startAuth: () => chatgptAuth.startAuth(),
  pollForDeviceToken: (...args: unknown[]) => chatgptAuth.pollForDeviceToken(...args),
}));

function displayInfo(overrides: Partial<ProviderDisplayInfo> & { id: string }): ProviderDisplayInfo {
  return {
    name: overrides.id,
    configured: false,
    status: "not_configured",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  byokActions.getByokProviderDisplayInfo.mockResolvedValue([]);
  byokActions.testProviderConnection.mockResolvedValue(true);
});

describe("ByokPanel", () => {
  it("should show a loading spinner while providers load", () => {
    byokActions.getByokProviderDisplayInfo.mockReturnValue(new Promise(() => {}));
    render(<ByokPanel />);
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });

  it("should render configured providers with status badges", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: true, status: "connected", maskedKey: "sk-...xyz" }),
    ]);
    render(<ByokPanel />);
    expect(await screen.findByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Conectado")).toBeDefined();
    expect(screen.getByText("sk-...xyz")).toBeDefined();
  });

  it("should render error status for a configured provider", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: true, status: "error" }),
    ]);
    render(<ByokPanel />);
    expect(await screen.findByText("Fallo de conexión")).toBeDefined();
  });

  it("should render unconfigured providers as available cards", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: false }),
    ]);
    render(<ByokPanel />);
    expect(await screen.findByText("OpenAI")).toBeDefined();
    expect(screen.getByText("Disponibles para Conectar")).toBeDefined();
  });

  it("should expand the form when selecting an unconfigured provider", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: false }),
    ]);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("OpenAI"));
    expect(screen.getByText("Llave de Acceso (API Key)")).toBeDefined();
    expect(screen.getByText("Conectar Proveedor")).toBeDefined();
    expect(screen.getByText("Dónde obtenerla")).toBeDefined();
  });

  it("should collapse the form when selecting the same provider again", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: false }),
    ]);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("OpenAI"));
    fireEvent.click(screen.getByText("OpenAI"));
    await waitForElementToBeRemoved(() => screen.queryByText("Conectar Proveedor"));
  });

  it("should show a required-key error when saving without a key", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: false }),
    ]);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("OpenAI"));
    const button = screen.getByText("Conectar Proveedor") as HTMLButtonElement;
    // Fix spec 899: el botón ya no queda disabled sin key — se muestra el
    // error (la rama de validación era código muerto con el botón disabled).
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(await screen.findByText("La Llave de Acceso es requerida")).toBeDefined();
    expect(byokActions.saveProviderKey).not.toHaveBeenCalled();
  });

  it("should require endpoint for custom providers", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "custom", name: "Endpoint Personalizado", configured: false }),
    ]);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Endpoint Personalizado"));
    expect(screen.getByText("URL del Endpoint")).toBeDefined();

    const keyInput = screen.getByPlaceholderText("sk-...");
    fireEvent.change(keyInput, { target: { value: "sk-key" } });
    fireEvent.click(screen.getByText("Conectar Proveedor"));
    expect(await screen.findByText("La URL del endpoint es requerida")).toBeDefined();
  });

  it("should save a provider key after successful connection test", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "deepseek", name: "Opita AI", configured: false }),
    ]);
    byokActions.testProviderConnection.mockResolvedValue(true);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Opita AI"));

    const keyInput = screen.getByPlaceholderText("sk-...");
    fireEvent.change(keyInput, { target: { value: "sk-ds-123" } });
    fireEvent.click(screen.getByText("Conectar Proveedor"));

    await vi.waitFor(() => {
      expect(byokActions.testProviderConnection).toHaveBeenCalledWith("deepseek", "sk-ds-123", undefined);
      expect(byokActions.saveProviderKey).toHaveBeenCalledWith("deepseek", "sk-ds-123", undefined);
    });
  });

  it("should show invalid-key error when connection test fails", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "deepseek", name: "Opita AI", configured: false }),
    ]);
    byokActions.testProviderConnection.mockResolvedValue(false);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Opita AI"));

    fireEvent.change(screen.getByPlaceholderText("sk-..."), { target: { value: "sk-mal" } });
    fireEvent.click(screen.getByText("Conectar Proveedor"));

    expect(await screen.findByText(/Llave de Acceso inválida/)).toBeDefined();
    expect(byokActions.saveProviderKey).not.toHaveBeenCalled();
  });

  it("should surface errors thrown while saving", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "deepseek", name: "Opita AI", configured: false }),
    ]);
    byokActions.saveProviderKey.mockRejectedValue(new Error("red explosion"));
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Opita AI"));
    fireEvent.change(screen.getByPlaceholderText("sk-..."), { target: { value: "sk-ok" } });
    fireEvent.click(screen.getByText("Conectar Proveedor"));

    expect(await screen.findByText(/Error al guardar: Error: red explosion/)).toBeDefined();
  });

  it("should delete a configured provider", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: true, status: "connected" }),
    ]);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByTitle("Desconectar proveedor"));
    expect(byokActions.deleteProviderKey).toHaveBeenCalledWith("openai");
  });

  it("should test a connection from the configured list", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: true, status: "not_configured" }),
    ]);
    byokActions.getProviderKey.mockResolvedValue({ id: "openai", key: "sk-abc", endpoint: undefined, updatedAt: Date.now() });
    byokActions.testProviderConnection.mockResolvedValue(true);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Probar Conexión"));
    expect(await screen.findByText("Conectado")).toBeDefined();
  });

  it("should show no-key error when testing an unconfigured provider", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: true, status: "not_configured" }),
    ]);
    byokActions.getProviderKey.mockResolvedValue(null);
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Probar Conexión"));
    expect(await screen.findByText("Fallo de conexión")).toBeDefined();
  });

  it("should show an error when the connection test throws", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "openai", name: "OpenAI", configured: true, status: "not_configured" }),
    ]);
    byokActions.getProviderKey.mockResolvedValue({ id: "openai", key: "sk-abc", endpoint: undefined, updatedAt: Date.now() });
    byokActions.testProviderConnection.mockRejectedValue(new Error("boom"));
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("Probar Conexión"));
    expect(await screen.findByText("Fallo de conexión")).toBeDefined();
  });

  it("should run the ChatGPT OAuth flow with immediate tokens", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "chatgpt-web", name: "ChatGPT Plus (WebAuth)", configured: false }),
    ]);
    chatgptAuth.startAuth.mockResolvedValue({
      type: "tokens",
      tokens: { accessToken: "at", refreshToken: "rt", expiresAt: Date.now() },
    });
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("ChatGPT Plus (WebAuth)"));
    fireEvent.click(screen.getByText("Iniciar Sesión en ChatGPT"));

    await vi.waitFor(() => {
      expect(byokActions.saveProviderKey).toHaveBeenCalledWith(
        "chatgpt-web",
        "at",
        undefined,
        expect.objectContaining({ refreshToken: "rt" }),
      );
    });
  });

  it("should run the device code flow for ChatGPT", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "chatgpt-web", name: "ChatGPT Plus (WebAuth)", configured: false }),
    ]);
    let resolvePoll: (v: unknown) => void = () => {};
    chatgptAuth.startAuth.mockResolvedValue({
      type: "pending",
      pending: { userCode: "ABC-123", verificationUri: "https://chatgpt.com/device", intervalMs: 5000 },
    });
    chatgptAuth.pollForDeviceToken.mockImplementation(
      () => new Promise((resolve) => { resolvePoll = resolve; }),
    );
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("ChatGPT Plus (WebAuth)"));
    fireEvent.click(screen.getByText("Iniciar Sesión en ChatGPT"));

    expect(await screen.findByText("ABC-123")).toBeDefined();
    expect(screen.getByText("Abrir OpenAI")).toBeDefined();
    expect(screen.getByText(/Esperando que completes/)).toBeDefined();

    resolvePoll({ accessToken: "dev-at", refreshToken: "dev-rt", expiresAt: Date.now() });
    await vi.waitFor(() => {
      expect(byokActions.saveProviderKey).toHaveBeenCalledWith(
        "chatgpt-web",
        "dev-at",
        undefined,
        expect.objectContaining({ refreshToken: "dev-rt" }),
      );
    });
  });

  it("should show an error message when ChatGPT auth fails", async () => {
    byokActions.getByokProviderDisplayInfo.mockResolvedValue([
      displayInfo({ id: "chatgpt-web", name: "ChatGPT Plus (WebAuth)", configured: false }),
    ]);
    chatgptAuth.startAuth.mockRejectedValue(new Error("denied"));
    render(<ByokPanel />);
    fireEvent.click(await screen.findByText("ChatGPT Plus (WebAuth)"));
    fireEvent.click(screen.getByText("Iniciar Sesión en ChatGPT"));
    expect(await screen.findByText("denied")).toBeDefined();
  });
});
