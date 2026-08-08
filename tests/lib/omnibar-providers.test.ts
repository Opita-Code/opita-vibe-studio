import { describe, it, expect } from "vitest";
import { filterOmniItems, OMNI_ITEMS } from "../../src/lib/omnibar-providers";

describe("filterOmniItems", () => {
  const items = [
    { id: "1", title: "Nuevo Archivo", category: "Commands" as const, iconType: "command" as const, keywords: ["archivo", "file"], action: "NEW_FILE" },
    { id: "2", title: "Nuevo Chat", subtitle: "Conversación limpia", category: "Chats" as const, iconType: "chat" as const, action: "NEW_CHAT" },
    { id: "3", title: "Configuración", category: "Settings" as const, iconType: "settings" as const, action: "OPEN_SETTINGS" },
  ];

  it("should return all items for an empty query", () => {
    expect(filterOmniItems("", items)).toEqual(items);
    expect(filterOmniItems("   ", items)).toEqual(items);
  });

  it("should filter Commands with the > prefix", () => {
    const result = filterOmniItems(">archivo", items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter Chats with the @ prefix", () => {
    const result = filterOmniItems("@chat", items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should match by title", () => {
    const result = filterOmniItems("configurac", items);
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("should match by subtitle", () => {
    const result = filterOmniItems("limpia", items);
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("should match by keyword", () => {
    const result = filterOmniItems("file", items);
    expect(result.map((i) => i.id)).toEqual(["1"]);
  });

  it("should match case-insensitively", () => {
    const result = filterOmniItems("NUEVO", items);
    expect(result.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("should return nothing for unmatched queries", () => {
    expect(filterOmniItems("zzz", items)).toEqual([]);
  });
});

describe("OMNI_ITEMS", () => {
  it("should expose a non-empty catalog", () => {
    expect(OMNI_ITEMS.length).toBeGreaterThan(0);
  });

  it("should have unique ids", () => {
    const ids = OMNI_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should include settings items", () => {
    expect(OMNI_ITEMS.some((i) => i.category === "Settings")).toBe(true);
    expect(OMNI_ITEMS.some((i) => i.action === "OPEN_AI_SETTINGS")).toBe(true);
  });

  it("should expose command items with actions", () => {
    const newFile = OMNI_ITEMS.find((i) => i.id === "cmd-new-file");
    expect(newFile?.action).toBe("NEW_FILE");
    expect(newFile?.category).toBe("Commands");
  });
});
