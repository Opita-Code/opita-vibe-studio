import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../../src/App";

describe("App Layout", () => {
  it("should render the explorer sidebar", () => {
    render(<App />);
    expect(screen.getByText("Explorador")).toBeDefined();
  });

  it("should render the editor area", () => {
    render(<App />);
    expect(screen.getByText("Editor de código")).toBeDefined();
  });

  it("should render the chat panel", () => {
    render(<App />);
    expect(screen.getByText("Chat")).toBeDefined();
  });

  it("should render the live preview toggle button", () => {
    render(<App />);
    expect(screen.getByText("Vista Previa")).toBeDefined();
  });

  it("should render the status bar", () => {
    render(<App />);
    expect(screen.getByText("DeepSeek")).toBeDefined();
    expect(screen.getByText("deepseek-chat")).toBeDefined();
  });

  it("should render the status message 'Listo'", () => {
    render(<App />);
    expect(screen.getByText("Listo")).toBeDefined();
  });
});
