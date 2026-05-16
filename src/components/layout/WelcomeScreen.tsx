import { useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { getFileSystemBackend } from "@/lib/fs-backend";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "@/lib/templates";
import { vibeEventBus } from "@/lib/vibe-events";
import vibeLogoUrl from "@/assets/vibe-logo.svg";
import {
  Rocket,
  User,
  CheckSquare,
  FolderOpen,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

// ─── Icon Map ───────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Rocket> = {
  Rocket,
  User,
  CheckSquare,
};

// ─── Template Card ──────────────────────────────────────────────

function TemplateCard({
  template,
  onSelect,
}: {
  template: ProjectTemplate;
  onSelect: (t: ProjectTemplate) => void;
}) {
  const Icon = ICON_MAP[template.icon] || Rocket;
  const fileCount = Object.keys(template.files).length;

  return (
    <button
      onClick={() => onSelect(template)}
      className="group relative flex flex-col items-start gap-3 p-4 rounded-xl
        bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm
        hover:border-white/15 hover:bg-white/[0.04]
        transition-all duration-300 text-left w-full
        hover:shadow-[0_0_30px_rgba(139,92,246,0.08)]
        active:scale-[0.98]"
    >
      {/* Gradient accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl opacity-50 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(90deg, ${template.gradient[0]}, ${template.gradient[1]})`,
        }}
      />

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${template.gradient[0]}20, ${template.gradient[1]}20)`,
        }}
      >
        <Icon
          className="w-4.5 h-4.5"
          style={{ color: template.gradient[0] }}
        />
      </div>

      {/* Text */}
      <div>
        <h3 className="text-sm font-semibold text-white/90 mb-0.5 group-hover:text-white transition-colors">
          {template.name}
        </h3>
        <p className="text-xs text-white/40 leading-relaxed">
          {template.description}
        </p>
      </div>

      {/* File count badge */}
      <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">
        {fileCount} archivo{fileCount !== 1 ? "s" : ""}
      </span>
    </button>
  );
}

// ─── Welcome Screen ─────────────────────────────────────────────

export function WelcomeScreen() {
  const openProject = useProjectStore((s) => s.openProject);
  const scaffoldTemplate = useProjectStore((s) => s.scaffoldTemplate);

  const handleOpenFolder = useCallback(async () => {
    try {
      const backend = getFileSystemBackend();
      if (!backend.isAvailable()) return;
      const path = await backend.selectDirectory();
      if (path) {
        await openProject(path);
        useUIStore.getState().setActiveSidebar("explorer");
        useUIStore.getState().setActiveView("editor");
      }
    } catch {
      // User cancelled or error
    }
  }, [openProject]);

  const handleAskAI = () => {
    useUIStore.getState().setActiveSidebar("chat");
    const input = document.querySelector('textarea[placeholder*="mensaje"]');
    if (input instanceof HTMLTextAreaElement) {
      input.focus();
    }
  };

  const handleSelectTemplate = useCallback(
    (template: ProjectTemplate) => {
      scaffoldTemplate(template);
      import("@/lib/vibe-events").then(({ vibeEvents }) => {
        vibeEvents.emit({ type: "template_used", templateId: template.id });
      });
      useUIStore.getState().setActiveSidebar("explorer");
      useUIStore.getState().setActiveView("split");
      useUIStore.getState().setVibeLensEnabled(true);
    },
    [scaffoldTemplate],
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-4 relative overflow-hidden bg-obsidian-950">
      {/* Subtle background orbs */}
      <div
        className="absolute top-[-15%] right-[-10%] w-[40%] h-[40%] rounded-full bg-aura-purple/[0.03] blur-[80px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] rounded-full bg-aura-cyan/[0.03] blur-[60px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-8 max-w-lg w-full z-10">
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-3 opacity-80">
          <img
            src={vibeLogoUrl}
            alt="Vibe Studio"
            className="w-10 h-10 opacity-50 grayscale"
          />
          <p className="text-xs font-mono text-white/20 uppercase tracking-[0.2em]">
            Vibe Studio
          </p>
        </div>

        {/* Template gallery */}
        <div className="w-full">
          <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3 text-center">
            Comienza con un template
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROJECT_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onSelect={handleSelectTemplate}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] text-white/15 uppercase tracking-widest">
            o
          </span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 text-xs font-mono text-white/30 uppercase tracking-widest">
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 hover:text-white/70 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Abrir Carpeta
          </button>
          <span className="opacity-20">•</span>
          <button
            onClick={handleAskAI}
            className="flex items-center gap-1.5 hover:text-aura-cyan/70 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Preguntar a IA
          </button>
          <span className="opacity-20">•</span>
          <a
            href="/"
            className="flex items-center gap-1.5 hover:text-aura-purple/70 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Conoce Vibe Studio
          </a>
        </div>
      </div>
    </div>
  );
}
