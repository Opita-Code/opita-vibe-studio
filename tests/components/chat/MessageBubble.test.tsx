import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../../../src/components/chat/MessageBubble";
import type { Message } from "../../../src/lib/types";

function makeMsg(overrides: Partial<Message> & { role: Message["role"] }): Message {
  return {
    id: "test-1",
    content: "",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MessageBubble", () => {
  it("should render user message right-aligned", () => {
    const msg = makeMsg({ role: "user", content: "Creá una landing page" });
    const { container } = render(<MessageBubble message={msg} />);

    // User messages should have justify-end
    expect(container.firstChild).toHaveClass("justify-end");
    expect(screen.getByText("Creá una landing page")).toBeDefined();
  });

  it("should render assistant message left-aligned", () => {
    const msg = makeMsg({ role: "assistant", content: "Claro, te ayudo con eso" });
    const { container } = render(<MessageBubble message={msg} />);

    // Assistant messages should have justify-start
    expect(container.firstChild).toHaveClass("justify-start");
  });

  it("should render system message centered", () => {
    const msg = makeMsg({ role: "system", content: "Sistema iniciado" });
    const { container } = render(<MessageBubble message={msg} />);

    expect(container.firstChild).toHaveClass("justify-center");
    expect(screen.getByText("Sistema iniciado")).toBeDefined();
  });

  it("should render basic markdown in assistant messages", () => {
    const msg = makeMsg({
      role: "assistant",
      content: "Esto es **negrita** y esto es *cursiva*",
    });
    render(<MessageBubble message={msg} />);

    // react-markdown should render strong and em elements
    expect(screen.getByText("negrita")).toBeDefined();
    expect(screen.getByText("cursiva")).toBeDefined();
  });

  it("should render empty content without crashing", () => {
    const msg = makeMsg({ role: "assistant", content: "" });
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.firstChild).toBeDefined();
  });
});
