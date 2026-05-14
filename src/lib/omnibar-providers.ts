export type OmniCategory = "Commands" | "Files" | "Chats" | "Settings" | "AI";

export interface OmniItem {
  id: string;
  title: string;
  subtitle?: string;
  category: OmniCategory;
  iconType: "file" | "command" | "chat" | "settings" | "ai" | "bug";
  keywords?: string[];
  action: string; // Identifier for the action to execute in the UI
}

export function filterOmniItems(query: string, items: OmniItem[]): OmniItem[] {
  if (!query.trim()) return items;
  
  const lowerQuery = query.toLowerCase();
  
  // Contextual prefix filtering
  if (lowerQuery.startsWith(">")) {
    const cmdQuery = lowerQuery.slice(1).trim();
    return items.filter(i => i.category === "Commands" && i.title.toLowerCase().includes(cmdQuery));
  }
  
  if (lowerQuery.startsWith("@")) {
    const chatQuery = lowerQuery.slice(1).trim();
    return items.filter(i => i.category === "Chats" && i.title.toLowerCase().includes(chatQuery));
  }

  // General fuzzy search
  return items.filter(i => 
    i.title.toLowerCase().includes(lowerQuery) || 
    (i.subtitle && i.subtitle.toLowerCase().includes(lowerQuery)) ||
    (i.keywords && i.keywords.some(k => k.toLowerCase().includes(lowerQuery)))
  );
}

// Mock providers for demonstration of the OmniBar capabilities
export const OMNI_ITEMS: OmniItem[] = [
  // Commands
  { id: "cmd-new-file", title: "Nuevo Archivo", category: "Commands", iconType: "command", keywords: ["create", "nuevo", "archivo", "file"], action: "NEW_FILE" },
  { id: "cmd-report-bug", title: "Reportar Bug", subtitle: "Envía feedback al equipo", category: "Commands", iconType: "bug", keywords: ["bug", "error", "feedback", "report"], action: "REPORT_BUG" },
  { id: "cmd-toggle-theme", title: "Alternar Tema Oscuro/Claro", category: "Commands", iconType: "command", keywords: ["theme", "tema", "dark", "light"], action: "TOGGLE_THEME" },
  
  // Settings
  { id: "set-editor", title: "Configuración del Editor", subtitle: "Ajusta tipografía, tabulaciones y atajos", category: "Settings", iconType: "settings", keywords: ["settings", "configuracion", "editor", "font"], action: "OPEN_SETTINGS" },
  { id: "set-ai", title: "Ajustes de Vibe AI", subtitle: "Modelos, contexto y proveedores", category: "Settings", iconType: "ai", keywords: ["ai", "vibe", "llm", "model"], action: "OPEN_AI_SETTINGS" },


];
