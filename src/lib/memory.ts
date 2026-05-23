/**
 * Engram — Persistent Memory for Vibe Studio Agent.
 *
 * Provides project-scoped memory that survives across chat sessions.
 * Integrated with @opita/memory-sdk for cloud sync (DynamoDB) and context decay.
 *
 * The agent can save decisions, patterns, bugfixes, and discoveries
 * and recall them in future sessions to maintain context continuity.
 */

import { CloudBridge, WebStorageAdapter, SyncEngine, ContextDecayEngine } from "@opita/memory-sdk";
import { useAuthStore } from "@/stores/auth";

// ─── Types ─────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  project: string;
  title: string;
  content: string;
  type: "decision" | "pattern" | "bugfix" | "discovery" | "convention";
  tags: string[];
  createdAt: number;
  sessionId?: string;
}

// ─── Constants ─────────────────────────────────────────────────

const MEMORIES_KEY = "sync:memories";
const MAX_MEMORIES_PER_PROJECT = 100;

// ─── SDK Initialization ────────────────────────────────────────

const apiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_DEV_API_URL || "https://api.opitacode.com";
const getAuthToken = async () => useAuthStore.getState().session?.token || null;
const serviceName = "vibe-studio";

export const cloudBridge = new CloudBridge({
  apiBaseUrl,
  getAuthToken,
  serviceName,
});

export const storageBackend = new WebStorageAdapter(serviceName);

export const decayEngine = new ContextDecayEngine();

export const syncEngine = new SyncEngine({
  storage: storageBackend,
  cloudBridge,
  decayEngine,
});

// ─── Internal Helpers ──────────────────────────────────────────

/** Load all memories from storage. */
async function loadAll(): Promise<MemoryEntry[]> {
  try {
    const raw = await storageBackend.get<string>(MEMORIES_KEY);
    if (!raw) return [];
    // WebStorageAdapter might return parsed object or string depending on env
    const entry = typeof raw === "string" ? JSON.parse(raw) : (raw as any);
    return Array.isArray(entry?.value) ? entry.value : [];
  } catch (err: unknown) {
    console.error("Error loading memories from storage:", err);
    return [];
  }
}

/** Persist all memories to storage and trigger background sync. */
async function persistAll(entries: MemoryEntry[]): Promise<void> {
  const timestamp = Date.now();
  await storageBackend.set(MEMORIES_KEY, JSON.stringify({ value: entries, timestamp }));
  
  // Trigger background sync if authenticated
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    syncEngine.push(userId).catch((err: unknown) => {
      console.warn("Background memories sync failed:", err);
    });
  }
}

/** Generate a unique ID. */
function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normaliza texto para búsqueda: quita acentos y diacríticos.
 * "función" → "funcion", "señal" → "senal"
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Strip combining diacritical marks
}

/**
 * Stop words en español — palabras demasiado comunes para indexar.
 * Incluye las más frecuentes del idioma + artículos/preposiciones.
 */
const STOP_WORDS_ES = new Set([
  // Artículos
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  // Preposiciones
  "de", "del", "en", "con", "por", "para", "sin", "sobre", "entre", "hacia", "hasta", "desde",
  // Conjunciones
  "que", "como", "pero", "porque", "cuando", "donde", "cual",
  // Pronombres
  "este", "esta", "ese", "esa", "esto", "eso", "estos", "esas",
  "lo", "le", "les", "nos", "se", "su", "sus", "mi", "mis", "tu", "tus",
  // Verbos comunes
  "es", "son", "ser", "fue", "hay", "tiene", "hacer", "puede",
  "está", "era", "han", "sido",
  // Adverbios
  "no", "si", "ya", "más", "muy", "también", "solo", "bien", "mal",
  // English common (el agente puede mezclar idiomas)
  "the", "is", "in", "on", "at", "to", "for", "of", "and", "or", "not",
  "was", "are", "has", "had", "this", "that", "with", "from", "but",
]);

/**
 * Extrae keywords de texto para indexación.
 * Optimizado para español: normaliza acentos, filtra stop words,
 * y mantiene términos técnicos (nombres de archivos, funciones, etc.)
 */
function extractKeywords(text: string): string[] {
  return normalize(text)
    .split(/[\s,.:;!?()[\]{}"'`/\\|<>#+*=~@&$%^_\-]+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOP_WORDS_ES.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i); // unique
}

/**
 * Puntúa una memoria contra una query de búsqueda.
 * Retorna 0 si no hay match. Mayor = mejor match.
 * Normaliza acentos para que "función" matchee "funcion".
 */
function scoreMatch(entry: MemoryEntry, queryWords: string[]): number {
  if (queryWords.length === 0) return 0;

  const entryText = normalize(`${entry.title} ${entry.content} ${entry.tags.join(" ")}`);
  let matches = 0;

  for (const word of queryWords) {
    const normalizedWord = normalize(word);
    if (entryText.includes(normalizedWord)) {
      matches++;
    }
  }

  if (matches === 0) return 0;

  // Ratio de coincidencia (0-1)
  const matchRatio = matches / queryWords.length;

  // Bonus de recencia: últimas 24h → 1.5x, última semana → 1.2x
  const ageMs = Date.now() - entry.createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  let recencyMultiplier = 1;
  if (ageHours < 24) recencyMultiplier = 1.5;
  else if (ageHours < 168) recencyMultiplier = 1.2;

  return matchRatio * recencyMultiplier;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Save a memory entry. Enforces per-project limit with FIFO eviction.
 */
export async function saveMemory(
  entry: Omit<MemoryEntry, "id" | "createdAt" | "tags">,
): Promise<MemoryEntry> {
  const all = await loadAll();

  const newEntry: MemoryEntry = {
    ...entry,
    id: generateId(),
    createdAt: Date.now(),
    tags: extractKeywords(`${entry.title} ${entry.content}`),
  };

  all.push(newEntry);

  // Enforce per-project limit (FIFO — remove oldest first)
  const projectEntries = all.filter((e) => e.project === entry.project);
  if (projectEntries.length > MAX_MEMORIES_PER_PROJECT) {
    const toRemove = projectEntries.length - MAX_MEMORIES_PER_PROJECT;
    // Sort by createdAt ascending (oldest first)
    const oldest = projectEntries
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, toRemove);
    const removeIds = new Set(oldest.map((e) => e.id));
    const filtered = all.filter((e) => !removeIds.has(e.id));
    await persistAll(filtered);
    return newEntry;
  }

  await persistAll(all);
  return newEntry;
}

/**
 * Search memories by keyword matching with recency weighting.
 * Returns top matches sorted by relevance score.
 */
export async function searchMemories(
  project: string,
  query: string,
  limit: number = 5,
): Promise<MemoryEntry[]> {
  const all = await loadAll();
  const projectEntries = all.filter((e) => e.project === project);
  const queryWords = extractKeywords(query);

  if (queryWords.length === 0) {
    // No meaningful query — return most recent
    return projectEntries
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  const scored = projectEntries
    .map((entry) => ({ entry, score: scoreMatch(entry, queryWords) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.entry);
}

/**
 * Get the N most recent memories for a project.
 */
export async function getRecentMemories(
  project: string,
  limit: number = 5,
): Promise<MemoryEntry[]> {
  const all = await loadAll();
  return all
    .filter((e) => e.project === project)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/**
 * Delete a specific memory by ID.
 */
export async function deleteMemory(id: string): Promise<boolean> {
  const all = await loadAll();
  const before = all.length;
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length === before) return false;
  await persistAll(filtered);
  return true;
}

/**
 * Clear all memories for a project.
 */
export async function clearProjectMemories(project: string): Promise<number> {
  const all = await loadAll();
  const before = all.length;
  const filtered = all.filter((e) => e.project !== project);
  await persistAll(filtered);
  return before - filtered.length;
}

/**
 * Get count of memories for a project.
 */
export async function getMemoryCount(project: string): Promise<number> {
  const all = await loadAll();
  return all.filter((e) => e.project === project).length;
}

// ─── Test Helpers ──────────────────────────────────────────────

/** @internal — exposed for testing only */
export { extractKeywords as _extractKeywords, scoreMatch as _scoreMatch, normalize as _normalize };
