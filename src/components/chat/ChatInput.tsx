import { useCallback, useRef, useState, useEffect, DragEvent, ClipboardEvent } from "react";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";
import { usePurchaseIntent } from "@/hooks/usePurchaseIntent";
import type { Attachment } from "@/lib/types";
import { listProviders } from "@/providers/registry";
import { ChevronDown, CheckCircle2, Zap, Lock } from "lucide-react";
import { ModeButtons } from "./ModeButtons";

// ─── Constants ─────────────────────────────────────────────────

const CHAR_LIMIT = 500000; // Frontier LLM limit
const PRO_MODELS = ["deepseek-reasoner", "gemini-2.5-pro"];

// ─── Props ─────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  disabled: boolean;
  /** Callback cuando el usuario escribe (para nudges de Aura) */
  onTextChange?: (text: string) => void;
  /** Texto a inyectar externamente (desde step chips de Aura) */
  injectText?: string;
}

// ─── Component ─────────────────────────────────────────────────

/**
 * Área de entrada multilineal con soporte para adjuntos y Drag & Drop.
 */
export function ChatInput({ onSend, disabled, onTextChange, injectText }: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const sessions = useChatStore(s => s.sessions);

  const plan = useAuthStore(s => s.plan);
  const { setIntent } = usePurchaseIntent();
  const [isUploading, setIsUploading] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle injected text from Aura step chips
  useEffect(() => {
    if (injectText) {
      setText(injectText);
      onTextChange?.(injectText);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [injectText, onTextChange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  const processFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isLarge = file.size > 5 * 1024 * 1024; // > 5MB

    if (isLarge) {
      if (plan !== "pro") {
        setIntent("large_file");
        return;
      }
      
      try {
        setIsUploading(true);
        // Solicitar URL prefirmada
        const token = localStorage.getItem("auth-token") || "";
        // El Storage API endpoint (dummy URL local por ahora o usar backend URL de AuthStore si existiera, pero podemos apuntar a /api/storage/presign si tenemos un proxy, u obtener el host del backend de la store)
        // Por ahora lo haremos de forma simple:
        const backendHost = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"; // Fallback para local
        
        const res = await fetch(`${backendHost}/storage/presign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" })
        });
        
        if (!res.ok) throw new Error("Error obteniendo URL de S3");
        
        const { uploadUrl, fileUrl } = await res.json();
        
        // Subir a S3
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
        
        if (!uploadRes.ok) throw new Error("Error subiendo el archivo a S3");
        
        setAttachments(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            contentType: file.type || "application/octet-stream",
            data: fileUrl, // S3 URL instead of Base64
            size: file.size
          }
        ]);
        
      } catch (err: any) {
        setUploadError("Error al subir archivo: " + err.message);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const data = e.target?.result as string;
      setAttachments(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          contentType: file.type || "text/plain",
          data,
          size: file.size
        }
      ]);
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }, [plan, setIntent]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(processFile);
    }
    // Reset para permitir seleccionar el mismo archivo de nuevo
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processFile]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file);
      }
    }
  }, [processFile]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  }, [processFile]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    setUploadError(null);
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setText("");
    setAttachments([]);
  }, [text, attachments, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === "ArrowUp" && text === "") {
        e.preventDefault();
        const session = sessions[activeSessionId];
        if (session) {
          const userMessages = session.messages.filter(m => m.role === "user");
          if (userMessages.length > 0) {
            setText(userMessages[userMessages.length - 1].content);
          }
        }
      }
    },
    [handleSend, text, sessions, activeSessionId],
  );

  const isOverLimit = text.length >= CHAR_LIMIT;
  const activeModelId = useChatStore(s => s.activeModelId);
  const setActiveModelId = useChatStore(s => s.setActiveModelId);
  const setActiveProvider = useChatStore(s => s.setActiveProvider);
  
  const allProviders = listProviders();
  
  const configuredProvidersStr = localStorage.getItem("vibe-byok-configured");
  const configuredProviders: string[] = configuredProvidersStr ? JSON.parse(configuredProvidersStr) : [];
  
  const visibleProviders = allProviders.map(p => {
    if (p.tier === "free") return p;
    if (configuredProviders.includes(p.id)) return p;
    return null;
  }).filter(Boolean) as typeof allProviders;

  const selectedModelName = allProviders.flatMap(p => p.models).find(m => m.id === activeModelId)?.name || "Seleccionar modelo";

  return (
    <div 
      className={`border-t border-white/5 p-4 bg-obsidian-900/60 backdrop-blur-3xl transition-colors ${isDragging ? "bg-aura-purple/10" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Modos de IA — Activación rápida */}
      <ModeButtons onActivate={(mode, prompt) => {
        useChatStore.getState().setActiveMode(mode);
        setText(prompt);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }} />

      {/* Zona de adjuntos */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map(att => (
            <div key={att.id} className="relative group flex items-center gap-2 bg-obsidian-800/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80">
              {att.contentType.startsWith("image/") ? (
                <div className="w-6 h-6 rounded bg-black overflow-hidden">
                  <img src={att.data} alt="thumbnail" className="w-full h-full object-cover opacity-80" />
                </div>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5"/></svg>
              )}
              <span className="max-w-[150px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(att.id)} aria-label={`Eliminar adjunto ${att.name}`} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-red-400 hover:text-red-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline upload error (replaces native alert) */}
      {uploadError && (
        <div role="alert" className="flex items-center justify-between mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
          <span>⚠️ {uploadError}</span>
          <button onClick={() => setUploadError(null)} aria-label="Cerrar error" className="text-red-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      <div className="relative flex items-end gap-2 p-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md transition-all duration-300 focus-within:ring-2 focus-within:ring-aura-purple/40 focus-within:border-aura-purple/50 focus-within:shadow-[0_0_20px_rgba(168,85,247,0.15)] focus-within:bg-white/10">
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          onChange={handleFileChange}
          aria-label="Seleccionar archivos para adjuntar"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Adjuntar archivo o imagen"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/50 hover:text-aura-purple hover:bg-white/5 transition-all disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= CHAR_LIMIT) {
              setText(e.target.value);
              onTextChange?.(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Escribe, pega imágenes o arrastra archivos aquí..."
          disabled={disabled}
          rows={Math.min(text.split('\n').length || 1, 10)}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white/90 placeholder-white/40 outline-none disabled:opacity-50 min-h-[40px] max-h-[250px] overflow-y-auto"
        />
        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          aria-label="Enviar mensaje"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-lg transition-all duration-300 ${
            (text.trim() || attachments.length > 0) && !disabled
              ? "bg-gradient-to-br from-aura-cyan to-aura-purple hover:scale-105 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-95"
              : "bg-obsidian-800/50 text-white/30 opacity-60"
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={(text.trim() || attachments.length > 0) && !disabled ? "translate-x-0.5" : ""}
          >
            <path
              d="M1.5 1.5L14.5 8L1.5 14.5L3.5 8L1.5 1.5Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <span className={`text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-full border ${plan === 'pro' ? 'text-vibe-cyan/80 bg-vibe-cyan/5 border-vibe-cyan/20' : plan === 'estudiante' ? 'text-aura-purple/80 bg-aura-purple/5 border-aura-purple/20' : 'text-slate-400 bg-slate-800 border-white/10'}`}>
            {isUploading ? "Subiendo..." : plan === "pro" ? "Opita Pro" : plan === "estudiante" ? "Estudiante" : "Plan Gratis"}
          </span>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
              aria-label="Seleccionar modelo de IA"
            >
              {selectedModelName.includes("Opita") ? (
                <span className="flex items-center text-aura-purple font-bold tracking-wider">
                  <Zap className="w-3 h-3 mr-1" />
                  {selectedModelName}
                </span>
              ) : (
                <span className="truncate max-w-[120px]">{selectedModelName}</span>
              )}
              <ChevronDown className={`w-3 h-3 opacity-50 transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            
            {isModelDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-obsidian-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in-up origin-bottom-left max-h-64 overflow-y-auto">
                {visibleProviders.map(p => (
                  <div key={p.id} className="mb-2 last:mb-0">
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
                      {p.name} {p.tier === "free" ? "(Gratis)" : "(BYOK)"}
                    </div>
                    {p.models.map(m => {
                      const isProLocked = plan !== "pro" && PRO_MODELS.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (isProLocked) {
                              setIntent("pro_model");
                              setIsModelDropdownOpen(false);
                            } else {
                              setActiveModelId(m.id);
                              setActiveProvider(p.id);
                              setIsModelDropdownOpen(false);
                            }
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between ${
                            activeModelId === m.id ? "bg-aura-purple/20 text-aura-purple" : "text-white/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span className={`flex items-center ${isProLocked ? "opacity-50" : ""}`}>
                            {m.name.includes("Opita") ? (
                              <strong className={`flex items-center font-bold ${activeModelId === m.id || isProLocked ? "" : "text-aura-purple"}`}>
                                <Zap className="w-3 h-3 mr-1" />
                                {m.name}
                              </strong>
                            ) : (
                              m.name
                            )}
                          </span>
                          {isProLocked ? (
                            <Lock className="w-3 h-3 text-aura-purple opacity-50" />
                          ) : activeModelId === m.id ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {visibleProviders.length === 1 && visibleProviders[0].tier === "free" && (
                  <div className="px-2 py-2 text-[10px] text-white/40 italic text-center border-t border-white/5 mt-1">
                    Conecta tus API Keys en Configuración para ver más modelos.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-medium tracking-wide uppercase ${isOverLimit ? "text-red-400" : "text-white/40"}`}>
          {isOverLimit ? "Límite alcanzado" : `~${Math.round(text.length / 4)} tokens`}
        </span>
      </div>
    </div>
  );
}
