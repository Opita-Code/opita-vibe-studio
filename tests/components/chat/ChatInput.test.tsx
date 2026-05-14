import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "../../../src/components/chat/ChatInput";

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render textarea and send button", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    expect(
      screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...")
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDefined();
  });

  it("should call onSend with trimmed text when Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "  Hola  " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("Hola", undefined);
  });

  it("should not call onSend for empty input (silent no-op)", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    ) as HTMLTextAreaElement;

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not call onSend for whitespace-only input", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not call onSend when disabled", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "Hola" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("should pass Shift+Enter through to allow newlines", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "line1" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    // Shift+Enter should not trigger send
    expect(onSend).not.toHaveBeenCalled();
  });

  it("should remain disabled when disabled prop changes", () => {
    const { rerender } = render(<ChatInput onSend={() => {}} disabled={true} />);

    let textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    );
    expect(textarea.hasAttribute("disabled")).toBe(true);

    rerender(<ChatInput onSend={() => {}} disabled={false} />);
    textarea = screen.getByPlaceholderText("Escribe, pega imágenes o arrastra archivos aquí...");
    expect(textarea.hasAttribute("disabled")).toBe(false);
  });

  it("should clear input after sending", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "Hola" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(textarea.value).toBe("");
  });



  it("should set disabled styles on textarea and button when disabled", () => {
    render(<ChatInput onSend={() => {}} disabled={true} />);

    const textarea = screen.getByPlaceholderText(
      "Escribe, pega imágenes o arrastra archivos aquí...",
    );
    const button = screen.getByRole("button", { name: "Enviar mensaje" });

    expect(textarea.hasAttribute("disabled")).toBe(true);
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
