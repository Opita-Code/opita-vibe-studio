import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitForElementToBeRemoved } from "@testing-library/react";
import { ModeButtons } from "../../../src/components/chat/ModeButtons";
import { PersonaSelector } from "../../../src/components/chat/PersonaSelector";
import { useChatStore } from "../../../src/stores/chat";
import { useUIStore } from "../../../src/stores/ui";
import { useAuthStore } from "../../../src/stores/auth";

describe("ModeButtons", () => {
  beforeEach(() => {
    useChatStore.setState({
      activeMode: "auto",
      executionMode: "interactive",
      setActiveMode: vi.fn(),
      setExecutionMode: vi.fn(),
    } as never);
  });

  it("should render the active mode button", () => {
    render(<ModeButtons onActivate={() => {}} />);
    expect(screen.getByLabelText(/Modo: /)).toBeDefined();
  });

  it("should open the mode dropdown and activate a mode", () => {
    const onActivate = vi.fn();
    const setActiveMode = vi.fn();
    useChatStore.setState({ activeMode: "auto", setActiveMode } as never);
    render(<ModeButtons onActivate={onActivate} />);
    fireEvent.click(screen.getByLabelText(/Modo: /));

    // find a mode option (different from current) and click it
    const option = screen.getAllByRole("button").find((b) => b.textContent?.includes("Construir"));
    fireEvent.click(option!);
    expect(setActiveMode).toHaveBeenCalled();
    expect(onActivate).toHaveBeenCalled();
  });

  it("should open the execution dropdown and switch to automatic", () => {
    const setExecutionMode = vi.fn();
    useChatStore.setState({ executionMode: "interactive", setExecutionMode } as never);
    render(<ModeButtons onActivate={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Ejecución: Interactivo/));

    const autoOption = screen.getAllByRole("button").find((b) => b.textContent?.includes("Auto") && b.textContent?.includes("encadena"));
    fireEvent.click(autoOption!);
    expect(setExecutionMode).toHaveBeenCalledWith("automatic");
  });

  it("should switch back to interactive execution mode", () => {
    const setExecutionMode = vi.fn();
    useChatStore.setState({ executionMode: "automatic", setExecutionMode } as never);
    render(<ModeButtons onActivate={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Ejecución: Auto/));
    const interactiveOption = screen.getAllByRole("button").find((b) => b.textContent?.includes("diriges"));
    fireEvent.click(interactiveOption!);
    expect(setExecutionMode).toHaveBeenCalledWith("interactive");
  });

  it("should close the mode dropdown when clicking outside", async () => {
    render(<ModeButtons onActivate={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Modo: /));
    expect(screen.getByText("Modo de Aura")).toBeDefined();
    fireEvent.mouseDown(document.body);
    await waitForElementToBeRemoved(() => screen.queryByText("Modo de Aura"));
  });
});

describe("PersonaSelector", () => {
  beforeEach(() => {
    useAuthStore.setState({ plan: "free" } as never);
    useUIStore.setState({
      persona: "creator",
      customPersonaPrompt: "",
      setPersona: vi.fn(),
      setCustomPersonaPrompt: vi.fn(),
    });
  });

  it("should render the active persona badge", () => {
    render(<PersonaSelector />);
    expect(screen.getByTitle("Persona: Creador")).toBeDefined();
  });

  it("should open the dropdown and list personas", () => {
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    expect(screen.getByText("Persona de Aura")).toBeDefined();
  });

  it("should select a free persona", () => {
    const setPersona = vi.fn();
    useUIStore.setState({ setPersona } as never);
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    fireEvent.click(screen.getByText("Estudiante"));
    expect(setPersona).toHaveBeenCalledWith("student");
  });

  it("should NOT select a pro persona for free users (locked)", () => {
    const setPersona = vi.fn();
    useUIStore.setState({ setPersona } as never);
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    const proPersona = screen.getAllByRole("button").find((b) => b.textContent?.includes("Pro"));
    fireEvent.click(proPersona!);
    expect(setPersona).not.toHaveBeenCalled();
  });

  it("should select a pro persona for pro users", () => {
    const setPersona = vi.fn();
    useAuthStore.setState({ plan: "pro" } as never);
    useUIStore.setState({ setPersona } as never);
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    const proPersona = screen.getAllByRole("button").find((b) => b.textContent?.includes("Pro"));
    fireEvent.click(proPersona!);
    expect(setPersona).toHaveBeenCalled();
  });

  it("should show the custom persona textarea for pro users with custom persona", () => {
    const setCustomPersonaPrompt = vi.fn();
    useAuthStore.setState({ plan: "pro" } as never);
    useUIStore.setState({
      persona: "custom",
      setCustomPersonaPrompt,
    } as never);
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    const textarea = screen.getByPlaceholderText("Describe cómo quieres que Aura se comunique contigo...");
    fireEvent.change(textarea, { target: { value: "hola" } });
    expect(setCustomPersonaPrompt).toHaveBeenCalledWith("hola");
    expect(screen.getByText("0/500")).toBeDefined();
  });

  it("should NOT show the custom textarea for free users", () => {
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    fireEvent.click(screen.getByText("Personalizado"));
    expect(screen.queryByPlaceholderText("Describe cómo quieres que Aura se comunique contigo...")).toBeNull();
  });

  it("should close the dropdown when clicking outside", async () => {
    render(<PersonaSelector />);
    fireEvent.click(screen.getByTitle(/Persona:/));
    expect(screen.getByText("Persona de Aura")).toBeDefined();
    fireEvent.mouseDown(document.body);
    await waitForElementToBeRemoved(() => screen.queryByText("Persona de Aura"));
  });
});
