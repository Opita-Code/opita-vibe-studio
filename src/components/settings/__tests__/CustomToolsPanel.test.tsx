import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CustomToolsPanel } from "@/components/settings/CustomToolsPanel";
import { useCustomToolsStore } from "@/stores/custom-tools";

// Reset store between tests
beforeEach(() => {
  useCustomToolsStore.setState({ tools: [] });
});

describe("CustomToolsPanel", () => {
  it("muestra el estado vacío y el formulario", () => {
    render(<CustomToolsPanel />);
    expect(screen.getByTestId("custom-tool-form")).toBeTruthy();
    expect(screen.queryByTestId("custom-tools-list")).toBeNull();
    expect(screen.getByText(/No hay herramientas personalizadas todavía/)).toBeTruthy();
  });

  it("agrega una herramienta válida", () => {
    render(<CustomToolsPanel />);

    fireEvent.change(screen.getByTestId("tool-name-input"), {
      target: { value: "search_weather" },
    });
    fireEvent.change(screen.getByTestId("tool-description-input"), {
      target: { value: "Busca el clima actual de una ciudad." },
    });
    fireEvent.change(screen.getByTestId("tool-params-input"), {
      target: { value: '{"city": {"type": "string"}}' },
    });
    fireEvent.click(screen.getByTestId("tool-submit-btn"));

    const item = screen.getByTestId("custom-tool-item-search_weather");
    expect(item).toBeTruthy();
    expect(within(item).getByText("search_weather")).toBeTruthy();
    expect(within(item).getByText(/Busca el clima/)).toBeTruthy();

    const stored = useCustomToolsStore.getState().tools;
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("search_weather");
    expect(stored[0].parameters).toEqual({ city: { type: "string" } });
  });

  it("rechaza nombre inválido con error visible", () => {
    render(<CustomToolsPanel />);

    fireEvent.change(screen.getByTestId("tool-name-input"), {
      target: { value: "Mi Tool!" },
    });
    fireEvent.change(screen.getByTestId("tool-description-input"), {
      target: { value: "Descripción válida" },
    });
    fireEvent.click(screen.getByTestId("tool-submit-btn"));

    expect(screen.getByTestId("custom-tool-error")).toBeTruthy();
    expect(useCustomToolsStore.getState().tools).toHaveLength(0);
  });

  it("rechaza JSON de parámetros inválido", () => {
    render(<CustomToolsPanel />);

    fireEvent.change(screen.getByTestId("tool-name-input"), {
      target: { value: "my_tool" },
    });
    fireEvent.change(screen.getByTestId("tool-description-input"), {
      target: { value: "Descripción válida" },
    });
    fireEvent.change(screen.getByTestId("tool-params-input"), {
      target: { value: "{city: string}" },
    });
    fireEvent.click(screen.getByTestId("tool-submit-btn"));

    expect(screen.getByTestId("custom-tool-error")).toBeTruthy();
    expect(useCustomToolsStore.getState().tools).toHaveLength(0);
  });

  it("no permite nombres duplicados", () => {
    useCustomToolsStore.getState().addTool({
      name: "dup_tool",
      description: "Primera",
      parameters: {},
    });

    render(<CustomToolsPanel />);

    fireEvent.change(screen.getByTestId("tool-name-input"), {
      target: { value: "dup_tool" },
    });
    fireEvent.change(screen.getByTestId("tool-description-input"), {
      target: { value: "Segunda" },
    });
    fireEvent.click(screen.getByTestId("tool-submit-btn"));

    expect(screen.getByTestId("custom-tool-error")).toBeTruthy();
    expect(useCustomToolsStore.getState().tools).toHaveLength(1);
  });

  it("edita una herramienta existente", () => {
    useCustomToolsStore.getState().addTool({
      name: "my_tool",
      description: "Antes",
      parameters: {},
    });

    render(<CustomToolsPanel />);
    fireEvent.click(screen.getByTestId("edit-tool-my_tool"));

    const descInput = screen.getByTestId("tool-description-input") as HTMLTextAreaElement;
    expect(descInput.value).toBe("Antes");

    fireEvent.change(descInput, { target: { value: "Después" } });
    fireEvent.click(screen.getByTestId("tool-submit-btn"));

    const stored = useCustomToolsStore.getState().tools;
    expect(stored).toHaveLength(1);
    expect(stored[0].description).toBe("Después");
  });

  it("elimina una herramienta", () => {
    useCustomToolsStore.getState().addTool({
      name: "gone_tool",
      description: "Temporal",
      parameters: {},
    });

    render(<CustomToolsPanel />);
    fireEvent.click(screen.getByTestId("delete-tool-gone_tool"));

    expect(useCustomToolsStore.getState().tools).toHaveLength(0);
    expect(screen.queryByTestId("custom-tool-item-gone_tool")).toBeNull();
  });

  it("oculta el formulario al alcanzar el límite de 10", () => {
    const tools = Array.from({ length: 10 }, (_, i) => ({
      name: `tool_${i}`,
      description: `Descripción ${i}`,
      parameters: {},
    }));
    useCustomToolsStore.setState({ tools });

    render(<CustomToolsPanel />);
    expect(screen.queryByTestId("custom-tool-form")).toBeNull();
    expect(screen.getByText(/Límite de 10 herramientas alcanzado/)).toBeTruthy();
  });
});
