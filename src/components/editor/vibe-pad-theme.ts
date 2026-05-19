/**
 * Vibe Pad — Tema Aura para CodeMirror 6.
 *
 * Colores del design system Vibe Studio.
 * CSS-first: cada selector es controlable, sin widgets blancos.
 */

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// ─── Color Tokens ───────────────────────────────────────────────

const aura = {
  bg: "#09090b",
  surface: "#121217",
  elevated: "#1c1c21",
  cyan: "#06b6d4",
  purple: "#a855f7",
  blue: "#3b82f6",
  text: "#e2e8f0",
  textSecondary: "#475569",
  textMuted: "#334155",
  border: "rgba(255,255,255,0.06)",
} as const;

// ─── Editor Theme ───────────────────────────────────────────────

export const vibePadTheme = EditorView.theme(
  {
    // Root
    "&": {
      backgroundColor: aura.bg,
      color: aura.text,
      fontSize: "14px",
      height: "100%",
    },

    // Content area
    ".cm-content": {
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontVariantLigatures: "contextual",
      caretColor: aura.cyan,
      padding: "24px 0",
      lineHeight: "1.6",
    },

    // Cursor
    "&.cm-focused .cm-cursor": {
      borderLeftColor: aura.cyan,
      borderLeftWidth: "2px",
    },

    // Selection
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: `${aura.cyan}33`,
      },

    // Gutters
    ".cm-gutters": {
      backgroundColor: aura.bg,
      color: aura.textSecondary,
      border: "none",
      paddingLeft: "4px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 4px",
      minWidth: "3em",
    },

    // Active line
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255,255,255,0.04)",
      color: aura.text,
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255,255,255,0.04)",
    },

    // Matching brackets
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: `${aura.cyan}26`,
      outline: `1px solid ${aura.cyan}40`,
    },

    // Fold gutter
    ".cm-foldGutter .cm-gutterElement": {
      color: aura.textMuted,
      transition: "color 0.2s",
    },
    ".cm-foldGutter .cm-gutterElement:hover": {
      color: aura.text,
    },

    // Search matches
    ".cm-searchMatch": {
      backgroundColor: `${aura.cyan}40`,
      borderRadius: "2px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: `${aura.cyan}60`,
    },

    // Tooltips — NO white boxes ever
    ".cm-tooltip": {
      backgroundColor: aura.surface,
      border: `1px solid ${aura.border}`,
      borderRadius: "8px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      color: aura.text,
    },
    ".cm-tooltip-autocomplete": {
      backgroundColor: aura.surface,
    },
    ".cm-tooltip-autocomplete > ul": {
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: "13px",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "4px 8px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(255,255,255,0.1)",
      color: aura.text,
    },
    ".cm-tooltip.cm-tooltip-hover": {
      backgroundColor: aura.surface,
      border: `1px solid ${aura.border}`,
    },

    // Panels (search panel, etc.)
    ".cm-panels": {
      backgroundColor: aura.surface,
      color: aura.text,
      borderBottom: `1px solid ${aura.border}`,
    },
    ".cm-panel input": {
      backgroundColor: aura.elevated,
      color: aura.text,
      border: `1px solid ${aura.border}`,
      borderRadius: "4px",
      padding: "4px 8px",
      outline: "none",
    },
    ".cm-panel input:focus": {
      borderColor: `${aura.cyan}80`,
    },
    ".cm-panel button": {
      backgroundColor: aura.elevated,
      color: aura.text,
      border: `1px solid ${aura.border}`,
      borderRadius: "4px",
      padding: "4px 8px",
      cursor: "pointer",
    },
    ".cm-panel button:hover": {
      backgroundColor: "rgba(255,255,255,0.1)",
    },

    // Scrollbar
    ".cm-scroller": {
      overflow: "auto",
      scrollbarWidth: "thin",
      scrollbarColor: `rgba(255,255,255,0.1) transparent`,
    },

    // Navigate highlight (used by navigate-highlight extension)
    ".cm-vibe-highlight": {
      background: `linear-gradient(90deg, ${aura.cyan}20 0%, transparent 100%)`,
      borderLeft: `3px solid ${aura.cyan}`,
    },

    // Agent gutter marker (used by agent-gutter extension)
    ".cm-agent-marker": {
      color: aura.purple,
      fontSize: "8px",
      lineHeight: "inherit",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    // Agent activity shimmer
    "&.cm-agent-building::before": {
      content: '""',
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      height: "2px",
      background: `linear-gradient(90deg, transparent, ${aura.cyan}80, ${aura.purple}80, transparent)`,
      backgroundSize: "200% 100%",
      animation: "vibe-shimmer 2s linear infinite",
      zIndex: "10",
    },
  },
  { dark: true },
);

// ─── Syntax Highlighting ────────────────────────────────────────

const vibePadHighlightStyle = HighlightStyle.define([
  // Keywords
  { tag: tags.keyword, color: "#c084fc" }, // purple-400
  { tag: tags.controlKeyword, color: "#c084fc" },
  { tag: tags.definitionKeyword, color: "#c084fc" },
  { tag: tags.moduleKeyword, color: "#c084fc" },
  { tag: tags.operatorKeyword, color: "#c084fc" },

  // Strings
  { tag: tags.string, color: "#86efac" }, // green-300
  { tag: tags.special(tags.string), color: "#86efac" },

  // Numbers
  { tag: tags.number, color: "#fde68a" }, // amber-200
  { tag: tags.integer, color: "#fde68a" },
  { tag: tags.float, color: "#fde68a" },

  // Comments
  { tag: tags.comment, color: "#475569", fontStyle: "italic" }, // slate-600
  { tag: tags.lineComment, color: "#475569", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#475569", fontStyle: "italic" },
  { tag: tags.docComment, color: "#64748b", fontStyle: "italic" }, // slate-500

  // Functions
  { tag: tags.function(tags.variableName), color: "#67e8f9" }, // cyan-300
  { tag: tags.function(tags.definition(tags.variableName)), color: "#67e8f9" },

  // Types
  { tag: tags.typeName, color: "#7dd3fc" }, // sky-300
  { tag: tags.className, color: "#7dd3fc" },
  { tag: tags.namespace, color: "#7dd3fc" },

  // JSX/HTML tags
  { tag: tags.tagName, color: "#7dd3fc" }, // sky-300
  { tag: tags.attributeName, color: "#c4b5fd" }, // violet-300
  { tag: tags.attributeValue, color: "#86efac" }, // green-300

  // Operators
  { tag: tags.operator, color: "#94a3b8" }, // slate-400
  { tag: tags.compareOperator, color: "#94a3b8" },
  { tag: tags.arithmeticOperator, color: "#94a3b8" },
  { tag: tags.logicOperator, color: "#94a3b8" },
  { tag: tags.bitwiseOperator, color: "#94a3b8" },

  // Variables & properties
  { tag: tags.variableName, color: "#e2e8f0" }, // slate-200
  { tag: tags.definition(tags.variableName), color: "#e2e8f0" },
  { tag: tags.propertyName, color: "#93c5fd" }, // blue-300
  { tag: tags.definition(tags.propertyName), color: "#93c5fd" },

  // Boolean & null
  { tag: tags.bool, color: "#fbbf24" }, // amber-400
  { tag: tags.null, color: "#f87171" }, // red-400

  // Punctuation & brackets
  { tag: tags.punctuation, color: "#64748b" }, // slate-500
  { tag: tags.paren, color: "#94a3b8" },
  { tag: tags.squareBracket, color: "#94a3b8" },
  { tag: tags.brace, color: "#94a3b8" },
  { tag: tags.angleBracket, color: "#94a3b8" },
  { tag: tags.separator, color: "#64748b" },

  // Regex
  { tag: tags.regexp, color: "#fb923c" }, // orange-400

  // Meta
  { tag: tags.meta, color: "#64748b" },
  { tag: tags.annotation, color: "#a78bfa" }, // violet-400

  // Escape sequences
  { tag: tags.escape, color: "#f472b6" }, // pink-400

  // Invalid
  { tag: tags.invalid, color: "#f43f5e", textDecoration: "underline wavy" }, // rose-500
]);

export const vibePadHighlight = syntaxHighlighting(vibePadHighlightStyle);
