import { useState } from "react";
import { useCustomToolsStore } from "@/stores/custom-tools";
import type { CustomToolDef } from "@/agent/stream-client";
import { Plus, Trash2, Pencil, Check, X, Wrench } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  parametersJson: string;
}

const EMPTY_FORM: FormState = { name: "", description: "", parametersJson: "" };

// ─── Helpers ────────────────────────────────────────────────────

/** Validates that the parameters text is valid JSON (object or array). */
function parseParameters(raw: string): { ok: boolean; error?: string; value?: Record<string, unknown> } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: {} };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Los parámetros deben ser un objeto JSON, ej: {\"type\": \"string\"}" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "JSON inválido. Revisa comillas, llaves y comas." };
  }
}

function toForm(tool: CustomToolDef): FormState {
  return {
    name: tool.name,
    description: tool.description,
    parametersJson:
      tool.parameters && Object.keys(tool.parameters).length > 0
        ? JSON.stringify(tool.parameters, null, 2)
        : "",
  };
}

// ─── Component ──────────────────────────────────────────────────

export function CustomToolsPanel() {
  const tools = useCustomToolsStore((s) => s.tools);
  const addTool = useCustomToolsStore((s) => s.addTool);
  const removeTool = useCustomToolsStore((s) => s.removeTool);
  const updateTool = useCustomToolsStore((s) => s.updateTool);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAX = 10;
  const isEditing = editingName !== null;
  const atLimit = tools.length >= MAX && !isEditing;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingName(null);
    setError(null);
  };

  const startEdit = (tool: CustomToolDef) => {
    setForm(toForm(tool));
    setEditingName(tool.name);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const description = form.description.trim();

    if (!name) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      setError("El nombre debe empezar por letra y usar solo minúsculas, números y guión bajo.");
      return;
    }
    if (!description) {
      setError("La descripción es obligatoria (el agente la usa para decidir cuándo invocar la tool).");
      return;
    }

    const params = parseParameters(form.parametersJson);
    if (!params.ok) {
      setError(params.error ?? "Parámetros inválidos.");
      return;
    }

    const tool: CustomToolDef = {
      name,
      description,
      parameters: params.value ?? {},
    };

    if (isEditing) {
      updateTool(editingName!, tool);
    } else {
      if (tools.some((t) => t.name === name)) {
        setError(`Ya existe una herramienta llamada "${name}".`);
        return;
      }
      addTool(tool);
    }
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-glass rounded-xl border border-glass">
        <div className="flex items-center gap-3 mb-2">
          <Wrench size={16} className="text-aura-cyan" />
          <h3 className="text-sm font-semibold text-slate-200">
            Herramientas Personalizadas
          </h3>
          <span className="ml-auto text-[10px] font-mono text-slate-500">
            {tools.length}/{MAX}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Define herramientas propias que el agente puede invocar durante la generación de código.
          Cada herramienta necesita un nombre único, una descripción clara (para que la IA sepa cuándo
          usarla) y un esquema JSON de parámetros opcional.
        </p>

        {tools.length === 0 && (
          <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-white/10 rounded-lg">
            No hay herramientas personalizadas todavía. Crea la primera con el formulario de abajo.
          </div>
        )}

        {tools.length > 0 && (
          <ul className="space-y-2 mb-4" data-testid="custom-tools-list">
            {tools.map((tool) => (
              <li
                key={tool.name}
                className="flex items-start gap-3 p-3 bg-obsidian-900/50 rounded-lg border border-white/5"
                data-testid={`custom-tool-item-${tool.name}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-aura-cyan">{tool.name}</span>
                    {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                        {Object.keys(tool.parameters).length} parámetros
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{tool.description}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(tool)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-aura-cyan hover:bg-aura-cyan/10 transition-colors"
                    aria-label={`Editar ${tool.name}`}
                    data-testid={`edit-tool-${tool.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => removeTool(tool.name)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label={`Eliminar ${tool.name}`}
                    data-testid={`delete-tool-${tool.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!atLimit && (
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="custom-tool-form">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300">
                {isEditing ? `Editar "${editingName}"` : "Nueva herramienta"}
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] uppercase font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  <X size={12} /> Cancelar
                </button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ej: search_weather"
                  disabled={isEditing}
                  className="w-full px-3 py-2 bg-obsidian-950/60 border border-white/10 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-aura-cyan/50 disabled:opacity-40 transition-colors"
                  data-testid="tool-name-input"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Parámetros (JSON)</label>
                <input
                  value={form.parametersJson}
                  onChange={(e) => setForm({ ...form, parametersJson: e.target.value })}
                  placeholder='ej: {"city": {"type": "string"}}'
                  className="w-full px-3 py-2 bg-obsidian-950/60 border border-white/10 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-aura-cyan/50 transition-colors"
                  data-testid="tool-params-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Descripción *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe qué hace la herramienta y cuándo debe usarla el agente..."
                rows={2}
                className="w-full px-3 py-2 bg-obsidian-950/60 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-aura-cyan/50 resize-none transition-colors"
                data-testid="tool-description-input"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400" data-testid="custom-tool-error" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aura-cyan/15 border border-aura-cyan/30 text-aura-cyan text-xs font-semibold hover:bg-aura-cyan/25 transition-colors"
                data-testid="tool-submit-btn"
              >
                {isEditing ? <Check size={14} /> : <Plus size={14} />}
                {isEditing ? "Guardar cambios" : "Agregar herramienta"}
              </button>
              {atLimit && (
                <span className="text-[10px] text-slate-500">
                  Límite de {MAX} herramientas alcanzado — edita o elimina una para crear otra.
                </span>
              )}
            </div>
          </form>
        )}

        {atLimit && (
          <p className="text-[10px] text-slate-500 mt-2">
            Límite de {MAX} herramientas alcanzado. Elimina una para agregar otra.
          </p>
        )}
      </div>
    </div>
  );
}
