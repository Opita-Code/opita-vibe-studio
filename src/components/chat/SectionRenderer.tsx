/**
 * SectionRenderer — Renders a single MessageSection by type.
 *
 * This is the switch component that delegates to section-specific renderers.
 * Used by MessageBubble when a message has structured sections.
 */

import type { MessageSection } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ApplyCodeBlock } from "@/components/chat/ApplyCodeBlock";
import { ThinkingChip } from "@/components/chat/ThinkingChip";
import { NoticeSection } from "@/components/chat/NoticeSection";

interface SectionRendererProps {
  section: MessageSection;
}

export function SectionRenderer({ section }: SectionRendererProps) {
  switch (section.type) {
    case "thinking":
      return (
        <ThinkingChip
          content={section.content}
          label={section.label}
          defaultCollapsed={section.collapsed ?? true}
        />
      );

    case "text":
      return (
        <div className="prose prose-invert max-w-none prose-sm prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className ?? "");
                const code = String(children).replace(/\n$/, "");

                if (!match) {
                  return (
                    <code
                      className="rounded bg-black/40 px-1 text-aura-cyan"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return <ApplyCodeBlock code={code} language={match[1]} />;
              },
            }}
          >
            {section.content || ""}
          </ReactMarkdown>
        </div>
      );

    case "code":
      return (
        <ApplyCodeBlock
          code={section.content}
          language={section.language || "typescript"}
        />
      );

    case "notice":
      return <NoticeSection content={section.content} />;

    // steps and summary are handled by existing AgentExecution widgets
    // They don't come through sections (yet), so we render as text fallback
    case "steps":
    case "summary":
      return (
        <div className="text-xs text-white/50 italic">
          {section.content}
        </div>
      );

    default:
      return null;
  }
}
