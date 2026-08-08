import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitForElementToBeRemoved } from "@testing-library/react";
import { SectionRenderer } from "../../../src/components/chat/SectionRenderer";
import { ThinkingChip } from "../../../src/components/chat/ThinkingChip";
import { NoticeSection } from "../../../src/components/chat/NoticeSection";
import { DonutProgress } from "../../../src/components/chat/DonutProgress";
import { StreamingIndicator } from "../../../src/components/chat/StreamingIndicator";

describe("SectionRenderer", () => {
  it("should render a thinking section via ThinkingChip", () => {
    render(<SectionRenderer section={{ id: "1", type: "thinking", content: "analizando src/app.ts y src/utils.ts" }} />);
    expect(screen.getByText("Analizó 2 archivos")).toBeDefined();
  });

  it("should render a text section with markdown", () => {
    render(<SectionRenderer section={{ id: "1", type: "text", content: "Texto **importante**" }} />);
    expect(screen.getByText("importante")).toBeDefined();
  });

  it("should render inline code in text sections without applying a block", () => {
    render(<SectionRenderer section={{ id: "1", type: "text", content: "Usa `npm install`" }} />);
    expect(screen.queryByText("Aplicar")).toBeNull();
  });

  it("should render fenced code blocks in text sections with ApplyCodeBlock", () => {
    render(<SectionRenderer section={{ id: "1", type: "text", content: "```ts\nconst a = 1;\n```" }} />);
    expect(screen.getByText("Aplicar")).toBeDefined();
  });

  it("should render a code section via ApplyCodeBlock", () => {
    render(<SectionRenderer section={{ id: "1", type: "code", content: "console.log(1)", language: "js" }} />);
    expect(screen.getByText("Aplicar")).toBeDefined();
  });

  it("should render a notice section", () => {
    render(<SectionRenderer section={{ id: "1", type: "notice", content: "Aviso importante" }} />);
    expect(screen.getByText("Aviso importante")).toBeDefined();
  });

  it("should render steps and summary sections as text fallback", () => {
    render(<SectionRenderer section={{ id: "1", type: "steps", content: "paso a paso" }} />);
    expect(screen.getByText("paso a paso")).toBeDefined();
    render(<SectionRenderer section={{ id: "1", type: "summary", content: "resumen" }} />);
    expect(screen.getByText("resumen")).toBeDefined();
  });

  it("should return null for unknown section types", () => {
    const { container } = render(<SectionRenderer section={{ id: "1", type: "invalid" as never, content: "" }} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ThinkingChip", () => {
  it("should auto-generate a label from file references", () => {
    render(<ThinkingChip content="Revisé src/app.ts y luego src/utils.ts" />);
    expect(screen.getByText("Analizó 2 archivos")).toBeDefined();
  });

  it("should auto-generate a detailed label for long content", () => {
    const longContent = "Primera frase. Segunda frase. Tercera frase. Cuarta frase. Quinta frase. Sexta frase. Séptima frase.";
    render(<ThinkingChip content={longContent} />);
    expect(screen.getByText("Análisis detallado")).toBeDefined();
  });

  it("should fall back to Razonamiento for short content without files", () => {
    render(<ThinkingChip content="pensamiento corto" />);
    expect(screen.getByText("Razonamiento")).toBeDefined();
  });

  it("should use the provided label when given", () => {
    render(<ThinkingChip content="x" label="Mi etiqueta" />);
    expect(screen.getByText("Mi etiqueta")).toBeDefined();
  });

  it("should expand and collapse the reasoning content", async () => {
    render(<ThinkingChip content="detalle del razonamiento" />);
    expect(screen.queryByText("detalle del razonamiento")).toBeNull();
    fireEvent.click(screen.getByText("Razonamiento"));
    expect(await screen.findByText("detalle del razonamiento")).toBeDefined();
    fireEvent.click(screen.getByText("Razonamiento"));
    await new Promise((r) => setTimeout(r, 250));
  });

  it("should start expanded when defaultCollapsed is false", () => {
    render(<ThinkingChip content="visible" defaultCollapsed={false} />);
    expect(screen.getByText("visible")).toBeDefined();
  });
});

describe("NoticeSection", () => {

  it("should render content while expanded", () => {
    render(<NoticeSection content="Nota informativa" />);
    expect(screen.getByText("Nota informativa")).toBeDefined();
  });

  it("should collapse on click", async () => {
    render(<NoticeSection content="Nota" />);
    fireEvent.click(screen.getByText("Nota"));
    expect(await screen.findByText("Aviso")).toBeDefined();
  });

  it("should re-expand from the Aviso button", async () => {
    render(<NoticeSection content="Nota" />);
    fireEvent.click(screen.getByText("Nota"));
    fireEvent.click(await screen.findByText("Aviso"));
    expect(await screen.findByText("Nota")).toBeDefined();
  });

  it("should auto-collapse after autoDismissMs", async () => {
    render(<NoticeSection content="Nota" autoDismissMs={100} />);
    expect(screen.getByText("Nota")).toBeDefined();
    await waitForElementToBeRemoved(() => screen.queryByText("Nota"), { timeout: 3000 });
    expect(screen.getByText("Aviso")).toBeDefined();
  });

  it("should NOT auto-collapse when autoDismissMs is 0", () => {
    render(<NoticeSection content="Persistente" autoDismissMs={0} />);
    expect(screen.getByText("Persistente")).toBeDefined();
  });
});

describe("DonutProgress", () => {
  it("should render a progressbar with the given percent", () => {
    render(<DonutProgress percent={42} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("42")).toBeDefined();
  });

  it("should hide the text when showText is false", () => {
    render(<DonutProgress percent={75} showText={false} />);
    expect(screen.queryByText("75")).toBeNull();
  });

  it("should round the displayed percentage", () => {
    render(<DonutProgress percent={66.6} />);
    expect(screen.getByText("67")).toBeDefined();
  });
});

describe("StreamingIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render one of the vibe phrases", () => {
    render(<StreamingIndicator />);
    expect(screen.getByText(/Afinando el aura|Inyectando flow|Destilando lógica|Calculando la estética|Calibrando el flujo|Conectando las vibras|Compilando con extra Vibe|Diseñando píxeles|Alineando los divs|Sincronizando frecuencias|Preparando el lienzo|Invocando los espíritus|Haciendo magia/)).toBeDefined();
  });

  it("should keep cycling phrases on an interval without crashing", () => {
    render(<StreamingIndicator />);
    const PHRASE = /Afinando el aura|Inyectando flow|Destilando lógica|Calculando la estética|Calibrando el flujo|Conectando las vibras|Compilando con extra Vibe|Diseñando píxeles|Alineando los divs|Sincronizando frecuencias|Preparando el lienzo|Invocando los espíritus|Haciendo magia/;
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(2500);
      expect(screen.getByText(PHRASE)).toBeDefined();
    }
  });
});
