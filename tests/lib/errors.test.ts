import { describe, it, expect } from "vitest";
import { extractErrorMessage } from "../../src/lib/errors";

describe("extractErrorMessage", () => {
  it("should return the message of Error instances", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("should return plain strings as-is", () => {
    expect(extractErrorMessage("cadena")).toBe("cadena");
  });

  it("should return the message property of plain objects", () => {
    expect(extractErrorMessage({ message: "obj message" })).toBe("obj message");
  });

  it("should stringify non-string message properties", () => {
    expect(extractErrorMessage({ message: 42 })).toBe("42");
  });

  it("should return the fallback for unknown values", () => {
    expect(extractErrorMessage(null)).toBe("Error desconocido");
    expect(extractErrorMessage(undefined)).toBe("Error desconocido");
    expect(extractErrorMessage(42)).toBe("Error desconocido");
  });

  it("should respect a custom fallback", () => {
    expect(extractErrorMessage(null, "Fallback custom")).toBe("Fallback custom");
  });
});
