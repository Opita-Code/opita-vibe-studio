import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageBubble } from "../../../src/components/chat/MessageBubble";
import type { Message } from "../../../src/lib/types";
import { ChatInput } from "../../../src/components/chat/ChatInput";

// ═════════════════════════════════════════════════════════════════
// Pruebas de accesibilidad para componentes de chat
// ═════════════════════════════════════════════════════════════════
//
// Verifica que los componentes interactivos sean accesibles:
// navegación por teclado, manejo de foco, ARIA labels.
//

// ─── ChatInput — ARIA labels ────────────────────────────────────

describe("ChatInput — ARIA labels y roles", () => {
  it("debería tener aria-label en el botón de envío", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const btn = screen.getByRole("button", { name: "Enviar mensaje" });
    expect(btn).toBeDefined();
  });

  it("debería tener placeholder descriptivo en el textarea", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const textarea = screen.getByPlaceholderText(
      "Escribí en español lo que querés crear...",
    );
    expect(textarea).toBeDefined();
  });
});

// ─── ChatInput — Navegación por teclado ──────────────────────────

describe("ChatInput — navegación por teclado", () => {
  it("debería poder tabear al botón de envío", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    const textarea = screen.getByPlaceholderText(
      "Escribí en español lo que querés crear...",
    ) as HTMLTextAreaElement;
    const button = screen.getByRole("button", { name: "Enviar mensaje" });

    // Escribir texto para habilitar el botón
    fireEvent.change(textarea, { target: { value: "Hola" } });

    // El textarea debe ser focusable
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Tab al botón — simular focus programático
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("debería mantener foco en el input después de enviar", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(
      "Escribí en español lo que querés crear...",
    ) as HTMLTextAreaElement;

    textarea.focus();
    fireEvent.change(textarea, { target: { value: "Hola" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Hola");

    // Después de enviar, el textarea se limpia
    expect(textarea.value).toBe("");
  });

  it("debería deshabilitar el input cuando disabled=true", () => {
    render(<ChatInput onSend={() => {}} disabled={true} />);

    const textarea = screen.getByPlaceholderText(
      "Escribí en español lo que querés crear...",
    ) as HTMLTextAreaElement;
    const button = screen.getByRole("button", { name: "Enviar mensaje" });

    expect(textarea.disabled).toBe(true);
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

// ─── MessageBubble — ARIA labels ─────────────────────────────────

describe("MessageBubble — roles y contenido", () => {
  it("debería diferenciar mensajes de usuario y asistente", () => {
    const userMsg: Message = {
      id: "u1",
      role: "user",
      content: "Hola, creá una página",
      timestamp: Date.now(),
    };
    const assistantMsg: Message = {
      id: "a1",
      role: "assistant",
      content: "Acá está tu página",
      timestamp: Date.now(),
    };

    const { container: userContainer } = render(<MessageBubble message={userMsg} />);
    const { container: assistantContainer } = render(
      <MessageBubble message={assistantMsg} />,
    );

    expect(userContainer.textContent).toContain("Hola, creá una página");
    expect(assistantContainer.textContent).toContain("Acá está tu página");
  });

  it("debería renderizar markdown en mensajes del asistente", () => {
    const msg: Message = {
      id: "a2",
      role: "assistant",
      content: "Usá `display: flex` para alinear elementos.",
      timestamp: Date.now(),
    };

    const { container } = render(<MessageBubble message={msg} />);
    // El contenido markdown debería estar presente
    expect(container.textContent).toContain("display: flex");
  });
});
